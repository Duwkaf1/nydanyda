import {cinemaJSON} from './cinema-http.js';
export async function recentTVmaze(options){
 const urls=[];for(let days=0;days<3;days++){const date=new Date();date.setUTCDate(date.getUTCDate()-days);const day=date.toISOString().slice(0,10);urls.push(`https://api.tvmaze.com/schedule?country=US&date=${day}`,`https://api.tvmaze.com/schedule/web?date=${day}`);}
 const results=new Array(urls.length);let next=0;
 await Promise.all(Array.from({length:3},async()=>{while(next<urls.length){const index=next++;try{const rows=await cinemaJSON(urls[index],options);if(!Array.isArray(rows))throw new Error('Invalid schedule');results[index]={rows};}catch(error){results[index]={error};}}}));
 const valid=results.filter(r=>r.rows);if(!valid.length)throw results[0].error;
 const seen=new Set();return {rows:valid.flatMap(r=>r.rows).filter(row=>{const id=(row?.show||row?._embedded?.show)?.id;if(!Number.isSafeInteger(id)||seen.has(id))return false;seen.add(id);return true;}).map(row=>row.show?row:{show:row._embedded.show}),partial:valid.length<urls.length};
}
