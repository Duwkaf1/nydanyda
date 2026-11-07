export function sourceWorkspace(){
 const panel=document.querySelector('#source-workspace'),host=document.querySelector('#source-host'),audio=document.querySelector('#source-audio');let current,frame,audioSignature='';
 const bridge=window.kadr;
 const measure=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(panel.hidden)return;const rect=host.getBoundingClientRect();bridge?.sourceBounds?.({x:Math.max(0,rect.x),y:Math.max(0,rect.y),width:Math.max(0,rect.width),height:Math.max(0,rect.height)}).catch(()=>{});});};
 const close=()=>bridge?.sourceAction?.('close').catch(()=>{});
 function update(value){const wasOpen=current?.open;current=value;if(value.open&&!wasOpen)window.dispatchEvent(new Event('yoru-source-opened'));panel.hidden=!value.open;document.body.classList.toggle('source-open',!!value.open);if(!value.open){if(wasOpen)document.querySelector('#content').focus({preventScroll:true});return;}
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close('source');
  document.querySelector('#source-title').textContent=value.title;
  document.querySelector('#source-status').textContent=value.error||(value.loading?'Загружаем страницу…':value.host);
  document.querySelector('#source-back').disabled=!value.canBack;document.querySelector('#source-forward').disabled=!value.canForward;
  const signature=JSON.stringify([value.loading,value.audio||[]]);
  if(signature!==audioSignature){audioSignature=signature;audio.replaceChildren();for(const [group,control]of (value.audio||[]).entries())for(const option of control.options){const element=document.createElement('option');element.value=group+':'+option.index;element.textContent=option.label;element.disabled=option.disabled;element.selected=option.selected;audio.append(element);}audio.disabled=!audio.options.length;
   if(!audio.options.length){const option=document.createElement('option');option.textContent=value.loading?'Загружаем варианты…':'Выбор внутри плеера источника';audio.append(option);}
  }
  document.querySelector('#source-audio-hint').textContent=audio.disabled?'Если список пуст, открой настройки озвучки в самом плеере.':'Реальные варианты озвучки с текущей страницы.';
  document.querySelector('#source-search-row').hidden=value.key!=='cinema-lordfilm';measure();
 }
 bridge?.onSourceState?.(update);
 new ResizeObserver(measure).observe(panel);window.addEventListener('resize',measure);
 document.querySelector('#source-close').onclick=close;
 for(const action of ['back','forward','reload','fullscreen'])document.querySelector('#source-'+action).onclick=()=>bridge?.sourceAction?.(action).catch(()=>{});
 document.querySelector('#source-audio-refresh').onclick=()=>bridge?.sourceAction?.('audio').catch(()=>{});
 audio.onchange=async()=>{const [group,index]=audio.value.split(':').map(Number);audio.disabled=true;try{await bridge.sourceAudio({group,index,revision:current.revision});}catch(error){document.querySelector('#source-audio-hint').textContent=String(error.message).replace(/^Error invoking remote method '[^']+': Error: /,'');}finally{audio.disabled=false;}};
 document.querySelector('#source-search-row').onsubmit=async event=>{event.preventDefault();try{await bridge.sourceSearch(document.querySelector('#source-search').value);}catch(error){document.querySelector('#source-status').textContent=String(error.message).replace(/^Error invoking remote method '[^']+': Error: /,'');}};
 document.addEventListener('keydown',event=>{if(!panel.hidden&&current?.key==='cinema-lordfilm'&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();event.stopImmediatePropagation();document.querySelector('#source-search').focus();}});
 return {close};
}
