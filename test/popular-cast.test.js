import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {resolveAnimeIdentity,requestAnimeAutomatic} from '../desktop/anime-automatic.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/popular/release-identities.json',import.meta.url)));
const expected=new Map([[1735,4880],[21,69],[269,2369],[38000,14107],[40456,15113],[47778,16054],[49926,16803],[51019,17198],[55701,18067],[40748,15275],[48561,16169],[51009,17196],[57658,18363]]);
test('all thirteen live catalog metadata snapshots resolve to their exact release rather than another popular season or film',async()=>{
 assert.equal(fixture.releases.length,13);for(const raw of fixture.releases){const identity=await resolveAnimeIdentity(raw);assert.equal(identity?.anidbId,expected.get(raw.mal.id),raw.name.main);assert.equal(identity.malId,raw.mal.id);}
});
test('the reviewed 2021/winter-2022 boundary accepts only the exact Entertainment District release and indexed name',async()=>{
 const raw=fixture.releases.find(x=>x.mal.id===47778);assert.equal(raw.year,2021);assert.equal((await resolveAnimeIdentity(raw)).method,'exact-mal-reviewed-year-title');
 assert.equal(await resolveAnimeIdentity({...raw,year:2020}),null);assert.equal(await resolveAnimeIdentity({...raw,name:{english:'Kimetsu no Yaiba'}}),null);assert.equal(await resolveAnimeIdentity({...raw,mal:{id:38000}}),null);
 const fubuki={id:997950,year:2003,mal:{id:1596},name:{english:'Arcade Gamer Fubuki'}};assert.equal(await resolveAnimeIdentity(fubuki),null);
});
test('popular TV releases without an episode source explicitly remain unsupported, while the two films are labelled single-release cast',async()=>{
 for(const raw of fixture.releases){const calls=[];const result=await requestAnimeAutomatic({kind:'anime-episode-cast',provider:'anilibria',releaseId:raw.id,number:1},{fetcher:async url=>{calls.push(url);assert.equal(new URL(url).pathname,`/api/v1/anime/releases/${raw.id}`);return new Response(JSON.stringify(raw));}});assert.equal(result.id,expected.get(raw.mal.id));if(raw.type==='MOVIE')assert.equal(result.singleRelease,true);else{assert.equal(result.supported,false,raw.name.main);assert.equal(result.html,undefined);assert.equal(result.singleRelease,undefined);}assert.ok(calls.every(url=>!url.includes('fandom')));}
});
test('reserve cast verification keeps the same reviewed release and rejects a different Demon Slayer season',async()=>{
 const raw=fixture.releases.find(x=>x.mal.id===47778);const result=await requestAnimeAutomatic({kind:'anime-cast',provider:'anilibria',releaseId:raw.id,castSource:'jikan'},{fetcher:async url=>new Response(JSON.stringify(url.includes('/full')?{data:{mal_id:47778,title:raw.name.english,year:2021}}:url.includes('/characters')?{data:[{role:'Main',character:{mal_id:1,name:'Owned test character'}}]}:raw))});assert.equal(result.id,16054);assert.equal(result.fallback.malId,47778);
 const wrong={...fixture.releases.find(x=>x.mal.id===51019),id:997951};await assert.rejects(requestAnimeAutomatic({kind:'anime-cast',provider:'anilibria',releaseId:wrong.id,castSource:'jikan'},{fetcher:async url=>{if(url.includes('graphql'))return new Response('Unavailable',{status:503});return new Response(JSON.stringify(url.includes('/full')?{data:{mal_id:38000,title:'Kimetsu no Yaiba'}}:wrong));}}),/резервный каталог/);
});
