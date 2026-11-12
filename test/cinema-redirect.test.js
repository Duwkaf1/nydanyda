import test from 'node:test';
import assert from 'node:assert/strict';
import {cinemaJSON} from '../desktop/cinema-http.js';
import {requestCinema} from '../desktop/cinema-network.js';
import {cinemaServiceURL,cinemaWebURL} from '../src/cinema-services.js';

const url='https://v3-cinemeta.strem.io/meta/movie/tt32880884.json';
const target='https://cinemeta-live.strem.io/meta/movie/tt32880884.json';
const movie={id:'tt32880884',type:'movie',name:'The Ultimate Planet',releaseInfo:'2026'};
const data={kind:'cinema-detail',provider:'cinemeta',media:'movie',id:movie.id};
const redirect=location=>new Response(null,{status:307,headers:{location}});

test('Cinemeta metadata only follows the exact verified host and same title path',async()=>{
 for(const dest of ['https://evil.test/meta/movie/tt32880884.json',target.replace('tt32880884','tt28429213'),target+'?extra=1']){
  const calls=[];
  await assert.rejects(cinemaJSON(url,{fresh:true,fetcher:async next=>{calls.push(next);return redirect(dest);}}),{code:'REDIRECT'});
  assert.deepEqual(calls,[url]);
 }
 const calls=[];
 const result=await requestCinema(data,{fetcher:async next=>{calls.push(next);return next===url?redirect(target):Response.json({meta:movie});}});
 assert.deepEqual(calls,[url,target]);
 assert.equal(result.item.localizedTitle,'Девятая планета');
 assert.equal(result.item.kinopoiskId,5426247);
 assert.equal(result.item.metadataLimited,undefined);
 const page=cinemaServiceURL('kinopoisk',result.item);
 assert.equal(page,'https://www.kinopoisk.ru/film/5426247/');
 assert.equal(cinemaWebURL(page),page);
});

test('unavailable external details leave verified basic metadata without claiming playback',async()=>{
 const result=await requestCinema({...data,media:'series',id:'tt28429213'},{fetcher:async()=>new Response(null,{status:404})});
 assert.equal(result.item.metadataLimited,true);
 assert.equal(result.item.kinopoiskId,5304403);
 assert.deepEqual(result.item.episodes,[]);
 assert.equal(result.item.posterUrl,'');
});
