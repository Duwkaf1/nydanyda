import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {FiltersEngine} from '@ghostery/adblocker';
const output=new URL('../data/adblock/',import.meta.url);await mkdir(new URL('sources/',output),{recursive:true});
const digest=value=>createHash('sha256').update(value).digest('hex');
async function get(url){const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`${response.status}: ${url}`);return response.text();}
const offline=process.argv.includes('--offline');const previous=offline?JSON.parse(await readFile(new URL('provenance.json',output),'utf8')):null;
const revisions=offline?previous.revisions:{};if(!offline)for(const repo of ['ghostery/adblocker','easylist/ruadlist','uBlockOrigin/uAssets'])revisions[repo]=JSON.parse(await get(`https://api.github.com/repos/${repo}/commits/master`)).sha;
const records=[];async function source(repo,path,name){const url=`https://raw.githubusercontent.com/${repo}/${revisions[repo]}/${path}`;const text=offline?await readFile(new URL('sources/'+name,output),'utf8'):await get(url);await writeFile(new URL('sources/'+name,output),text);records.push({file:name,url,sha256:digest(text)});return text;}
const lists=[];for(const path of ['easylist/easylist.txt','easylist/easyprivacy.txt','ublock-origin/filters.txt','ublock-origin/quick-fixes.txt','ublock-origin/unbreak.txt'])lists.push(await source('ghostery/adblocker','packages/adblocker/assets/'+path,path.replaceAll('/','-')));
// Resolve only this repository's local includes; no arbitrary destinations.
const visited=new Set();async function russian(path,depth=0){if(depth>4||visited.size>40||!/^[a-zA-Z0-9_+./-]+\.txt$/.test(path)||path.includes('..'))throw new Error('Invalid RU AdList include');if(visited.has(path))return '';visited.add(path);const text=await source('easylist/ruadlist',path,'ru-'+path.replaceAll('/','-'));let result='';for(const line of text.split('\n')){const include=line.match(/^%include ([^%]+)%$/)||line.match(/^!#include (\S+)$/);result+=include?await russian(include[1],depth+1)+'\n':line+'\n';}return result;}
lists.push(await russian('RuAdList-uBO.txt'));
const resources=await source('ghostery/adblocker','packages/adblocker/assets/ublock-origin/resources.json','resources.json');
await source('uBlockOrigin/uAssets','LICENSE','LICENSE-uAssets.txt');
await copyFile(new URL('../node_modules/@ghostery/adblocker/LICENSE',import.meta.url),new URL('LICENSE-Ghostery.txt',output));
const own=await readFile(new URL('player-filters.txt',output),'utf8');const engine=FiltersEngine.parse([...lists,own].join('\n'),{enableCompression:true,loadGenericCosmeticsFilters:false,loadExtendedSelectors:false,enableMutationObserver:false});engine.updateResources(resources,digest(resources));
const binary=engine.serialize();await writeFile(new URL('engine.bin',output),binary);
await writeFile(new URL('provenance.json',output),JSON.stringify({engine:'@ghostery/adblocker@2.20.3',generatedAt:new Date().toISOString(),revisions,sources:records,ownRulesSha256:digest(own),binarySha256:digest(binary),binaryBytes:binary.length},null,2)+'\n');
console.log(`Offline player protection: ${binary.length} bytes; ${records.length} attributed source files.`);
