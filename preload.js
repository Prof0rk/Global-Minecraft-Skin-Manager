const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: () => ipcRenderer.invoke('is-electron'),
  loginMicrosoft: () => ipcRenderer.invoke('login-microsoft')
});
