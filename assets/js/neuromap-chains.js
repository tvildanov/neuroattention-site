/* A concept may belong to many recordings. Each recording gets its own
   visible occurrence while the stored concept remains shared. */
(function (root) {
  'use strict';
  // Stored walks have occurrence IDs. Older databases may only have diary rows,
  // aggregate concept pairs, or isolated concepts. Never traverse those pairs
  // to manufacture a recording shared by unrelated visits.
  function withArchive(graph, diary) {
    const chains = (graph.chains || []).filter(chain => chain.node_ids.length).slice();
    const recorded = new Set(chains.flatMap(chain => chain.node_ids.map(String)));
    if (graph.nodes.every(node => recorded.has(String(node.id)))) return { ...graph, chains };
    const covered = new Set(recorded);
    const concepts = new Map(graph.nodes.map(node => [String(node.id), node]));
    const lookup = new Map();
    const termKey = node => JSON.stringify([node.type, String(node.label).trim().toLowerCase(), node.valence || 'neutral']);
    for (const node of graph.nodes) lookup.set(termKey(node), String(node.id));
    if (diary) {
      const matches = new Map(diary.nodes.map(n => [n.id, lookup.get(termKey(n))]));
      for (const row of diary.chains) {
        const ids = row.node_ids.map(id => matches.get(id));
        if (ids.some(id => !id) || ids.every(id => recorded.has(id))) continue;
        chains.push({ ...row, node_ids: ids });
        ids.forEach(id => covered.add(id));
      }
    }
    const fromDiary = new Set(covered);
    const pairs = new Set();
    function archive(id, ids, date, kind) {
      chains.push({ id, session_id: null, node_ids: ids, started_at: date, finished_at: date, archive_kind: kind });
      ids.forEach(id => covered.add(id));
    }
    for (const link of graph.links || []) {
      const a = concepts.get(String(link.source)), b = concepts.get(String(link.target));
      if (!a || !b || (fromDiary.has(String(a.id)) && fromDiary.has(String(b.id)))) continue;
      const sensation = a.type === 'sensation' ? a : b, area = sensation === a ? b : a;
      if (sensation.type !== 'sensation' || !isBody(area)) continue;
      const ids = [String(area.id), String(sensation.id)], key = ids.join(':');
      if (pairs.has(key)) continue;
      pairs.add(key);
      archive('pair:' + key, ids, link.last_seen_at || sensation.last_seen_at, 'pair');
    }
    for (const [id, node] of concepts) {
      if (!covered.has(id)) archive('item:' + id, [id], node.last_seen_at || node.created_at, 'item');
    }
    return { ...graph, chains };
  }

  function isBody(node) {
    return node?.type === 'area' && (node.metadata?.area_kind === 'body' || node.metadata?.source === 'sensation');
  }

  function occurrenceGraph(graph, inRange) {
    const concepts = new Map(graph.nodes.map(node => [String(node.id), node]));
    const chained = new Set();
    const occurrences = new Map();
    const nodes = [];
    const links = [];
    for (const chain of graph.chains) {
      const time = Date.parse(chain.started_at);
      const visible = inRange(time);
      let previous = null;
      const visibleAt = new Map();
      const bodyAt = new Set();
      const bodyLinks = [];
      // The sensation form writes all picked locations followed by the felt sensations.
      // Bind each sensation to the locations in its own saved step. For older sessions
      // without payload labels, the adjacent location block is the evidence available.
      const recordedArea = (item, index) => isBody(item) ||
        (item?.type === 'area' && chain.body_locations?.[index]?.includes(item.label));
      let areas = [], wasSensation = false;
      for (const [i, id] of chain.node_ids.entries()) {
        const item = concepts.get(String(id));
        if (chain.positions && i && chain.positions[i] !== chain.positions[i - 1] + 1) areas = [];
        if (recordedArea(item, i)) {
          if (wasSensation) areas = [];
          wasSensation = false;
          areas.push(i);
        } else if (item?.type === 'sensation') {
          const labels = chain.body_locations?.[i];
          for (const pos of areas) {
            if (labels?.length && !labels.includes(concepts.get(String(chain.node_ids[pos])).label)) continue;
            bodyAt.add(pos);
            bodyLinks.push([pos, i]);
          }
          wasSensation = true;
        } else {
          areas = [];
          wasSensation = false;
        }
      }
      for (const [index, nodeId] of chain.node_ids.entries()) {
        const key = String(nodeId);
        chained.add(key);
        const concept = concepts.get(key);
        if (!visible || !concept) {
          previous = null;
          continue;
        }
        const id = chain.id + ':' + index;
        const node = { ...concept, id, concept_id: key, session_id: chain.session_id,
          recorded_intensity: chain.intensities?.[index],
          metadata: recordedArea(concept, index) ? { ...concept.metadata, area_kind: 'body' } : concept.metadata,
          position: chain.positions?.[index] ?? index, chain_id: chain.id,
          last_seen_at: chain.started_at, created_at: chain.started_at };
        nodes.push(node);
        const occurrenceKey = JSON.stringify([chain.session_id, key]);
        if (chain.session_id && !occurrences.has(occurrenceKey)) occurrences.set(occurrenceKey, id);
        visibleAt.set(index, id);
        if (chain.positions && index && chain.positions[index] !== chain.positions[index - 1] + 1) previous = null;
        if (!bodyAt.has(index)) {
          if (previous) links.push({ source: previous, target: id, count: 1, chain_ids: [chain.id] });
          previous = id;
        }
      }
      for (const [area, sensation] of bodyLinks) {
        if (visibleAt.has(area) && visibleAt.has(sensation)) {
          links.push({ source: visibleAt.get(area), target: visibleAt.get(sensation), count: 1, chain_ids: [chain.id] });
        }
      }
    }
    const legacy = new Set();
    for (const concept of graph.nodes) {
      const id = String(concept.id);
      if (!chained.has(id) && inRange(Date.parse(concept.last_seen_at))) {
        legacy.add(id);
        nodes.push(concept);
      }
    }
    for (const link of graph.links) {
      if (legacy.has(String(link.source)) && legacy.has(String(link.target))) links.push(link);
    }
    for (const link of graph.explicit_links || []) {
      const locate = (session, node) => occurrences.get(JSON.stringify([session, String(node)]))
        || (legacy.has(String(node)) ? String(node) : null);
      const source = locate(link.source_session, link.source);
      const target = locate(link.target_session, link.target);
      if (source && target && source !== target) links.push({ source, target, count: 1, kind: 'correlation' });
    }
    const frequency=new Map();
    for(const node of nodes){
      if(node.concept_id)frequency.set(node.concept_id,(frequency.get(node.concept_id)||0)+1);
    }
    for(const node of nodes){
      if(node.concept_id){node.count=frequency.get(node.concept_id);node.chain_ids=[node.chain_id];}
    }
    return { nodes, links };
  }
  function groupedGraph(graph, inRange) {
    const occurrences = occurrenceGraph(graph, inRange);
    const ids = new Map();
    const nodes = new Map();
    const links = new Map();
    for (const node of occurrences.nodes) {
      const id = String(node.concept_id || node.id);
      ids.set(String(node.id), id);
      let group = nodes.get(id);
      if (!group) {
        group = {
          ...node, id, concept_id: id, session_id: undefined, position: undefined,
          count: 0, chain_ids: []
        };
        nodes.set(id, group);
      }
      group.count += node.concept_id ? 1 : (node.count || 1);
      if (node.chain_id!=null && !group.chain_ids.includes(node.chain_id)) group.chain_ids.push(node.chain_id);
      if (node.last_seen_at > group.last_seen_at) group.last_seen_at = node.last_seen_at;
      if (node.created_at < group.created_at) group.created_at = node.created_at;
    }
    for (const edge of occurrences.links) {
      const source = ids.get(String(edge.source));
      const target = ids.get(String(edge.target));
      if (!source || !target || source === target) continue;
      const correlation = edge.kind === 'correlation';
      const key = JSON.stringify([source, target, correlation]);
      let group = links.get(key);
      if (!group) {
        group = { ...edge, source, target, count: 0, chain_ids: new Set() };
        links.set(key, group);
      }
      group.count += edge.count || 1;
      for (const chain of edge.chain_ids || []) group.chain_ids.add(chain);
    }
    return {
      nodes: [...nodes.values()],
      links: [...links.values()].map(edge => ({ ...edge, chain_ids: [...edge.chain_ids] }))
    };
  }
  function branchPositions(chains,nodes,width,height) {
    const positions=new Map();
    const byId=new Map(nodes.map(node=>[String(node.id),node]));
    const visible=chains.map(chain=>chain.node_ids.map(String).filter(id=>byId.has(id))).filter(ids=>ids.length);
    const columns=Math.max(1,Math.min(visible.length,Math.ceil(Math.sqrt(visible.length*width/height))));
    const rows=Math.max(1,Math.ceil(visible.length/columns));
    const cellW=(width-80)/columns, cellH=(height-80)/rows;
    visible.forEach((ids,index)=>{
      const known=ids.findIndex(id=>positions.has(id));
      const anchor=positions.get(ids[known]);
      const cx=40+(index%columns+.5)*cellW, cy=40+(Math.floor(index/columns)+.5)*cellH;
      const angle=anchor?index*2.399963:(index%2===0 ? .2 : -.2);
      const step=Math.min(116,cellW*.84/Math.max(1,ids.length-1));
      ids.forEach((id,i)=>{
        if(positions.has(id))return;
        const offset=(anchor?i-known:i-(ids.length-1)/2)*step;
        positions.set(id,{x:Math.max(40,Math.min(width-40,(anchor?.x??cx)+Math.cos(angle)*offset)),
          y:Math.max(40,Math.min(height-40,(anchor?.y??cy)+Math.sin(angle)*offset))});
      });
    });
    return positions;
  }
  function dragBranch(node,nodes,preferred) {
    const ids=node.chainIds||[];
    const chain=ids.find(id=>String(id)===String(preferred)) ?? (ids.length===1?ids[0]:null);
    return chain==null?[]:nodes.filter(other=>other!==node&&(other.chainIds||[]).length===1&&other.chainIds.includes(chain));
  }
  if (typeof module !== 'undefined') {
    module.exports = occurrenceGraph;
    module.exports.withArchive = withArchive;
    module.exports.groupedGraph = groupedGraph;
    module.exports.branchPositions = branchPositions;
    module.exports.dragBranch = dragBranch;
  } else {
    root.nmWithArchive = withArchive;
    root.nmOccurrenceGraph = occurrenceGraph;
    root.nmGroupedGraph = groupedGraph;
    root.nmBranchPositions = branchPositions;
    root.nmDragBranch = dragBranch;
  }
})(typeof window === 'undefined' ? null : window);
