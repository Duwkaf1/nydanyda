import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {FiltersEngine,Request} from '@ghostery/adblocker';
const fallbackRules='||doubleclick.net^\n||googlesyndication.com^\n||adfox.ru^\n||adriver.ru^\n||an.yandex.ru^';
export function loadPlayerBlocker(){
 try{return FiltersEngine.deserialize(readFileSync(new URL('../data/adblock/engine.bin',import.meta.url)));}
 catch(error){console.warn('Yoru: using basic advertising protection:',error.message);return FiltersEngine.parse(fallbackRules);}
}
export function requestDecision(engine,details){
 if(!/^https?:\/\//i.test(details.url)||details.resourceType==='mainFrame')return {};
 const request=Request.fromRawDetails({url:details.url,sourceUrl:details.referrer||details.frame?.url||'',type:({xmlHttpRequest:'xmlhttprequest',webSocket:'websocket'}[details.resourceType]||details.resourceType||'other')});
 const result=engine.match(request);
 if(result.redirect){const resource=result.filter?.getRedirectResource()||'';return {redirectURL:resource.startsWith('noop-vast')?result.redirect.dataUrl.replace(/^data:[^;,]+/,'data:application/xml'):result.redirect.dataUrl};}
 return result.match?{cancel:true}:{};
}
export function createPlayerProtection(engine=loadPlayerBlocker()){
 const sessions=new WeakSet(),contents=new WeakSet(),resources=new Map(),redirects=new Map();
 function localResource(uri){
  const previous=redirects.get(uri);if(previous)return previous;
  const match=uri.match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/);if(!match)return null;
  const body=match[2]?Buffer.from(match[3],'base64'):Buffer.from(decodeURIComponent(match[3]));
  const id=createHash('sha256').update(match[1]).update(body).digest('hex');const url=`yoru-adblock://resources/${id}`;
  if(resources.size>=256){const first=resources.keys().next().value;resources.delete(first);for(const [data,target]of redirects)if(target.endsWith(first))redirects.delete(data);}
  resources.set(id,{body,type:match[1]});redirects.set(uri,url);return url;
 }
 function protectSession(session){
  if(sessions.has(session))return;sessions.add(session);
  session.protocol.handle('yoru-adblock',request=>{
   const url=new URL(request.url);const resource=url.hostname==='resources'&&request.method==='GET'&&resources.get(url.pathname.slice(1));
   return resource?new Response(resource.body,{headers:{'Content-Type':resource.type,'Access-Control-Allow-Origin':'*','Cross-Origin-Resource-Policy':'cross-origin','Cache-Control':'public, max-age=86400'}}):new Response('',{status:404});
  });
  session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(details,callback)=>{
   // Main-process catalog/API traffic has no browsing context and stays independent.
   if(!details.webContentsId){callback({});return;}
   const decision=requestDecision(engine,details);if(decision.redirectURL){const resource=localResource(decision.redirectURL);callback(resource?{redirectURL:resource}:{cancel:true});}else callback(decision);
  });
 }
 function cosmetics(frame){
  try{
   if(frame.isDestroyed()||!/^https:\/\//i.test(frame.url))return;
   const url=frame.url,request=Request.fromRawDetails({url,type:'document'});
   const {styles,scripts}=engine.getCosmeticsFilters({url,hostname:request.hostname,domain:request.domain,getBaseRules:true,getInjectionRules:true,getExtendedRules:false,getRulesFromHostname:true,getRulesFromDOM:false});
   // Trusted bundled list output runs in the remote frame, with its existing sandbox.
   // No renderer IPC or Node.js bridge is exposed to advertisements or players.
   const code=`if(location.href===${JSON.stringify(url)}){${styles?`try{const sheet=new CSSStyleSheet();sheet.replaceSync(${JSON.stringify(styles)});document.adoptedStyleSheets=[...document.adoptedStyleSheets,sheet];}catch{}`:''}\n${scripts.join('\n')}\n}`;
   if(styles||scripts.length)frame.executeJavaScript(code).catch(()=>{});
  }catch{/* A frame can be detached while navigating or closing. */}
 }
 function protectContents(webContents){
  if(contents.has(webContents))return;contents.add(webContents);protectSession(webContents.session);
  webContents.setWindowOpenHandler(()=>({action:'deny'}));
  webContents.on('frame-created',(_event,{frame})=>frame.on('dom-ready',()=>cosmetics(frame)));
  webContents.on('dom-ready',()=>cosmetics(webContents.mainFrame));
 }
 return {protectSession,protectContents};
}
