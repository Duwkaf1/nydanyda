const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('kadr', Object.freeze({
  uninstallStatus: () => ipcRenderer.invoke('app:uninstall-status'),
  uninstallApp: () => ipcRenderer.invoke('app:uninstall'),
  openCinema: data => ipcRenderer.invoke('cinema:open', data),
  openLordfilm: media => ipcRenderer.invoke('cinema:lordfilm',media),
  openLordfilmBrowser: media => ipcRenderer.invoke('cinema:lordfilm-browser',media),
  probeCinema: () => ipcRenderer.invoke('cinema:probe'),
  openSource: id => ipcRenderer.invoke('source:open', id),
  openAniDB: data => ipcRenderer.invoke('anidb:open', data),
  fetchAniDB: data => ipcRenderer.invoke('anidb:fetch', data),
  openWebPlayer: url => ipcRenderer.invoke('player:open', url),
  bindPlayer: data => ipcRenderer.invoke('player-media:bind',data),
  commandPlayer: data => ipcRenderer.invoke('player-media:command',data),
  unbindPlayer: id => ipcRenderer.send('player-media:unbind',id),
  onPlayerState: callback => { const listener=(_event,value)=>callback(value);ipcRenderer.on('player-media:state',listener);return ()=>ipcRenderer.removeListener('player-media:state',listener); },
  catalogRequest: data => ipcRenderer.invoke('catalog:request', data),
  cancelCatalog: requestId => ipcRenderer.send('catalog:cancel', requestId),
}));
