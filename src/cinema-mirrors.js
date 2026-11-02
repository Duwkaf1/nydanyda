export const CINEMA_MIRRORS=Object.freeze({
 'kinopoisk-cx':{name:'Плеер CX',origin:'https://kinopoisk.cx'},
 'kinopoisk-sbs':{name:'Плеер SBS',origin:'https://kinopoisk.sbs'},
 'kinopoisk-cfd':{name:'Плеер CFD',origin:'https://kinopoisk.cfd'},
 sspoisk:{name:'SSpoisk',origin:'https://www.sspoisk.ru'},
 kinokino:{name:'KinoKino',origin:'https://kinokino.vip'},
});
const hosts=new Set(['kinopoisk.ru','www.kinopoisk.ru',...Object.values(CINEMA_MIRRORS).flatMap(x=>{const host=new URL(x.origin).hostname.replace(/^www\./,'');return [host,'www.'+host];})]);
export function kinopoiskPage(value,media){
 if(typeof value!=='string'&&typeof value!=='number')throw new Error('Укажи ссылку или ID Кинопоиска.');
 const text=String(value).trim();let id,type;
 if(/^[1-9]\d{0,9}$/.test(text)){id=Number(text);type=media==='series'?'series':'film';}
 else{let url;try{url=new URL(text);}catch{throw new Error('Нужна ссылка Кинопоиска вида /film/123/ или /series/123/.');}
  const match=url.pathname.match(/^\/(film|series)\/([1-9]\d{0,9})\/?$/);
  if(url.protocol!=='https:'||url.username||url.password||url.port||!hosts.has(url.hostname)||!match)throw new Error('Нужна HTTPS-ссылка на карточку Кинопоиска или поддерживаемого зеркала.');
  type=match[1];id=Number(match[2]);
 }
 if(media&&type!==(media==='series'?'series':'film'))throw new Error('Тип ссылки не совпадает: для сериала нужна /series/, для фильма — /film/.');
 return {id,media:type==='series'?'series':'movie',url:`https://www.kinopoisk.ru/${type}/${id}/`};
}
export function cinemaMirrorURL(service,item){
 if(!Object.hasOwn(CINEMA_MIRRORS,service)||!['movie','series'].includes(item?.media)||!Number.isSafeInteger(item.kinopoiskId)||item.kinopoiskId<1||item.kinopoiskId>9999999999)throw new Error('Сначала укажи или подбери точную карточку Кинопоиска.');
 return `${CINEMA_MIRRORS[service].origin}/${item.media==='series'?'series':'film'}/${item.kinopoiskId}/`;
}
export function cinemaMirrorPage(value){try{const url=new URL(value);if(!Object.values(CINEMA_MIRRORS).some(x=>new URL(x.origin).hostname.replace(/^www\./,'')===url.hostname.replace(/^www\./,'')))return null;const page=kinopoiskPage(value);if(url.search||url.hash)return null;return {...page,url:url.href};}catch{return null;}}
