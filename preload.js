const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  onShowGroups: (callback) => ipcRenderer.on('show-groups', (event, ...args) => callback(...args)),
  onShowItems: (callback) => ipcRenderer.on('show-items', (event, ...args) => callback(...args)),
  getGroupItems: (groupName) => ipcRenderer.send('get-group-items', groupName),
  pasteItem: (item) => ipcRenderer.send('paste-item', item),
  deleteItem: (payload) => ipcRenderer.send('delete-item', payload),
  requestGroupsView: () => ipcRenderer.send('request-groups-view'),
  hideWindow: () => ipcRenderer.send('hide-window'),
  addGroup: (groupName) => ipcRenderer.send('add-group', groupName),
  deleteGroup: (groupName) => ipcRenderer.send('delete-group', groupName),
  editGroupName: (payload) => ipcRenderer.send('edit-group-name', payload),
  getSettings: () => ipcRenderer.sendSync('get-settings'),
  saveSettings: (settings) => ipcRenderer.send('save-settings', settings),
  resetSettings: () => ipcRenderer.send('reset-settings'),
  quitApp: () => ipcRenderer.send('quit-app'),
});