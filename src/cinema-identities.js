import {cinemaItem} from './cinema-provider.js';

// Exact identities confirmed against the title's IMDb listing. Some entries
// also have a verified Kinopoisk match. No playback URLs are stored here.
const identities = [
 ['1+1', 'The Intouchables', 'movie', '2011', 'tt1675434'],
 ['Скрытая любовь', 'Hidden Love', 'series', '2023', 'tt28076458'],
 ['Аутсорс', 'Autsors', 'series', '2025', 'tt30852730', '5437615'],
 ['Топи', 'The Swamp', 'series', '2021', 'tt12112118', '1355060'],
 ['Вампиры средней полосы', 'Vampiry sredney polosy', 'series', '2021', 'tt10922010'],
 ['Беспринципные', 'Besprintsipnye', 'series', '2020', 'tt12112298'],
 ['Содержанки', 'Russian Affairs', 'series', '2019', 'tt10199718', '1191043'],
 ['Война', 'War', 'movie', '2002', 'tt0309047', '41431'],
 ['Жмурки', 'Zhmurki', 'movie', '2005', 'tt0420982'],
 ['Экипаж', 'The Crew', 'movie', '2016', 'tt5653294'],
 ['Салют-7', 'Salyut-7', 'movie', '2017', 'tt6537238'],
 ['Марафон желаний', 'The Marathon of Desires', 'movie', '2020', 'tt10895828'],
 ['Паразиты: Серая зона', 'Parasyte: The Grey', 'series', '2024', 'tt21874396'],
 ['Наследники', 'Heirs', 'series', '2013', 'tt3243098'],
 ['Магазин для убийц', 'A Shop for Killers', 'series', '2024', 'tt26450613'],
 ['Мерцающий арбуз', 'Twinkling Watermelon', 'series', '2023', 'tt27446493'],
 ['Король', 'The King', 'movie', '2017', 'tt5644740'],
 ['Хозяин', 'The Host', 'movie', '2006', 'tt0468492'],
 ['Слово пацана. Кровь на асфальте', "The Boy's Word: Blood on the Asphalt", 'series', '2023', 'tt28429213', '5304403', ['Слово пацана']],
 ['Девятая планета', 'The Ultimate Planet', 'movie', '2026', 'tt32880884', '5426247'],
];

const normalizeTitle = title => title.normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const byTitle = new Map();
const byId = new Map();
for (const [localizedTitle, name, media, releaseInfo, id, kinopoiskId, aliases = []] of identities) {
 const identity = {...cinemaItem({name, type:media, releaseInfo, id},'cinemeta',media),localizedTitle, ...(kinopoiskId ? {kinopoiskId:Number(kinopoiskId)} : {})};
 byId.set(identity.id,identity);
 for (const title of [localizedTitle,...aliases]) byTitle.set(normalizeTitle(title),identity);
}

export function exactCinemaIdentity(query) {
 return byTitle.get(normalizeTitle(query));
}

export function cinemaIdentity(media, id) {
 return byId.get(media+':'+id);
}
