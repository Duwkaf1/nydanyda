import {discoveryRequest} from './discovery-transport.js';
import {parseAniDBPage,parseJikanCast,parseAniListCast} from './anime-online.js';
import { parseAniDB, readCastCache, saveCastCache, castForEpisode, anidbPage, anidbReleaseId, characterRole } from './anidb.js';
import { mergeCastPhotos, validateCharacterPhoto } from './character-photos.js';
import { characterPhotoPicker } from './character-photo-picker.js';
import { icon } from './icons.js';
import { characterDetailsEditor } from './character-details-editor.js';
import {parseEpisodeAppearances} from './episode-cast.js';
export function castPanel({ $, node, active, persist, toast }) {
  let cache = readCastCache(); let serial = 0;let autoRequest,autoKey='',autoSequence=0,rateRetries=0,retryTimer;const autoMessages=new Map();
  let episodeRequest,episodeKey='',episodeSequence=0;const episodeMessages=new Map();
  const episodeContext=()=>`${active()?.title.id}:${id()}:${active()?.episode.number}`;
  const details = characterDetailsEditor({ $, node, changed: () => render() });
  const photos = characterPhotoPicker({ $, node, save: (releaseId, characterId, photo) => {
    const data = cache[releaseId]; const character = data?.characters.find(item => item.id === characterId);
    if (!character) throw new Error('Данные персонажа изменились. Открой выбор фотографии заново.');
    if (photo) character.photo = validateCharacterPhoto(photo); else delete character.photo;
    const saved = save(data); render(); toast(saved ? 'Фотография персонажа сохранена.' : 'Фотография изменена только до закрытия приложения: не удалось сохранить её.');
  } });
  const season = () => Number($('#cast-season').value) || 1;
  const mapping = () => active()?.title.seasons?.find(item => item.number === season());
  const id = () => mapping()?.anidbId || (season() === 1 ? active()?.title.anidbId : null);
  const message = text => { $('#cast-status').textContent = text; $('#cast-settings-status').textContent = text; };
  $('#open-cast-settings').onclick = () => { $('#cast-settings-status').textContent = ''; $('#cast-settings-dialog').showModal(); };
  for (const selector of ['#close-cast-settings', '#done-cast-settings']) $(selector).onclick = () => $('#cast-settings-dialog').close();
  function save(data) { cache[data.id] = data; try { saveCastCache(cache); return true; } catch { toast('Каст показан до закрытия приложения: не удалось сохранить его на диске.'); return false; } }
  function render() {
    details.flush();
    serial++; const value = active(); if (!value) return;
    const perEpisode = $('#cast-scope').value === 'episode';
    $('#cast-view').value=$('#cast-scope').value;
    $('#cast-context').textContent = `${value.title.title} · ${perEpisode?`Серия ${value.episode.number}`:$('#cast-season').selectedOptions[0]?.textContent || 'Весь релиз'}`;
    $('#cast-settings-context').textContent = $('#cast-context').textContent;
    $('#cast-season-label').hidden = $('#cast-season').options.length < 2;
    $('#anidb-id').value = id() ? anidbPage(id()) : ''; $('#cast-list').replaceChildren(); $('#cast-episode-editor').replaceChildren();
    const data = cache[id()]; const known = data && Array.isArray(data.characters) && Array.isArray(data.episodes);
    const episode = known ? data.episodes.find(item => item.number === String(value.episode.number)) : null;
    $('#anidb-episode').disabled = !episode?.id || season() !== (value.episode.season || 1);
    $('#save-episode-cast').disabled = !known || season() !== (value.episode.season || 1);
    $('#cast-settings-label').textContent = known || value.title.catalog ? 'Настроить' : 'Добавить персонажей';
    $('#retry-auto-cast').hidden=!value.title.catalog||!autoMessages.has(value.title.id);
    $('#cast-show-all').hidden=true;$('#retry-episode-cast').hidden=true;
    $('#cast-episode-settings').hidden = !known;
    if (!known) { $('#cast-status').textContent = value.title.catalog ? autoMessages.get(value.title.id)||'Автоматически загружаем персонажей из AniDB…' : 'Персонажей пока нет. Список можно добавить в настройках.'; return; }
    const manual=Array.isArray(data.manualEpisodes?.[String(value.episode.number)]);
    const single=data.singleRelease===true&&value.episode.number===1;
    const characters = perEpisode ? (single&&!manual?data.characters:castForEpisode(data, value.episode.number)) : data.characters;
    const appearances=data.automaticEpisodes?.[String(value.episode.number)];
    const source=appearances&&!manual?` · ${appearances.source||'Black Clover Wiki'}`:'';
    $('#cast-status').textContent = perEpisode ? characters === null ? episodeMessages.get(episodeContext())||(value.title.catalog?(episodeRequest&&episodeKey===episodeContext()?'Загружаем подтверждённые появления в этой серии…':'Нет подтверждённых данных по этой серии.'):'Для этой серии данные ещё не отмечены.') : single&&!manual?`Одноэпизодный релиз · персонажей: ${characters.length}`:`Серия ${value.episode.number} · ${manual?'отмечено вручную':'найдено в каталоге'}: ${characters.length}${source}` : `${['MyAnimeList','AniList'].includes(data.source)?data.source+' · ':''}Весь релиз · персонажей: ${characters.length} · имена и заметки можно менять`;
    $('#cast-show-all').hidden=!perEpisode||Boolean(characters?.length);
    $('#retry-episode-cast').hidden=!perEpisode||!value.title.catalog||!episodeMessages.has(episodeContext());
    for (const character of [...(characters || [])].sort((a, b) => characterRole(a.role).rank - characterRole(b.role).rank)) {
      const personal = details.attach(character, { titleId: value.title.id, releaseId: data.id, characterId: character.id });
      const card = node('article', undefined, 'cast-card'); const role = characterRole(character.role).label;
      card.dataset.characterId = character.id;
      const portrait = node('div', undefined, 'character-portrait'); const fallback = node('span', undefined, 'character-photo-fallback'); fallback.append(icon('portrait'), node('span', 'Фотографии пока нет')); portrait.append(fallback);
      const source = character.photo?.url || character.imageUrl;
      if (source) {
        const image = node('img', undefined, 'character-photo'); image.alt = personal.name; image.loading = 'lazy'; image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
        image.onload = () => { fallback.hidden = true; }; image.onerror = () => { image.remove(); fallback.lastElementChild.textContent = 'Фото недоступно'; };
        image.src = source; portrait.append(image);
      }
      const edit = node('button', undefined, 'character-photo-edit icon-button'); edit.type = 'button'; edit.append(icon('image')); edit.setAttribute('aria-label', `Выбрать фото: ${personal.name}`); edit.title = 'Выбрать фотографию'; edit.onclick = () => photos.open(character, data.id); portrait.append(edit);
      const body = node('div', undefined, 'character-body'); body.append(personal.heading, personal.note, node('p', role || 'Персонаж', 'character-role'));
      const actors = node('div', undefined, 'character-actors');
      for (const actor of character.actors) {
        const row = node('div', undefined, 'character-actor');
        if (actor.imageUrl) { const image = node('img'); image.alt = ''; image.loading = 'lazy'; image.decoding = 'async'; image.referrerPolicy = 'no-referrer'; image.onerror = () => image.remove(); image.src = actor.imageUrl; row.append(image); }
        row.append(node('span', actor.name)); actors.append(row);
      }
      if (!character.actors.length) actors.append(node('span', 'Актёр озвучивания не указан', 'muted'));
      body.append(actors);
      card.append(portrait, body);
      $('#cast-list').append(card);
    }
    const marked = data.manualEpisodes?.[String(value.episode.number)] || [];
    for (const character of data.characters) {
      const label = node('label'); const input = node('input'); input.type = 'checkbox'; input.value = character.id; input.checked = marked.includes(character.id);
      const name = details.name(character, { titleId: value.title.id, releaseId: data.id, characterId: character.id });
      label.append(input, node('span', name)); $('#cast-episode-editor').append(label);
    }
  }
  function episodeChanged() {
    const value = active(); if (!value) return;
    const numbers = [...new Set([1, ...value.title.episodes.map(ep => ep.season || 1), ...(value.title.seasons || []).map(item => item.number)])].sort((a, b) => a - b);
    $('#cast-season').replaceChildren(...numbers.map(number => { const option = node('option', value.title.seasons?.find(s => s.number === number)?.title || `Сезон ${number}`); option.value = number; return option; }));
    $('#cast-season').value = value.episode.season || 1; render();ensureAutomatic();ensureEpisode();
  }
  async function ensureEpisode(force=false){
    const value=active(),data=cache[id()];const key=episodeContext();
    if(!value?.title.catalog||!data||season()!==(value.episode.season||1))return;
    if(!force&&(data.singleRelease||data.automaticEpisodes?.[String(value.episode.number)]&&Date.now()-data.automaticEpisodes[String(value.episode.number)].updatedAt<86400000||episodeKey===key&&(episodeRequest||episodeMessages.has(key))))return;
    episodeRequest?.abort();const controller=new AbortController();episodeRequest=controller;episodeKey=key;const token=++episodeSequence;episodeMessages.delete(key);render();
    try{
      const result=await discoveryRequest({kind:'anime-episode-cast',provider:value.title.catalog.provider,releaseId:value.title.catalog.releaseId,number:value.episode.number},{signal:controller.signal});
      if(token!==episodeSequence||episodeContext()!==key||active()!==value)return;
      if(result.id!==data.id||result.number!==value.episode.number)throw new Error('Источник вернул другой релиз или серию.');
      const latest=cache[result.id];if(!latest)throw new Error('Список персонажей изменился. Повтори загрузку.');
      if(result.singleRelease===true){latest.singleRelease=true;save(latest);}
      else if(result.supported===false)episodeMessages.set(key,result.message||'Нет подтверждённых данных по этой серии.');
      else{const appearances=parseEpisodeAppearances(result,value.episode.number);latest.automaticEpisodes||={};latest.automaticEpisodes[String(value.episode.number)]=appearances;save(latest);}
    }catch(error){if(token===episodeSequence&&!controller.signal.aborted)episodeMessages.set(key,`Не удалось загрузить появления этой серии. ${(error.message||'Повтори позже.').replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'')}`);}
    finally{if(token===episodeSequence){episodeRequest=null;render();}}
  }
  async function ensureAutomatic(force=false){
    const value=active();if(!value?.title.catalog){clearTimeout(retryTimer);autoRequest?.abort();autoSequence++;autoRequest=null;episodeRequest?.abort();episodeSequence++;episodeRequest=null;return;}const key=`${value.title.id}:${season()}`;
    if(!force&&((autoKey===key&&autoRequest)||cache[id()]&&Date.now()-cache[id()].updatedAt<86400000))return;
    clearTimeout(retryTimer);if(autoKey!==key)rateRetries=0;autoRequest?.abort();autoRequest=new AbortController();autoKey=key;const token=++autoSequence;const titleId=value.title.id;autoMessages.delete(titleId);$('#retry-auto-cast').hidden=true;
    try{
      let result=await discoveryRequest({kind:'anime-cast',provider:value.title.catalog.provider,releaseId:value.title.catalog.releaseId},{signal:autoRequest.signal});if(token!==autoSequence||active()?.title.id!==titleId)return;
      const current=active();if(mapping()?.anidbId&&mapping().anidbId!==result.id)throw new Error('Для этого сезона сохранена собственная страница AniDB. Автоматически её не меняем.');
      const expectedId=result.id;let data;try{data=result.anilist?parseAniListCast(result.anilist,result.id):result.fallback?parseJikanCast(result.fallback,result.id):parseAniDBPage(result.html,result.id);}catch(error){
       if(result.fallback||result.anilist)throw error;
       result=await discoveryRequest({kind:'anime-cast',provider:value.title.catalog.provider,releaseId:value.title.catalog.releaseId,castSource:'jikan'},{signal:autoRequest.signal});
       if(token!==autoSequence||active()?.title.id!==titleId)return;
       if(result.id!==expectedId)throw new Error('Резервный каталог вернул другой релиз.');
       data=result.anilist?parseAniListCast(result.anilist,result.id):parseJikanCast(result.fallback,result.id);
      }current.title.anidbId=result.id;save(mergeCastPhotos(data,cache[result.id]));persist();autoMessages.delete(titleId);render();ensureEpisode();
    }catch(error){if(token===autoSequence&&!autoRequest.signal.aborted&&active()?.title.id===titleId){autoMessages.set(titleId,(error.message||'Не удалось загрузить персонажей.').replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));render();if(/подождать перед следующей/.test(error.message)&&rateRetries++<1)retryTimer=setTimeout(()=>{if(active()?.title.id===titleId)ensureAutomatic(true);},5100);}}
    finally{if(token===autoSequence)autoRequest=null;}
  }
  $('#retry-auto-cast').onclick=()=>ensureAutomatic(true);
  $('#cast-show-all').onclick=()=>{$('#cast-scope').value='season';render();};
  $('#retry-episode-cast').onclick=()=>ensureEpisode(true);
  $('#cast-view').onchange=()=>{$('#cast-scope').value=$('#cast-view').value;$('#cast-scope').onchange();};
  $('#cast-season').onchange = () => { if (season() !== (active()?.episode.season || 1)) $('#cast-scope').value = 'season'; render(); }; $('#cast-scope').onchange = () => {
    if ($('#cast-scope').value === 'episode') $('#cast-season').value = active()?.episode.season || 1;
    render();ensureEpisode();
  };
  $('#bind-anidb').onclick = () => {
    try {
      const value = active(); const entry = { ...(mapping() || {}), number: season(), anidbId: anidbReleaseId($('#anidb-id').value) };
      value.title.seasons = [...(value.title.seasons || []).filter(item => item.number !== season()), entry].sort((a, b) => a.number - b.number);
      const saved = persist(); render(); $('#cast-settings-status').textContent = saved ? 'Страница сохранена. Если список ещё пуст, выбери способ загрузки ниже.' : 'Ссылка применена только до закрытия приложения: не удалось сохранить её.';
    } catch (error) { $('#cast-settings-status').textContent = error.message; }
  };
  async function open(episode = false) {
    try {
      const value = active(); const data = cache[id()]; const episodeId = episode ? data?.episodes.find(item => item.number === String(value.episode.number))?.id : undefined;
      if (!id()) throw new Error('Сначала сохрани ссылку на аниме.');
      if (window.kadr?.openAniDB) await window.kadr.openAniDB({ id: id(), episodeId });
      else window.open(anidbPage(id(), episodeId), '_blank', 'noopener,noreferrer');
    } catch (error) { message(error.message); }
  }
  $('#anidb-open').onclick = () => open(); $('#anidb-episode').onclick = () => open(true);
  $('#anidb-xml-button').onclick = () => $('#anidb-xml').click();
  $('#anidb-xml').onchange = async event => {
    const target = id(); const token = serial; const file = event.target.files[0];
    try {
      if (!target) throw new Error('Сначала сохрани ссылку на аниме.');
      if (!file || file.size > 2 * 1024 * 1024) throw new Error('Нужен XML-файл до 2 МиБ.');
      const data = parseAniDB(await file.text(), target);
      if (token !== serial) return;
      const saved = save(mergeCastPhotos(data, cache[target])); render(); $('#cast-settings-status').textContent = saved ? 'Персонажи добавлены. Можно закрыть настройки.' : 'Персонажи добавлены только до закрытия приложения: не удалось сохранить их.';
    } catch (error) { if (token === serial) message(error.message); }
    event.target.value = '';
  };
  $('#anidb-fetch').onclick = async () => {
    const target = id(); const token = serial; const button = $('#anidb-fetch'); button.disabled = true;
    try {
      if (!target) throw new Error('Сначала сохрани ссылку на аниме.');
      if (!window.kadr?.fetchAniDB) throw new Error('Прямой запрос AniDB доступен в настольном приложении. Здесь можно импортировать XML.');
      const client = $('#anidb-client').value.trim(); const version = Number($('#anidb-client-version').value);
      if (!client) throw new Error('Для API нужно зарегистрированное имя клиента AniDB. Укажи его ниже или импортируй XML.');
      const xml = await window.kadr.fetchAniDB({ id: target, client, version });
      if (token !== serial) return;
      const data = parseAniDB(xml, target); const saved = save(mergeCastPhotos(data, cache[target])); render(); $('#cast-settings-status').textContent = saved ? 'Список обновлён.' : 'Список обновлён только до закрытия приложения: не удалось сохранить его.';
    } catch (error) { if (token === serial) message(`Не удалось обновить: ${error.message}`); }
    finally { button.disabled = false; }
  };
  $('#save-episode-cast').onclick = () => {
    const data = cache[id()]; if (!data || season() !== (active()?.episode.season || 1)) return;
    data.manualEpisodes ||= {}; data.manualEpisodes[String(active().episode.number)] = [...$('#cast-episode-editor').querySelectorAll('input:checked')].map(input => Number(input.value));
    data.updatedAt = Date.now(); save(data); $('#cast-scope').value = 'episode'; render();
  };
  const config = (() => { try { const value = JSON.parse(localStorage.getItem('yoru.anidb.client') || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; } })();
  $('#anidb-client').value = typeof config.client === 'string' ? config.client.slice(0, 32) : ''; $('#anidb-client-version').value = Number.isInteger(config.version) && config.version > 0 ? config.version : 1;
  for (const input of [$('#anidb-client'), $('#anidb-client-version')]) input.onchange = () => {
    if (!input.checkValidity()) return;
    try { localStorage.setItem('yoru.anidb.client', JSON.stringify({ client: $('#anidb-client').value.trim(), version: Number($('#anidb-client-version').value) })); } catch { toast('Не удалось сохранить параметры AniDB.'); }
  };
  return { episodeChanged };
}
