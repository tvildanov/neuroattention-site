/* A point of light switches appearance without replacing navigation or content. */
(()=>{'use strict';const html=document.documentElement,button=document.querySelector('[data-theme-switch]');if(!button)return;
const reduced=matchMedia('(prefers-reduced-motion:reduce)');let switching=false;
function labels(){const light=html.dataset.domTheme==='light',lang=html.lang;const label=lang==='en'?(light?'Switch to night theme':'Switch to day theme'):lang==='es'?(light?'Activar tema nocturno':'Activar tema diurno'):(light?'Включить ночную тему':'Включить дневную тему');button.setAttribute('aria-label',label);button.title=label;button.setAttribute('aria-pressed',String(light));}
function setTheme(theme){html.dataset.domTheme=theme;try{localStorage.setItem('dom_theme',theme);}catch(e){}labels();document.dispatchEvent(new CustomEvent('domthemechange',{detail:{theme}}));}
labels();document.addEventListener('langchange',labels);
button.addEventListener('click',async()=>{if(switching)return;const next=html.dataset.domTheme==='light'?'dark':'light';const rect=button.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;try{if(navigator.vibrate&&!reduced.matches)navigator.vibrate(8);}catch(e){}
if(reduced.matches){setTheme(next);return;}
switching=true;try{if(document.startViewTransition){const transition=document.startViewTransition(()=>setTheme(next));await transition.ready;const radius=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));await html.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${radius}px at ${x}px ${y}px)`]},{duration:620,easing:'cubic-bezier(.22,1,.36,1)',pseudoElement:'::view-transition-new(root)'}).finished;}else{setTheme(next);button.classList.remove('is-switching');void button.offsetWidth;button.classList.add('is-switching');setTimeout(()=>button.classList.remove('is-switching'),650);}}catch(e){setTheme(next);}finally{switching=false;}});
})();
