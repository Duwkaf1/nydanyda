import test from 'node:test';import assert from 'node:assert/strict';import {requestAnimeAutomatic} from '../desktop/anime-automatic.js';
test('current API is searched beyond an initial Russian-only result and keeps published Sibnet original/subtitle links and duration',async()=>{
 const calls=[];const raw={id:995301,year:2017,mal:{id:34572},name:{english:'Black Clover',main:'Чёрный клевер'}};
 const result=await requestAnimeAutomatic({kind:'anime-options',releaseId:raw.id,number:1},{fetcher:async url=>{
  calls.push(url);const u=new URL(url);let response;
  if(u.pathname.includes('/releases/'))response=raw;
  else if(u.pathname.endsWith('/videos'))response={response:[{video_id:u.pathname.includes('/701/')?801:802,number:'1',duration:1434,iframe_url:u.pathname.includes('/701/')?'https://kodik.info/serial/dub':'https://video.sibnet.ru/shell.php?videoid=802',data:{dubbing:u.pathname.includes('/701/')?'AniDUB':'Субтитры · Команда перевода',player:u.pathname.includes('/701/')?'Kodik':'Sibnet'}}]};
  else response={response:[{anime_id:u.searchParams.get('q')==='Black Clover'?701:702,year:2017,remote_ids:{myanimelist_id:34572}}]};
  return new Response(JSON.stringify(response));
 }});assert.equal(result.players.length,2);assert.equal(result.players[1].audioType,'original');assert.equal(result.players[1].subtitles,true);assert.equal(result.players[1].duration,1434);assert.equal(new URL(result.players[1].url).hostname,'video.sibnet.ru');assert.ok(calls.every(url=>!url.includes('old.yummyani.me')));assert.equal(calls.filter(url=>new URL(url).pathname==='/anime').length,2);
});
