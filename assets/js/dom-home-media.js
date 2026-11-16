/* Background videos: prepare near the viewport; play only while actually visible. */
(function(){'use strict';
function init(){
 const videos=[...document.querySelectorAll('video[autoplay]')],visible=new Set();
 const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
 function themedStatic(v){return !!v.closest('.dom-insight-orb') && v.closest('#screen-4').dataset.attentionView!=='drop';}
 function prepare(v){if(v.dataset.naPrepared)return;v.dataset.naPrepared='1';v.querySelectorAll('source[data-src]').forEach(s=>{s.src=s.dataset.src;});v.preload='metadata';v.load();}
 function play(v){if(document.hidden||reduce.matches||themedStatic(v)||!visible.has(v)||v.dataset.naNoAutoplay==='1'){v.pause();return;}prepare(v);v.muted=true;v.playsInline=true;const p=v.play();if(p&&p.catch)p.catch(()=>{});}
 videos.forEach(v=>{v.removeAttribute('autoplay');v.pause();});
 if('IntersectionObserver'in window){
  const prepareObserver=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){prepare(e.target);prepareObserver.unobserve(e.target);}}),{rootMargin:'320px'});
  const playObserver=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)visible.add(e.target);else visible.delete(e.target);play(e.target);}),{threshold:.05});
  videos.forEach(v=>{prepareObserver.observe(v);playObserver.observe(v);});
 }else{const refresh=()=>videos.forEach(v=>{const r=v.getBoundingClientRect();if(r.top<innerHeight&&r.bottom>0)visible.add(v);else visible.delete(v);play(v);});window.addEventListener('scroll',refresh,{passive:true});refresh();}
 document.addEventListener('visibilitychange',()=>videos.forEach(play));
 document.addEventListener('domthemechange',()=>videos.forEach(play));
 document.addEventListener('domattentionviewchange',()=>videos.forEach(play));
 reduce.addEventListener('change',()=>videos.forEach(play));
 const retry=()=>visible.forEach(play);window.addEventListener('pointerdown',retry,{passive:true});window.addEventListener('keydown',retry);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
