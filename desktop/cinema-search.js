import {requestCinema} from './cinema-network.js';
import {cinemaSearchTerms,rankCinemaSearch} from '../src/cinema-search.js';
import {exactCinemaIdentity} from '../src/cinema-identities.js';
export async function requestCinemaSearch(data,{fetcher=globalThis.fetch,signal}={}){
 const {terms}=cinemaSearchTerms(data?.query);const exact=exactCinemaIdentity(data.query);const combined=signal?AbortSignal.any([signal,AbortSignal.timeout(18000)]):AbortSignal.timeout(18000);
 const jobs=terms.flatMap(query=>['movie','series'].map(media=>({kind:'cinema-list',provider:'cinemeta',media,query,genre:'',page:1,discovery:'yes',yearFrom:0,yearTo:0,minImdb:0,minTomatoes:0,cursor:0})));
 const results=new Array(jobs.length);let next=0;
 await Promise.all(Array.from({length:3},async()=>{while(next<jobs.length){const index=next++;try{results[index]={value:await requestCinema(jobs[index],{fetcher,signal:combined})};}catch(error){results[index]={error};}}}));
 signal?.throwIfAborted();const good=results.filter(result=>result.value),failures=results.filter(result=>result.error);
 if(!good.length&&!exact)throw new Error('Поиск фильмов и сериалов сейчас недоступен. Открой Lordfilm в Yoru или повтори запрос.');
 const unique=new Map();for(const result of good)for(const item of result.value.items)if(!unique.has(item.id))unique.set(item.id,item);
 const match=exact?unique.get(exact.id):undefined;
 if(exact)unique.delete(exact.id);
 const ranked=rankCinemaSearch([...unique.values()],data.query);
 if(exact)ranked.unshift({...exact,...match,...(!match?{metadataLimited:true}:{})});
 const items=ranked.slice(0,72);
 return {items,total:items.length,hasMore:false,provider:'cinemeta',scope:'title-search',...(failures.length||good.some(result=>result.value.fallback)?{warning:'Часть источников поиска недоступна. Показаны полученные результаты.'}:{})};
}
