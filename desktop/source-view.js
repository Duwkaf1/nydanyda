import {sourcePlayback} from './source-playback.js';
import {WebContentsView} from 'electron';
import {allowPlayerFullscreen} from './player-permissions.js';
import {sourceAudioScript} from './source-audio.js';
const downloadSessions=new WeakSet();

export function embeddedSource({window,ipcMain,trusted,externalProgress}){
 const scans=new WeakSet();
 let view,key='',title='',origin='',bounds,full=false,error='',loadFailed=false,revision=0,audio=[],audioTimer,playbackTimer,loadTimer,pendingSearch;
 const notify=()=>{if(!window.isDestroyed())window.webContents.send('source-view:state',view?{open:true,key,title,host:origin?new URL(origin).hostname:'',loading:view.webContents.isLoading(),error,loadFailed,canBack:view.webContents.navigationHistory.canGoBack(),canForward:view.webContents.navigationHistory.canGoForward(),revision,audio,playbackStatus:playback.status()}:{open:false});};
 const evaluatePlayback=(frame,code,gesture)=>{
  let timer;
  const contents=view?.webContents;
  const execution=contents?.mainFrame===frame
   ? contents.executeJavaScriptInIsolatedWorld(1004,[{code}],gesture)
   : frame.executeJavaScript(code,gesture);
  return Promise.race([execution,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),700);})]).finally(()=>clearTimeout(timer));
 };
 const playback=sourcePlayback({store:externalProgress,notify,
  readFrame:(frame,code)=>evaluatePlayback(frame,code,false),
  commandFrame:(frame,code)=>evaluatePlayback(frame,code,true)});
 const playbackFrames=()=>{
  if(!view||view.webContents.isDestroyed()||!key.startsWith('cinema-'))return;
  playback.poll(view.webContents.mainFrame.framesInSubtree.filter(frame=>/^https:\/\//.test(frame.url))).catch(()=>{});
 };
 const place=()=>{if(!view||window.isDestroyed())return;const [width,height]=window.getContentSize();if(full){view.setBounds({x:0,y:0,width,height});return;}const zoom=window.webContents.getZoomFactor(),r=bounds;const x=Math.max(0,Math.min(width,Math.round((r?.x||0)*zoom))),y=Math.max(0,Math.min(height,Math.round((r?.y||0)*zoom)));view.setBounds({x,y,width:Math.max(0,Math.min(width-x,Math.round((r?.width||0)*zoom))),height:Math.max(0,Math.min(height-y,Math.round((r?.height||0)*zoom)))});};
 async function scanAudio(){const current=view;if(!current||scans.has(current)||current.webContents.isDestroyed())return;scans.add(current);const ticket=++revision;try{const found=[];const frames=current.webContents.mainFrame.framesInSubtree.slice(0,24);await Promise.all(frames.map(async frame=>{try{const controls=await frame.executeJavaScript(sourceAudioScript());for(const control of controls)found.push({...control,frame:frame.routingId,process:frame.processId});}catch{}}));if(current!==view||ticket!==revision)return;audio=found.sort((a,b)=>a.process-b.process||a.frame-b.frame||a.control-b.control);notify();}finally{scans.delete(current);}}
 function close(){clearInterval(audioTimer);clearInterval(playbackTimer);playback.stop();clearTimeout(loadTimer);revision++;audio=[];if(view){const previous=view;view=undefined;window.contentView.removeChildView(previous);if(!previous.webContents.isDestroyed())previous.webContents.close();}full=false;bounds=undefined;notify();}
 function open(data){
  const url=new URL(data.url);if(url.protocol!=='https:'||url.username||url.password||url.port)throw new Error('Недопустимый адрес источника.');
  if(view&&key===data.key&&view.webContents.getURL()===url.href){notify();return;}
  close();key=data.key;title=data.title;origin=url.origin;error='';loadFailed=false;pendingSearch=key==='cinema-lordfilm'&&typeof data.search==='string'?data.search.slice(0,100):'';
  view=new WebContentsView({webPreferences:{partition:`player-${key}`,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,allowRunningInsecureContent:false}});
  const current=view,contents=current.webContents;
  window.contentView.addChildView(current);place();allowPlayerFullscreen(window,{contents});
  if(!downloadSessions.has(contents.session)){contents.session.on('will-download',event=>event.preventDefault());downloadSessions.add(contents.session);}
  const permitted=value=>{try{const target=new URL(value);return target.origin===origin&&target.protocol==='https:'&&!target.username&&!target.password&&!target.port;}catch{return false;}};
  const guard=(event,value,_inPlace,isMainFrame)=>{if(isMainFrame===false)return;if(!permitted(value))event.preventDefault();};
  contents.on('will-navigate',guard);contents.on('will-redirect',guard);
  // Some legitimate cards use target=_blank. Keep same-site navigation here;
  // cross-site popups and advertisements cannot create another window.
  contents.setWindowOpenHandler(({url})=>{if(permitted(url))contents.loadURL(url).catch(()=>{});return {action:'deny'};});
  contents.on('did-start-loading',()=>{if(current!==view)return;error='';loadFailed=false;audio=[];revision++;notify();clearTimeout(loadTimer);loadTimer=setTimeout(()=>{if(current===view&&contents.isLoading()){error='Источник долго загружается. Можно подождать или обновить страницу.';notify();}},20000);});
  contents.on('did-stop-loading',()=>{if(current!==view)return;clearTimeout(loadTimer);if(!loadFailed)error='';notify();scanAudio();if(pendingSearch&&!loadFailed){const query=pendingSearch;pendingSearch='';search(query).catch(()=>{if(current===view&&!loadFailed){error='Введи название в поиске на странице источника.';notify();}});}});
  const resetPlayback=()=>{if(current===view&&key.startsWith('cinema-'))playback.reset(key,title,contents.getURL());};
  contents.on('did-navigate',resetPlayback);
  contents.on('did-navigate-in-page',(_event,_url,isMain)=>{if(current===view&&isMain)resetPlayback();});

  contents.on('did-fail-load',(_event,code,_description,_url,isMain)=>{if(current!==view||!isMain||code===-3)return;loadFailed=true;pendingSearch='';error=`Не удалось открыть ${new URL(origin).hostname} (код ${code}). Проверь соединение или выбери другой источник.`;notify();});
  contents.on('enter-html-full-screen',()=>{if(current===view){full=true;place();}});contents.on('leave-html-full-screen',()=>{full=false;place();});
  contents.on('render-process-gone',()=>{if(current===view){loadFailed=true;error='Страница источника остановилась. Нажми «Обновить».';notify();}});
  audioTimer=setInterval(scanAudio,5000);playbackTimer=setInterval(playbackFrames,1000);notify();contents.loadURL(url.href).catch(()=>{});
 }
 const handle=(channel,callback)=>ipcMain.handle(channel,(event,data)=>{trusted(event);return callback(data);});
 handle('source-view:bounds',data=>{if(!data||!['x','y','width','height'].every(k=>Number.isFinite(data[k])&&data[k]>=0&&data[k]<=20000))return;bounds=data;place();});
 handle('source-view:preferences',settings=>playback.preferences(settings));
 handle('source-view:last-playback',()=>{const last=playback.latest();return last&&!last.finished?{title:last.title,time:last.time}:null;});
 handle('source-view:action',async action=>{if(action==='resume'){const last=playback.latest();if(!last||last.finished)return false;open(last);playback.openCheckpoint(last);return true;}if(action==='close'){close();return;}if(!view)return;if(['back','forward','reload'].includes(action))playback.cancelAdvance();if(action==='back'&&view.webContents.navigationHistory.canGoBack())view.webContents.navigationHistory.goBack();else if(action==='forward'&&view.webContents.navigationHistory.canGoForward())view.webContents.navigationHistory.goForward();else if(action==='reload')view.webContents.reload();else if(action==='audio')await scanAudio();else if(action==='fullscreen')window.setFullScreen(!window.isFullScreen());});
 handle('source-view:audio',async data=>{const current=view;if(!current||data?.revision!==revision||!Number.isInteger(data?.group)||!Number.isInteger(data?.index))throw new Error('Обнови список озвучек.');const group=audio[data.group],option=group?.options.find(option=>option.index===data.index);if(!option||option.disabled)throw new Error('Озвучка недоступна.');const frame=current.webContents.mainFrame.framesInSubtree.find(frame=>frame.routingId===group.frame&&frame.processId===group.process);if(!frame)throw new Error('Плеер изменился. Обнови список озвучек.');await frame.executeJavaScript(sourceAudioScript({kind:'select',control:group.control,index:option.index,label:option.label}),true);await scanAudio();});
 async function search(query){if(key!=='cinema-lordfilm'||!view||typeof query!=='string'||!query.trim()||query.length>100)throw new Error('Сначала открой каталог Lordfilm.');
  const result=await view.webContents.mainFrame.executeJavaScript(`(()=>{const input=[...document.querySelectorAll('input[name="story"],input[type="search"],input[name="q"],input[name="search"]')].find(input=>input.form&&!input.disabled);if(!input)return false;const form=input.form,url=new URL(form.action,location.href);if(url.origin!==location.origin)return false;input.value=${JSON.stringify(query.trim())};input.dispatchEvent(new Event('input',{bubbles:true}));form.requestSubmit();return true;})()`,true);
  if(!result)throw new Error('Поиск сайта не найден. Используй поиск на странице источника.');return {searched:true};}
 handle('source-view:search',search);
 window.on('resize',place);window.on('enter-full-screen',()=>{full=true;place();});window.on('leave-full-screen',()=>{full=false;place();});window.webContents.on('zoom-changed',place);window.webContents.on('did-start-navigation',(_event,_url,_inPlace,isMain)=>{if(isMain)close();});window.on('close',close);
 return {open,close};
}
