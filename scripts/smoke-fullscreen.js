import assert from 'node:assert/strict';
export async function checkFullscreen({application,page,video,label='video'}){
 const owner=await application.browserWindow(page);const playing=await video.evaluate(v=>!v.paused);await video.evaluate(v=>v.pause());
 const cinema=await page.locator('body').evaluate(e=>e.classList.contains('cinema-mode'));if(!cinema)await page.locator('#focus-button').click();
 const source=await video.evaluate(v=>v.currentSrc);const time=await video.evaluate(v=>v.currentTime);
 await owner.evaluate(w=>w.focus());await page.locator('#fullscreen-button').click();await page.waitForFunction(()=>document.fullscreenElement?.id==='video-host',undefined,{timeout:7000});
 await page.waitForFunction(()=>{const host=document.querySelector('#video-host'),r=host.getBoundingClientRect();return Math.abs(r.width-innerWidth)<2&&Math.abs(r.height-innerHeight)<2;});
 assert.equal(await owner.evaluate(w=>w.isFullScreen()),true);
 await owner.evaluate(w=>{w.focus();w.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});w.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});});await page.waitForFunction(()=>!document.fullscreenElement,undefined,{timeout:7000});
 await owner.evaluate(w=>{w.focus();w.webContents.sendInputEvent({type:'keyDown',keyCode:'F11'});w.webContents.sendInputEvent({type:'keyUp',keyCode:'F11'});});await page.waitForFunction(()=>document.fullscreenElement?.id==='video-host',undefined,{timeout:7000});await owner.evaluate(w=>{w.webContents.sendInputEvent({type:'keyDown',keyCode:'F11'});w.webContents.sendInputEvent({type:'keyUp',keyCode:'F11'});});await page.waitForFunction(()=>!document.fullscreenElement,undefined,{timeout:7000});
 assert.equal(await video.evaluate(v=>v.currentSrc),source);assert.ok(Math.abs(await video.evaluate(v=>v.currentTime)-time)<.4);assert.equal(await video.evaluate(v=>v.paused),true);
 if(!cinema)await page.locator('#focus-button').click();
 if(playing)await video.evaluate(v=>v.play());
 console.log(`PASS: real Electron fullscreen, screen-sized video, Escape/F11 and preserved source/time for ${label}`);
}
