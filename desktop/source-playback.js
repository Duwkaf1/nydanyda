import {createHash} from 'node:crypto';
import {sourcePlaybackScript} from './source-playback-dom.js';

const contentPage = value => {
 try {
  const url=new URL(value);
  if(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.search&&!url.hash&&url.pathname.length<=400&&url.pathname!=='/')return url.href;
 } catch {}
 return null;
};
const valid = state => state && Number.isFinite(state.time) && Number.isFinite(state.duration)
 && state.time>=0 && state.duration>=60 && state.time<=state.duration+1
 && typeof state.identity==='string' && state.identity.length<=2048;

export function sourcePlayback({store,notify,now=Date.now,readFrame,commandFrame}) {
 let session,advance,resume,autoNext=true,timeoutMs=30000;
 let status='';
 const read=()=>Array.isArray(store.read())?store.read():[];
 const latest=()=>read().find(record=>contentPage(record?.url)&&/^cinema-[a-z0-9.-]{1,60}$/.test(record?.key||'')&&typeof record.title==='string'&&record.title.length<=200);
 const setStatus = message => {if(status!==message){status=message;notify();}};
 function reset(key,title,url) {
  session={key,title,url:contentPage(url),last:null,lastAdvance:now(),savedAt:0,attempted:false,restoreTried:false,busy:false,advanced:false,finished:false};
  setStatus('');
 }
 function stop(){session=null;advance=null;resume=null;status='';}
 function openCheckpoint(record){resume=record?.episode?record:null;}
 function cancelAdvance(){advance=null;}
 function checkpoint(current,state,id,finished) {
  if(!current.url||!id||state.time<1)return;
  const updatedAt=now();
  const old=read().find(record=>record?.id===id);
  const record={id,key:current.key,title:current.title,url:current.url,time:state.time,duration:state.duration,updatedAt,finished};
  if(typeof state.episode==='string'&&/^[\p{L}\p{N}:._ -]{1,80}$/u.test(state.episode))record.episode=state.episode;
  if(old?.time===record.time&&old?.finished===finished)return;
  try{
   store.write([record,...read().filter(record=>record?.id!==id)].slice(0,100));
   current.savedAt=updatedAt;
  }catch{current.saveFailed=true;}
 }
 async function poll(frames) {
  const current=session;
  if(!current||current.busy)return;
  current.busy=true;
  try {
   const results=await Promise.all(frames.slice(0,12).map(async frame=>{
    try{return {frame,state:await readFrame(frame,sourcePlaybackScript())};}catch{return null;}
   }));
   if(current!==session)return;
   const matches=results.filter(result=>valid(result?.state));
   if(matches.length!==1)return;
   const {frame,state}=matches[0];
   const id=current.url&&state.identity?createHash('sha256').update(JSON.stringify([current.key,current.url,state.identity])).digest('hex'):null;
   if(!current.last||current.last.identity!==state.identity||Math.abs(current.last.duration-state.duration)>2||(current.finished&&!state.ended)){
    current.last=null;current.lastAdvance=now();current.attempted=false;current.advanced=false;current.finished=false;current.restoreTried=false;
   }
   const previous=current.last;
   current.last=state;
   if(advance?.expires<now())advance=null;
   if(resume&&resume.url===current.url&&state.ready>=1&&!state.seeking){
    const requested=resume;
    resume=null;
    if(id!==requested.id&&state.time<=1){
     const switched=await commandFrame(frame,sourcePlaybackScript({kind:'episode',episode:requested.episode})).catch(()=>false);
     if(current!==session||switched)return;
    }
   }
   if(advance?.confirmed&&state.ready>=2&&!state.seeking&&(advance.url!==current.url||advance.identity!==state.identity)){
    advance=null;
    if(state.paused&&state.time<=1){
     await commandFrame(frame,sourcePlaybackScript({kind:'play',identity:state.identity})).catch(()=>false);
     if(current!==session)return;
    }
   }
   if(!current.restoreTried&&state.ready>=1&&!state.seeking){
    current.restoreTried=true;
    const saved=id&&read().find(record=>record?.id===id&&!record.finished&&Math.abs(record.duration-state.duration)<=2);
    if(saved&&state.time<=1&&saved.time<state.duration-1){
     const restored=await commandFrame(frame,sourcePlaybackScript({kind:'seek',identity:state.identity,time:saved.time})).catch(()=>false);
     if(current!==session)return;
     if(restored){current.last=null;current.lastAdvance=now();return;}
    }
   }
   if(previous&&!state.seeking&&state.time>previous.time+.05){
    current.lastAdvance=now();
    if(state.time-previous.time<5)current.advanced=true;
   }
   if(state.paused||state.seeking)current.lastAdvance=now();
   if(state.ended){
    if(!current.finished){checkpoint(current,state,id,true);current.finished=true;}
    if(autoNext&&!current.attempted&&current.advanced&&previous?.ended&&state.next&&!state.error){
     current.attempted=true;
     const pending={identity:state.identity,url:current.url,expires:now()+15000};
     advance=pending;
     const moved=await commandFrame(frame,sourcePlaybackScript({kind:'next',identity:state.identity})).catch(()=>false);
     if(advance===pending){
      if(moved)pending.confirmed=true;
      else advance=null;
     }
     if(current!==session)return;
     setStatus(moved?'Открываем следующую серию…':'Открой следующую серию в плеере источника.');
    }else if(!current.attempted)setStatus('Воспроизведение завершено.');
    return;
   }
   if(!state.seeking&&(!current.savedAt||now()-current.savedAt>=3000))checkpoint(current,state,id,false);
   if(current.saveFailed)setStatus('Не удалось сохранить позицию внешнего плеера.');
   else if(state.error)setStatus('Видео не загрузилось. Нажми «Обновить».');
   else if(!state.paused&&!state.seeking&&now()-current.lastAdvance>=timeoutMs)setStatus('Видео не продвигается. Проверь соединение или нажми «Обновить».');
   else if(!state.paused&&!state.seeking&&state.ready<3&&now()-current.lastAdvance>=3000)setStatus('Буферизация видео…');
   else setStatus('');
  }finally{current.busy=false;}
 }
 return {reset,stop,poll,latest,openCheckpoint,cancelAdvance,status:()=>status,preferences(settings){
  if(typeof settings?.autoNext==='boolean'){autoNext=settings.autoNext;if(!autoNext)cancelAdvance();}
  if(Number.isFinite(settings?.timeoutSeconds))timeoutMs=Math.min(60,Math.max(5,settings.timeoutSeconds))*1000;
 }};
}
