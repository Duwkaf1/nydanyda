import {discoveryRequest} from './discovery-transport.js';
import {onlinePlayerEntries,animeEmbedURL,managedPlayer} from './anime-online.js';
const finiteTime=value=>{const n=typeof value==='number'?value:typeof value==='string'&&value.trim()?Number(value):NaN;return Number.isFinite(n)&&n>=0&&n<604800?n:null;};
export function onlinePlayback({$,node,active,video,persist,enter,refresh,status,onTime,onEnded,chrome,audioResolved=()=>{}}){
 let preferred;try{preferred=JSON.parse(localStorage.getItem('yoru.online-last.v1')||'null');}catch{}
 let current=null,frame=null,request,key='',serial=0,detach=()=>{},timer,bridgeOff=()=>{},bridgeId,bridgeReady=false;
 let time=null,duration=0,playing=false,userPaused=false,reported=false,ended=false,ready=false,restore=0,awaitingSeek=false,lastProgress=0,volume=1,muted=false,didPlay=false,alignments=0,mediaPrepared=false;
 let pausedByYoru=false,lastPlayIntent=0;
 let audioIntent=0,pendingAudio=null,wantedAudio=null;const failed=new Set(),badAudio=new Set();
 const allPlayers=()=>active()?.episode.onlinePlayers||[];
 const players=()=>allPlayers().filter(p=>!badAudio.has(p.id));
 const desktop=()=>Boolean(window.kadr?.bindPlayer&&window.kadr?.onPlayerState);
 function stop(){clearInterval(timer);detach();detach=()=>{};bridgeOff();bridgeOff=()=>{};if(bridgeId)window.kadr?.unbindPlayer?.(bridgeId);bridgeId=null;bridgeReady=false;frame?.remove();frame=null;current=null;time=null;reported=false;chrome?.stop();}
 function rawCommand(value){if(frame&&current&&managedPlayer(current))frame.contentWindow?.postMessage({key:'kodik_player_api',value},new URL(current.url).origin);}
 function command(value){
  if(bridgeReady&&bridgeId){const id=bridgeId,selected=frame;const converted={play:['play'],pause:['pause'],seek:['seek',value.seconds],volume:['volume',value.volume],mute:['mute',true],unmute:['mute',false]}[value.method];
   if(converted){window.kadr.commandPlayer({requestId:id,action:converted[0],...(converted.length>1?{value:converted[1]}:{})}).then(ok=>{if(!ok&&id===bridgeId&&selected===frame&&!(value.method==='play'&&userPaused))rawCommand(value);}).catch(()=>{});return;}
  }
  rawCommand(value);
 }
 function setPaused(paused){pausedByYoru=paused;if(!paused)lastPlayIntent=Date.now();userPaused=paused;playing=!paused;const value=active();if(value)value.session.paused=paused;if(!paused){didPlay=true;lastProgress=Date.now();}command({method:paused?'pause':'play'});}
 function attachChrome(){chrome?.attach({provider:true,captureClicks:ready,providerControls:()=>{pausedByYoru=false;lastPlayIntent=0;},state:()=>({time:awaitingSeek?restore:time??restore,duration,paused:userPaused,volume,muted,seeking:awaitingSeek,buffered:0}),play:()=>setPaused(false),pause:()=>setPaused(true),seek:seconds=>{restore=seconds;awaitingSeek=true;lastProgress=Date.now();command({method:'seek',seconds});},volume:value=>{volume=value;muted=false;active().session.volume=value;active().session.muted=false;command({method:'volume',volume:value});},mute:value=>{muted=value;active().session.muted=value;command({method:value?'mute':'unmute'});}});}
 function finish(){if(ended||!reported)return;ended=true;playing=false;userPaused=true;pausedByYoru=true;clearInterval(timer);onTime(time);command({method:'pause'});onEnded();}
 function recover(){
  if(!current||ended)return;const old=current,value=active();failed.add(old.id);
  const candidates=players().filter(p=>!failed.has(p.id)&&(desktop()||managedPlayer(p))&&p.audioType===old.audioType&&p.subtitles===old.subtitles&&(!old.quality||p.quality>=old.quality)&&(p.voice===old.voice||value.recovery.allowOtherRussian));
  const priority=p=>p.voice===old.voice?-1:p.voice.toLowerCase().includes(value.recovery.voicePriority)?0:1;candidates.sort((a,b)=>priority(a)-priority(b));
  if(value.recovery.autoSwitch&&candidates.length){select(candidates[0].id,true);status(`Переключаем плеер: ${candidates[0].voice} · с сохранённого момента.`);}
  else{clearInterval(timer);setPaused(true);status('Плеер не отвечает. Позиция сохранена. Повтори подключение или выбери другой вариант.');$('#retry-online').hidden=false;}
 }
 function progress(seconds){
  if(seconds===null)return;
  if(awaitingSeek&&Math.abs(seconds-restore)>.8)return;
  awaitingSeek=false;if(time===null||Math.abs(seconds-time)>.01)lastProgress=Date.now();time=seconds;reported=true;onTime(seconds);
  $('#online-status').textContent='Позиция этого плеера сохраняется в Yoru.';
 }
 function select(id,recovering=false){
  const player=players().find(p=>p.id===id);if(!player)return false;if(!recovering){failed.clear();audioIntent++;pendingAudio=null;wantedAudio=null;}
  const native=video();const checkpoint=native?.ended?0:(time??(native?.readyState>=1?native.currentTime:active()?.checkpoint))||0;
  const paused=native?.ended?false:active().session.paused;enter();current=player;restore=checkpoint;awaitingSeek=checkpoint>0;time=null;duration=0;playing=false;userPaused=paused;pausedByYoru=paused;lastPlayIntent=0;reported=false;ended=false;ready=false;didPlay=false;alignments=0;mediaPrepared=false;lastProgress=Date.now();
  const value=active();value.checkpoint=checkpoint;value.watching.audioMode=player.audioType==='original'?'original':'dub';value.external=player;volume=value.session.volume;muted=value.session.muted;
  preferred={titleId:value.title.id,voice:player.voice,player:player.player};try{localStorage.setItem('yoru.online-last.v1',JSON.stringify(preferred));}catch{}
  $('#watch-audio-mode').value=value.watching.audioMode;audioResolved(value.watching.audioMode);$('#online-status').hidden=false;$('#retry-online').hidden=true;
  bridgeId=crypto.randomUUID();frame=node('iframe');frame.name='yoru-player-'+bridgeId;frame.tabIndex=-1;frame.title=`${player.player} · ${player.voice}`;frame.className='online-player';frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-presentation');frame.allow='autoplay; fullscreen; encrypted-media; picture-in-picture';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';frame.src=animeEmbedURL(player.url);$('#video-host').append(frame);
  const option=node('option','В плеере');option.value='provider';$('#quality option[value="provider"]')?.remove();$('#quality').append(option);$('#quality').value='provider';$('#quality').disabled=true;$('#player-engine').disabled=true;$('#retry-button').hidden=true;
  status(`${player.voice} · подключение…`);$('#online-status').textContent='Открываем опубликованный плеер этой серии…';
  const selected=frame,idForBridge=bridgeId,origin=new URL(player.url).origin;
  const ensureReady=()=>{if(!ready){ready=true;attachChrome();}};
  if(desktop()){
   bridgeOff=window.kadr.onPlayerState(state=>{
    if(frame!==selected||state?.requestId!==idForBridge)return;
    bridgeReady=true;if(!state.content)return;
    const language=String(state.audioLanguage||'').toLowerCase().split('-')[0];
    if(player.audioType==='original'&&['ru','rus'].includes(language)){
     badAudio.add(player.id);command({method:'pause'});value.watching.audioMode='dub';$('#watch-audio-mode').value='dub';audioResolved('dub');status('Плеер вернул русскую дорожку вместо японской. Проверяем другой вариант.');recover();return;
    }
    if(reported&&didPlay&&!userPaused&&!awaitingSeek&&!$('#video-host').classList.contains('provider-controls-open')&&duration>0&&duration-time<=1.25&&state.time<1&&time>state.time+2){finish();return;}
    ensureReady();duration=finiteTime(state.duration)||duration;volume=state.volume;muted=state.muted;
    playing=!state.paused&&!state.ended;if(playing){didPlay=true;if(!pausedByYoru)userPaused=false;}
    if(state.paused&&!state.ended&&mediaPrepared&&didPlay&&!awaitingSeek&&!pausedByYoru&&Date.now()-lastPlayIntent>1500&&(duration-time>1.25||$('#video-host').classList.contains('provider-controls-open')))userPaused=true;
    progress(finiteTime(state.time));
    if(awaitingSeek)command({method:'seek',seconds:restore});
    if(!mediaPrepared){mediaPrepared=true;command({method:'volume',volume:value.session.volume});if(value.session.muted)command({method:'mute'});command({method:userPaused?'pause':'play'});}
    if(state.ended&&reported)finish();
   });
   window.kadr.bindPlayer({requestId:bridgeId,url:player.url,duration:player.duration||0}).catch(()=>{});
  }
  const message=event=>{
   if(event.source!==selected.contentWindow||event.origin!==origin||frame!==selected||!managedPlayer(player))return;
   let data=event.data;try{if(typeof data==='string')data=JSON.parse(data);}catch{return;}if(!data||typeof data.key!=='string')return;if(bridgeReady&&data.key!=='kodik_player_current_episode')return;
   if(data.key==='kodik_player_current_episode'){
    const episode=finiteTime(data.value?.episode);if(episode!==null&&episode!==active()?.episode.number){
     const next=value.title.episodes[value.title.episodes.indexOf(value.episode)+1];
     if(next?.number===episode&&reported&&duration>0&&duration-time<=3){finish();return;}
     if(alignments++<2){reported=false;command({method:'change_episode',episode:value.episode.number,...(Number.isFinite(data.value?.season)?{season:data.value.season}:{})});}return;
    }
   }
   if(data.key==='kodik_player_duration_update'){ensureReady();duration=finiteTime(data.value?.duration??data.value)||duration;if(awaitingSeek)command({method:'seek',seconds:restore});}
   if(data.key==='kodik_player_video_started'){ensureReady();playing=true;didPlay=true;lastProgress=Date.now();if(awaitingSeek)command({method:'seek',seconds:restore});}
   const seconds=['kodik_player_time_update','kodik_player_time'].includes(data.key)?finiteTime(data.value?.time??data.value):data.key==='kodik_player_seek'?finiteTime(data.value?.time):null;
   if(seconds!==null){ensureReady();progress(seconds);}
   if(data.key==='kodik_player_play'){ensureReady();playing=true;didPlay=true;if(!pausedByYoru)userPaused=false;if(!userPaused){value.session.paused=false;status(`${player.voice} · воспроизведение`);}}
   if(data.key==='kodik_player_pause'){playing=false;if(!pausedByYoru&&Date.now()-lastPlayIntent>1500&&(duration-time>1.25||$('#video-host').classList.contains('provider-controls-open')))userPaused=true;status(`${player.voice} · пауза`);}
   if(data.key==='kodik_player_volume_change'){if(typeof data.value?.muted==='boolean')muted=data.value.muted;const v=Number(data.value?.volume);if(Number.isFinite(v)&&v>=0&&v<=1)volume=v;}
   if(data.key==='kodik_player_video_ended')finish();
  };
  window.addEventListener('message',message);detach=()=>window.removeEventListener('message',message);
  selected.onload=()=>{if(frame!==selected)return;rawCommand({method:'get_time'});if(awaitingSeek)command({method:'seek',seconds:restore});command({method:userPaused?'pause':'play'});};selected.onerror=recover;
  timer=setInterval(()=>{
   if(frame!==selected||ended)return;if(!bridgeReady)rawCommand({method:'get_time'});
   if(userPaused)return;const stalled=Date.now()-lastProgress;
   if(reported&&didPlay&&duration>=30&&duration-time<=1.25&&duration>=time&&stalled>=8000){status('Конец серии завис. Открываем следующую доступную серию.');finish();return;}
   if(stalled>=value.recovery.timeoutSeconds*1000)recover();
  },1000);
  attachChrome();refresh();return true;
 }
 function availableMessage(values){return `Доступно: ${values.filter(p=>p.audioType==='dub').length} озвучек · ${values.filter(p=>p.audioType==='original').length} вариантов оригинала · ${values.filter(p=>p.subtitles).length} переводов с субтитрами.`;}
 function chooseKnown(value,values){
  const old=preferred?.titleId===value.title.id?values.find(p=>p.voice===preferred.voice&&p.player===preferred.player):null;
  const candidate=old||values.find(p=>p.audioType===value.watching.audioMode);
  if(candidate)return select(candidate.id);return false;
 }
 async function load(force=false){
  const value=active();if(!value?.title.catalog){request?.abort();key='';$('#online-status').hidden=true;$('#retry-online').hidden=true;return;}
  if(preferred?.titleId===value.title.id&&video()){value.session.paused=true;video().pause();}
  const compatible=values=>values.filter(p=>desktop()||managedPlayer(p));
  if(!force&&value.episode.onlinePlayers?.length&&!value.episode.sources.length){const values=compatible(players());if(values.length){if(!current)chooseKnown(value,values);return true;}}
  const next=`${value.title.id}:${value.episode.id}`;
  if(!force&&key===next&&(request||value.episode.onlinePlayers!==undefined)){if(!request&&!current)$('#online-status').textContent=availableMessage(players());return true;}
  request?.abort();request=new AbortController();key=next;const token=++serial,controller=request;
  $('#online-status').hidden=false;$('#online-status').textContent='Подбираем плееры, японскую дорожку и переводы…';$('#retry-online').hidden=true;
  try{
   const result=await discoveryRequest({kind:'anime-options',provider:value.title.catalog.provider,releaseId:value.title.catalog.releaseId,number:value.episode.number},{signal:controller.signal});
   const owner=active();if(token!==serial||owner?.title.id!==value.title.id||owner?.episode.id!==value.episode.id)return;
   const validated=compatible(onlinePlayerEntries(result.players)||[]);owner.episode.onlinePlayers=validated;persist();refresh();$('#online-status').textContent=validated.length?availableMessage(validated):result.message||'Подключить другие плееры этой серии пока не удалось.';$('#retry-online').hidden=validated.length>0;
   if(!pendingAudio&&!current&&(preferred?.titleId===owner.title.id||!owner.episode.sources.length))chooseKnown(owner,validated);
   return true;
  }catch(error){if(token===serial&&!controller.signal.aborted){$('#online-status').textContent='Не удалось проверить другие плееры. Доступен повтор подключения.';$('#retry-online').hidden=false;}}
  finally{if(token===serial)request=null;}
 }
 function chooseAudio(mode,requireSubtitles=false){
  const value=active();if(!value)return false;const intent=++audioIntent;pendingAudio=null;wantedAudio=null;
  if(!requireSubtitles&&value.episode.sources.some(s=>s.quality===value.quality&&(mode==='original'?s.audioType==='original'&&s.language==='ja':s.audioType!=='original'&&s.language==='ru'))){preferred=null;try{localStorage.removeItem('yoru.online-last.v1');}catch{}return false;}
  const candidate=()=>players().filter(p=>p.audioType===mode&&(!requireSubtitles||p.subtitles)).sort((a,b)=>Number(b.subtitles)-Number(a.subtitles))[0];
  if(candidate())return select(candidate().id);if(!value.title.catalog)return false;
  const actualMode=current?.audioType==='original'?'original':value.watching.audioMode;const wasPaused=current?userPaused:video()?.ended?false:video()?.paused??value.session.paused;
  pendingAudio={mode,requireSubtitles};wantedAudio={mode,requireSubtitles};video()?.pause();if(current)setPaused(true);
  $('#watch-audio-mode').value=mode;status(requireSubtitles?'Ищем японскую дорожку с субтитрами…':'Ищем японскую дорожку…');
  load(true).then(loaded=>{
   if(active()!==value||intent!==audioIntent)return;pendingAudio=null;
   const player=candidate();if(player){value.session.paused=wasPaused;select(player.id);return;}
   value.watching.audioMode=actualMode;$('#watch-audio-mode').value=actualMode;audioResolved(actualMode);refresh();$('#retry-online').hidden=false;
   const message=loaded?'Японскую дорожку подключить не удалось. Русская дорожка приостановлена. Можно повторить подбор.':'Не удалось проверить плееры. Текущая дорожка приостановлена; повтори подбор.';
   status(message);$('#online-status').textContent=message;
  }).catch(()=>{if(active()===value&&intent===audioIntent){pendingAudio=null;$('#watch-audio-mode').value=actualMode;audioResolved(actualMode);status('Подбор японской дорожки не завершён. Доступен повтор.');$('#retry-online').hidden=false;}});
  return true;
 }
 $('#retry-online').onclick=async()=>{
  if(wantedAudio){chooseAudio(wantedAudio.mode,wantedAudio.requireSubtitles);return;}
  const value=active(),previous=current;if(!await load(true)||active()!==value||!previous)return;
  const replacement=players().find(p=>p.id===previous.id)||players().find(p=>p.voice===previous.voice&&p.player===previous.player&&p.audioType===previous.audioType&&p.subtitles===previous.subtitles);
  if(replacement)select(replacement.id);else status('Прежний плеер сейчас недоступен. Выбери другой вариант.');
 };
 return {players,current:()=>current,time:()=>reported?time:null,stop,select,load,chooseAudio,chooseSubtitles:()=>chooseAudio('original',true),play:()=>setPaused(false),pause:()=>setPaused(true),snapshot:()=>({time,duration,paused:userPaused}),useNative(){audioIntent++;pendingAudio=null;wantedAudio=null;preferred=null;try{localStorage.removeItem('yoru.online-last.v1');}catch{}},cancel(){request?.abort();serial++;audioIntent++;pendingAudio=null;wantedAudio=null;badAudio.clear();key='';stop();}};
}
