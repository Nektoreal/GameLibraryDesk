//like backend only for web

const API = 'http://localhost:8080';
let token = null;

let activeEntryId = null;
let sessionStart = null;
let timerInterval = null;
let processList = [];

async function login(){
  let url = API + '/api/auth/login';

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  const res = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      username: username,
      password: password
    })
  });

  if(res.ok) {
    const data = await res.json();
    token = data.token;
    window.electronAPI.sendToken(token)
    showMainScreen(username);
  }
}

function showMainScreen(name) {

  document.getElementById('username-display').innerHTML = name;
  //Hide login screen
  document.getElementById('login-screen').style.display = 'none';
  //Show main screen
  document.getElementById('main-screen').style.display = 'block';
  loadGames();

}

function formatTime(seconds){
  let hours = Math.floor(seconds / 3600) 
  const remainingSeconds = seconds % 3600
  let minutes = Math.floor(remainingSeconds / 60)

  return `${hours}h ${minutes}m`
}

async function loadGames() {
  let url = API + '/api/entries';
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}`},
  });

  let entries = await res.json();
  const gamesList = document.getElementById("games-list");

  gamesList.innerHTML = entries.map(entry => `
    <div class="game-card">
      <div class="game-info">
        <span class="game-title">${entry.game.title}</span>
        <span class="game-time">${formatTime(entry.playtime)}</span>
        <span class="status-badge ${entry.status}">${entry.status}</span>
      </div>
      <div class="game-process">
        <input id="process-${entry.game.id}" placeholder="process.exe" value="${entry.game.processName || ''}" oninput="showSuggestions('${entry.game.id}', this.value)"/>
        <div id="suggestions-${entry.game.id}" class="suggestions"></div>
        <button onclick="saveProcessName('${entry.game.id}', document.getElementById('process-${entry.game.id}').value)">Save</button>
        <button onclick="browseExe('${entry.game.id}')">📁</button>
      </div>
    </div>
  `).join('')

  window.electronAPI.sendGameList(entries);

}

function logout(){
  //clear the token
  token = null;
  //hide main
  document.getElementById('main-screen').style.display = 'none';
  //show login
  document.getElementById('login-screen').style.display = 'block';
}

function startTracking(entryId, gameTitle) {

  console.log('startTracking called:', entryId, gameTitle)
  const statusEl = document.getElementById('active-game-status').style.display = 'block';
  document.querySelector('.content').style.paddingTop = '120px';
  console.log('status element:', statusEl)


  activeEntryId = entryId;
  sessionStart = new Date();

  document.getElementById('active-game-status').style.display = 'block';
  document.getElementById('active-game-name').innerHTML = gameTitle;

  timerInterval = setInterval(() => {
    const seconds = Math.floor((new Date() - sessionStart) / 1000);
    document.getElementById('active-game-timer').innerHTML = formatTime(seconds)
  }, 1000);
}

function showSuggestions(gameId, value) {
  if (!value) {
    document.getElementById(`suggestions-${gameId}`).innerHTML = '';
    return;
  }
  const filtered = processList.filter(name => name.includes(value.toLowerCase())).slice(0, 5)

  document.getElementById(`suggestions-${gameId}`).innerHTML = filtered.map(name => `
    <div onclick="selectProcess('${gameId}', '${name}')">${name}</div>
  `).join('')
}

function selectProcess(gameId, name) {
  document.getElementById(`process-${gameId}`).value = name;
  document.getElementById(`suggestions-${gameId}`).innerHTML = '';
}


 async function saveProcessName(gameId, processName) {
  let url = API + `/api/games/${gameId}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({processName: processName})
  });
}

async function stopTracking() {
  let url = API + `/api/entries/${activeEntryId}/playtime`;
  clearInterval(timerInterval);
  let totalTime = Math.floor((new Date() - sessionStart)/1000);

  document.getElementById('active-game-status').style.display = 'none';

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      seconds: totalTime
    })
  });

  activeEntryId = null;
  sessionStart = null;
  timerInterval = null;
  loadGames()
}

async function browseExe(gameId) {
    const fileName = await window.electronAPI.openFileDialog()
    if (fileName) {
        document.getElementById(`process-${gameId}`).value = fileName
    }
}


window.electronAPI.onGameDetected((event, entry) => {
  console.log('Game detected in app.js:', entry.game.title)
  startTracking(entry.id, entry.game.title)
})

window.electronAPI.onGameClosed((event, entry) => {
  stopTracking(entry.id)
})

window.electronAPI.onProcessList((event, names) => {
  processList = names
})