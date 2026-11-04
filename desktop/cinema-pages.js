import {boundedText} from '../src/subtitles.js';
import {kinopoiskPage} from '../src/cinema-mirrors.js';
import {publicCinemaPoster} from '../src/cinema-public.js';
const cache=new Map(),blocked=new Map();
const clean=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const year=value=>String(value||'').match(/\b\d{4}\b/)?.[0]||'';
const decode=value=>value.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
export function rottenPage(value,media){if(typeof value!=='string'||value.length>500)return null;try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.search&&!url.hash&&['www.rottentomatoes.com','rottentomatoes.com'].includes(url.hostname)&&new RegExp('^/'+(media==='series'?'tv':'m')+'/[a-z0-9_-]+/?$','i').test(url.pathname)?url.href:null;}catch{return null;}}
function jsonNodes(html){const nodes=[];let visited=0;function walk(value,depth=0){if(!value||typeof value!=='object'||depth>10||++visited>10000)return;if(Array.isArray(value)){for(const x of value)walk(x,depth+1);return;}nodes.push(value);for(const x of Object.values(value))if(x&&typeof x==='object')walk(x,depth+1);}for(const tag of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi))try{walk(JSON.parse(tag[1]));}catch{}return nodes;}
function identity(node,data){const types=Array.isArray(node['@type'])?node['@type']:[node['@type']];if(!types.includes(data.media==='movie'?'Movie':'TVSeries'))return false;const same=Array.isArray(node.sameAs)?node.sameAs:[node.sameAs];const imdb=same.map(value=>{try{const u=new URL(value);return ['imdb.com','www.imdb.com'].includes(u.hostname)?u.pathname.match(/^\/title\/(tt\d{7,10})\/?$/)?.[1]:null;}catch{return null;}}).filter(Boolean);if(imdb.length)return imdb.every(id=>id===data.imdbId);return clean(node.name)===clean(data.title)&&!!year(data.year)&&year(node.datePublished||node.startDate)===year(data.year);}
export function parseCinemaPage(html,data,source){
 if(typeof html!=='string'||html.length>2*1024*1024)throw new Error('Страница слишком большая.');
 const valid=jsonNodes(html).filter(node=>identity(node,data));if(!valid.length)return {ratings:{},posterUrl:''};
 if(source==='kinopoisk'){
  const nodes=valid.filter(node=>{try{return kinopoiskPage(node.url||node['@id'],data.media).id===data.kinopoiskId;}catch{return false;}});if(nodes.length!==1)return {ratings:{},posterUrl:''};const node=nodes[0];const raw=node.aggregateRating;const score=Number(raw?.ratingValue);const max=Number(raw?.bestRating||10);
  const image=typeof node.image==='string'?node.image:node.image?.url;
  return {ratings:{...(Number.isFinite(score)&&score>0&&score<=10&&max===10?{kinopoisk:score}:{})},posterUrl:publicCinemaPoster(image)};
 }
 if(source==='rottenTomatoes'){
  const nodes=valid.filter(node=>rottenPage(node.url||node['@id'],data.media)===rottenPage(data.rottenTomatoesUrl,data.media));if(nodes.length!==1)return {ratings:{},posterUrl:''};
  let score=null;const attr=html.match(/<score-board\b[^>]*\btomatometerscore\s*=\s*["'](\d{1,3})["']/i);if(attr)score=Number(attr[1]);
  if(score===null)for(const tag of html.matchAll(/<script\b[^>]*id\s*=\s*["']media-scorecard-json["'][^>]*>([\s\S]*?)<\/script\s*>/gi))try{const raw=JSON.parse(tag[1]);const value=raw.criticsScore?.score;if(typeof value==='number'||typeof value==='string'&&/^\d{1,3}$/.test(value))score=Number(value);}catch{}
  return {ratings:{...(score!==null&&Number.isInteger(score)&&score>=0&&score<=100?{rottenTomatoes:score}:{})},posterUrl:''};
 }
 throw new Error('Неизвестный источник оценок.');
}
async function page(url,options){
 const host=new URL(url).hostname;if((blocked.get(host)||0)>Date.now())throw new Error('Страница временно недоступна.');let target=url;
 for(let i=0;i<3;i++){
  const response=await options.fetcher(target,{credentials:'omit',redirect:'manual',signal:options.signal,headers:{Accept:'text/html'}});
  if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');await response.body?.cancel();const next=new URL(location||'',target);if(!location||i===2||next.origin!==new URL(url).origin||next.username||next.password)throw new Error('Страница требует перехода на другой адрес.');target=next.href;continue;}
  if([403,429].includes(response.status))blocked.set(host,Date.now()+15*60000);
  const html=await boundedText(response,2*1024*1024);if(/<title[^>]*>[^<]*(captcha|just a moment|access denied)|unusual traffic from|id=["']captcha|captcha-page/i.test(html)){blocked.set(host,Date.now()+15*60000);throw new Error('Источник запросил проверку.');}return html;
 }
 throw new Error('Страница недоступна.');
}
async function findRotten(data,options){
 const query=new URL('https://www.google.com/search');query.searchParams.set('q',`site:rottentomatoes.com/${data.media==='series'?'tv':'m'}/ "${data.title.replace(/["\\]/g,' ')}" ${year(data.year)}`);
 const html=await page(query.href,options),links=new Set();for(const tag of html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)){let value=decode(tag[1]);try{const url=new URL(value,'https://www.google.com');if(url.hostname==='www.google.com'&&url.pathname==='/url')value=url.searchParams.get('q')||url.searchParams.get('url')||'';}catch{}const safe=rottenPage(value,data.media);if(safe)links.add(safe);if(links.size===2)break;}return [...links];
}
export async function requestCinemaPublic(data,{fetcher=globalThis.fetch,signal}={}){
 if(!['movie','series'].includes(data.media)||typeof data.title!=='string'||!data.title.trim()||data.title.length>160||!/^tt\d{7,10}$/.test(data.imdbId)||typeof data.year!=='string'||data.year.length>30||data.kinopoiskId!==undefined&&(!Number.isSafeInteger(data.kinopoiskId)||data.kinopoiskId<1||data.kinopoiskId>9999999999)||data.rottenTomatoesUrl!==undefined&&!rottenPage(data.rottenTomatoesUrl,data.media))throw new Error('Некорректная карточка для открытых источников.');
 const key=JSON.stringify([data.media,data.imdbId,data.kinopoiskId||0,data.title,data.year,data.rottenTomatoesUrl||'']);const old=cache.get(key);if(old&&Date.now()-old.time<old.ttl)return old.value;
 const timeout=AbortSignal.timeout(12000),options={fetcher,signal:signal?AbortSignal.any([signal,timeout]):timeout};const result={ratings:{},posterUrl:'',sources:[],keyless:true};
 if(data.kinopoiskId)try{const url=kinopoiskPage(data.kinopoiskId,data.media).url;const parsed=parseCinemaPage(await page(url,options),data,'kinopoisk');Object.assign(result.ratings,parsed.ratings);result.posterUrl=parsed.posterUrl;if(parsed.posterUrl||parsed.ratings.kinopoisk!==undefined)result.sources.push(url);}catch{}
 try{const urls=data.rottenTomatoesUrl?[data.rottenTomatoesUrl]:year(data.year)?await findRotten(data,options):[];for(const url of urls){options.signal.throwIfAborted();const parsed=parseCinemaPage(await page(url,options),{...data,rottenTomatoesUrl:url},'rottenTomatoes');if(parsed.ratings.rottenTomatoes!==undefined){Object.assign(result.ratings,parsed.ratings);result.sources.push(url);break;}}}catch{}
 signal?.throwIfAborted();if(cache.size>=200)cache.delete(cache.keys().next().value);cache.set(key,{time:Date.now(),ttl:result.sources.length?86400000:3600000,value:result});return result;
}
