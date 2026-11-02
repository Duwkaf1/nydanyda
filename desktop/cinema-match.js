import {boundedText} from '../src/subtitles.js';
import {kinopoiskPage} from '../src/cinema-mirrors.js';
export function matchedKinopoisk(html,data){
 if(typeof html!=='string'||html.length>2*1024*1024||!/^tt\d{7,10}$/.test(data?.imdbId)||!['movie','series'].includes(data.media))throw new Error('Не удалось проверить карточку.');
 const ids=new Set();let nodes=0;
 function inspect(node,depth=0){if(!node||typeof node!=='object'||depth>12||++nodes>10000)return;if(Array.isArray(node)){for(const value of node)inspect(value,depth+1);return;}
  const types=Array.isArray(node['@type'])?node['@type']:[node['@type']];const expected=data.media==='series'?['TVSeries','TVSeason']:['Movie'];
  if(types.some(t=>expected.includes(t))){const same=Array.isArray(node.sameAs)?node.sameAs:[node.sameAs];const exact=same.some(value=>{try{const u=new URL(value);return u.protocol==='https:'&&['imdb.com','www.imdb.com'].includes(u.hostname)&&u.pathname.replace(/\/$/,'')===`/title/${data.imdbId}`;}catch{return false;}});
   if(exact)for(const value of [node.url,node['@id']])try{ids.add(kinopoiskPage(value,data.media).id);}catch{}
  }
  for(const value of Object.values(node))if(value&&typeof value==='object')inspect(value,depth+1);
 }
 for(const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi))try{inspect(JSON.parse(match[1]));}catch{}
 return ids.size===1?{kinopoiskId:[...ids][0],matchedBy:'exact-imdb'}:{kinopoiskId:null,message:ids.size>1?'Найдено несколько разных карточек Кинопоиска. Укажи точную ссылку.':'Точное соответствие не найдено. Можно указать ссылку Кинопоиска.'};
}
export async function matchCinema(data,{fetcher=globalThis.fetch,signal}={}){
 if(!/^tt\d{7,10}$/.test(data?.imdbId)||!['movie','series'].includes(data.media)||typeof data.query!=='string'||!data.query.trim()||data.query.length>160)throw new Error('Для подбора нужен точный IMDb ID и название.');
 const url=new URL('https://www.kinopoisk.ru/index.php');url.searchParams.set('kp_query',data.query);
 try{const response=await fetcher(url.href,{credentials:'omit',redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(6000)]):AbortSignal.timeout(6000),headers:{Accept:'text/html'}});if(!response.ok)throw new Error('Unavailable');return matchedKinopoisk(await boundedText(response,2*1024*1024),data);}catch(error){if(signal?.aborted)throw error;return {kinopoiskId:null,message:'Автоподбор недоступен. Можно указать ссылку Кинопоиска.'};}
}
