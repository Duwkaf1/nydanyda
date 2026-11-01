import {episodeReference} from '../src/episode-cast.js';
import {requestAniListCast} from './anilist-cast.js';
import {readFile} from 'node:fs/promises';
import {boundedText} from '../src/subtitles.js';
import {yummyPlayers} from '../src/anime-online.js';
const entries=new Map();let used=0,crosswalk;let lastAniDB=0,aniDBQueue=Promise.resolve(),aniDBUnavailableUntil=0;
const normalized=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}]/gu,'');
export async function resolveAnimeIdentity(raw){
 if(raw.id===5152&&raw.alias==='black-clover-special'&&raw.year===2016&&raw.episodes?.length===1)return {anidbId:12351,malId:33950,method:'reviewed-release-correction',episodeCount:1};
 crosswalk ||= readFile(new URL('../data/anime-crosswalk.json',import.meta.url),'utf8').then(JSON.parse);
 const index=await crosswalk;const malId=Number(raw.mal?.id);const entry=index.entries[String(malId)];
 if(!entry||entry.year!==raw.year)return null;
 const names=new Set(entry.names.map(normalized));if(![raw.name?.english,raw.name?.main,raw.name?.alternative].some(name=>name&&names.has(normalized(name))))return null;
 return {anidbId:entry.anidbId,malId,method:'exact-mal-year-title',episodeCount:entry.episodes};
}
async function cached(url,{fetcher,signal,html=false,ttl=120000}){
 signal.throwIfAborted();const old=entries.get(url);if(old&&Date.now()-old.time<ttl)return old.value;
 const response=await fetcher(url,{credentials:'omit',redirect:'error',signal,headers:{Accept:html?'text/html':'application/json'}});if(!response.ok){const error=new Error(`HTTP ${response.status}`);error.status=response.status;throw error;}const text=await boundedText(response,3*1024*1024);const value=html?text:JSON.parse(text);const size=text.length*2;
 if(size<6*1024*1024){const prior=entries.get(url);if(prior){entries.delete(url);used-=prior.size;}while(entries.size&&(entries.size>=12||used+size>8*1024*1024)){const key=entries.keys().next().value;used-=entries.get(key).size;entries.delete(key);}entries.set(url,{value,size,time:Date.now()});used+=size;}
 return value;
}
export async function requestAnimeAutomatic(data,{fetcher=globalThis.fetch,signal}={}){
 if(!data||!['anime-options','anime-cast','anime-episodes','anime-episode-cast'].includes(data.kind)||data.provider!==undefined&&!['anilibria','yummyani'].includes(data.provider)||!Number.isSafeInteger(data.releaseId)||data.releaseId<1||['anime-options','anime-episode-cast'].includes(data.kind)&&(!Number.isFinite(data.number)||data.number<0||data.number>100000))throw new Error('Не удалось определить выбранное аниме и серию.');
 if(data.castSource!==undefined&&(data.kind!=='anime-cast'||data.castSource!=='jikan'))throw new Error('Неизвестный каталог персонажей.');
 const total=signal?AbortSignal.any([signal,AbortSignal.timeout(data.kind==='anime-cast'?35000:18000)]):AbortSignal.timeout(data.kind==='anime-cast'?35000:18000);
 let raw,yummy;
 if(data.provider==='yummyani'){
  const result=await yummyRequest(`/anime/${data.releaseId}`,{fetcher,signal:total});yummy=result.response;
  if(yummy?.anime_id!==data.releaseId)throw new Error('Каталог вернул другое аниме.');
  raw={id:yummy.anime_id,alias:yummy.remote_ids?.anilibria_alias,year:yummy.year,mal:{id:Number(yummy.remote_ids?.myanimelist_id)},name:{main:yummy.title,english:yummy.other_titles?.[0],alternative:yummy.other_titles?.join(' / ')}};
  if(data.kind==='anime-episodes')return yummyRequest(`/anime/${data.releaseId}/videos`,{fetcher,signal:total});
 }else{
  if(data.kind==='anime-episodes')throw new Error('Неизвестный каталог серий.');
  for(const origin of ['https://anilibria.top','https://aniliberty.top']){try{raw=await cached(`${origin}/api/v1/anime/releases/${data.releaseId}`,{fetcher,signal:AbortSignal.any([total,AbortSignal.timeout(4500)])});if(raw.id!==data.releaseId)throw new Error('ID не совпал.');break;}catch{raw=null;total.throwIfAborted();}}
 }
 if(!raw)throw new Error('Не удалось проверить карточку аниме. Повторим при следующем открытии.');
 let identity=await resolveAnimeIdentity(raw);
 // Yummyani supplies multiple exact alternative names; verify them individually.
 if(!identity&&yummy)for(const name of yummy.other_titles||[]){identity=await resolveAnimeIdentity({...raw,name:{main:name}});if(identity)break;}
 if(data.kind==='anime-episode-cast'){
  if(!identity)throw new Error('Не удалось подтвердить релиз для списка появлений.');
  if(identity.episodeCount===1&&data.number===1)return {id:identity.anidbId,number:1,singleRelease:true};
  if(identity.malId!==34572||!Number.isInteger(data.number)||data.number<1||data.number>170)return {id:identity.anidbId,number:data.number,supported:false,message:'У подключённых каталогов нет подтверждённых появлений по сериям для этого релиза.'};
  const sourceURL=episodeReference(data.number);const url=new URL('https://blackclover.fandom.com/api.php');for(const [key,value]of Object.entries({action:'parse',page:`Episode ${data.number}`,prop:'text',format:'json',formatversion:2}))url.searchParams.set(key,String(value));
  const raw=await cached(url.href,{fetcher,signal:AbortSignal.any([total,AbortSignal.timeout(8000)]),ttl:86400000});
  const title=raw.parse?.title?.replaceAll('_',' ').trim();const html=typeof raw.parse?.text==='string'?raw.parse.text:raw.parse?.text?.['*'];
  if(title!==`Episode ${data.number}`||typeof html!=='string')throw new Error('Источник не подтвердил номер серии.');
  return {id:identity.anidbId,malId:34572,number:data.number,sourceURL,html};
 }
 if(data.kind==='anime-cast'){
  if(!identity)throw new Error('Не удалось безопасно определить релиз AniDB. Чужих персонажей не подставляем.');
  const url=`https://anidb.net/anime/${identity.anidbId}`;const old=entries.get(url);if(data.castSource!=='jikan'&&old&&Date.now()-old.time<86400000)return {id:identity.anidbId,html:old.value};
  try{
   if(data.castSource==='jikan')throw new Error('Выбран резервный каталог');
   if(Date.now()<aniDBUnavailableUntil)throw new Error('AniDB временно недоступен');
   const task=aniDBQueue.catch(()=>{}).then(async()=>{
    total.throwIfAborted();if(Date.now()<aniDBUnavailableUntil)throw new Error('AniDB временно недоступен');const cachedPage=entries.get(url);if(cachedPage&&Date.now()-cachedPage.time<86400000)return cachedPage.value;
    const wait=Math.max(0,5000-(Date.now()-lastAniDB));if(wait)await new Promise((resolve,reject)=>{const done=()=>{total.removeEventListener('abort',abort);resolve();};const timer=setTimeout(done,wait);const abort=()=>{clearTimeout(timer);reject(total.reason);};total.addEventListener('abort',abort,{once:true});});
    total.throwIfAborted();lastAniDB=Date.now();return cached(url,{fetcher,signal:AbortSignal.any([total,AbortSignal.timeout(5000)]),html:true,ttl:86400000});
   });aniDBQueue=task;
   const html=await task;if(!/id=["']characterlist["']/.test(html)){const bad=entries.get(url);if(bad){used-=bad.size;entries.delete(url);}const error=new Error('AniDB не вернул персонажей');error.status=429;throw error;}
   return {id:identity.anidbId,html};
  }catch(error){total.throwIfAborted();if(error.status===429)aniDBUnavailableUntil=Date.now()+60000;}
  try{
   const phase=AbortSignal.any([total,AbortSignal.timeout(8000)]);
   const detail=await cached(`https://api.jikan.moe/v4/anime/${identity.malId}/full`,{fetcher,signal:phase,ttl:86400000});
   const verified=await resolveAnimeIdentity({year:raw.year,mal:{id:detail.data?.mal_id},name:{main:detail.data?.title,english:detail.data?.title_english}});
   if(!verified||verified.anidbId!==identity.anidbId||detail.data?.mal_id!==identity.malId)throw new Error('Другой релиз');
   const cast=await cached(`https://api.jikan.moe/v4/anime/${identity.malId}/characters`,{fetcher,signal:phase,ttl:86400000});
   return {id:identity.anidbId,fallback:{malId:identity.malId,title:detail.data.title,characters:cast.data}};
  }catch{total.throwIfAborted();}
  try{
   const anilist=await requestAniListCast(identity,{fetcher,signal:AbortSignal.any([total,AbortSignal.timeout(8000)]),verify:async title=>{
    for(const name of Object.values(title||{})){if(!name)continue;const candidate=await resolveAnimeIdentity({year:raw.year,mal:{id:identity.malId},name:{main:name}});if(candidate?.anidbId===identity.anidbId)return true;}return false;
   }});return {id:identity.anidbId,anilist};
  }catch{throw new Error('AniDB и резервный каталог персонажей (MyAnimeList / AniList) сейчас недоступны. Сохранённый каст остаётся на устройстве.');}
 }
 if(yummy)return {players:yummyPlayers(await yummyRequest(`/anime/${data.releaseId}/videos`,{fetcher,signal:total}),data.number),anidbId:identity?.anidbId||null,yummyId:data.releaseId};

 const queries=[...new Set([raw.name?.english,raw.name?.main].filter(Boolean).map(name=>String(name).slice(0,100)))].slice(0,2);
 const collected=new Map();let answered=false,yummyId=null;
 search:for(const base of ['https://api.yani.tv','https://old.yummyani.me/api'])for(const query of queries){
  const url=new URL(base+'/anime');url.searchParams.set('q',query);url.searchParams.set('limit','50');
  try{
   const phase=AbortSignal.any([total,AbortSignal.timeout(4500)]);const search=await cached(url.href,{fetcher,signal:phase});if(!Array.isArray(search.response))continue;answered=true;
   const matches=[];for(const item of search.response)if(await yummyReleaseMatch(item,raw,identity))matches.push(item);
   if(!matches.length||matches.length>3||matches.length>1&&matches.some(item=>Number(item.remote_ids?.myanimelist_id)!==identity?.malId))continue;
   for(const item of matches){const videos=await cached(`${base}/anime/${item.anime_id}/videos`,{fetcher,signal:phase});for(const player of yummyPlayers(videos,data.number))collected.set(player.id,player);yummyId??=item.anime_id;}
   if([...collected.values()].some(player=>player.audioType==='original'&&player.subtitles))break search;
  }catch(error){if(signal?.aborted)throw error;if(total.aborted)break search;}
 }
 return {players:[...collected.values()].slice(0,40),anidbId:identity?.anidbId||null,yummyId,message:answered?'Проверены опубликованные плееры этого релиза.':'Не удалось проверить дополнительные плееры: источники сейчас недоступны.'};
}

async function yummyRequest(path,{fetcher,signal}){
 let failure;for(const base of ['https://api.yani.tv','https://old.yummyani.me/api']){try{return await cached(base+path,{fetcher,signal:AbortSignal.any([signal,AbortSignal.timeout(6000)])});}catch(error){failure=error;signal.throwIfAborted();}}throw failure;
}

export async function yummyReleaseMatch(item,raw,identity){
 if(!Number.isSafeInteger(item?.anime_id)||item.anime_id<1)return false;
 const linkedMal=Number(item.remote_ids?.myanimelist_id);const exactId=identity&&linkedMal===identity.malId;
 if(identity&&linkedMal&&linkedMal!==identity.malId)return false;
 const sameYear=!item.year||item.year===raw.year;
 if(sameYear&&(exactId||typeof raw.alias==='string'&&raw.alias.length>0&&item.remote_ids?.anilibria_alias===raw.alias))return true;
 // Festival and disc dates can differ. Only an exact ID plus an indexed name
 // may bridge that difference; a similarly titled TV season cannot.
 if(exactId)for(const name of [item.title,...(Array.isArray(item.other_titles)?item.other_titles:[])]){
  if(!name)continue;const verified=await resolveAnimeIdentity({year:raw.year,mal:{id:identity.malId},name:{main:name}});if(verified?.anidbId===identity.anidbId)return true;
 }
 return false;
}
