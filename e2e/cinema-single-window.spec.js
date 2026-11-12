import {test,expect} from '@playwright/test';
import {serveCinema} from './cinema-fixtures.js';
import {cinemaItem} from '../src/cinema-provider.js';
import {sourceAudioDOM} from '../desktop/source-audio.js';
test('an unavailable saved movie catalog opens Lordfilm in Yoru and keeps direct title search available',async({page})=>{
 await serveCinema(page,{fail:true});await page.addInitScript(()=>{window.__fallback=[];window.kadr={openLordfilm:async media=>window.__fallback.push({media}),openCinema:async data=>window.__fallback.push(data)};});await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'Фильмы',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__fallback)).toEqual([{media:'movie'}]);await expect(page.locator('#cinema-status')).toContainText('Открываем Lordfilm');await page.locator('#cinema-search').fill('Джон Уик');await page.keyboard.press('Enter');await expect(page.locator('#cinema-source-fallback')).toBeVisible();await page.locator('#cinema-source-fallback').click();expect(await page.evaluate(()=>window.__fallback.at(-1))).toEqual({service:'lordfilm',item:{title:'Джон Уик',year:'',media:'movie'}});
});
test('Russian title search from Series includes older movies and related TV, then restores saved discovery filters',async({page})=>{
 await serveCinema(page,{recent:true});const requests=[];
 await page.route('**/__yoru/catalog?**',route=>{const args=new URL(route.request().url()).searchParams;if(args.get('kind')!=='cinema-search')return route.fallback();requests.push(Object.fromEntries(args));return route.fulfill({json:{items:[cinemaItem({id:'tt2911666',name:'John Wick',type:'movie',releaseInfo:'2014',imdbRating:'7.4'},'cinemeta','movie'),cinemaItem({id:'tt6486762',name:'The Continental: From the World of John Wick',type:'series',releaseInfo:'2023',imdbRating:'7.2'},'cinemeta','series')],total:2,hasMore:false,scope:'title-search'}});});
 await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'Сериалы',exact:true}).click();await page.locator('#cinema-search').fill('джон');await page.keyboard.press('Enter');await expect(page.locator('#cinema-grid .catalog-card')).toHaveCount(2);await expect(page.locator('#cinema-grid')).toContainText('2014 · Фильм');await expect(page.locator('#cinema-grid')).toContainText('2023 · Сериал');await expect(page.locator('#cinema-period')).toBeDisabled();expect(requests.at(-1).yearFrom).toBe('0');expect(requests.at(-1).genre).toBe('');await page.screenshot({path:'test-results/cinema-john-wick-search.png',animations:'disabled'});await page.locator('#cinema-search').fill('');await expect(page.locator('#cinema-period')).toBeEnabled();await expect(page.locator('#cinema-period')).toHaveValue('recent');
});
test('source audio reads actual choices, dispatches change and rejects stale labels without exposing URL values',async({page})=>{
 await page.goto('about:blank');await page.setContent('<select name="translation" onchange="document.body.dataset.changed=this.selectedIndex"><option value="https://secret.test/one">Русский · A</option><option value="https://secret.test/two">Русский · B</option><option disabled>Недоступно</option></select><select name="quality"><option>1080</option></select>');const run=action=>page.evaluate(({code,action})=>eval('('+code+')')(action),{code:sourceAudioDOM.toString(),action});const result=await run();expect(result).toHaveLength(1);expect(JSON.stringify(result)).not.toContain('secret');await run({kind:'select',control:0,index:1,label:'Русский · B'});await expect(page.locator('body')).toHaveAttribute('data-changed','1');await expect(page.locator('select[name="translation"]')).toHaveJSProperty('selectedIndex',1);await expect(run({kind:'select',control:0,index:0,label:'Stale option'})).rejects.toThrow('Список озвучек изменился');
});
test('the source workspace fits narrow and zoomed layouts and renders only source-reported dubbing',async({page})=>{
 await serveCinema(page);await page.addInitScript(()=>{window.__sourceActions=[];window.kadr={sourceAction:async value=>window.__sourceActions.push(value),sourceBounds:async rect=>window.__sourceRect=rect,onSourceState:callback=>window.__sourceUpdate=callback};});await page.goto('http://127.0.0.1:5173');await page.evaluate(()=>window.__sourceUpdate({open:true,key:'cinema-lordfilm',title:'Lordfilm · Yoru',host:'sm.lordfilm5.pro',revision:1,audio:[{options:[{index:0,label:'Русский · Проверочная студия',selected:true}]}]}));await expect(page.locator('#source-workspace')).toBeVisible();await expect(page.locator('#source-audio option')).toHaveText('Русский · Проверочная студия');expect(await page.evaluate(()=>{const option=document.querySelector('#source-audio option');window.__sourceUpdate({open:true,key:'cinema-lordfilm',title:'Lordfilm · Yoru',host:'sm.lordfilm5.pro',revision:2,audio:[{options:[{index:0,label:'Русский · Проверочная студия',selected:true}]}]});return option===document.querySelector('#source-audio option');})).toBe(true);await page.keyboard.press('Control+k');await expect(page.locator('#source-search')).toBeFocused();await expect(page.locator('#source-workspace')).toBeVisible();for(const width of [1320,640,400]){await page.setViewportSize({width,height:900});await expect.poll(()=>page.evaluate(()=>document.querySelector('#source-workspace').scrollWidth<=document.querySelector('#source-workspace').clientWidth+1)).toBe(true);}await page.setViewportSize({width:1320,height:900});await page.screenshot({path:'test-results/cinema-single-window-controls.png',animations:'disabled'});await page.locator('#source-close').click();expect(await page.evaluate(()=>window.__sourceActions.at(-1))).toBe('close');
});

