import {cinemaItem} from './cinema-provider.js';
import {cinemaRatings} from './cinema-filters.js';
const name='yoru.cinema-cache.v1';
const key=args=>JSON.stringify([args.media,args.provider,args.query,args.genre,args.yearFrom||0,args.yearTo||0,args.minImdb||0,args.minTomatoes||0]);
function restore(item){
 if(!item||!['cinemeta','tvmaze'].includes(item.provider)||!['movie','series'].includes(item.media))return null;
 const raw=item.provider==='cinemeta'?{id:item.sourceId,type:item.media,name:item.title,releaseInfo:item.year,poster:item.posterUrl,genres:item.genres,imdbRating:item.rating}: {id:Number(item.sourceId),name:item.title,premiered:item.year,image:{original:item.posterUrl},genres:item.genres,rating:{average:item.rating},externals:{imdb:item.imdbId}};
 const safe=cinemaItem(raw,item.provider,item.media);if(!safe||safe.id!==item.id)return null;safe.ratings=cinemaRatings(item);if(item.imdbId&&item.alternatePosterUrl){const meta=cinemaItem({id:item.imdbId,name:item.title,type:item.media,poster:item.alternatePosterUrl},'cinemeta',item.media);if(meta?.posterUrl)safe.alternatePosterUrl=meta.posterUrl;}return safe;
}
export function cinemaCache(storage){return {
 put(args,result){if(args.provider==='archive'||!result.items?.length)return;try{let all=JSON.parse(storage.getItem(name)||'[]');if(!Array.isArray(all))all=[];all=all.filter(row=>row.key!==key(args)).slice(-5);const row={key:key(args),time:Date.now(),result:{items:result.items.slice(0,24),provider:result.provider,hasMore:false,total:null,...(result.fallback?{fallback:true,fallbackMessage:result.fallbackMessage}:{}),...(result.scope?{scope:result.scope}:{})}};all.push(row);let value=JSON.stringify(all);while(all.length>1&&value.length>512*1024){all.shift();value=JSON.stringify(all);}if(value.length<=512*1024)storage.setItem(name,value);}catch{}},
 get(args){try{const raw=storage.getItem(name);if(!raw||raw.length>512*1024)return null;const rows=JSON.parse(raw);if(!Array.isArray(rows))return null;const row=rows.find(row=>row.key===key(args));if(!row||!Number.isFinite(row.time)||Date.now()-row.time>7*86400000||row.time>Date.now()+60000||!Array.isArray(row.result?.items))return null;const items=row.result.items.slice(0,24).map(restore).filter(Boolean);if(!items.length)return null;return {...row.result,items,cachedAt:row.time};}catch{return null;}}
};}
