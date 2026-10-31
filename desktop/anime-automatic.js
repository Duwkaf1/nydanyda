import {readFile} from 'node:fs/promises';
import {boundedText} from '../src/subtitles.js';
import {yummyPlayers} from '../src/anime-online.js';
const entries=new Map();let used=0,crosswalk;let lastAniDB=0,aniDBBusy=false;
const normalized=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}]/gu,'');
export async function resolveAnimeIdentity(raw){
 if(raw.id===5152&&raw.alias==='black-clover-special'&&raw.year===2016&&raw.episodes?.length===1)return {anidbId:12351,malId:33950,method:'reviewed-release-correction'};
 crosswalk ||= readFile(new URL('../data/anime-crosswalk.json',import.meta.url),'utf8').then(JSON.parse);
 const index=await crosswalk;const malId=Number(raw.mal?.id);const entry=index.entries[String(malId)];
 if(!entry||entry.year!==raw.year)return null;
 const names=new Set(entry.names.map(normalized));if(![raw.name?.english,raw.name?.main,raw.name?.alternative].some(name=>name&&names.has(normalized(name))))return null;
 return {anidbId:entry.anidbId,malId,method:'exact-mal-year-title'};
}
async function cached(url,{fetcher,signal,html=false,ttl=120000}){
 signal.throwIfAborted();const old=entries.get(url);if(old&&Date.now()-old.time<ttl)return old.value;
 const response=await fetcher(url,{credentials:'omit',redirect:'error',signal,headers:{Accept:html?'text/html':'application/json'}});const text=await boundedText(response,html?3*1024*1024:3*1024*1024);const value=html?text:JSON.parse(text);const size=text.length*2;
 if(size<6*1024*1024){if(old){entries.delete(url);used-=old.size;}while(entries.size&&(entries.size>=12||used+size>8*1024*1024)){const key=entries.keys().next().value;used-=entries.get(key).size;entries.delete(key);}entries.set(url,{value,size,time:Date.now()});used+=size;}
 return value;
}
export async function requestAnimeAutomatic(data,{fetcher=globalThis.fetch,signal}={}){
 if(!data||!['anime-options','anime-cast'].includes(data.kind)||!Number.isSafeInteger(data.releaseId)||data.releaseId<1||data.kind==='anime-options'&&(!Number.isFinite(data.number)||data.number<0||data.number>100000))throw new Error('Не удалось определить выбранное аниме и серию.');
 const total=signal?AbortSignal.any([signal,AbortSignal.timeout(18000)]):AbortSignal.timeout(18000);
 let raw;for(const origin of ['https://anilibria.top','https://aniliberty.top']){try{raw=await cached(`${origin}/api/v1/anime/releases/${data.releaseId}`,{fetcher,signal:AbortSignal.any([total,AbortSignal.timeout(4500)])});if(raw.id!==data.releaseId)throw new Error('ID не совпал.');break;}catch{raw=null;total.throwIfAborted();}}
 if(!raw)throw new Error('Не удалось проверить карточку аниме. Повторим при следующем открытии.');
 const identity=await resolveAnimeIdentity(raw);
 if(data.kind==='anime-cast'){
  if(!identity)throw new Error('Не удалось безопасно определить релиз AniDB. Чужих персонажей не подставляем.');
  const url=`https://anidb.net/anime/${identity.anidbId}`;const old=entries.get(url);if(old&&Date.now()-old.time<86400000)return {id:identity.anidbId,html:old.value};
  if(aniDBBusy||Date.now()-lastAniDB<5000)throw new Error('AniDB просит подождать перед следующей загрузкой.');
  aniDBBusy=true;lastAniDB=Date.now();try{return {id:identity.anidbId,html:await cached(url,{fetcher,signal:total,html:true,ttl:86400000})};}catch{throw new Error('AniDB сейчас недоступен. Уже сохранённые персонажи и заметки остаются на устройстве.');}finally{aniDBBusy=false;}
 }
 const query=raw.name?.english||raw.name?.main;let answered=false;
 for(const base of ['https://old.yummyani.me/api','https://api.yani.tv']){
  const url=new URL(base+'/anime');url.searchParams.set('q',String(query).slice(0,100));url.searchParams.set('limit','50');
  try{
   const phase=AbortSignal.any([total,AbortSignal.timeout(6000)]);const search=await cached(url.href,{fetcher,signal:phase});if(!Array.isArray(search.response))continue;answered=true;
   const matches=search.response.filter(item=>Number.isSafeInteger(item.anime_id)&&(!item.year||item.year===raw.year)&&(item.remote_ids?.anilibria_alias===raw.alias||identity&&Number(item.remote_ids?.myanimelist_id)===identity.malId));
   if(matches.length!==1)continue;
   const item=matches[0];const videos=await cached(`${base}/anime/${item.anime_id}/videos`,{fetcher,signal:phase});return {players:yummyPlayers(videos,data.number),anidbId:identity?.anidbId||null,yummyId:item.anime_id};
  }catch{total.throwIfAborted();}
 }
 return {players:[],anidbId:identity?.anidbId||null,message:answered?'Другие варианты для этого релиза пока не подтверждены.':'Не удалось загрузить другие озвучки и субтитры: Yummyani сейчас недоступен.'};
}
