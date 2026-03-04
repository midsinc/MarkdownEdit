const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

let mainWindow = null
let currentFilePath = null
const recentFiles = []
const MAX_RECENT = 10

function createWindow(fileToOpen = null) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    title: 'MarkdownEdit',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))

  mainWindow.webContents.once('did-finish-load', () => {
    if (fileToOpen) {
      openFileInRenderer(fileToOpen)
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })
  buildMenu()
}

function openFileInRenderer(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    currentFilePath = filePath
    addRecentFile(filePath)
    mainWindow.webContents.send('file:opened', { filePath, content })
    mainWindow.setTitle(`${path.basename(filePath)} - MarkdownEdit`)
  } catch (err) {
    dialog.showErrorBox('Error', `Could not open file: ${err.message}`)
  }
}

function addRecentFile(filePath) {
  const index = recentFiles.indexOf(filePath)
  if (index !== -1) recentFiles.splice(index, 1)
  recentFiles.unshift(filePath)
  if (recentFiles.length > MAX_RECENT) recentFiles.pop()
  buildMenu()
}

function buildMenu() {
  const isMac = process.platform === 'darwin'

  const recentSubmenu = recentFiles.length > 0
    ? recentFiles.map(fp => ({
        label: fp,
        click: () => openFileInRenderer(fp)
      }))
    : [{ label: 'No recent files', enabled: false }]

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
            })
            if (!canceled && filePaths.length > 0) {
              openFileInRenderer(filePaths[0])
            }
          }
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu:save')
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow.webContents.send('menu:save-as')
        },
        {
          label: 'Rename...',
          click: () => mainWindow.webContents.send('menu:rename')
        },
        { type: 'separator' },
        {
          label: 'Recent Files',
          submenu: recentSubmenu
        },
        { type: 'separator' },
        {
          label: 'Export as HTML...',
          click: () => mainWindow.webContents.send('menu:export-html')
        },
        {
          label: 'Export as PDF...',
          click: () => mainWindow.webContents.send('menu:export-pdf')
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'toggleDevTools' }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// --- IPC Handlers ---

ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
  })
  if (canceled || filePaths.length === 0) return null
  const filePath = filePaths[0]
  const content = fs.readFileSync(filePath, 'utf-8')
  currentFilePath = filePath
  addRecentFile(filePath)
  mainWindow.setTitle(`${path.basename(filePath)} - MarkdownEdit`)
  return { filePath, content }
})

ipcMain.handle('dialog:saveFile', async (_event, { filePath, content }) => {
  let savePath = filePath
  if (!savePath) {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (result.canceled) return null
    savePath = result.filePath
  }
  fs.writeFileSync(savePath, content, 'utf-8')
  currentFilePath = savePath
  addRecentFile(savePath)
  mainWindow.setTitle(`${path.basename(savePath)} - MarkdownEdit`)
  return savePath
})

ipcMain.handle('dialog:saveAs', async (_event, { content }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  })
  if (result.canceled) return null
  fs.writeFileSync(result.filePath, content, 'utf-8')
  currentFilePath = result.filePath
  addRecentFile(result.filePath)
  mainWindow.setTitle(`${path.basename(result.filePath)} - MarkdownEdit`)
  return result.filePath
})

ipcMain.handle('dialog:rename', async (_event, { oldPath }) => {
  if (!oldPath) return null
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: oldPath,
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  })
  if (result.canceled) return null
  fs.renameSync(oldPath, result.filePath)
  currentFilePath = result.filePath
  addRecentFile(result.filePath)
  mainWindow.setTitle(`${path.basename(result.filePath)} - MarkdownEdit`)
  return result.filePath
})

ipcMain.handle('export:html', async (_event, { html, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'document.html',
    filters: [{ name: 'HTML', extensions: ['html'] }]
  })
  if (result.canceled) return null
  fs.writeFileSync(result.filePath, html, 'utf-8')
  return result.filePath
})

ipcMain.handle('export:pdf', async (_event, { defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'document.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (result.canceled) return null
  const pdfBuffer = await mainWindow.webContents.printToPDF({
    pageSize: 'A4',
    printBackground: true,
    margins: { top: 0.75, bottom: 0.75, left: 0.75, right: 0.75 }
  })
  fs.writeFileSync(result.filePath, pdfBuffer)
  return result.filePath
})

ipcMain.on('title:update', (_event, title) => {
  if (mainWindow) mainWindow.setTitle(title)
})

// --- File open from command line args (Windows) ---
function getFileFromArgs(argv) {
  const args = argv.slice(app.isPackaged ? 1 : 2)
  return args.find(a => !a.startsWith('-') && fs.existsSync(a)) || null
}

// --- File open from OS (macOS) ---
let pendingFilePath = null

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (app.isReady() && mainWindow) {
    openFileInRenderer(filePath)
  } else {
    pendingFilePath = filePath
  }
})

// --- App lifecycle ---
app.whenReady().then(() => {
  const cliFile = getFileFromArgs(process.argv)
  createWindow(pendingFilePath || cliFile)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
