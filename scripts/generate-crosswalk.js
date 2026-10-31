// Regenerate the separately licensed ID database from the pinned upstream JSON.
// Usage: node scripts/generate-crosswalk.js /path/to/anime-offline-database-minified.json
import {readFile,writeFile} from 'node:fs/promises';
const raw=JSON.parse(await readFile(process.argv[2],'utf8'));const entries={};
for(const item of raw.data){
 const ids=pattern=>item.sources.flatMap(url=>{const match=url.match(pattern);return match?[Number(match[1])]:[];});
 const anidb=ids(/^https:\/\/anidb\.net\/anime\/(\d+)$/);const mal=ids(/^https:\/\/myanimelist\.net\/anime\/(\d+)$/);
 if(anidb.length!==1||mal.length!==1)continue;
 entries[String(mal[0])]={anidbId:anidb[0],year:item.animeSeason.year,episodes:item.episodes,names:[...new Set([item.title,...item.synonyms])]};
}
await writeFile(new URL('../data/anime-crosswalk.json',import.meta.url),JSON.stringify({source:'manami-project/anime-offline-database',version:'2026-27',license:'ODbL-1.0 / DbCL-1.0',entries})+'\n');
console.log(`Wrote ${Object.keys(entries).length} exact MAL/AniDB mappings. Preserve LICENSE-anime-crosswalk.txt.`);
