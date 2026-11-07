const players=new WeakMap();
// These are video windows created by Yoru. All other capabilities stay denied.
export function allowPlayerFullscreen(window,{local=false,contents=window.webContents}={}){
 const session=contents.session;let allowed=players.get(session);
 if(!allowed){allowed=new WeakSet();players.set(session,allowed);
  session.setPermissionRequestHandler((sender,permission,callback)=>callback(permission==='fullscreen'&&allowed.has(sender)));
  session.setPermissionCheckHandler((sender,permission)=>permission==='fullscreen'&&allowed.has(sender));
 }
 allowed.add(contents);let html=false;
 contents.on('enter-html-full-screen',()=>{html=true;});contents.on('leave-html-full-screen',()=>{html=false;});
 contents.on('before-input-event',(event,input)=>{
  if(input.type!=='keyDown'||input.isAutoRepeat||input.control||input.alt||input.meta)return;
  if(input.key==='F11'){
   event.preventDefault();
   if(html){contents.executeJavaScript('document.exitFullscreen()',true).catch(()=>{});return;}
   if(local&&!window.isFullScreen()){
    contents.executeJavaScript("(()=>{const host=document.querySelector('#video-host');if(host&&host.checkVisibility()&&host.querySelector('video,iframe')){host.requestFullscreen();return true;}return false;})()",true).then(opened=>{if(!opened&&!window.isDestroyed())window.setFullScreen(true);}).catch(()=>{});
   }else window.setFullScreen(!window.isFullScreen());
  }else if(input.key==='Escape'&&html){event.preventDefault();contents.executeJavaScript('document.exitFullscreen()',true).catch(()=>{});}
  else if(input.key==='Escape'&&window.isFullScreen()){event.preventDefault();window.setFullScreen(false);}
 });
}
