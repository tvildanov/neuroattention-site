(() => {
  'use strict';
  const motion = matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)');
  const cards = '.dom-v06-program-card,.level-card,.prog-card,.dom-card,.dom-v06-research-card,.dom-v06-subscription,.card-hover,.hero-route-card,#client-dashboard .dash-card';
  const buttons = '.btn,body:not(.home-matrix) .nav-logo-dom,body.dom-account-matrix button:not(.nm-chip)';
  let card;
  let button;
  function reset(node) {
    if (!node) return;
    node.classList.remove('dom-pointer-active');
    for (const property of ['--dom-pointer-x','--dom-pointer-y','--dom-hover-x','--dom-hover-y']) node.style.removeProperty(property);
  }
  function follow(node, event, isCard) {
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    const x = event.clientX - rect.left + (parseFloat(style.getPropertyValue('--dom-pointer-x')) || 0);
    const y = event.clientY - rect.top + (parseFloat(style.getPropertyValue('--dom-pointer-y')) || 0);
    const limit = isCard ? 4 : 5;
    const clamp = value => Math.max(-limit, Math.min(limit, value));
    node.classList.add('dom-pointer-surface','dom-pointer-active');
    if (isCard) node.classList.add('dom-pointer-card','dom-card-lit');
    node.style.setProperty('--dom-pointer-x',clamp((x-rect.width/2)*.12)+'px');
    node.style.setProperty('--dom-pointer-y',clamp((y-rect.height/2)*.13)+'px');
    node.style.setProperty('--dom-hover-x',x+'px');
    node.style.setProperty('--dom-hover-y',y+'px');
    node.style.setProperty('--dom-light-x',x+'px');
    node.style.setProperty('--dom-light-y',y+'px');
  }
  function clear() {
    reset(card);
    card?.classList.remove('dom-card-lit');
    reset(button);
    card = button = null;
  }
  document.addEventListener('pointermove',event => {
    if (!motion.matches || event.pointerType === 'touch') {clear();return;}
    if (!(event.target instanceof Element)) return;
    const nextButton = event.target.closest(buttons);
    const nextCard = event.target.closest(cards);
    if (nextButton !== button) reset(button);
    if (nextCard !== card) {reset(card);card?.classList.remove('dom-card-lit');}
    button = nextButton;
    card = nextCard;
    if (!event.buttons) {follow(card,event,true);follow(button,event,false);}
  },{passive:true});
  document.addEventListener('pointerleave',clear);
  motion.addEventListener('change',clear);
})();
