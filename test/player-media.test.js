import test from 'node:test';import assert from 'node:assert/strict';
import {mediaCommand,playerMedia} from '../desktop/player-media.js';
test('media commands accept only bounded controls and never arbitrary script, URLs or an injected request ID',()=>{
 for(const data of [{requestId:'safe-id',action:'seek',value:123},{requestId:'safe-id',action:'play'},{requestId:'safe-id',action:'pause'},{requestId:'safe-id',action:'mute',value:true},{requestId:'safe-id',action:'volume',value:.4}]){const code=mediaCommand(data);assert.doesNotThrow(()=>new Function('return '+code));assert.ok(!code.includes('.src'));}
 for(const data of [{requestId:'x");alert(1);//',action:'play'},{requestId:'safe',action:'executeJavaScript',value:'alert(1)'},{requestId:'safe',action:'seek',value:Infinity},{requestId:'safe',action:'volume',value:2},{requestId:'safe',action:'mute',value:'true'}])assert.throws(()=>mediaCommand(data));
});
test('trusted media bridge finds a nested content video, routes controls only to its current binding and rejects untrusted IPC',async()=>{
 const handlers=new Map(),sent=[],commands=[];let trustedCalls=0;let frameURL='https://video.sibnet.ru/shell.php?videoid=1';
 const content={url:'https://video.sibnet.ru/player',isDestroyed:()=>false,executeJavaScript:async code=>{if(code.startsWith('(async')){commands.push(code);return true;}return {score:2e9,content:true,time:5,duration:1400,paused:false,readyState:3};}};
 const root={name:'yoru-player-test',get url(){return frameURL;},framesInSubtree:[],isDestroyed:()=>false,executeJavaScript:async()=>null};root.framesInSubtree=[root,content];
 const bridge=playerMedia({ipcMain:{handle:(k,v)=>handlers.set(k,v),on:(k,v)=>handlers.set(k,v)},window:()=>({isDestroyed:()=>false,webContents:{mainFrame:{frames:[root]},send:(...args)=>sent.push(args)}}),trusted:event=>{trustedCalls++;if(event!=='trusted')throw new Error('Untrusted sender');}});
 try{
  assert.throws(()=>handlers.get('player-media:bind')('remote',{requestId:'test',url:root.url}),/Untrusted/);
  await handlers.get('player-media:bind')('trusted',{requestId:'test',url:root.url,duration:1400});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(sent[0][1].time,5);assert.equal(sent[0][1].requestId,'test');assert.equal(sent[0][1].src,undefined);
  assert.equal(await handlers.get('player-media:command')('trusted',{requestId:'stale',action:'play'}),false);assert.equal(commands.length,0);
  assert.equal(await handlers.get('player-media:command')('trusted',{requestId:'test',action:'seek',value:10}),true);assert.equal(commands.length,1);
  await assert.rejects(handlers.get('player-media:command')('remote',{requestId:'test',action:'play'}),/Untrusted/);
  handlers.get('player-media:unbind')('trusted','test');assert.equal(await handlers.get('player-media:command')('trusted',{requestId:'test',action:'play'}),false);
  assert.ok(trustedCalls>=6);
 }finally{bridge.stop();}
});
