// Only provider-owned embeds published by the catalog are accepted. No scripts,
// player tokens or protected media URLs are extracted.
export const ANIME_EMBED_HOSTS=['old.yummyani.me','ru.yummyani.me','site.yummyani.me','video.sibnet.ru','kodik.info','kodik.cc','kodik.biz','kodik.video','kodik.online','kodikplayer.com','kodikplayer.net','aniqit.com','aniqit.net','aniqit.ru'];
export function animeEmbedURL(value){
 const url=new URL(value?.startsWith('//')?'https:'+value:value);
 if(url.protocol!=='https:'||url.username||url.password||url.port||!ANIME_EMBED_HOSTS.includes(url.hostname)||url.href.length>2048)throw new Error('Этот плеер пока не поддерживается.');
 return url.href;
}
export function onlinePlayerEntries(value){
 if(value===undefined)return undefined;
 if(!Array.isArray(value)||value.length>40)throw new Error('У серии может быть до 40 вариантов онлайн-просмотра.');
 const ids=new Set();return value.map(item=>{
  if(!item||typeof item.id!=='string'||!/^yummy:\d+$/.test(item.id)||ids.has(item.id)||!['dub','original','unknown'].includes(item.audioType)||typeof item.voice!=='string'||!item.voice.trim()||item.voice.length>120||typeof item.player!=='string'||!item.player.trim()||item.player.length>80||typeof item.subtitles!=='boolean'||![null,480,720,1080].includes(item.quality))throw new Error('Не удалось прочитать вариант просмотра.');
  ids.add(item.id);return {id:item.id,url:animeEmbedURL(item.url),voice:item.voice,player:item.player,audioType:item.audioType,subtitles:item.subtitles,quality:item.quality};
 });
}
export function yummyPlayers(raw,number){
 if(!Array.isArray(raw?.response))throw new Error('Каталог не вернул список плееров.');
 const result=[],ids=new Set();
 for(const entry of raw.response.slice(0,20000)){
  if(Number(entry.number)!==number||!Number.isSafeInteger(entry.video_id||entry.id))continue;
  let data=entry.data;try{if(typeof data==='string')data=JSON.parse(data);}catch{continue;}
  if(!data||typeof data.dubbing!=='string'||!data.dubbing.trim()||typeof data.player!=='string'||!data.player.trim())continue;
  const voice=data.dubbing.trim().slice(0,120);const subtitles=/субтитр|subtitles|\bsubs?\b/i.test(voice);const original=subtitles||/оригинал|original|японск|\braw\b/i.test(voice);
  // A non-Russian dub is never advertised as a Russian voice.
  if(/английск|украинск|english|україн/i.test(voice))continue;
  try{const url=animeEmbedURL(entry.iframe_url||entry.player_url||entry.url||data.iframe_url);const id=`yummy:${entry.video_id||entry.id}`;if(ids.has(id))continue;ids.add(id);const quality=String(entry.quality||'').match(/^(480|720|1080)p?$/)?.[1];result.push({id,url,voice,player:data.player.trim().slice(0,80),audioType:original?'original':'dub',subtitles,quality:quality?Number(quality):null});}catch{/* Unsupported hosts remain unavailable, never guessed. */}
 }
 return onlinePlayerEntries(result.slice(0,40));
}
export function parseAniDBPage(html,expectedId,Parser=DOMParser){
 if(typeof html!=='string'||html.length>3*1024*1024)throw new Error('AniDB вернул слишком большой ответ.');
 const document=new Parser().parseFromString(html,'text/html');const canonical=document.querySelector('link[rel="canonical"]')?.getAttribute('href')||document.querySelector('meta[property="og:url"]')?.getAttribute('content');
 try{const url=new URL(canonical,'https://anidb.net');if(url.protocol!=='https:'||!['anidb.net','www.anidb.net'].includes(url.hostname)||url.pathname.replace(/\/$/,'')!==`/anime/${expectedId}`)throw 0;}catch{throw new Error('AniDB не подтвердил выбранное аниме.');}
 const characters=[],seen=new Set();
 for(const bubble of document.querySelectorAll('#characterlist .g_bubble')){
  const links=[...bubble.querySelectorAll('a[href^="/character/"],a[href^="https://anidb.net/character/"]')];const link=links.find(a=>a.closest('.data .name')&&a.textContent.trim())||links.find(a=>a.textContent.trim());if(!link)continue;
  const id=Number(new URL(link.getAttribute('href'),'https://anidb.net').pathname.match(/^\/character\/(\d+)$/)?.[1]);const name=link.textContent.trim().slice(0,200);if(!id||!name||seen.has(id))continue;seen.add(id);
  const picture=bubble.querySelector('.thumb img')?.getAttribute('src');let imageUrl;
  try{const url=new URL(picture,'https://anidb.net');const match=url.pathname.match(/^\/images\/(?:main|\d{1,4})\/([\w-]+\.(?:png|jpe?g|webp))$/i);if(url.protocol==='https:'&&url.hostname==='cdn.anidb.net'&&match)imageUrl=`https://cdn.anidb.net/images/main/${match[1]}`;}catch{}
  const actors=[];for(const actor of bubble.querySelectorAll('.seiyuu a[href*="/creator/"]')){const actorName=actor.textContent.trim().slice(0,160);if(actorName)actors.push({name:actorName,id:Number(actor.getAttribute('href').match(/\/creator\/(\d+)/)?.[1])||null});}
  const role=bubble.closest('.character')?'main character in':bubble.closest('.cast')?'secondary cast in':'appears in';characters.push({id,name,role,...(imageUrl?{imageUrl}:{}),actors});if(characters.length>=500)break;
 }
 if(!characters.length)throw new Error('AniDB не вернул список персонажей. Возможно, сайт ограничил запрос.');
 return {id:expectedId,title:document.querySelector('h1')?.textContent.trim().slice(0,200)||'',characters,episodes:[],updatedAt:Date.now()};
}
