import {readFile,writeFile} from 'node:fs/promises';
import {requestCatalog} from '../desktop/catalog-network.js';
import {resolveAnimeIdentity,requestAnimeAutomatic} from '../desktop/anime-automatic.js';
const families=[
 {name:'Наруто',malIds:[20,1735],queries:['Наруто','Naruto'],wiki:'naruto.fandom.com'},
 {name:'One Piece',malIds:[21],queries:['Ван Пис'],wiki:'onepiece.fandom.com'},
 {name:'Блич',malIds:[269,41467,53998,56784],queries:['Блич','Bleach'],wiki:'bleach.fandom.com'},
 {name:'Атака титанов',malIds:[16498,25777,35760,38524,40028,48583,51535],queries:['Атака титанов','Shingeki no Kyojin','Гигантов'],wiki:'attackontitan.fandom.com'},
 {name:'Клинок, рассекающий демонов',malIds:[38000,40456,47778,49926,51019,55701],queries:['Клинок'],wiki:'kimetsu-no-yaiba.fandom.com'},
 {name:'Магическая битва',malIds:[40748,48561,51009,57658],queries:['Магическая битва'],wiki:'jujutsu-kaisen.fandom.com'},
];
const args=process.argv.slice(2);if(args.some((x,i)=>!['--live','--output'].includes(x)&&args[i-1]!=='--output'))throw new Error('Use --live and/or --output <file>.');
const output=args.includes('--output')?args[args.indexOf('--output')+1]:null;if(args.includes('--output')&&(!output||output.startsWith('--')))throw new Error('Missing --output file.');
const fixture=JSON.parse(await readFile(new URL('../test/fixtures/popular/release-identities.json',import.meta.url),'utf8'));
let releases=fixture.releases,searches=[];
if(args.includes('--live')){
 const found=new Map(),wanted=new Set(families.flatMap(f=>f.malIds));
 for(const query of [...new Set(families.flatMap(f=>f.queries))]){
  try{
   const attempts=[];const raw=await requestCatalog({kind:'list',provider:'anilibria',query,page:1,sort:'popular',genres:[],age:''},{fetcher:async(url,options)=>{const response=await fetch(url,options);attempts.push({url,status:response.status});return response;}});
   if(!Array.isArray(raw.data))throw new Error('Каталог не вернул список релизов.');
   searches.push({query,attempts,returnedMalIds:(raw.data||[]).map(x=>x.mal?.id).filter(Number.isSafeInteger),total:raw.meta?.pagination?.total});
   for(const item of raw.data||[]){if(!wanted.has(item.mal?.id))continue;found.set(item.id,{id:item.id,alias:item.alias,name:item.name,year:item.year,mal:{id:item.mal.id},type:item.type?.value,episodes_total:item.episodes_total});}
  }catch(error){searches.push({query,error:error.message});}
 }
 releases=[...found.values()];
}
const checked=[];
for(const raw of releases){
 const identity=await resolveAnimeIdentity(raw);let episodeMode='identity_not_verified';
 if(identity){const result=await requestAnimeAutomatic({kind:'anime-episode-cast',provider:'anilibria',releaseId:raw.id,number:1},{fetcher:async url=>{if(new URL(url).pathname!==`/api/v1/anime/releases/${raw.id}`)throw new Error('Appearance data is outside this metadata audit.');return new Response(JSON.stringify(raw));}});episodeMode=result.singleRelease?'single_release_cast':result.supported===false?'unsupported':'not_verified';}
 checked.push({...raw,identity,episodeMode,castDataFetched:false});
}
let policy;try{policy=JSON.parse(await readFile('/etc/codex/network-policy.json','utf8')).http_network_policy;}catch{}
const allowed=host=>policy?.type==='unrestricted'||policy?.egress_rules?.some(r=>r.host===host||r.host.startsWith('*.')&&host.endsWith(r.host.slice(1)));
const report={checkedAt:new Date().toISOString(),metadataEvidence:args.includes('--live')?'live_catalog':`saved_live_metadata:${fixture.checkedAt}`,wikiDataRequested:false,searches,releases:checked,families:families.map(f=>({name:f.name,expectedMalIds:f.malIds,foundReleaseIds:checked.filter(x=>f.malIds.includes(x.mal.id)).map(x=>x.id),missingMalIds:f.malIds.filter(id=>!checked.some(x=>x.mal.id===id)),appearanceCandidateHost:f.wiki,wikiNetwork:policy?allowed(f.wiki)?'allowed_but_not_requested':'blocked_by_environment_policy':'policy_unknown'}))};
const json=JSON.stringify(report,null,2)+'\n';if(output)await writeFile(output,json);else process.stdout.write(json);
