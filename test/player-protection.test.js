import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {loadPlayerBlocker,requestDecision,createPlayerProtection} from '../desktop/player-protection.js';
const engine=loadPlayerBlocker();const details=(url,resourceType='script')=>({url,resourceType,referrer:'https://kodik.info/serial/owned'});
test('bundled protection blocks known Russian and international advertisements but preserves content, original tracks, subtitles and player APIs',()=>{
 for(const url of ['https://ad.doubleclick.net/advert.js','https://ads.adfox.ru/advert.mp4','https://ad.adriver.ru/banner.js'])assert.equal(requestDecision(engine,details(url,url.endsWith('mp4')?'media':'script')).cancel,true,url);
 for(const [url,type] of [['https://kodik.info/serial/owned','subFrame'],['https://qa.libria.fun/master1080.m3u8','media'],['https://kodik.info/owned-content.mp4','media'],['https://kodik.info/ja-audio.m3u8','media'],['https://kodik.info/subtitles/translation.vtt','xhr'],['https://api.yani.tv/anime/123/videos','xhr']])assert.deepEqual(requestDecision(engine,details(url,type)),{},url);
});
test('ad SDK and VAST XML receive valid local compatibility responses instead of leaving the player waiting',()=>{
 const sdk=requestDecision(engine,details('https://imasdk.googleapis.com/js/sdkloader/ima3.js'));assert.match(sdk.redirectURL,/^data:application\/javascript;base64,/);const code=Buffer.from(sdk.redirectURL.split(',')[1],'base64').toString();assert.match(code,/AdsLoader/);
 const vast=requestDecision(engine,details('https://an.yandex.ru/meta/owned','xmlHttpRequest'));assert.match(vast.redirectURL,/^data:/);assert.match(Buffer.from(vast.redirectURL.split(',')[1],'base64').toString(),/<VAST/);
});
test('protection is installed once per session and leaves main-process metadata traffic alone',()=>{
 let hooks=0,handler;const session={protocol:{handle(){}},webRequest:{onBeforeRequest(_filter,value){hooks++;handler=value;}}};const protection=createPlayerProtection(engine);protection.protectSession(session);protection.protectSession(session);assert.equal(hooks,1);handler({...details('https://ad.doubleclick.net/a.js'),webContentsId:0},result=>assert.deepEqual(result,{}));handler({...details('https://ad.doubleclick.net/a.js'),webContentsId:1},result=>assert.equal(result.cancel,true));
});
test('all shipped filter sources and the compiled engine match recorded checksums',()=>{
 const base=new URL('../data/adblock/',import.meta.url);const manifest=JSON.parse(readFileSync(new URL('provenance.json',base)));const hash=bytes=>createHash('sha256').update(bytes).digest('hex');assert.equal(hash(readFileSync(new URL('engine.bin',base))),manifest.binarySha256);for(const source of manifest.sources)assert.equal(hash(readFileSync(new URL('sources/'+source.file,base))),source.sha256,source.file);assert.equal(hash(readFileSync(new URL('player-filters.txt',base))),manifest.ownRulesSha256);
});
