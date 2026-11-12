import test from 'node:test';import assert from 'node:assert/strict';
import {cinemaSearchTerms,rankCinemaSearch} from '../src/cinema-search.js';
import {requestCinemaSearch} from '../desktop/cinema-search.js';
test('Russian John Wick search expands to the original title and related series without inventing a TV version',async()=>{
 const requests=[];const fetcher=async url=>{requests.push(url);const media=url.includes('/series/')?'series':'movie',query=decodeURIComponent(url.split('/search=')[1]?.replace(/\.json$/,'').split('&')[0]||'');const rows=media==='movie'&&query==='John Wick'?[{id:'tt2911666',type:'movie',name:'John Wick',releaseInfo:'2014',imdbRating:'7.4'}]:media==='series'&&query==='The Continental'?[{id:'tt6486762',type:'series',name:'The Continental: From the World of John Wick',releaseInfo:'2023',imdbRating:'7.2'}]:[];return new Response(JSON.stringify({metas:rows}));};
 const result=await requestCinemaSearch({query:'джон',media:'series',yearFrom:2026,minImdb:9},{fetcher});
 assert.deepEqual(result.items.map(item=>[item.title,item.media,item.year]),[['John Wick','movie','2014'],['The Continental: From the World of John Wick','series','2023']]);assert.equal(result.total,2);assert.equal(result.hasMore,false);assert.equal(requests.length,6);assert.ok(requests.every(url=>!url.includes('year')&&!url.includes('api_key')));
});
test('title variants are bounded, unrelated queries stay literal and stale requests cancel',async()=>{assert.deepEqual(cinemaSearchTerms('Солярис').terms,['Солярис']);assert.deepEqual(cinemaSearchTerms('Джон Уик').terms,['Джон Уик','John Wick','The Continental']);assert.throws(()=>cinemaSearchTerms('x'.repeat(101)));assert.throws(()=>cinemaSearchTerms('bad\nquery'));const signal=AbortSignal.abort();await assert.rejects(requestCinemaSearch({query:'Cancelled unique search'},{signal,fetcher:()=>{throw new Error('offline');}}),{name:'AbortError'});const ranked=rankCinemaSearch([{title:'John Wayne Gacy'},{title:'The Continental'},{title:'John Wick'}],'джон');assert.equal(ranked[0].title,'John Wick');});

test('Cyrillic franchise titles rank ahead of related series',()=>{assert.equal(rankCinemaSearch([{title:'The Continental',media:'series'},{title:'Джон Уик',media:'movie'}],'джон')[0].title,'Джон Уик');});

test('verified Russian titles remain searchable when the catalog omits them or returns a namesake', async () => {
 const cases = [
  ['1 + 1','tt1675434','movie'],
  ['Жмурки','tt0420982','movie'],
  ['Война','tt0309047','movie'],
  ['Слово пацана','tt28429213','series'],
  ['Девятая планета','tt32880884','movie'],
  ['Паразиты — серая зона','tt21874396','series'],
  ['Наследники','tt3243098','series'],
  ['Магазин для убийц','tt26450613','series'],
 ];
 const fetcher=async url=>new Response(JSON.stringify({metas:url.includes('/movie/')?[{id:'tt0499556',type:'movie',name:'War',releaseInfo:'2007'}]:[]}));
 for(const [query,id,media] of cases){
  const {items}=await requestCinemaSearch({query},{fetcher});
  assert.equal(items[0].imdbId,id,query);
  assert.equal(items[0].media,media,query);
  assert.equal(items.filter(item=>item.imdbId===id).length,1,query);
 }
});
