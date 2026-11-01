import {icon} from './icons.js';
export const clockTime=value=>{if(!Number.isFinite(value)||value<0)return '--:--';const total=Math.floor(value);return total>=3600?`${Math.floor(total/3600)}:${String(Math.floor(total/60)%60).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`:`${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;};
export function playerControls({host,fullscreen,status}){
 let detach=()=>{},adapter,bar,interval,dragging=false;let stage;
 const element=(tag,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;return n;};
 function stop(){clearInterval(interval);detach();detach=()=>{};adapter=null;bar?.remove();stage?.remove();stage=null;host.querySelector('.yoru-return-controls')?.remove();host.classList.remove('has-yoru-controls','provider-controls-open');delete host.dataset.chromePlaying;}
 function attach(value){
  stop();adapter=value;host.classList.add('has-yoru-controls');bar=element('div','yoru-controls');bar.setAttribute('role','group');bar.setAttribute('aria-label','Управление просмотром Yoru');
  const button=(name,graphic,action)=>{const b=element('button','yoru-player-button');b.type='button';b.title=name;b.setAttribute('aria-label',name);b.append(icon(graphic));b.onclick=()=>Promise.resolve(action()).catch(()=>status('Не удалось выполнить команду плеера. Попробуй ещё раз.'));return b;};
  const timeline=element('input','yoru-timeline');timeline.type='range';timeline.min='0';timeline.max='0';timeline.step='.1';timeline.value='0';timeline.setAttribute('aria-label','Позиция воспроизведения');
  const time=element('output','yoru-time');time.setAttribute('aria-live','off');
  const play=button('Воспроизвести','play',()=>{const s=adapter.state();return s.paused?adapter.play():adapter.pause();});play.dataset.testid='yoru-play';
  const back=button('Назад на 10 секунд','rewind',()=>adapter.seek(Math.max(0,adapter.state().time-10)));back.classList.add('yoru-back');
  const mute=button('Выключить звук','volume',()=>adapter.mute(!adapter.state().muted));
  const volume=element('input','yoru-volume');volume.type='range';volume.min='0';volume.max='1';volume.step='.05';volume.value='1';volume.setAttribute('aria-label','Громкость');volume.oninput=()=>adapter.volume(Number(volume.value));
  if(value.captureClicks){stage=element('button','yoru-video-stage');stage.type='button';stage.tabIndex=-1;stage.setAttribute('aria-hidden','true');stage.onclick=()=>play.click();host.append(stage);}
  const row=element('div','yoru-control-row');row.append(play,back,time,mute,volume);
  if(value.provider){
   const restore=button('Вернуться к панели Yoru','close',()=>{host.classList.remove('provider-controls-open');});restore.className='yoru-return-controls';restore.prepend(document.createTextNode('Панель Yoru '));host.append(restore);
   row.append(button('Качество и перевод в плеере','settings',()=>{value.providerControls?.();host.classList.add('provider-controls-open');}));
  }
  row.append(button('На весь экран','fullscreen',fullscreen));bar.append(timeline,row);host.append(bar);
  function render(){
   if(!adapter)return;const s=adapter.state();const duration=Number.isFinite(s.duration)&&s.duration>0?s.duration:0;host.dataset.chromePlaying=String(!s.paused);
   play.setAttribute('aria-label',s.paused?'Воспроизвести':'Пауза');play.title=s.paused?'Воспроизвести':'Пауза';play.replaceChildren(icon(s.paused?'play':'pause'));
   timeline.disabled=!duration||s.seeking===true;timeline.max=String(duration);if(!dragging)timeline.value=String(Math.max(0,Math.min(duration,s.time||0)));
   const display=Number(timeline.value);timeline.style.setProperty('--played',`${duration?display/duration*100:0}%`);timeline.style.setProperty('--buffered',`${duration?Math.max(display,Math.min(duration,s.buffered||0))/duration*100:0}%`);timeline.setAttribute('aria-valuetext',`${clockTime(display)} из ${clockTime(duration)}`);time.textContent=`${clockTime(display)} / ${clockTime(duration||NaN)}`;
   mute.setAttribute('aria-label',s.muted?'Включить звук':'Выключить звук');mute.title=s.muted?'Включить звук':'Выключить звук';mute.replaceChildren(icon(s.muted?'muted':'volume'));if(document.activeElement!==volume)volume.value=String(s.muted?0:s.volume??1);
  }
  timeline.oninput=()=>{dragging=true;render();};timeline.onchange=()=>{const target=Number(timeline.value);dragging=false;adapter.seek(target);render();};timeline.onpointercancel=()=>{dragging=false;render();};
  const click=event=>{if(event.target.closest('.yoru-controls,.yoru-return-controls')||adapter.provider)return;if(event.target.closest('video'))play.click();};host.addEventListener('click',click);detach=()=>host.removeEventListener('click',click);interval=setInterval(render,250);render();
 }
 function video(element){
  element.controls=false;attach({state:()=>({time:element.currentTime,duration:element.duration,paused:element.paused,muted:element.muted,volume:element.volume,seeking:element.seeking,buffered:element.buffered.length?element.buffered.end(element.buffered.length-1):0}),play:()=>element.play(),pause:()=>element.pause(),seek:time=>{element.currentTime=Math.min(Number.isFinite(element.duration)?element.duration:time,Math.max(0,time));},mute:muted=>{element.muted=muted;},volume:volume=>{element.volume=volume;element.muted=false;}});
 }
 return {attach,video,stop};
}
