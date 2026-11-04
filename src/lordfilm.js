export const LORDFILM_ORIGIN='https://sm.lordfilm5.pro';
export function lordfilmCatalogURL(media){if(!['movie','series'].includes(media))throw new Error('Выбери фильмы или сериалы.');return LORDFILM_ORIGIN+(media==='movie'?'/filmy/':'/');}
export function lordfilmPage(value){try{const url=new URL(value);return url.origin===LORDFILM_ORIGIN&&!url.username&&!url.password&&!url.port?url.href:null;}catch{return null;}}
