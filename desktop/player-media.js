import {animeEmbedURL,ANIME_EMBED_HOSTS} from '../src/anime-online.js';
const validId=value=>typeof value==='string'&&/^[a-z0-9-]{1,64}$/i.test(value);
export function mediaCommand(data){
 if(!validId(data?.requestId)||!['play','pause','seek','volume','mute'].includes(data.action))throw new Error('Недопустимая команда плеера.');
 if(data.action==='seek'&&(!Number.isFinite(data.value)||data.value<0||data.value>604800)||data.action==='volume'&&(!Number.isFinite(data.value)||data.value<0||data.value>1)||data.action==='mute'&&typeof data.value!=='boolean')throw new Error('Недопустимое значение плеера.');
 const key=JSON.stringify('__yoru_media_'+data.requestId);
 const operation={play:'await v.play();',pause:'v.pause();',seek:`v.currentTime=Math.min(Number.isFinite(v.duration)?v.duration:${Number(data.value)||0},${Number(data.value)||0});`,volume:`v.volume=${Number(data.value)||0};v.muted=false;`,mute:`v.muted=${data.value===true};`}[data.action];
 return `(async()=>{const v=globalThis[${key}];if(!(v instanceof HTMLMediaElement)||!v.isConnected)return false;${operation}return true;})()`;
}
export function playerMedia({ipcMain,window,trusted}){
 let active=null,timer,busy=false;
 const stop=()=>{clearInterval(timer);timer=null;active=null;busy=false;};
 async function poll(binding){
  if(active!==binding||busy||window().isDestroyed())return;busy=true;
  try{
   const main=window().webContents.mainFrame;const root=main.frames.find(frame=>frame.name==='yoru-player-'+binding.id||frame.url===binding.url);if(!root)return;try{animeEmbedURL(root.url);}catch{return;}
   const children=root.framesInSubtree.filter(frame=>frame!==root).sort((a,b)=>Number(ANIME_EMBED_HOSTS.some(host=>b.url.startsWith('https://'+host+'/')))-Number(ANIME_EMBED_HOSTS.some(host=>a.url.startsWith('https://'+host+'/'))));const frames=[root,...children].slice(0,12);let best;
   for(const frame of frames){
    if(active!==binding)return;
    try{
     if(binding.blocked.has(frame)||frame.isDestroyed()||!/^https:\/\//.test(frame.url))continue;
     let deadline;const evaluation=frame.executeJavaScript(`(()=>{let best;for(const v of document.querySelectorAll('video')){const r=v.getBoundingClientRect();if(r.width<24||r.height<24||getComputedStyle(v).display==='none')continue;const d=Number.isFinite(v.duration)?v.duration:0;const expected=${binding.duration};const content=!expected||!d||Math.abs(d-expected)<=Math.max(30,expected*.15);const score=r.width*r.height+(content?1e9:0)+(d?1e6:0);if(!best||score>best.score){globalThis[${JSON.stringify('__yoru_media_'+binding.id)}]=v;const a=Array.from(v.audioTracks||[]).find(t=>t.enabled);best={score,content,time:v.currentTime||0,duration:d,paused:v.paused,ended:v.ended,seeking:v.seeking,volume:v.volume,muted:v.muted,readyState:v.readyState,buffered:v.buffered.length?v.buffered.end(v.buffered.length-1):0,audioLanguage:a?.language||''};}}return best||null;})()`);const state=await Promise.race([evaluation,new Promise((_,reject)=>{deadline=setTimeout(()=>{binding.blocked.add(frame);reject(new Error('Frame unavailable'));},1200);})]).finally(()=>clearTimeout(deadline));
     if(state&&(!best||state.score>best.state.score))best={state,frame};if(state?.content&&state.readyState>=1&&state.duration>0)break;
    }catch{/* Removed/navigating frames are retried; media stays sandboxed. */}
   }
   if(active!==binding||!best)return;binding.frame=best.frame;
   window().webContents.send('player-media:state',{requestId:binding.id,...best.state});
  }finally{if(active===binding)busy=false;}
 }
 ipcMain.handle('player-media:bind',(event,data)=>{
  trusted(event);if(!validId(data?.requestId))throw new Error('Не удалось подключить управление.');const url=animeEmbedURL(data.url);stop();
  const binding={id:data.requestId,url,duration:Number.isFinite(data.duration)&&data.duration>0&&data.duration<604800?data.duration:0,frame:null,blocked:new WeakSet()};active=binding;
  timer=setInterval(()=>{poll(binding).catch(()=>{});},500);poll(binding).catch(()=>{});return true;
 });
 ipcMain.handle('player-media:command',async(event,data)=>{
  trusted(event);const code=mediaCommand(data);const binding=active;if(!binding||binding.id!==data.requestId||!binding.frame||binding.frame.isDestroyed())return false;
  return binding.frame.executeJavaScript(code,true).catch(()=>false);
 });
 ipcMain.on('player-media:unbind',(event,id)=>{try{trusted(event);if(active?.id===id)stop();}catch{}});
 return {stop};
}
