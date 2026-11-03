import {matchesCinema} from '../src/cinema-filters.js';
import {cinemaRating} from './cinema-ratings.js';
import {boundedText} from '../src/subtitles.js';
import {cinemaArgs,cinemaURL,cinemaItem} from '../src/cinema-provider.js';
const cache=new Map();let bytes=0;
async function json(url,fetcher,signal){
 signal.throwIfAborted();const old=cache.get(url);if(old&&Date.now()-old.time<120000)return old.value;
 const response=await fetcher(url,{credentials:'omit',redirect:'error',signal,headers:{Accept:'application/json'}});
 if(response.status===404&&url.startsWith('https://api.tvmaze.com/shows?page='))return [];
 const body=await boundedText(response,6*1024*1024);const value=JSON.parse(body);
 if(body.length<=2*1024*1024){while(cache.size&&(cache.size>=8||bytes+body.length>8*1024*1024)){const key=cache.keys().next().value;bytes-=cache.get(key).size;cache.delete(key);}if(old&&cache.has(url)){bytes-=old.size;cache.delete(url);}cache.set(url,{value,time:Date.now(),size:body.length});bytes+=body.length;}
 return value;
}
export async function requestCinema(data,{fetcher=globalThis.fetch,signal,ratingsKey}={}){
 cinemaArgs(data);const timeout=AbortSignal.timeout(16000);const total=signal?AbortSignal.any([signal,timeout]):timeout;
 async function run(args,first){
  const deadline=first&&args.kind==='cinema-list'&&args.provider==='cinemeta'?AbortSignal.any([total,AbortSignal.timeout(8000)]):total;
  const get=url=>json(url,fetcher,deadline);
  if(args.kind==='cinema-genres'){const raw=await get(cinemaURL(args));const catalog=raw.catalogs?.find(item=>item.type===args.media&&item.id==='top');const options=catalog?.extra?.find(extra=>extra.name==='genre')?.options;if(!Array.isArray(options))throw new Error('Список жанров временно недоступен.');return {genres:options.filter(value=>typeof value==='string'&&value.length<=60).slice(0,80)};}
  if(args.kind==='cinema-detail'){
   const raw=await get(cinemaURL(args));const item=cinemaItem(args.provider==='cinemeta'?raw.meta:raw,args.provider,args.media);
   if(!item||item.sourceId!==args.id)throw new Error('Сервис вернул другую карточку. Повтори открытие.');
   return {item,...(args.provider==='archive'?{archive:raw}:{})};
  }
  if(args.provider==='archive'){
   const raw=await get(cinemaURL(args));if(!Array.isArray(raw.response?.docs))throw new Error('Каталог фильмов вернул неизвестный ответ.');
   const items=raw.response.docs.slice(0,24).map(r=>cinemaItem(r,'archive','movie')).filter(Boolean).filter(item=>args.discovery!=='yes'||matchesCinema(item,args));return {items,hasMore:args.page*24<raw.response.numFound,total:raw.response.numFound,provider:'archive'};
  }
  if(args.discovery==='yes'){
   if(args.minTomatoes&&!ratingsKey)throw new Error('Для фильтра Rotten Tomatoes подключи ключ OMDb в настройках.');
   const size=args.provider==='cinemeta'?100:250;let cursor=args.cursor||0,scanned=0,ended=false;const items=[];
   while(items.length<24&&scanned<300&&!ended){
    const raw=await get(cinemaURL(args,Math.floor(cursor/size)));const rows=args.provider==='cinemeta'?raw.metas:Array.isArray(raw)?raw:null;
    if(!Array.isArray(rows))throw new Error('Каталог вернул неизвестный ответ.');
    // TVmaze search is one bounded response, not the paginated show index.
    const search=args.provider==='tvmaze'&&args.query.trim();const within=search?cursor:cursor%size;
    if(within>=rows.length){ended=true;break;}
    const chunk=rows.slice(within,within+Math.min(24,300-scanned));const mapped=chunk.map(row=>cinemaItem(row,args.provider,args.media));
    if(args.minImdb||args.minTomatoes){let next=0;await Promise.all(Array.from({length:3},async()=>{while(next<mapped.length){const index=next++,item=mapped[index];if(!item?.imdbId||!matchesCinema(item,{...args,minImdb:0,minTomatoes:0}))continue;if(args.minImdb&&item.provider==='cinemeta'&&item.rating===null){try{const raw=await get(cinemaURL({kind:'cinema-detail',provider:'cinemeta',media:args.media,id:item.imdbId}));const detail=cinemaItem(raw.meta,'cinemeta',args.media);if(detail?.id===item.id)item.rating=detail.rating;}catch{}}if(args.minTomatoes||args.minImdb&&ratingsKey&&(item.provider!=='cinemeta'||item.rating===null)){try{const r=await cinemaRating(item.imdbId,args.media,{fetcher,signal:deadline,ratingsKey});item.ratings={imdb:item.provider==='cinemeta'?item.rating:null,...r};}catch{}}}}));}
    for(let i=0;i<mapped.length;i++){cursor++;scanned++;if(mapped[i]&&matchesCinema(mapped[i],args))items.push(mapped[i]);if(items.length===24)break;}
    ended=(search||rows.length<size)&&((search?cursor:cursor%size)>=rows.length||cursor%size===0);
   }
   return {items,hasMore:!ended,nextCursor:cursor,total:null,provider:args.provider,scanned};
  }
  const size=args.provider==='cinemeta'?100:250;const offset=(args.page-1)*24;const providerPage=Math.floor(offset/size);const within=offset%size;
  const firstRaw=await get(cinemaURL(args,providerPage));const list=raw=>args.provider==='cinemeta'?raw.metas:Array.isArray(raw)?raw:null;
  let all=list(firstRaw);if(!Array.isArray(all))throw new Error('Каталог вернул неизвестный ответ.');
  if(args.provider==='tvmaze'&&args.query.trim()){const filtered=all.map(x=>cinemaItem(x,'tvmaze','series')).filter(Boolean).filter(item=>!args.genre||item.genres.includes(args.genre));return {items:filtered.slice(offset,offset+24),hasMore:offset+24<filtered.length,total:filtered.length,provider:args.provider};}
  let more=all.length>=size;
  if(within+24>size&&more){const next=list(await get(cinemaURL(args,providerPage+1)));if(!Array.isArray(next))throw new Error('Не удалось получить следующую страницу.');all=[...all,...next];more=next.length>=size;}
  const items=all.slice(within,within+24).map(x=>cinemaItem(x,args.provider,args.media)).filter(Boolean);
  return {items:items.filter(item=>!args.genre||!item.genres.length||item.genres.includes(args.genre)),hasMore:within+24<all.length||more,total:null,provider:args.provider};
 }
 try{return await run(data,true);}catch(error){
  if(total.aborted)throw new Error('Сервис долго не отвечает. Проверь соединение и повтори попытку.');
  if(data.discovery==='yes')throw new Error(error.message?.startsWith('Для фильтра')?error.message:'Не удалось загрузить выбранный каталог. Фильтры сохранены. Повтори позже или выбери другой источник.');
  if(data.kind!=='cinema-list'||data.provider!=='cinemeta')throw new Error('Не удалось загрузить каталог. Попробуй другой источник или повтори позже.');
  const provider=data.media==='series'?'tvmaze':'archive';try{const result=await run({...data,provider},false);return {...result,fallback:true,fallbackMessage:`Основной каталог недоступен. Показаны результаты ${provider==='archive'?'Internet Archive':'TVmaze'}.`};}catch{throw new Error('Каталоги сейчас недоступны. Попробуй ещё раз; сохранённая библиотека остаётся на устройстве.');}
 }
}
