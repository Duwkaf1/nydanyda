import {requestCinemaSearch} from './cinema-search.js';
import {requestCinemaMetadata} from './cinema-metadata.js';
import {requestCinemaPublic} from './cinema-pages.js';
import {matchCinema} from './cinema-match.js';
import {requestAnimeAutomatic} from './anime-automatic.js';
import { CATALOG_HOSTS, catalogRequestURL } from '../src/catalog-provider.js';
import {requestCinema} from './cinema-network.js';
import { resolvePoster } from './poster-network.js';
import { boundedText } from '../src/subtitles.js';

// The renderer supplies a typed operation, never a destination URL. Only these
// fixed public API origins are reachable through this bridge.
export async function requestCatalog(data, { fetcher = globalThis.fetch, signal } = {}) {
  if(data?.kind==='anime-options'||data?.kind==='anime-cast'||data?.kind==='anime-episodes'||data?.kind==='anime-episode-cast')return requestAnimeAutomatic(data,{fetcher,signal});
  if(data?.kind==='cinema-search')return requestCinemaSearch(data,{fetcher,signal});
  if(data?.kind==='cinema-metadata')return requestCinemaMetadata(data,{fetcher,signal});
  if(data?.kind==='cinema-public')return requestCinemaPublic(data,{fetcher,signal});
  if(data?.kind==='cinema-match')return matchCinema(data,{fetcher,signal});
  if(data?.kind==='cinema-list'||data?.kind==='cinema-detail'||data?.kind==='cinema-genres')return requestCinema(data,{fetcher,signal});
  catalogRequestURL(data);
  const deadline = AbortSignal.timeout(12000);
  const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
  let failure;
  for (const origin of (data.provider === 'yummyani' ? ['https://old.yummyani.me','https://api.yani.tv'] : CATALOG_HOSTS)) {
    combined.throwIfAborted();
    try {
      const url=data.provider==='yummyani'?catalogRequestURL(data).replace('https://old.yummyani.me/api',origin==='https://api.yani.tv'?origin:origin+'/api'):catalogRequestURL(data,origin);
      const response = await fetcher(url, { credentials: 'omit', redirect: 'error', signal: AbortSignal.any([combined,AbortSignal.timeout(5500)]), headers: { Accept: 'application/json' } });
      if (response.status === 429) throw new Error('Каталог просит подождать. Повтори поиск немного позже.');
      if (response.status === 404) throw new Error('Это аниме больше не найдено в каталоге.');
      const body = await boundedText(response, 2 * 1024 * 1024);
      const raw=JSON.parse(body);
      return data.kind === 'poster' ? await resolvePoster(raw,{releaseId:data.releaseId,after:data.after,fetcher,signal:combined}) : raw;
    } catch (error) {
      if (combined.aborted) throw error;
      failure = error;
      if (/просит подождать|больше не найдено/.test(error.message)) break;
    }
  }
  throw new Error(/просит подождать|больше не найдено/.test(failure?.message) ? failure.message : 'Каталог сейчас не отвечает. Проверь соединение и попробуй ещё раз.');
}
