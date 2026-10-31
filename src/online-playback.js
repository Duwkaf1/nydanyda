import {discoveryRequest} from './discovery-transport.js';
import {onlinePlayerEntries,animeEmbedURL} from './anime-online.js';
export function onlinePlayback({$,node,active,video,persist,enter,refresh,status,onTime,onEnded}){
 let preferred;try{preferred=JSON.parse(localStorage.getItem('yoru.online-last.v1')||'null');}catch{}
 let current=null,frame=null,detach=()=>{},request,key='',serial=0,time=null,restore=0,awaitingSeek=false,reported=false,wrongEpisode=false;
 const players=()=>active()?.episode.onlinePlayers||[];
 function stop(){detach();detach=()=>{};frame?.remove();frame=null;current=null;time=null;reported=false;}
 function command(value){if(frame&&current&&/kodik|aniqit/.test(new URL(current.url).hostname))frame.contentWindow?.postMessage({key:'kodik_player_api',value},new URL(current.url).origin);}
 function select(id){const player=players().find(p=>p.id===id);if(!player)return false;
  const native=video();const checkpoint=(time??(native?.readyState>=1?native.currentTime:active()?.checkpoint))||0;enter();current=player;restore=checkpoint;awaitingSeek=checkpoint>0;time=null;reported=false;wrongEpisode=false;
  const value=active();preferred={titleId:value.title.id,voice:player.voice,player:player.player};try{localStorage.setItem('yoru.online-last.v1',JSON.stringify(preferred));}catch{}value.watching.audioMode=player.audioType==='original'?'original':'dub';value.external=player;$('#watch-audio-mode').value=value.watching.audioMode;
  frame=node('iframe');frame.title=`${player.player} · ${player.voice}`;frame.className='online-player';frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-presentation');frame.allow='autoplay; fullscreen; encrypted-media; picture-in-picture';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
  frame.src=animeEmbedURL(player.url);$('#video-host').append(frame);
  const option=node('option','В плеере');option.value='provider';$('#quality option[value="provider"]')?.remove();$('#quality').append(option);$('#quality').value='provider';$('#quality').disabled=true;
  $('#player-engine').disabled=true;$('#retry-button').hidden=true;status(`${player.voice} · ${player.player} · нажми воспроизведение в плеере`);
  $('#online-status').textContent='Разрешение и оформление субтитров выбираются внутри этого плеера. Позиция сохраняется, когда плеер передаёт её Yoru.';
  const selectedFrame=frame;const origin=new URL(player.url).origin;
  const message=event=>{
   if(event.source!==selectedFrame.contentWindow||event.origin!==origin||frame!==selectedFrame)return;
   let data=event.data;try{if(typeof data==='string')data=JSON.parse(data);}catch{return;}
   if(!data||typeof data.key!=='string'||!/kodik|aniqit/.test(new URL(player.url).hostname))return;
   if(data.key==='kodik_player_current_episode'&&Number.isFinite(data.value?.episode)&&data.value.episode!==active()?.episode.number){reported=false;wrongEpisode=true;status('Серия изменена внутри плеера. Выбирай серии в Yoru, чтобы сохранить правильную историю.');return;}
   if(['kodik_player_video_started','kodik_player_duration_update'].includes(data.key)&&awaitingSeek)command({method:'seek',seconds:restore});
   const seconds=['kodik_player_time_update','kodik_player_time'].includes(data.key)?data.value:data.key==='kodik_player_seek'?data.value?.time:null;
   if(!wrongEpisode&&typeof seconds==='number'&&Number.isFinite(seconds)&&seconds>=0&&seconds<604800){if(awaitingSeek&&Math.abs(seconds-restore)>.75)return;awaitingSeek=false;time=seconds;reported=true;onTime(seconds);$('#online-status').textContent='Позиция этого плеера сохраняется в Yoru. Разрешение и оформление перевода выбираются в самом плеере.';}
   if(data.key==='kodik_player_play')status(`${player.voice} · ${player.player} · воспроизведение`);
   if(data.key==='kodik_player_pause')status(`${player.voice} · ${player.player} · пауза`);
   if(data.key==='kodik_player_video_ended'&&reported)onEnded();
  };
  window.addEventListener('message',message);selectedFrame.onerror=()=>status('Плеер не загрузился. Выбери другой плеер или озвучку в списке под видео.');detach=()=>window.removeEventListener('message',message);refresh();return true;
 }
 async function load(force=false){
  const value=active();if(!value?.title.catalog){request?.abort();key='';$('#online-status').hidden=true;$('#retry-online').hidden=true;return;}
  if(preferred?.titleId===value.title.id){value.session.paused=true;video()?.pause();}
  const next=`${value.title.id}:${value.episode.id}`;if(!force&&key===next&&(request||value.episode.onlinePlayers!==undefined))return;request?.abort();request=new AbortController();key=next;const token=++serial;
  $('#online-status').hidden=false;$('#online-status').textContent='Автоматически подбираем озвучки, субтитры и другие плееры…';$('#retry-online').hidden=true;
  try{const result=await discoveryRequest({kind:'anime-options',releaseId:value.title.catalog.releaseId,number:value.episode.number},{signal:request.signal});if(token!==serial||active()?.title.id!==value.title.id||active()?.episode.id!==value.episode.id)return;
   const validated=onlinePlayerEntries(result.players);active().episode.onlinePlayers=validated;persist();refresh();$('#online-status').textContent=validated.length?`Дополнительных вариантов: ${validated.length}. Выбери озвучку, перевод или плеер под видео.`:result.message||'Другие озвучки и субтитры для этой серии не найдены.';$('#retry-online').hidden=validated.length>0;if(!current&&preferred?.titleId===active().title.id){const old=validated.find(p=>p.voice===preferred.voice&&p.player===preferred.player)||validated.find(p=>p.voice===preferred.voice);if(old)select(old.id);}
  }catch(error){if(token===serial&&!request.signal.aborted){$('#online-status').textContent='Не удалось подобрать озвучки и субтитры. Текущий просмотр продолжается.';$('#retry-online').hidden=false;}}finally{if(token===serial)request=null;}
 }
 $('#retry-online').onclick=()=>load(true);
 return {useNative(){preferred=null;try{localStorage.removeItem('yoru.online-last.v1');}catch{}},players,current:()=>current,time:()=>reported?time:null,stop,select,load,chooseAudio(mode){const value=active();if(!value)return false;const native=value.episode.sources.some(s=>s.quality===value.quality&&(mode==='original'?s.audioType==='original':s.audioType!=='original'&&s.language==='ru'));if(native){preferred=null;try{localStorage.removeItem('yoru.online-last.v1');}catch{}return false;}const candidate=players().filter(p=>p.audioType===mode).sort((a,b)=>Number(b.subtitles)-Number(a.subtitles))[0];return candidate?select(candidate.id):false;},cancel(){request?.abort();serial++;key='';stop();}};
}