test('after both movie catalogs fail, the embedded error leads back to the alternate catalog selector',async({page})=>{
 await serveCinema(page);
 await page.route('**/__yoru/catalog?**',route=>{
  const {searchParams}=new URL(route.request().url());
  if(searchParams.get('kind')!=='cinema-list'||searchParams.get('provider')!=='cinemeta')return route.fallback();
  return route.fulfill({status:503,json:{error:'Cinemeta HTTP 503'}});
 });
 await page.addInitScript(()=>{
  window.kadr={
   onSourceState:callback=>window.__sourceUpdate=callback,
   openLordfilm:async()=>window.__sourceUpdate({open:true,key:'cinema-lordfilm',title:'Lordfilm · Yoru',host:'sm.lordfilm5.pro',loading:true}),
   sourceAction:async action=>{if(action==='close')window.__sourceUpdate({open:false});},
  };
 });
 await page.goto('http://127.0.0.1:5173');
 await page.getByRole('button',{name:'Фильмы',exact:true}).click();
 const alternate=page.locator('#source-other-catalog');
 await expect(page.locator('#source-status')).toHaveText('Загружаем страницу…');
 await expect(alternate).toBeHidden();
 await page.evaluate(()=>window.__sourceUpdate({
  open:true,key:'cinema-lordfilm',title:'Lordfilm · Yoru',error:'Не удалось открыть Lordfilm (код -105).',loadFailed:true,
 }));
 await expect(page.locator('#source-status')).toContainText('код -105');
 await alternate.click();
 await expect(page.locator('#source-workspace')).toBeHidden();
 await expect(page.locator('#cinema-error')).toContainText('Cinemeta HTTP 503');
 await expect(page.locator('#cinema-status')).toBeEmpty();
 const provider=page.locator('#cinema-provider');
 await expect(provider).toBeFocused();
 await provider.selectOption('archive');
 await expect(page.locator('#cinema-grid')).toContainText('Проверочный фильм');
});

test('when opening the embedded fallback rejects, the catalog shows the error and a recovery action',async({page})=>{
 await serveCinema(page,{fail:true});
 await page.addInitScript(()=>{window.kadr={openLordfilm:async()=>{throw new Error('Окно источника недоступно.');}};});
 await page.goto('http://127.0.0.1:5173');
 await page.getByRole('button',{name:'Фильмы',exact:true}).click();
 await expect(page.locator('#cinema-status')).toHaveText('Cinemeta и Lordfilm недоступны');
 await expect(page.locator('#cinema-error')).toContainText('Окно источника недоступно.');
 await page.locator('#cinema-other-catalog').click();
 await expect(page.locator('#cinema-provider')).toBeFocused();
});
