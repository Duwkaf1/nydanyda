import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {durableJSON} from '../desktop/durable-json.js';
import {sourcePlayback} from '../desktop/source-playback.js';
import {loadState} from '../src/storage.js';

const url='https://sr.lordfilm5.pro/series/owned.html';
const key='cinema-lordfilm';
const base={identity:'episode:s1e1',duration:120,paused:false,seeking:false,ready:4,error:false,next:true,ended:false};
function playbackHarness(store) {
 let clock=100,sample,saved=[];
 store??={read:()=>saved,write:rows=>{saved=rows;}};
 const commands=[];
 const playback=sourcePlayback({store,now:()=>clock,notify(){},
  readFrame:async()=>sample,commandFrame:async(_frame,code)=>{commands.push(code);return true;}});
 playback.reset(key,'Проверочный сериал',url);
 return {playback,commands,async feed(time,patch={},ms=1000){
  clock+=ms;sample={...base,time,...patch};
  await playback.poll([{}]);
 }};
}

test('external playback waits during buffering and pause; advancing requires real completion and is sent once',async()=>{
 const h=playbackHarness();
 await h.feed(110);
 await h.feed(111);
 await h.feed(111,{ready:2},4000);
 assert.match(h.playback.status(),/Буферизация/);
 await h.feed(111,{ready:2},31000);
 assert.match(h.playback.status(),/не продвигается/);
 await h.feed(111,{paused:true,ready:2},40000);
 assert.equal(h.playback.status(),'');
 await h.feed(114);
 assert.equal(h.playback.status(),'');
 await h.feed(119,{seeking:true});
 assert.deepEqual(h.commands,[]);
 await h.feed(120,{paused:true,ended:true});
 await h.feed(120,{paused:true,ended:true});
 await h.feed(120,{paused:true,ended:true});
 assert.equal(h.commands.length,1);
 assert.match(h.commands[0],/"kind":"next"/);
});

test('disabled auto-next, last episode and media errors do not advance',async()=>{
 for(const [settings,patch] of [
  [{autoNext:false},{}],[{autoNext:true},{next:false}],[{autoNext:true},{error:true}],
 ]){
  const h=playbackHarness();h.playback.preferences(settings);
  await h.feed(118);await h.feed(119);
  await h.feed(120,{paused:true,ended:true,...patch});
  await h.feed(120,{paused:true,ended:true,...patch});
  assert.deepEqual(h.commands,[]);
 }
});

test('external progress resumes only the same identified episode and excludes raw media identifiers on disk',async t=>{
 const folder=mkdtempSync(join(tmpdir(),'yoru-source-progress-'));t.after(()=>rmSync(folder,{recursive:true,force:true}));
 const file=join(folder,'progress.json');
 const first=playbackHarness(durableJSON(file,[]));
 await first.feed(25,{identity:'episode:s1e1'});
 assert.equal(first.playback.latest().time,25);
 assert.equal(first.playback.latest().identity,undefined);
 const second=playbackHarness(durableJSON(file,[]));
 await second.feed(0,{identity:'episode:s1e2'});
 assert.deepEqual(second.commands,[]);
 await second.feed(0,{identity:'episode:s1e1'});
 assert.equal(second.commands.length,1);
 assert.match(second.commands[0],/"time":25/);
});

test('committed native episode and time survive killing the writer with no unload; a partial temp file is ignored',async t=>{
 const folder=mkdtempSync(join(tmpdir(),'yoru-power-cut-'));t.after(()=>rmSync(folder,{recursive:true,force:true}));
 const file=join(folder,'progress.json');
 const entry={progress:{serial:{episodeId:'s1e2',time:73.25,updatedAt:90}},quality:720,savedAt:100};
 const source=new URL('../desktop/durable-json.js',import.meta.url).href;
 const child=spawn(process.execPath,['--input-type=module','-e',`import {durableJSON} from ${JSON.stringify(source)}; durableJSON(process.argv[1],null).write(${JSON.stringify(entry)}); process.stdout.write('saved'); setInterval(()=>{},1000);`,file],{stdio:['ignore','pipe','inherit']});
 t.after(()=>child.kill('SIGKILL'));
 await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>assert.fail('Writer exited before saving'))]);
 writeFileSync(file+'.tmp','{"progress":');
 const exited=once(child,'exit');child.kill('SIGKILL');await exited;
 const titles=[{id:'serial',title:'Проверка',episodes:['s1e1','s1e2'].map((id,index)=>({id,number:index+1,sources:[{id:'test',url:'https://example.test/test.mp4',voice:'Тест',language:'ru',quality:720}]}))}];
 const storage={getItem:key=>key==='kadr.library.v1'?JSON.stringify({titles}):'{"savedAt":80,"progress":{}}'};
 const result=loadState(storage,durableJSON(file,null).read());
 assert.equal(result.error,undefined);
 assert.deepEqual(result.state.progress,entry.progress);
 assert.equal(result.state.quality,720);
});

test('auto-next starts the newly loaded video and reopening a saved playlist can select its episode',async()=>{
 const h=playbackHarness();
 await h.feed(118);await h.feed(119);await h.feed(120,{ended:true,paused:true});await h.feed(120,{ended:true,paused:true});
 h.playback.reset(key,'Следующая серия',url);
 await h.feed(0,{identity:'episode:s1e2',episode:'s1e2',paused:true});
 assert.equal(h.commands.length,2);
 assert.match(h.commands[1],/"kind":"play"/);
 await h.feed(12,{identity:'episode:s1e2',episode:'s1e2'});
 const saved=h.playback.latest();
 assert.equal(saved.episode,'s1e2');
 h.playback.stop();
 h.playback.reset(key,'Проверочный сериал',url);
 h.playback.openCheckpoint(saved);
 await h.feed(0,{paused:true});
 assert.match(h.commands[2],/"episode":"s1e2"/);
 await h.feed(0,{identity:'episode:s1e2',paused:true});
 assert.match(h.commands[3],/"time":12/);
});
