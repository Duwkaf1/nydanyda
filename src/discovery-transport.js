import {boundedText} from './subtitles.js';
export async function discoveryRequest(data,{signal}={}){
 signal?.throwIfAborted();
 if(globalThis.window?.kadr?.catalogRequest){const requestId=crypto.randomUUID();const cancel=()=>window.kadr.cancelCatalog(requestId);signal?.addEventListener('abort',cancel,{once:true});try{const result=await window.kadr.catalogRequest({...data,requestId});signal?.throwIfAborted();return result;}finally{signal?.removeEventListener('abort',cancel);}}
 const url=new URL('/__yoru/catalog',location.href);for(const [key,value]of Object.entries(data))url.searchParams.set(key,Array.isArray(value)?JSON.stringify(value):String(value));const response=await fetch(url,{signal,credentials:'omit'});let result;try{result=JSON.parse(await boundedText(response.ok?response:new Response(response.body,{headers:response.headers}),6*1024*1024));}catch{throw new Error(`Не удалось прочитать ответ каталога (HTTP ${response.status}).`);}if(typeof result?.error==='string')throw new Error(result.error.slice(0,1000));if(!response.ok)throw new Error(`Ошибка запроса каталога: HTTP ${response.status}.`);return result;
}
