import {boundedText} from '../src/subtitles.js';
const cache=new Map();
export function parseCinemaRatings(raw,id,media){
 if(raw?.Response!=='True'||raw.imdbID!==id||raw.Type!==media)throw new Error('Не совпала карточка рейтингов.');
 const imdb=/^(?:\d(?:\.\d)?|10(?:\.0)?)$/.test(raw.imdbRating)&&Number(raw.imdbRating)>0?Number(raw.imdbRating):null;
 const value=raw.Ratings?.find(row=>row.Source==='Rotten Tomatoes')?.Value;
 const tomatoes=typeof value==='string'&&/^(?:\d{1,2}|100)%$/.test(value)?Number(value.slice(0,-1)):null;
 return {imdb,rottenTomatoes:tomatoes};
}
export async function cinemaRating(id,media,{fetcher=globalThis.fetch,signal,ratingsKey=''}={}){
 if(!/^tt\d{7,10}$/.test(id)||!['movie','series'].includes(media))throw new Error('Некорректная карточка рейтингов.');
 if(!ratingsKey)return {imdb:null,rottenTomatoes:null,available:false};
 const key=`${media}:${id}`;const old=cache.get(key);if(old&&old.owner===ratingsKey&&Date.now()-old.time<86400000)return old.value;
 const url=new URL('https://www.omdbapi.com/');url.searchParams.set('apikey',ratingsKey);url.searchParams.set('i',id);
 try{const deadline=AbortSignal.timeout(6000);const combined=signal?AbortSignal.any([signal,deadline]):deadline;const raw=JSON.parse(await boundedText(await fetcher(url.href,{credentials:'omit',redirect:'error',signal:combined,headers:{Accept:'application/json'}}),256*1024));const value={...parseCinemaRatings(raw,id,media),available:true};if(cache.size>=300)cache.delete(cache.keys().next().value);cache.set(key,{value,owner:ratingsKey,time:Date.now()});return value;}catch{throw new Error('Рейтинги OMDb недоступны. Проверь ключ и лимит запросов в настройках.');}
}
export async function requestCinemaRatings(data,options={}){
 if(!['movie','series'].includes(data.media)||!Array.isArray(data.ids)||data.ids.length>24||data.ids.some(id=>typeof id!=='string'||!/^tt\d{7,10}$/.test(id)))throw new Error('Некорректный запрос рейтингов.');
 const deadline=AbortSignal.timeout(12000);options={...options,signal:options.signal?AbortSignal.any([options.signal,deadline]):deadline};
 const ids=[...new Set(data.ids)],items={};let next=0;await Promise.all(Array.from({length:Math.min(3,ids.length)},async()=>{while(next<ids.length){options.signal?.throwIfAborted();const id=ids[next++];try{items[id]=await cinemaRating(id,data.media,options);}catch{items[id]={imdb:null,rottenTomatoes:null,available:false};}}}));return {items,configured:!!options.ratingsKey};
}
