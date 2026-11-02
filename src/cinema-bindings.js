import {kinopoiskPage} from './cinema-mirrors.js';
const key='yoru.cinema-bindings.v1';
export function cinemaBindings(storage=localStorage){
 const bindings=new Map();try{const raw=JSON.parse(storage.getItem(key)||'[]');if(Array.isArray(raw))for(const row of raw.slice(0,500)){if(!row||typeof row.id!=='string'||!/^((movie|series):tt\d{7,10}|series:tvmaze:\d{1,9})$/.test(row.id))continue;const page=kinopoiskPage(row.kinopoiskId,row.id.startsWith('series:')?'series':'movie');bindings.set(row.id,page.id);}}catch{}
 return {get:id=>bindings.get(id),remove(id){bindings.delete(id);try{storage.setItem(key,JSON.stringify([...bindings].map(([id,kinopoiskId])=>({id,kinopoiskId}))));}catch{}},set(id,value,media){if(!/^((movie|series):tt\d{7,10}|series:tvmaze:\d{1,9})$/.test(id))throw new Error('Не удалось определить карточку.');const page=kinopoiskPage(value,media);bindings.delete(id);bindings.set(id,page.id);while(bindings.size>500)bindings.delete(bindings.keys().next().value);try{storage.setItem(key,JSON.stringify([...bindings].map(([id,kinopoiskId])=>({id,kinopoiskId}))));return {id:page.id,saved:true};}catch{return {id:page.id,saved:false};}}};
}
