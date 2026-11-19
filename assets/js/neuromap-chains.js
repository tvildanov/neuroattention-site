/* A concept may belong to many recordings. Each recording gets its own
   visible occurrence while the stored concept remains shared. */
(function (root) {
  'use strict';
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
          position: chain.positions?.[index] ?? index, chain_id: chain.id,
          last_seen_at: chain.started_at, created_at: chain.started_at };
        nodes.push(node);
        const occurrenceKey = JSON.stringify([chain.session_id, key]);
        if (!occurrences.has(occurrenceKey)) occurrences.set(occurrenceKey, id);
        if (previous) links.push({ source: previous, target: id, count: 1, chain_ids: [chain.id] });
        previous = id;
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
    const slot=Math.max(2,Math.ceil(Math.sqrt(visible.length)));
    const stride=Math.min(116,width/Math.max(slot,4));
    visible.forEach((ids,index)=>{
      const known=ids.findIndex(id=>positions.has(id));
      const origin=known<0 ? {x:width*(.2+.58*((index%slot+.5)/slot)),y:height*(.15+.7*((Math.floor(index/slot)+.5)/Math.ceil(visible.length/slot)))} : positions.get(ids[known]);
      const angle=index*2.399963229728653;
      ids.forEach((id,step)=>{
        if(positions.has(id))return;
        const d=(step-Math.max(0,known))*stride;
        positions.set(id,{x:Math.max(45,Math.min(width-45,origin.x+Math.cos(angle)*d)),y:Math.max(45,Math.min(height-45,origin.y+Math.sin(angle)*d))});
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
    module.exports.groupedGraph = groupedGraph;
    module.exports.branchPositions = branchPositions;
    module.exports.dragBranch = dragBranch;
  } else {
    root.nmOccurrenceGraph = occurrenceGraph;
    root.nmGroupedGraph = groupedGraph;
    root.nmBranchPositions = branchPositions;
    root.nmDragBranch = dragBranch;
  }
})(typeof window === 'undefined' ? null : window);
