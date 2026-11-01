import { packager } from '@electron/packager';
import path from 'node:path';
import { readFile, copyFile, writeFile, readdir, rm } from 'node:fs/promises';
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const output = await packager({
  dir: '.', out: 'artifacts', name: 'Yoru', executableName: 'Yoru', platform: 'win32', arch: 'x64',
  electronVersion: '45.0.0', appVersion: version, asar: true, overwrite: true,
  icon: path.resolve('assets/yoru.ico'),
  win32metadata: { CompanyName: 'Duwkaf1', FileDescription: 'Yoru — кино, сериалы и аниме', ProductName: 'Yoru' },
  download: { cacheRoot: path.resolve('.cache/electron') },
  ignore: [/^\/(test|e2e|test-results|playwright-report|scripts|installer|docs|public|artifacts|\.git|\.cache)(\/|$)/, /^\/assets\/branding(\/|$)/, /^\/(vite\.config|playwright\.config)/],
});
for (const item of output) {
  await copyFile('public/fonts/OFL-Nunito.txt', path.join(item, 'LICENSE-Nunito.txt'));
  // The app explicitly uses Russian; keep English as Chromium's fallback.
  // Remove only other UI locale packs, never codecs, fonts or rendering files.
  const locales = path.join(item, 'locales');
  for (const file of await readdir(locales, { withFileTypes: true })) {
    if (file.isFile() && file.name.endsWith('.pak') && !['ru.pak', 'en-US.pak'].includes(file.name)) await rm(path.join(locales, file.name));
  }
  await copyFile('data/LICENSE-anime-crosswalk.txt', path.join(item, 'LICENSE-anime-crosswalk.txt'));
  await copyFile('node_modules/hls.js/LICENSE', path.join(item, 'LICENSE-hls.js.txt'));
  await copyFile('docs/playlist.example.json', path.join(item, 'playlist.example.json'));
  await copyFile('docs/playlist-original.example.json', path.join(item, 'playlist-original.example.json'));
  await copyFile('docs/viewing-0.6.md', path.join(item, 'Просмотр-и-субтитры.md'));
  await copyFile('docs/redesign-0.7.md', path.join(item, 'Оформление-и-проверки.md'));
  await copyFile('docs/character-details.md', path.join(item, 'Имена-и-заметки.md'));
  await copyFile('docs/managed-anime-0.9.2.md', path.join(item, 'Проверка-перед-публикацией.md'));
  await copyFile('node_modules/video.js/LICENSE', path.join(item, 'LICENSE-video.js.txt'));
  await copyFile('node_modules/libass-wasm/dist/js/COPYRIGHT', path.join(item, 'LICENSE-libass-wasm.txt'));
  await writeFile(path.join(item, 'ПРОЧИТАЙ.txt'), `\uFEFFYORU ${version}

Установщик Yoru-Setup ставит приложение одним файлом на Windows 10/11 x64. Из ZIP без установки нужно распаковать всю папку и запустить Yoru.exe. Сборка не подписана.

Начни с каталога: введи название, выбери жанры и возраст либо нажми «Случайное аниме». AniLibria использует встроенный плеер и сохраняет серию и время. Расширенный каталог Yummyani подгружает следующие страницы при прокрутке и открывает поддерживаемый плеер внутри Yoru. Серии, автопереход, выбранная озвучка и подтверждённая позиция управляются приложением. Если управляемого плеера нет, приложение сообщает об этом; окно сайта вместо просмотра не открывается.

Во вкладках «Фильмы» и «Сериалы» работает общий каталог Cinemeta. При его отказе используются TVmaze для сериалов или Internet Archive для фильмов со свободной лицензией. Это разные каталоги: смена источника явно обозначается. Для YouTube, Кинопоиска, Rutube и VK Видео открывается поиск названия и выбранной серии в системном браузере. Наличие полной версии, вход, подписку и региональные ограничения определяет сервис; автоматической передачи позиции между такими сайтами нет.

Прямой просмотр Internet Archive появляется только при подтверждённом файле, языке и указанной свободной лицензии. Резервные адреса относятся к тому же файлу и качеству. Сохраняется позиция встроенного просмотра. В настройках можно проверить доступ к публичным страницам сервисов; это не проверка наличия фильма. Проверки новых сервисов из РФ и других стран не подтверждены.

Для аниме AniLibria автоматически подбираются другие плееры и озвучки Yummyani, если найдено точное соответствие релиза. Реальные названия команд берутся из API. Если оригинал и варианты перевода опубликованы для выбранного релиза, они доступны под видео. Онлайн-плеер открывается внутри Yoru; качество и оформление его субтитров выбираются в самом плеере. Позиция Kodik сохраняется только по подтверждённым сообщениям. Доступность каждого перевода и 1080p не гарантируется.

Если постер Yummyani не загрузился, резервная обложка проверяется по точным идентификаторам релиза в AniLibria или MyAnimeList. По одному похожему названию обложки не подставляются; при противоречии идентификаторов остаётся заглушка.

В настройках есть готовые темы, своя палитра, режимы производительности и качества. Подробные параметры и ручной импорт находятся во вкладке «Дополнительно».

Кнопка «Удалить приложение полностью» в настройках установленной версии сначала просит подтверждение. После подтверждения удаляются приложение, библиотека, история, заметки, темы и кэш. Обычное удаление через Windows сохраняет профиль. В ZIP без установки эта кнопка не запускает удаление; распакованную папку можно удалить вручную после закрытия приложения.

Профиль хранится в %APPDATA%\\kadr-anime. Не публикуй свои списки с личными токенами. Твои видео и документы вне профиля Yoru не удаляются.

Сохраняются два движка, прямые MP4/WebM/HLS, варианты перевода и оформленные субтитры. Автовосстановление требует подходящего резервного источника; полный отказ сети или сервиса не позволяет гарантировать непрерывный просмотр. Проверки из РФ и звук Discord на пользовательском ПК не подтверждены. Для Discord выбирай нужное окно приложения с передачей звука.

Персонажи каталога автоматически подбираются по точной связи с AniDB и загружаются с публичной страницы релиза, вместе с фотографиями. Свои имена и заметки сохраняются отдельно. Запросы AniDB выполняются через очередь. При недоступности или изменении разметки AniDB используется MyAnimeList через Jikan с проверкой точного MAL ID, названия и года. Сохранённый каст и заметки остаются на устройстве. Полный состав по каждой серии не подтверждён; для дополнительного ручного HTTP API по-прежнему нужен зарегистрированный клиент. Индекс ID основан на anime-offline-database, ODbL/DbCL; лицензия включена в поставку.

Результаты Windows-проверки и актуальные установщики находятся в GitHub Actions репозитория Duwkaf1/kinoteatr-xivivide. Подробности — в «Проверка-перед-публикацией.md».
`, 'utf8');
  console.log(`Windows application: ${item}`);
}
