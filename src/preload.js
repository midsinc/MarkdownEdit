const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (args) => ipcRenderer.invoke('dialog:saveFile', args),
  saveAs: (args) => ipcRenderer.invoke('dialog:saveAs', args),
  renameFile: (args) => ipcRenderer.invoke('dialog:rename', args),
  exportHtml: (args) => ipcRenderer.invoke('export:html', args),
  exportPdf: (args) => ipcRenderer.invoke('export:pdf', args),
  updateTitle: (title) => ipcRenderer.send('title:update', title),

  onFileOpened: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('file:opened', handler)
    return () => ipcRenderer.removeListener('file:opened', handler)
  },
  onMenuSave: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('menu:save', handler)
    return () => ipcRenderer.removeListener('menu:save', handler)
  },
  onMenuSaveAs: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('menu:save-as', handler)
    return () => ipcRenderer.removeListener('menu:save-as', handler)
  },
  onMenuRename: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('menu:rename', handler)
    return () => ipcRenderer.removeListener('menu:rename', handler)
  },
  onMenuExportHtml: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('menu:export-html', handler)
    return () => ipcRenderer.removeListener('menu:export-html', handler)
  },
  onMenuExportPdf: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('menu:export-pdf', handler)
    return () => ipcRenderer.removeListener('menu:export-pdf', handler)
  },
  onMenuNewTab: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('menu:new-tab', handler)
    return () => ipcRenderer.removeListener('menu:new-tab', handler)
  },
  onMenuCloseTab: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('menu:close-tab', handler)
    return () => ipcRenderer.removeListener('menu:close-tab', handler)
  },

  platform: process.platform
})
