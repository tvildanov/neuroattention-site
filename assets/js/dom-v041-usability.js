/* Local reading controls only: no account, application or profile data is reset. */
(()=>{'use strict';
const words={ru:{more:'Продолжение ниже',hint:'Прокрутите текст или нажмите ↓',top:'К началу текста',reset:'Начать путь заново',resetHint:'Сбросить только прогресс просмотра сайта',done:'Путь сброшен. Начните с 01.',lines:['DOM как экосистема','для следующего этапа','человеческого развития']},en:{more:'Continue reading below',hint:'Scroll the text or press ↓',top:'Back to the start',reset:'Restart the journey',resetHint:'Reset website exploration progress only',done:'Journey reset. Start with 01.',lines:['DOM as an ecosystem','for the next stage','of human development']},es:{more:'El texto continúa abajo',hint:'Desplaza el texto o pulsa ↓',top:'Volver al inicio del texto',reset:'Reiniciar el recorrido',resetHint:'Restablecer solo el progreso de exploración',done:'Recorrido reiniciado. Empieza por 01.',lines:['DOM como ecosistema','para la siguiente etapa','del desarrollo humano']}};
const copy=()=>words[document.documentElement.lang]||words.en,reduce=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
const regions=[];let currentLang='';
const eco=document.querySelector('.dom-eco-panels');if(eco)eco.id='dom-eco-reading';
function sizeReading(){const section=document.getElementById('dom-ecosystem'),heading=section.querySelector('.dom-ecosystem-diagram-heading'),style=getComputedStyle(section),h2=heading.querySelector('h2');section.style.setProperty('--eco-reading-height',Math.max(180,innerHeight-70-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)-heading.offsetHeight-parseFloat(getComputedStyle(h2).marginBottom)-24)+'px');}

for(const id of ['dom-eco-reading','dom-space-detail','dom-lab-detail','dom-direction-detail']){
 const panel=document.getElementById(id);if(!panel)continue;panel.classList.add('dom-v041-reading');
 const shell=document.createElement('div');shell.className='dom-v041-scroll';shell.dataset.scrollRegion=id;panel.before(shell);shell.append(panel);
 panel.tabIndex=0;panel.setAttribute('role','region');const heading=panel.querySelector('h3,h4');if(heading){heading.id=heading.id||id+'-heading';panel.setAttribute('aria-labelledby',heading.id);}
 const cue=document.createElement('button');cue.type='button';cue.className='dom-v041-scroll-cue';cue.setAttribute('aria-controls',id);shell.append(cue);
 const update=()=>{shell.hidden=panel.hidden;const capacity=panel.clientHeight+(cue.hidden?0:cue.offsetHeight);const overflow=!panel.hidden&&panel.scrollHeight>capacity+3;const bottom=panel.scrollTop+panel.clientHeight>=panel.scrollHeight-5;shell.classList.toggle('can-scroll',overflow);shell.classList.toggle('has-more',overflow&&!bottom);cue.hidden=!overflow;cue.textContent=(bottom?'↑ ':'↓ ')+(bottom?copy().top:copy().more);cue.title=copy().hint;};
 cue.addEventListener('click',()=>{const bottom=panel.scrollTop+panel.clientHeight>=panel.scrollHeight-5;panel.scrollTo({top:bottom?0:Math.min(panel.scrollHeight,panel.scrollTop+panel.clientHeight*.8),behavior:reduce()?'instant':'smooth'});});
 // Keep the same reading surface in control at boundaries and over its cue.
 shell.addEventListener('wheel',event=>{if(event.ctrlKey||event.metaKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)||panel.hidden||panel.scrollHeight<=panel.clientHeight+3)return;event.preventDefault();event.stopPropagation();const unit=event.deltaMode===1?18:event.deltaMode===2?panel.clientHeight:1;panel.scrollTop+=event.deltaY*unit;},{passive:false});
 panel.addEventListener('scroll',update,{passive:true});new ResizeObserver(update).observe(panel);regions.push({panel,shell,update});
}
const octagon='<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="7,1 17,1 23,7 23,17 17,23 7,23 1,17 1,7"/></svg>';
document.querySelectorAll('.dom-v03-rail>a').forEach(a=>{a.innerHTML=octagon;});
const reset=document.createElement('button');reset.type='button';reset.className='dom-v041-reset';reset.innerHTML=octagon+'<svg class="dom-v041-reset-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.5 8A7 7 0 1 0 19 15M19 4v5h-5"/></svg>';document.querySelector('.dom-v03-rail')?.append(reset);
const mobileReset=reset.cloneNode(true);mobileReset.classList.add('dom-v041-reset-mobile');document.body.append(mobileReset);
const status=document.createElement('p');status.className='dom-v041-reset-status';status.setAttribute('role','status');status.hidden=true;document.body.append(status);let statusTimer;
for(const button of [reset,mobileReset])button.addEventListener('click',()=>{window.DOMJourney.reset();status.textContent=copy().done;status.hidden=false;clearTimeout(statusTimer);statusTimer=setTimeout(()=>status.hidden=true,4500);});
function refresh(){for(const {update}of regions)update();const lang=document.documentElement.lang;if(lang!==currentLang){currentLang=lang;const heading=document.querySelector('#dom-ecosystem .dom-ecosystem-diagram-heading h2');if(heading){heading.replaceChildren(...copy().lines.map(text=>{const line=document.createElement('span');line.textContent=text;return line;}));}for(const button of [reset,mobileReset]){button.setAttribute('aria-label',copy().reset);button.title=copy().reset+' · '+copy().resetHint;}}
 sizeReading();requestAnimationFrame(()=>regions.forEach(({update})=>update()));}
new ResizeObserver(()=>{sizeReading();regions.forEach(({update})=>update());}).observe(document.querySelector('#dom-ecosystem .dom-ecosystem-diagram-heading'));
document.addEventListener('domjourneychange',refresh);document.addEventListener('langchange',refresh);window.addEventListener('resize',refresh,{passive:true});refresh();
// Rotate the source without re-encoding its stored pixels.
const map=document.querySelectorAll('#dom-observation-cards .media-box img')[1];if(map){map.classList.add('dom-v041-map-image');const box=map.closest('.media-box');const measure=()=>{box.style.setProperty('--map-width',box.clientWidth+'px');box.style.setProperty('--map-height',box.clientHeight+'px');};new ResizeObserver(measure).observe(box);measure();}
// A genuine source frame for reduced motion, rather than a replacement illustration.
const drop=document.querySelector('#screen-4 .dom-attention-drop');drop?.addEventListener('loadedmetadata',()=>{if(reduce()&&drop.duration>3.7)drop.currentTime=3.7;});
window.DOMV041UI={inventory:()=>[...document.querySelectorAll('section img,section video')].map(n=>{const r=n.getBoundingClientRect(),style=getComputedStyle(n);return {file:n.currentSrc||n.src||n.querySelector('source')?.src,sourceWidth:n.naturalWidth||n.videoWidth||0,sourceHeight:n.naturalHeight||n.videoHeight||0,cssWidth:r.width,cssHeight:r.height,dpr:devicePixelRatio,fit:style.objectFit,filter:style.filter,transform:style.transform};})};
})();
