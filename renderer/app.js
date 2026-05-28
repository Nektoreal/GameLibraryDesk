const API = 'http://localhost:8080';
let token = null;

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
  }
  showMainScreen(username);
}

function showMainScreen(name) {

  document.getElementById('username-display').innerHTML = name;
  //Hide login screen
  document.getElementById('login-screen').style.display = 'none';
  //Show main screen
  document.getElementById('main-screen').style.display = 'block';

  loadGames();
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
    <p>${entry.game.title} <p>${entry.status}</p> </p>
    `).join('')
}

function logout(){
  //clear the token
  token = null;
  //hide main
  document.getElementById('main-screen').style.display = 'none';
  //show login
  document.getElementById('login-screen').style.display = 'block';
}