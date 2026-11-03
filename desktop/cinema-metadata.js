import {cinemaJSON} from './cinema-http.js';
import {cinemaItem,cinemaURL} from '../src/cinema-provider.js';
export async function requestCinemaMetadata(data,{fetcher=globalThis.fetch,signal}={}){
 if(!['movie','series'].includes(data.media)||!Array.isArray(data.ids)||data.ids.length>24||data.ids.some(id=>typeof id!=='string'||!/^tt\d{7,10}$/.test(id)))throw new Error('Некорректный запрос метаданных.');
 const timeout=AbortSignal.timeout(12000),combined=signal?AbortSignal.any([signal,timeout]):timeout,ids=[...new Set(data.ids)],items={};let next=0;
 await Promise.all(Array.from({length:Math.min(3,ids.length)},async()=>{while(next<ids.length){combined.throwIfAborted();const id=ids[next++];try{const raw=await cinemaJSON(cinemaURL({kind:'cinema-detail',provider:'cinemeta',media:data.media,id}),{fetcher,signal:combined});const item=cinemaItem(raw.meta,'cinemeta',data.media);if(item?.imdbId===id)items[id]={imdb:item.rating,posterUrl:item.posterUrl,year:item.year};}catch{}}}));return {items};
}
