import test from 'node:test';import assert from 'node:assert/strict';
import {requestAnimeAutomatic} from '../desktop/anime-automatic.js';
import {episodeReference,automaticEpisodeCharacters,validEpisodeAppearances} from '../src/episode-cast.js';
const release={id:994501,year:2017,mal:{id:34572},name:{english:'Black Clover'}};
test('episode appearance requests use the fixed TV identity and a fixed page for the requested episode; the special never receives TV appearances',async()=>{
 const calls=[];const result=await requestAnimeAutomatic({kind:'anime-episode-cast',releaseId:release.id,number:2},{fetcher:async url=>{calls.push(url);return new Response(JSON.stringify(url.includes('api.php')?{parse:{title:'Episode 2',text:'<h2>Characters</h2><ul><li>Asta</li></ul>'}}:release));}});assert.equal(result.number,2);assert.equal(result.id,12665);assert.equal(result.sourceURL,episodeReference(2));const url=new URL(calls.at(-1));assert.equal(url.origin,'https://blackclover.fandom.com');assert.equal(url.searchParams.get('page'),'Episode 2');
 const special=await requestAnimeAutomatic({kind:'anime-episode-cast',releaseId:5152,number:1},{fetcher:async url=>{assert.ok(!url.includes('fandom'));return new Response(JSON.stringify({id:5152,alias:'black-clover-special',year:2016,episodes:[{}]}));}});assert.equal(special.id,12351);assert.equal(special.singleRelease,true);
 await assert.rejects(requestAnimeAutomatic({kind:'anime-episode-cast',releaseId:994502,number:3},{fetcher:async url=>new Response(JSON.stringify(url.includes('api.php')?{parse:{title:'Episode 2',text:'wrong'}}:{...release,id:994502}))}),/номер серии/);
});
test('appearance matching uses only names from that episode, tolerates name order and aliases, preserves unknown episodes and rejects foreign cache references',()=>{
 const entry={names:[{name:'Asta',aliases:[]},{name:'Yuno Grinberryall',aliases:[]}],sourceURL:episodeReference(1),malId:34572,updatedAt:1};
 const data={characters:[{id:1,name:'Asta'},{id:2,name:'Yuno',aliases:['Grinberryall, Yuno']},{id:3,name:'Noelle Silva'}],automaticEpisodes:{1:entry}};
 assert.deepEqual(automaticEpisodeCharacters(data,1).map(c=>c.id),[1,2]);assert.equal(automaticEpisodeCharacters(data,2),null);
 assert.deepEqual(Object.keys(validEpisodeAppearances({1:entry,2:{...entry,sourceURL:'https://evil.test/wiki/Episode_2'},3:{...entry,malId:33950},4:{...entry,sourceURL:episodeReference(3)}})),['1']);
});
