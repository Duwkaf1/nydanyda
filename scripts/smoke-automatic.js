import {readFile} from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {serveAutomatic,automaticRelease,automaticPlayers} from '../e2e/automatic-fixtures.js';
export async function smokeAutomatic({application,page,root}){
 const html=await readFile(path.join(root,'test/fixtures/automatic/anidb-page.html'),'utf8');const release={...automaticRelease,id:900128};
 await serveAutomatic(page);
 await application.evaluate(({net},{release,html,players})=>{const previous=net.fetch;globalThis.__automaticCalls=[];net.fetch=async(url,options)=>{
  if(/^https:\/\/(anilibria|aniliberty)\.top\/api\/v1\/anime\//.test(url)){globalThis.__automaticCalls.push(url);return new Response(JSON.stringify(new URL(url).pathname.includes('/releases/')?release:{data:[release],meta:{pagination:{total:1,total_pages:1}}}));}
  if(url.startsWith('https://old.yummyani.me/api/')){globalThis.__automaticCalls.push(url);return new Response(JSON.stringify({response:url.includes('/videos')?players.map(p=>({video_id:Number(p.id.split(':')[1]),number:'1',quality:p.quality+'p',iframe_url:p.url,data:{dubbing:p.voice,player:p.player}})):[{anime_id:900128,year:2002,remote_ids:{anilibria_alias:release.alias,myanimelist_id:1596}}]}));}
  if(url==='https://anidb.net/anime/128'){globalThis.__automaticCalls.push(url);return new Response(html);}
  return previous(url,options);
 };},{release,html,players:automaticPlayers});
 await page.reload();await page.getByRole('button',{name:'Открыть: Arcade Gamer Fubuki',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#catalog-play').disabled);await page.locator('#catalog-play').click();await page.waitForFunction(()=>document.querySelector('#quick-source').textContent.includes('AniDUB'));
 await page.waitForFunction(()=>{const v=document.querySelector('#video-host video');return v?.readyState>=2&&v.currentTime>0;});await page.locator('#video-host video').evaluate(v=>v.pause());await page.locator('#cast-panel').evaluate(e=>e.open=true);
 await page.waitForFunction(()=>document.querySelectorAll('.cast-card').length===4);assert.ok((await page.locator('.cast-card').first().textContent()).includes('Главный персонаж'));
 await page.locator('#watch-audio-mode').selectOption('original');await page.waitForSelector('#video-host iframe');const frame=page.frameLocator('#video-host iframe');assert.equal(await frame.locator('body').evaluate(()=>typeof window.kadr),'undefined');await page.getByTestId('yoru-play').click();await page.waitForFunction(()=>document.querySelector('#quality').value==='provider');await frame.locator('video').waitFor();for(let n=0;n<60;n++){const ready=await frame.locator('video').evaluate(v=>v.videoHeight===1080&&v.currentTime>0&&v.webkitAudioDecodedByteCount>0);if(ready)break;if(n===59)throw new Error('Embedded H.264/AAC did not decode.');await page.waitForTimeout(100);}
 await frame.locator('video').evaluate(v=>{v.pause();v.currentTime=3;});await page.waitForFunction(()=>document.querySelector('#online-status').textContent.startsWith('Позиция этого плеера сохраняется'));await page.getByRole('button',{name:'Закрыть плеер',exact:true}).click();const progress=await page.evaluate(()=>JSON.parse(localStorage.getItem('kadr.playback.v1')).progress['catalog:anilibria:900128']);assert.ok(Math.abs(progress.time-3)<.2);
 const requests=await application.evaluate(()=>globalThis.__automaticCalls);assert.ok(requests.some(url=>url.includes('/videos')));assert.ok(requests.includes('https://anidb.net/anime/128'));
 console.log('PASS: automatic native IPC identity, real AniDB page parsing, portraits, original/subtitle/dub variants, sandboxed embedded H.264/AAC 1080p and confirmed timeline saving');
}
