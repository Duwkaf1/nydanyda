// This function is serialized into the source frame. It reads standard media
// state and operates only the player's own explicit next-episode control.
export function sourcePlaybackDOM(action = {}, minimumDuration = 60) {
 const visible = element => {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility === 'visible';
 };
 const videos = [...document.querySelectorAll('video')].filter(video => {
  const rect = video.getBoundingClientRect();
  return rect.width >= 120 && rect.height >= 70 && visible(video) && Number.isFinite(video.duration) && video.duration >= minimumDuration;
 });
 if (videos.length !== 1) return null;
 const video = videos[0];
 const player = video.closest('[data-player], .player, .video-player, .video-js, .plyr, .jwplayer') || video.parentElement;
 if (!player) return null;
 const marker = player.querySelector('[data-episode-id][aria-current="true"], [data-episode][aria-current="true"], [data-episode-id].active, [data-episode].active');
 const episode = [marker,video,player].map(element=>element?.getAttribute('data-episode-id') || element?.getAttribute('data-episode')).find(value=>/^[\p{L}\p{N}:._ -]{1,80}$/u.test(value || ''));
 let mediaPath = '';
 try {
  const media = new URL(video.currentSrc);
  if (media.protocol==='https:' && !media.username && !media.password) mediaPath=media.origin+media.pathname;
 } catch {}
 const identity = episode ? 'episode:'+episode : mediaPath ? 'media:'+mediaPath : '';
 const options = [...player.querySelectorAll('button, a[href], [role="button"]')].filter(control => {
  if (!visible(control) || control.disabled || control.getAttribute('aria-disabled')==='true') return false;
  const title = [control.getAttribute('aria-label'), control.getAttribute('title'), control.textContent?.trim()].filter(Boolean);
  if (!control.hasAttribute('data-next-episode') && control.getAttribute('data-action')!=='next-episode'
      && !title.some(text=>/^(?:следующая серия|следующий эпизод|next episode)$/iu.test(text))) return false;
  if (control.tagName!=='A') return true;
  try { return new URL(control.href).origin===location.origin; } catch { return false; }
 });
 const next = options.length===1 ? options[0] : null;
 if (action.kind==='episode') {
  if (video.currentTime>1 || !action.episode) return false;
  const controls=[...player.querySelectorAll('button[data-episode-id], a[data-episode-id][href], button[data-episode], a[data-episode][href]')].filter(control=>{
   if(!visible(control)||control.disabled||control.getAttribute('aria-disabled')==='true')return false;
   if((control.getAttribute('data-episode-id')||control.getAttribute('data-episode'))!==action.episode)return false;
   return control.tagName!=='A'||new URL(control.href).origin===location.origin;
  });
  if(controls.length!==1)return false;
  controls[0].click();
  return true;
 }
 if (action.kind==='play') {
  if (action.identity!==identity || !video.paused || video.ended || video.seeking || video.error || video.currentTime>1) return false;
  return video.play().then(()=>true,()=>false);
 }
 if (action.kind==='next') {
  if (!video.ended || video.seeking || video.error || action.identity!==identity || !next) return false;
  next.click();
  return true;
 }
 if (action.kind==='seek') {
  if (!identity || identity!==action.identity || video.seeking || video.error || video.currentTime>1) return false;
  if (!Number.isFinite(action.time) || action.time<1 || action.time>=video.duration-1) return false;
  video.currentTime=action.time;
  return true;
 }
 return {identity,episode:episode||'',time:video.currentTime,duration:video.duration,ended:video.ended,
  paused:video.paused,seeking:video.seeking,ready:video.readyState,error:!!video.error,next:!!next};
}

export const sourcePlaybackScript = action => `(${sourcePlaybackDOM.toString()})(${JSON.stringify(action || {})})`;
