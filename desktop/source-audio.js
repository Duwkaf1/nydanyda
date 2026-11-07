// Read only rendered translation controls. Never return option values, player
// configurations, stream URLs or tokens to the local renderer.
export function sourceAudioDOM(action) {
 const label=element=>String(element.textContent||element.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim().slice(0,120);
 const visible=element=>!!element.getClientRects().length&&!element.disabled;
 const controls=[...document.querySelectorAll('select')].filter(element=>{
  const context=[element.id,element.name,element.getAttribute('aria-label'),...([...element.labels||[]].map(label=>label.textContent)),element.parentElement?.className].join(' ');
  // Custom select widgets often hide their original <select> permanently.
  return !element.disabled&&/translat|dubbing|voice|audio|озвуч|перевод/i.test(context)&&element.options.length>0&&element.options.length<=100;
 });
 const videos=[...document.querySelectorAll('video')].filter(video=>visible(video)&&video.audioTracks?.length>1&&video.audioTracks.length<=100);
 const trackLabel=(track,index)=>String(track.label||track.language||`Дорожка ${index+1}`).slice(0,120);
 if(action?.kind==='select'&&action.control>=controls.length){const tracks=videos[action.control-controls.length]?.audioTracks,track=tracks?.[action.index];if(!track||trackLabel(track,action.index)!==action.label)throw new Error('Список дорожек изменился. Обнови его.');for(let index=0;index<tracks.length;index++)tracks[index].enabled=index===action.index;return true;}
 const control=controls[action?.control||0];
 if(action?.kind==='select'){
  const option=control?.options[action.index];
  if(!option||option.disabled||label(option)!==action.label)throw new Error('Список озвучек изменился. Обнови его.');
  control.selectedIndex=action.index;
  control.dispatchEvent(new Event('input',{bubbles:true}));control.dispatchEvent(new Event('change',{bubbles:true}));return true;
 }
 return [...controls.slice(0,4).map((element,control)=>({control,options:[...element.options].map((option,index)=>({index,label:label(option),selected:option.selected,disabled:option.disabled})).filter(option=>option.label)})),...videos.slice(0,2).map((video,index)=>({control:controls.length+index,options:Array.from({length:video.audioTracks.length},(_,index)=>({index,label:trackLabel(video.audioTracks[index],index),selected:video.audioTracks[index].enabled,disabled:false}))}))];
}
export const sourceAudioScript=action=>`(${sourceAudioDOM.toString()})(${JSON.stringify(action||{})})`;
