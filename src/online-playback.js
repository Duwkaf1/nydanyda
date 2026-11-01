import {discoveryRequest} from './discovery-transport.js';
import {onlinePlayerEntries,animeEmbedURL,managedPlayer} from './anime-online.js';
export function onlinePlayback({$,node,active,video,persist,enter,refresh,status,onTime,onEnded}){
 let preferred;try{preferred=JSON.parse(localStorage.getItem('yoru.online-last.v1')||'null');}catch{}
 let current=null,frame=null,detach=()=>{},request,key='',serial=0,time=null,restore=0,awaitingSeek=false,reported=false,wrongEpisode=false;let timer,playing=false,ready=false,lastActivity=0,ended=false;const failed=new Set();let audioIntent=0,pendingAudio=null,wantedSubtitles=false;
 const players=()=>active()?.episode.onlinePlayers||[];
 function stop(){clearInterval(timer);timer=null;detach();detach=()=>{};frame?.remove();frame=null;current=null;time=null;reported=false;}
 function command(value){if(frame&&current&&/kodik|aniqit/.test(new URL(current.url).hostname))frame.contentWindow?.postMessage({key:'kodik_player_api',value},new URL(current.url).origin);}
 function select(id,recovering=false){const player=players().find(p=>p.id===id);if(!player)return false;if(!recovering){failed.clear();audioIntent++;pendingAudio=null;}
  const native=video();const checkpoint=(time??(native?.readyState>=1?native.currentTime:active()?.checkpoint))||0;enter();current=player;restore=checkpoint;awaitingSeek=checkpoint>0;time=null;reported=false;wrongEpisode=false;playing=false;ready=false;ended=false;lastActivity=Date.now();
  const value=active();$('#online-status').hidden=false;$('#retry-online').hidden=true;preferred={titleId:value.title.id,voice:player.voice,player:player.player};try{localStorage.setItem('yoru.online-last.v1',JSON.stringify(preferred));}catch{}value.watching.audioMode=player.audioType==='original'?'original':'dub';value.external=player;$('#watch-audio-mode').value=value.watching.audioMode;
  frame=node('iframe');frame.title=`${player.player} · ${player.voice}`;frame.className='online-player';frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-presentation');frame.allow='autoplay; fullscreen; encrypted-media; picture-in-picture';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
  frame.src=animeEmbedURL(player.url);$('#video-host').append(frame);
  const option=node('option','В плеере');option.value='provider';$('#quality option[value="provider"]')?.remove();$('#quality').append(option);$('#quality').value='provider';$('#quality').disabled=true;
  $('#player-engine').disabled=true;$('#retry-button').hidden=true;status(`${player.voice} · ${player.player} · нажми воспроизведение в плеере`);
  $('#online-status').textContent='Разрешение и оформление субтитров выбираются внутри этого плеера. Позиция сохраняется, когда плеер передаёт её Yoru.';
  const selectedFrame=frame;const origin=new URL(player.url).origin;
  const message=event=>{
   if(event.source!==selectedFrame.contentWindow||event.origin!==origin||frame!==selectedFrame)return;
   let data=event.data;try{if(typeof data==='string')data=JSON.parse(data);}catch{return;}
   if(!data||typeof data.key!=='string'||!managedPlayer(player))return;
   if(data.key==='kodik_player_current_episode'&&Number.isFinite(data.value?.episode)&&data.value.episode!==active()?.episode.number){reported=false;wrongEpisode=true;status('Серия изменена внутри плеера. Выбирай серии в Yoru, чтобы сохранить правильную историю.');return;}
   if(['kodik_player_video_started','kodik_player_duration_update'].includes(data.key)){ready=true;lastActivity=Date.now();}
   if(['kodik_player_video_started','kodik_player_duration_update'].includes(data.key)&&awaitingSeek)command({method:'seek',seconds:restore});
   const seconds=['kodik_player_time_update','kodik_player_time'].includes(data.key)?data.value:data.key==='kodik_player_seek'?data.value?.time:null;
   if(!wrongEpisode&&typeof seconds==='number'&&Number.isFinite(seconds)&&seconds>=0&&seconds<604800){if(awaitingSeek&&Math.abs(seconds-restore)>.75)return;awaitingSeek=false;if(time===null||Math.abs(seconds-time)>.01)lastActivity=Date.now();time=seconds;reported=true;onTime(seconds);$('#online-status').textContent='Позиция этого плеера сохраняется в Yoru. Разрешение и оформление перевода выбираются в самом плеере.';}
   if(data.key==='kodik_player_play'){ready=true;playing=true;active().session.paused=false;lastActivity=Date.now();}if(data.key==='kodik_player_play')status(`${player.voice} · ${player.player} · воспроизведение`);
   if(data.key==='kodik_player_pause'){ready=true;playing=false;active().session.paused=true;}if(data.key==='kodik_player_pause')status(`${player.voice} · ${player.player} · пауза`);
   if(data.key==='kodik_player_video_ended'&&reported&&!ended&&!wrongEpisode){ended=true;playing=false;onTime(time);onEnded();}
  };
  window.addEventListener('message',message);
  const recover=()=>{
   if(frame!==selectedFrame||ended||wrongEpisode)return;
   const state=active();failed.add(player.id);
   const candidates=players().filter(p=>managedPlayer(p)&&!failed.has(p.id)&&p.audioType===player.audioType&&p.subtitles===player.subtitles&&(!player.quality||p.quality>=player.quality)&&(p.voice===player.voice||state.recovery.allowOtherRussian));
   const priority=p=>p.voice===player.voice?-1:p.voice.toLowerCase().includes(state.recovery.voicePriority)?0:1;
   candidates.sort((a,b)=>priority(a)-priority(b));const next=state.recovery.autoSwitch&&candidates[0];
   if(next){select(next.id,true);status(`Плеер не отвечает. Переключаем: ${next.voice} · ${next.player} · с сохранённого момента.`);}
   else{clearInterval(timer);status('Плеер не отвечает. Позиция сохранена. Повтори подключение или выбери другой вариант.');$('#retry-online').hidden=false;}
  };
  selectedFrame.onload=()=>{if(frame===selectedFrame){command({method:'get_time'});if(awaitingSeek)command({method:'seek',seconds:restore});if(!value.session.paused)command({method:'play'});}};
  selectedFrame.onerror=recover;
  timer=setInterval(()=>{if(frame!==selectedFrame)return;command({method:'get_time'});if((playing||!ready)&&Date.now()-lastActivity>=active().recovery.timeoutSeconds*1000)recover();},1000);
  detach=()=>window.removeEventListener('message',message);refresh();return true;
 }
 async function load(force=false){
  const value=active();if(!value?.title.catalog){request?.abort();key='';$('#online-status').hidden=true;$('#retry-online').hidden=true;return;}
  if(preferred?.titleId===value.title.id&&video()){value.session.paused=true;video().pause();}
  if(!force&&value.episode.onlinePlayers?.length&&!value.episode.sources.length){refresh();const choices=value.episode.onlinePlayers;const selected=choices.find(p=>p.voice===preferred?.voice&&p.player===preferred?.player)||choices.find(p=>p.audioType===value.watching.audioMode)||choices[0];if(!current)select(selected.id);return true;}
  const next=`${value.title.id}:${value.episode.id}`;if(!force&&key===next&&(request||value.episode.onlinePlayers!==undefined)){if(!request)availability(value.episode.onlinePlayers||[]);return true;}request?.abort();request=new AbortController();key=next;const token=++serial;
  $('#online-status').hidden=false;$('#online-status').textContent='Автоматически подбираем озвучки, субтитры и другие плееры…';$('#retry-online').hidden=true;
  try{const result=await discoveryRequest({kind:'anime-options',provider:value.title.catalog.provider,releaseId:value.title.catalog.releaseId,number:value.episode.number},{signal:request.signal});if(token!==serial||active()?.title.id!==value.title.id||active()?.episode.id!==value.episode.id)return;
   const validated=onlinePlayerEntries(result.players).filter(managedPlayer);active().episode.onlinePlayers=validated;persist();refresh();$('#online-status').textContent=validated.length?`Доступно: ${validated.filter(p=>p.audioType==='dub').length} озвучек · ${validated.filter(p=>p.audioType==='original').length} вариантов оригинала · ${validated.filter(p=>p.subtitles).length} переводов с субтитрами.${validated.some(p=>p.audioType==='original')?'':' Для этой серии оригинал пока не подтверждён.'}`:result.message||'Другие озвучки и субтитры для этой серии не найдены.';$('#retry-online').hidden=validated.length>0;if(!pendingAudio&&!current&&preferred?.titleId===active().title.id){const old=validated.find(p=>p.voice===preferred.voice&&p.player===preferred.player)||validated.find(p=>p.voice===preferred.voice);if(old)select(old.id);}if(!pendingAudio&&!current&&!value.episode.sources.length&&validated.length)select((validated.find(p=>p.audioType===value.watching.audioMode)||validated[0]).id);return true;
  }catch(error){if(token===serial&&!request.signal.aborted){$('#online-status').textContent='Не удалось подобрать озвучки и субтитры. Текущий просмотр продолжается.';$('#retry-online').hidden=false;}}finally{if(token===serial)request=null;}
 }
 function availability(values){
  $('#online-status').hidden=false;
  if(current)return;
  $('#online-status').textContent=`Доступно: ${values.filter(p=>p.audioType==='dub').length} озвучек · ${values.filter(p=>p.audioType==='original').length} вариантов оригинала · ${values.filter(p=>p.subtitles).length} переводов с субтитрами.${values.some(p=>p.audioType==='original')?'':' В AniLibria доступна русская озвучка; оригинал подбирается у других плееров.'}`;
 }
 function chooseAudio(mode,requireSubtitles=false){
  const value=active();if(!value)return false;const intent=++audioIntent;pendingAudio=null;wantedSubtitles=requireSubtitles;
  const native=!requireSubtitles&&value.episode.sources.some(s=>s.quality===value.quality&&(mode==='original'?s.audioType==='original':s.audioType!=='original'&&s.language==='ru'));
  if(native){preferred=null;try{localStorage.removeItem('yoru.online-last.v1');}catch{}return false;}
  const candidate=()=>players().filter(p=>p.audioType===mode&&(!requireSubtitles||p.subtitles)).sort((a,b)=>Number(b.subtitles)-Number(a.subtitles))[0];
  if(candidate())return select(candidate().id);
  if(!value.title.catalog)return false;
  pendingAudio=mode;value.watching.audioMode=mode;$('#watch-audio-mode').value=mode;video()?.pause();command({method:'pause'});refresh();
  status(requireSubtitles?'Ищем оригинал с субтитрами для этой серии…':'Ищем оригинальную дорожку для этой серии…');
  load(true).then(loaded=>{
   if(active()!==value||intent!==audioIntent)return;pendingAudio=null;
   const player=candidate();if(player){select(player.id);return;}
   refresh();$('#retry-online').hidden=false;
   const message=loaded?'Для этой серии оригинал с нужным переводом не найден у доступных плееров. Можно повторить подбор или выбрать русскую озвучку.':'Не удалось проверить другие плееры. Повтори подбор или выбери русскую озвучку.';
   status(message);$('#online-status').textContent=message;
  }).catch(()=>{if(active()===value&&intent===audioIntent){pendingAudio=null;status('Не удалось подобрать оригинал. Повтори подбор или выбери русскую озвучку.');$('#retry-online').hidden=false;}});
  return true;
 }
 $('#retry-online').onclick=async()=>{
  const value=active(),previous=current;if(value?.watching.audioMode==='original'&&(!current||current.audioType!=='original')){chooseAudio('original',wantedSubtitles);return;}if(!await load(true)||active()!==value||!previous)return;
  const replacement=players().find(p=>p.id===previous.id)||players().find(p=>p.voice===previous.voice&&p.player===previous.player&&p.audioType===previous.audioType&&p.subtitles===previous.subtitles);
  if(replacement)select(replacement.id);else status('Прежний вариант сейчас недоступен. Выбери другой перевод или озвучку.');
 };
 return {useNative(){audioIntent++;pendingAudio=null;preferred=null;try{localStorage.removeItem('yoru.online-last.v1');}catch{}},players,current:()=>current,time:()=>reported?time:null,stop,select,load,chooseSubtitles(){return chooseAudio('original',true);},chooseAudio,cancel(){request?.abort();serial++;audioIntent++;pendingAudio=null;key='';stop();}};
}
