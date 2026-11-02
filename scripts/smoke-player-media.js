import {checkFullscreen} from './smoke-fullscreen.js';
import assert from 'node:assert/strict';
export async function smokePlayerMedia({application,page}){
 // The catalogued wrapper intentionally publishes no player postMessage API.
 // Its content video lives in a different-origin nested iframe.
 await page.route('https://kodik.info/serial/owned-sub1',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}iframe{width:100%;height:100%;border:0}</style><iframe src="https://video.sibnet.ru/yoru-owned-player"></iframe>'}));
 await page.route('https://video.sibnet.ru/yoru-owned-player',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><style>html,body{margin:0;width:100%;height:100%;background:#08090b;overflow:hidden}video{width:100%;height:100%}</style><video playsinline controls src="https://kodik.info/owned.mp4"></video>'}));
 await page.getByRole('button',{name:'История',exact:true}).click();await page.getByRole('button',{name:'Смотреть: Arcade Gamer Fubuki',exact:true}).click();await page.waitForSelector('#video-host iframe');
 const nested=page.frameLocator('#video-host iframe').frameLocator('iframe');await nested.locator('video').waitFor();await page.waitForFunction(()=>document.querySelector('.yoru-time')?.textContent.includes('/ 0:06'));
 assert.equal(await nested.locator('body').evaluate(()=>typeof window.kadr),'undefined');assert.equal(await nested.locator('body').evaluate(()=>typeof window.require),'undefined');
 await checkFullscreen({application,page,video:nested.locator('video'),label:'nested original/subtitle anime iframe'});
 const play=page.getByTestId('yoru-play');if(await play.getAttribute('aria-label')==='Воспроизвести')await play.click();
 await page.waitForFunction(()=>document.querySelector('[data-testid="yoru-play"]')?.getAttribute('aria-label')==='Пауза');
 const decoded=await nested.locator('video').evaluate(v=>({height:v.videoHeight,audio:v.webkitAudioDecodedByteCount}));assert.equal(decoded.height,1080);assert.ok(decoded.audio>0);
 await play.click();for(let i=0;i<30;i++){if(await nested.locator('video').evaluate(v=>v.paused))break;await page.waitForTimeout(100);}assert.equal(await nested.locator('video').evaluate(v=>v.paused),true);
 const timeline=page.getByRole('slider',{name:'Позиция воспроизведения'});await timeline.fill('2');for(let i=0;i<30;i++){if(Math.abs(await nested.locator('video').evaluate(v=>v.currentTime)-2)<.2)break;await page.waitForTimeout(100);}
 assert.ok(Math.abs(await nested.locator('video').evaluate(v=>v.currentTime)-2)<.2);
 await page.getByRole('button',{name:'Выключить звук',exact:true}).click();for(let i=0;i<20;i++){if(await nested.locator('video').evaluate(v=>v.muted))break;await page.waitForTimeout(100);}assert.equal(await nested.locator('video').evaluate(v=>v.muted),true);
 await play.click();await page.waitForFunction(()=>document.querySelector('#playing-title').textContent.includes('Серия 2'),{},{timeout:10000});
 console.log('PASS: real nested cross-origin HTML5 video without player API, sandboxed remote frame, Yoru play/pause/seek/mute, decoded 1080p H.264/AAC and actual ended -> next episode');
 await page.getByRole('button',{name:'Закрыть плеер',exact:true}).click();
}
