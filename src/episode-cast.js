const wikiOrigin='https://blackclover.fandom.com';
const nameKey=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(Boolean).sort().join(' ');
export function episodeReference(number){if(!Number.isInteger(number)||number<1||number>170)throw new Error('Неизвестная серия.');return `${wikiOrigin}/wiki/Episode_${number}`;}
export function parseEpisodeAppearances(raw,number,Parser=DOMParser){
 if(raw?.number!==number||raw.malId!==34572||raw.sourceURL!==episodeReference(number)||typeof raw.html!=='string'||raw.html.length>2*1024*1024)throw new Error('Источник не подтвердил выбранную серию.');
 const doc=new Parser().parseFromString(raw.html,'text/html');const root=doc.querySelector('.mw-parser-output')||doc.body;
 const headings=[...root.querySelectorAll('h2,h3,h4')];const heading=headings.find(h=>/^(characters_in_order_of_appearance|characters_appearing|characters)$/i.test((h.id||h.querySelector('[id]')?.id||h.textContent.trim().replace(/\s+/g,'_'))));
 if(!heading)throw new Error('В источнике нет подтверждённого списка появлений этой серии.');
 const container=h=>h.parentElement.classList.contains('mw-heading')?h.parentElement:h;
 const following=headings.find(h=>Number(h.tagName[1])<=Number(heading.tagName[1])&&(heading.compareDocumentPosition(h)&4));const range=doc.createRange();range.selectNodeContents(root);range.setStartAfter(container(heading));if(following)range.setEndBefore(container(following));const section=range.cloneContents();
 const names=[],seen=new Set();for(const a of section.querySelectorAll('a[href]')){
  if(!a.closest('li,td,.gallerytext'))continue;
  let url;try{url=new URL(a.getAttribute('href'),wikiOrigin);}catch{continue;}
  if(url.origin!==wikiOrigin||!url.pathname.startsWith('/wiki/'))continue;let slug;try{slug=decodeURIComponent(url.pathname.slice(6));}catch{continue;}if(/^(File|Category|Template|Help|User|Special|Episode_|Chapter_)/i.test(slug)||slug.includes(':'))continue;
  const name=a.textContent.trim().slice(0,160);if(!name||/^(edit|citation|\d+)$/i.test(name)||seen.has(slug))continue;seen.add(slug);
  names.push({name,aliases:[a.getAttribute('title'),slug.replaceAll('_',' ')].filter(x=>typeof x==='string'&&x.length<=160)});if(names.length>=300)break;
 }
 if(!names.length)throw new Error('Источник не вернул имена персонажей этой серии.');
 return {names,source:'Black Clover Wiki',sourceURL:raw.sourceURL,malId:34572,updatedAt:Date.now()};
}
export function automaticEpisodeCharacters(data,number){
 const entry=data?.automaticEpisodes?.[String(number)];if(!entry||entry.malId!==34572||!Array.isArray(entry.names))return null;
 const names=new Set(entry.names.flatMap(item=>[item.name,...(item.aliases||[])]).map(nameKey));
 return data.characters.filter(character=>[character.name,...(character.aliases||[])].some(name=>names.has(nameKey(name))));
}
export function validEpisodeAppearances(value){
 const result={};if(!value||typeof value!=='object'||Array.isArray(value))return result;
 for(const [key,entry]of Object.entries(value).slice(0,170)){
  const number=Number(key);if(!Number.isInteger(number)||number<1||number>170||entry?.malId!==34572||entry.sourceURL!==episodeReference(number)||!Number.isFinite(entry.updatedAt)||!Array.isArray(entry.names)||entry.names.length>300)continue;
  const names=entry.names.filter(n=>n&&typeof n.name==='string'&&n.name.length>0&&n.name.length<=160&&Array.isArray(n.aliases)&&n.aliases.length<=8&&n.aliases.every(a=>typeof a==='string'&&a.length<=160));
  if(names.length)result[key]={...entry,names};
 }
 return result;
}
