export const LORDFILM_ORIGIN='https://sr.lordfilm5.pro';
const legacyOrigin='https://sm.lordfilm5.pro';
export function lordfilmCatalogURL(media){if(!['movie','series'].includes(media))throw new Error('Выбери фильмы или сериалы.');return LORDFILM_ORIGIN+(media==='movie'?'/filmy/':'/');}
export function lordfilmPage(value){try{const url=new URL(value);if(url.username||url.password||url.port||![LORDFILM_ORIGIN,legacyOrigin].includes(url.origin))return null;
 url.hostname=new URL(LORDFILM_ORIGIN).hostname;return url.href;}catch{return null;}}
