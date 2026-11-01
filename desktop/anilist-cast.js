import {boundedText} from '../src/subtitles.js';
const QUERY=`query YoruCast($mal:Int!,$page:Int!){Media(idMal:$mal,type:ANIME){idMal title{romaji english native} characters(page:$page,perPage:50,sort:[ROLE,ID]){pageInfo{hasNextPage} edges{role node{id name{full} image{large}} voiceActors(language:JAPANESE){name{full}}}}}}`;
const cache=new Map();
export async function requestAniListCast(identity,{fetcher,signal,verify}){
 const old=cache.get(identity.malId);if(old&&Date.now()-old.time<86400000)return old.value;
 const edges=[];let title='',partial=false;
 for(let page=1;page<=4;page++){
  const response=await fetcher('https://graphql.anilist.co',{method:'POST',credentials:'omit',redirect:'error',signal,headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({query:QUERY,variables:{mal:identity.malId,page}})});
  if(!response.ok)throw new Error('AniList недоступен');
  const raw=JSON.parse(await boundedText(response,2*1024*1024));const media=raw?.data?.Media;
  if(media?.idMal!==identity.malId||!Array.isArray(media.characters?.edges)||!await verify(media.title))throw new Error('AniList не подтвердил выбранное аниме.');
  title=media.title.romaji||media.title.english||media.title.native;edges.push(...media.characters.edges);partial=media.characters.pageInfo?.hasNextPage===true;
  if(!partial)break;
 }
 if(!edges.length)throw new Error('AniList вернул пустой состав');
 const value={malId:identity.malId,title,characters:edges,partial};
 if(cache.size>=12)cache.delete(cache.keys().next().value);cache.set(identity.malId,{value,time:Date.now()});return value;
}
