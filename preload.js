//This is the bridge between main.js and app.js

//imports 
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', { //creates `window.electronAPI` object in app.js.

  onGameDetected: (callback) => ipcRenderer.on('game-detected', callback), // When main.js sends this message, the callback in app.js will be triggered.

  onGameClosed: (callback) => ipcRenderer.on('game-closed', callback),

  onProcessList: (callback) => ipcRenderer.on('process-list', callback),

  sendGameList: (games) => ipcRenderer.send('games-list', games),

  sendToken: (token) => ipcRenderer.send('token', token),

  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),

  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  onReloadGames: (callback) => ipcRenderer.on('reload-games', callback)
})