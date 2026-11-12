import {boundedText} from '../src/subtitles.js';
const cache=new Map();let bytes=0;
export class CinemaHTTPError extends Error {
 constructor(url,code){const host=new URL(url).hostname;super(`${host}: ${code}`);this.name='CinemaHTTPError';this.code=code;this.host=host;}
}
function allowedRedirect(original, next){
 if(next.username||next.password)return false;
 if(next.origin===original.origin)return true;
 return original.origin==='https://v3-cinemeta.strem.io'&&next.origin==='https://cinemeta-live.strem.io'
  && /^\/meta\/(?:movie|series)\/tt\d{7,10}\.json$/.test(original.pathname)
  && next.pathname===original.pathname && !next.search && !next.hash;
}
export async function cinemaJSON(url,{fetcher=globalThis.fetch,signal,fresh=false}={}){
 signal?.throwIfAborted();const old=cache.get(url);if(!fresh&&old&&Date.now()-old.time<120000)return old.value;
 let response,target=url;const original=new URL(url);
 try{
  for(let redirects=0;redirects<4;redirects++){
   response=await fetcher(target,{credentials:'omit',redirect:'manual',signal,headers:{Accept:'application/json'}});
   if(![301,302,303,307,308].includes(response.status))break;
   const location=response.headers.get('location');await response.body?.cancel();
   let next;try{next=new URL(location,target);}catch{throw new CinemaHTTPError(url,'REDIRECT');}
   if(!location||redirects===3||!allowedRedirect(original,next))throw new CinemaHTTPError(url,'REDIRECT');
   target=next.href;
  }
 }catch(error){if(error instanceof CinemaHTTPError)throw error;throw new CinemaHTTPError(url,signal?.aborted?'TIMEOUT':/ERR_NAME_NOT_RESOLVED|ENOTFOUND|EAI_AGAIN/.test(String(error.cause?.code||error.message))?'DNS':'NETWORK');}
 if(response.status===404&&url.startsWith('https://api.tvmaze.com/shows?page='))return [];
 if(!response.ok){await response.body?.cancel();throw new CinemaHTTPError(url,`HTTP ${response.status}`);}
 let body,value;try{body=await boundedText(response,6*1024*1024);value=JSON.parse(body);}catch{throw new CinemaHTTPError(url,signal?.aborted?'TIMEOUT':'INVALID_JSON_OR_SIZE');}
 if(body.length<=2*1024*1024){if(cache.has(url)){bytes-=cache.get(url).size;cache.delete(url);}while(cache.size&&(cache.size>=12||bytes+body.length>8*1024*1024)){const key=cache.keys().next().value;bytes-=cache.get(key).size;cache.delete(key);}cache.set(url,{value,time:Date.now(),size:body.length});bytes+=body.length;}
 return value;
}
export function cinemaFailure(error,provider){return error instanceof CinemaHTTPError?error.message:`${provider}: ${['TimeoutError','AbortError'].includes(error?.name)?'TIMEOUT':error instanceof TypeError?'NETWORK':'INVALID_RESPONSE'}`;}
