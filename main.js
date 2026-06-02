//like backend with system

//imports
const { app, BrowserWindow, ipcMain, powerMonitor, Tray, Menu, nativeImage, dialog, shell } = require('electron')
const path = require('path')

const { exec } = require('child_process')
const util = require('util')
const execPromise = util.promisify(exec)

const fs = require('fs')



const STEAM_PATHS = [
  'C:\\Program Files (x86)\\Steam\\steamapps',
  'C:\\Program Files\\Steam\\steamapps'
]

const EXCLUDED_EXE = [
  'uninstall.exe', 'setup.exe', 'redist.exe',
  'vc_redist.exe', 'directx.exe', 'crashreporter.exe',
  'unins000.exe', 'dxsetup.exe'
]

let tray = null

let activeGame = null
let activeGameStartTime = null
let win = null;

let token = null;

ipcMain.on('token', (event, t) => {
  token = t;
})

ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [{ name: 'Executable', extensions: ['exe'] }]
    })
    if (result.canceled) return null
    return path.basename(result.filePaths[0])
})

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url)
})

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 600,
    center: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true, //make isolation between app.js and main.jss via preload.js
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.loadFile('renderer/index.html')
  win.setMenuBarVisibility(false)
//get a request for close window
  win.on('close', (e) => {
    e.preventDefault()
    if (activeGame && activeGameStartTime) {
      const seconds = Math.floor((new Date() - activeGameStartTime) / 1000)
      savePlaytimeFromMain(activeGame.id, seconds)
      activeGame = null
      activeGameStartTime = null
      win.webContents.send('force-save-playtime')
    }
    win.hide()
  })
  //if game in tray


  //Create task in tray
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('Game Tracker')

  const menu = Menu.buildFromTemplate([
    {label: 'Show', click: () => win.show() },
    {type: 'separator' },
    {label: 'Quit', click: () => {
      if (activeGame && activeGameStartTime) {
      const seconds = Math.floor((new Date() - activeGameStartTime) / 1000)
      savePlaytimeFromMain(activeGame.id, seconds)
    }
      win.destroy()
      app.quit()
    }}
  ])

  tray.setContextMenu(menu)

  tray.on('click', () => win.show())

  startProcessWatcher();
}

app.whenReady().then(createWindow)

let gamesList = []

ipcMain.on('games-list', (event, games) => {
  gamesList = games
  autoMatchSteamGames()
  }
)

function startProcessWatcher() {
  setInterval(async () => {
    const {stdout} = await execPromise('tasklist'); //get in format: [{name: witcher3.exe},...]
    const names = stdout.toLowerCase().split('\n').map(line => line.split(' ')[0])// do in massiv format: ['chrome.exe', 'witcher3.exe',...]
    win.webContents.send('process-list', names)
    const foundGame = gamesList.find(entry => names.includes(entry.game.processName?.toLowerCase()))//looking in the list of games for one whose processName is among the running processes.

    console.log('Looking for:', gamesList.map(e => e.game.processName))
    console.log('Found:', foundGame ? foundGame.game.title : 'nothing')

    if (foundGame && activeGame === null) {
      console.log('Sending game-detected, entry id:', foundGame.id)
      win.webContents.send('game-detected', foundGame)//send message to app.js like "game is detected, this is info about"
      activeGame = foundGame;
      activeGameStartTime = new Date()
    }
    if (!foundGame && activeGame !== null) {
      win.webContents.send('game-closed', activeGame) //If the game was not found BUT it was previously active — game has closed. We send a message to app.js and reset activeGame.
      activeGame = null;
      activeGameStartTime = null;
    }
    console.log('Games list length:', gamesList.length) // ← добавь первой строкой
  }, 3000);
}

function findSteamPath() {
  return STEAM_PATHS.find(p => fs.existsSync(p)) || null;
}

function parseAcfFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')

  const name = content.match(/"name"\s+"([^"]+)"/)
  const installdir = content.match(/"installdir"\s+"([^"]+)"/)

  if (!name || !installdir) return null

  return {
    name: name[1],
    installdir: installdir[1]
  }
}

function scanSteam() {
  const steamPath = findSteamPath();
  //check the path
  if (!steamPath) {
    return null;
  }
  //scan all files
  let files = fs.readdirSync(steamPath);
  //filtering all files to files with ".acf"
  const acfFiles = files.filter(f => f.endsWith('.acf'))
  //parse all files
  const games = acfFiles.map(f => parseAcfFile(path.join(steamPath, f)))
  .filter(g => g != null)
  .map(g => ({
    name:g.name,
    installdir: g.installdir,
    exeName: findExeForGame(steamPath, g.installdir)
  }))
  .filter(g => g.exeName !== null)
  return games;
}

function findExeForGame(steamPath, installdir) {
  let gamePath = path.join(steamPath, 'common', installdir)

  if(!fs.existsSync(gamePath)){
    return null;
  }

  let files = fs.readdirSync(gamePath);

  const exeFiles = files.filter(f => f.endsWith('.exe') && !EXCLUDED_EXE.includes(f.toLowerCase()))

  const byName = exeFiles.find(f => f.toLowerCase().startsWith(installdir.toLowerCase().replace(/ /g, '')))
  if (byName) return byName;

  const biggest = exeFiles.sort((a, b) => {
    const sizeA = fs.statSync(path.join(gamePath, a)).size
    const sizeB = fs.statSync(path.join(gamePath, b)).size
    return sizeB - sizeA
  })[0]
  if(biggest) return biggest

  return exeFiles[0] || null
}

function autoMatchSteamGames() {
  const steamGames = scanSteam()

  if(!steamGames) return

  console.log('Steam games found:', steamGames ? steamGames.length : 0)
    steamGames.forEach(g => console.log(g.name, '→', g.exeName))

  for (const entry of gamesList) {
    console.log('Comparing:', entry.game.title, 'with Steam games')
    const match = steamGames.find(sg => 
      sg.name.toLowerCase() === entry.game.title.toLowerCase()
    )
    console.log('Match:', match ? match.name : 'none')

    if (match && !entry.game.processName) {
      const data = JSON.stringify({ processName: match.exeName})
      const options = {
        hostname: 'localhost',
        port:8080,
        path:`/api/games/${entry.game.id}`,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Content-Length': Buffer.byteLength(data)
        }
      }
      const req = require('http').request(options, (res) => {
        console.log('Updated processName for', entry.game.title, '→ status:', res.statusCode)
      })
      req.on('error', (err) => {
        console.log('Failed to update processName for', entry.game.title, err.message)
      })
      req.write(data)
      req.end()
    }
  }
}

function savePlaytimeFromMain(entryId, seconds) {
  if (!entryId || !token || seconds <= 0) return

  const data = JSON.stringify({ seconds: String(seconds) })
  const req = require('http').request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/entries/${entryId}/playtime`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Content-Length': Buffer.byteLength(data)
    }
  })
  req.on('error', (err) => console.error('Failed to save playtime:', err.message))
  req.write(data)
  req.end()
}