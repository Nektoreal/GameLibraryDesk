//like backend with system

//imports
const { app, BrowserWindow, ipcMain, powerMonitor } = require('electron')
const path = require('path')

const { exec } = require('child_process')
const util = require('util')
const execPromise = util.promisify(exec)

let activeGame = null
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true, //make isolation between app.js and main.jss via preload.js
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.loadFile('renderer/index.html')
  startProcessWatcher();
}

app.whenReady().then(createWindow)

let gamesList = []

ipcMain.on('games-list', (event, games) => {
  gamesList = games
  console.log('Games received:', gamesList.length)
  }
)

function startProcessWatcher() {
  setInterval(async () => {
    const {stdout} = await execPromise('tasklist'); //get in format: [{name: witcher3.exe},...]
    const names = stdout.toLowerCase().split('\n').map(line => line.split(' ')[0])// do in massiv format: ['chrome.exe', 'witcher3.exe',...]
    win.webContents.send('process-list', names)
    const foundGame = gamesList.find(entry => names.includes(entry.game.processName))//looking in the list of games for one whose processName is among the running processes.

    console.log('Looking for:', gamesList.map(e => e.game.processName))
    console.log('Found:', foundGame ? foundGame.game.title : 'nothing')

    if (foundGame && activeGame === null) {
      win.webContents.send('game-detected', foundGame)//send message to app.js like "game is detected, this is info about"
      activeGame = foundGame;
    }
    if (!foundGame && activeGame !== null) {
      win.webContents.send('game-closed', activeGame) //If the game was not found BUT it was previously active — game has closed. We send a message to app.js and reset activeGame.
      activeGame = null;
    }
    console.log('Games list length:', gamesList.length) // ← добавь первой строкой
  }, 3000);
}