let player = '';
let ships = [];
let orientation = 'horizontal';
let gameStarted = false;
let submited = false;
let tempBoard = [...Array(10)].map(() => Array(10).fill(''));
let yourTurn = false;

const shipLimits = {4:1,3:2,2:3,1:4};
const shipPlacedCount = {4:0,3:0,2:0,1:0};
let placingSize = 4;
let hoveredCells = [];

setInterval(() => {
  if (!player) return;
  fetch('/api/heartbeat', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({player})
  });
}, 8000);

function drawBoards() {
  const ownBoard = document.getElementById('ownBoard');
  const opponentBoard = document.getElementById('opponentBoard');
  ownBoard.innerHTML = '';
  opponentBoard.innerHTML = '';
  for (let y=0; y<10; y++) {
    for (let x=0; x<10; x++) {
      let cell = document.createElement('div');
      cell.className='cell'; cell.dataset.x=x; cell.dataset.y=y;
      cell.onclick =()=>handleOwnCellClick(x,y);
      cell.onmouseover=()=>highlightPlacement(x,y);
      cell.onmouseleave=()=>clearHighlight();
      ownBoard.appendChild(cell);

      let oppCell=document.createElement('div');
      oppCell.className='cell'; oppCell.dataset.x=x; oppCell.dataset.y=y;
      oppCell.onclick =()=>{
        if(!gameStarted||!yourTurn) return;
        const idx=y*10+x;
        const c=document.getElementById('opponentBoard').children[idx];
        if(c.classList.contains('hit')||c.classList.contains('miss')||c.classList.contains('sunk')) return;
        shoot(x,y);
      };
      opponentBoard.appendChild(oppCell);
    }
  }
}

function handleOwnCellClick(x,y){ if(gameStarted||submited)return; const ship=findShipAt(x,y); ship?removeShip(ship):placeShip(x,y);}
function findShipAt(x,y){ for(let s of ships){ for(let i=0;i<s.size;i++){ let xi=s.x+(s.orientation==='horizontal'?i:0), yi=s.y+(s.orientation==='vertical'?i:0); if(xi===x&&yi===y)return s; }} return null; }
function removeShip(s){ ships=ships.filter(x=>x!==s); shipPlacedCount[s.size]--; drawShips(); }
function placeShip(x,y){ if(shipPlacedCount[placingSize]>=shipLimits[placingSize]){ alert(`Вы уже поставили все ${placingSize}-палубные корабли`); return; } if(!canPlaceShip(x,y,placingSize,orientation)){ alert('Нельзя разместить корабль здесь!'); return;} ships.push({x,y,size:placingSize,orientation}); shipPlacedCount[placingSize]++; drawShips(); if(shipPlacedCount[placingSize]>=shipLimits[placingSize]) for(let sz=placingSize-1;sz>=1;sz--) if(shipPlacedCount[sz]<shipLimits[sz]){ selectShipSize(sz); break; } }
function rotateShip(){ orientation=orientation==='horizontal'?'vertical':'horizontal'; }
function selectShipSize(sz){ placingSize=sz; }
function drawShips(){ const own=document.getElementById('ownBoard').children; tempBoard=[...Array(10)].map(()=>Array(10).fill('')); for(let c of own) c.classList.remove('ship','highlight','highlight-invalid'); ships.forEach(s=>{ for(let i=0;i<s.size;i++){ let xi=s.x+(s.orientation==='horizontal'?i:0), yi=s.y+(s.orientation==='vertical'?i:0); if(xi>=0&&xi<10&&yi>=0&&yi<10){ tempBoard[yi][xi]='S'; own[yi*10+xi].classList.add('ship'); } }}); }
function canPlaceShip(x,y,size,ori){ for(let i=0;i<size;i++){ let xi=x+(ori==='horizontal'?i:0), yi=y+(ori==='vertical'?i:0); if(xi<0||xi>=10||yi<0||yi>=10) return false; if(tempBoard[yi][xi]==='S') return false; for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ let nx=xi+dx, ny=yi+dy; if(nx>=0&&nx<10&&ny>=0&&ny<10&&tempBoard[ny][nx]==='S') return false; } } return true; }
function highlightPlacement(x,y){ if(gameStarted)return; clearHighlight(); const own=document.getElementById('ownBoard').children; const valid=canPlaceShip(x,y,placingSize,orientation); for(let i=0;i<placingSize;i++){ let xi=x+(orientation==='horizontal'?i:0), yi=y+(orientation==='vertical'?i:0); if(xi>=0&&xi<10&&yi>=0&&yi<10){ let idx=yi*10+xi; own[idx].classList.add(valid?'highlight':'highlight-invalid'); hoveredCells.push(idx); } } }
function clearHighlight(){ const own=document.getElementById('ownBoard').children; hoveredCells.forEach(i=>own[i].classList.remove('highlight','highlight-invalid')); hoveredCells=[]; }
function shoot(x,y){ if(!gameStarted||!yourTurn) return; fetch('/api/shoot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({player,x,y})}).then(r=>r.json()).then(data=>{ const opp=document.getElementById('opponentBoard').children; let idx=y*10+x; if(data.hit) opp[idx].classList.add('hit'); else opp[idx].classList.add('miss'); if(data.sunk) data.sunk_cells.forEach(([cx,cy])=>{ let i=cy*10+cx; opp[i].classList.remove('hit'); opp[i].classList.add('sunk'); }); yourTurn=data.your_turn; if(data.victory) alert('Вы победили! Игра сбросится через 10 секунд.'); }); }

function submitShips() {
  if (ships.length !== 10) {
    alert('Вы должны разместить все корабли!');
    return;
  }
  submited = true;
  fetch('/api/place_ship', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player, ships })
  }).then(r => r.json()).then(() => {
    document.getElementById('shipSelectors').style.display = 'none';
    document.getElementById('status').innerText = 'Вы готовы. Ожидание второго игрока...';
  });
}

function selectPlayer(p) {
  fetch('/api/select_role', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({role:p})
  })
  .then(r => {
    if (!r.ok) return r.json().then(err=>{throw err;});
    return r.json();
  })
  .then(()=>{
    player = p;
    document.getElementById('roleSelection').style.display='none';
    document.getElementById('gameArea').style.display='block';
    document.getElementById('shipSelectors').style.display='block';
    drawBoards();
    pollState();
  })
  .catch(err=>alert(err.message||'Ошибка при выборе роли'));
}

window.addEventListener('load', () => {
  fetch('/api/status')
    .then(r => r.json())
    .then(data => {
      if (data.player1_taken) document.getElementById('btnPlayer1').style.display = 'none';
      if (data.player2_taken) document.getElementById('btnPlayer2').style.display = 'none';
    });
});



function pollState() {
  setInterval(()=>{
    if(!player) return;
    fetch(`/api/get_state/${player}`)
      .then(r=>r.json())
      .then(data=>{
        if(!data.ready && !data.opponent_ready && gameStarted) {
          resetClientGame();
          return;
        }
        gameStarted = data.ready && data.opponent_ready;
        submited = data.ready;
        yourTurn   = data.your_turn;
        document.getElementById('status').innerText = gameStarted
          ? (yourTurn ? 'Ваш ход' : 'Ход противника')
          : (submited ? 'Ждем второго' :'Ожидание готовности обоих игроков...');
        if(gameStarted) document.getElementById('shipSelectors').style.display='none';
        updateShots(data);

        // Кнопка перезапуска
        const btn = document.getElementById('btnRestart');
        if(!data.opponent_online && data.ready && !data.victory) {
          btn.style.display='inline-block';
        } else {
          btn.style.display='none';
        }
      });
  },1000);
}

document.getElementById('btnRestart').addEventListener('click',()=>{
  fetch('/api/reset',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({player})
  })
  .then(r=>r.json())
  .then(data=>{
    if(data.status==='ok'){
      localStorage.removeItem('battleship_role');
      location.reload();
    } else {
      alert(data.message);
    }
  });
});

function resetClientGame() {
  // Сброс внутреннего состояния
  player = '';
  ships = [];
  orientation = 'horizontal';
  tempBoard = [...Array(10)].map(() => Array(10).fill(''));
  gameStarted = false;
  submitted = false;
  yourTurn = false;
  for (let size in shipPlacedCount) {
    shipPlacedCount[size] = 0;
  }
  placingSize = 4;
  hoveredCells = [];

  // Показываем/прячем нужные панели
  document.getElementById('roleSelection').style.display    = 'block';
  document.getElementById('gameArea').style.display         = 'none';
  document.getElementById('shipSelectors').style.display    = 'none';

  // Снова показываем обе кнопки выбора игрока
  document.getElementById('btnPlayer1').style.display = 'inline-block';
  document.getElementById('btnPlayer2').style.display = 'inline-block';

  // Рисуем пустые доски
  drawBoards();
}


function updateShots(data) {
    const ownBoard = document.getElementById('ownBoard').children;
    const opponentBoard = document.getElementById('opponentBoard').children;

    // Очистка классов перед новой отрисовкой
    for (let cell of ownBoard) {
        cell.classList.remove('hit', 'miss', 'sunk', 'forbidden');
    }
    for (let cell of opponentBoard) {
        cell.classList.remove('hit', 'miss', 'sunk', 'forbidden');
    }

    // Отмечаем выстрелы противника по нашему полю
    data.opponent_shots.forEach(shot => {
        const idx = shot.y * 10 + shot.x;
        if (opponentBoard[idx]) {
            opponentBoard[idx].classList.add(shot.hit ? 'hit' : 'miss');
        }
    });

    // Отмечаем наши выстрелы по полю противника
    data.own_shots.forEach(shot => {
        const idx = shot.y * 10 + shot.x;
        if (ownBoard[idx]) {
            ownBoard[idx].classList.add(shot.hit ? 'hit' : 'miss');
        }
    });

    // Отмечаем потопленные корабли на поле противника
    if (data.sunk_ships) {
        data.sunk_ships.forEach(shipCoords => {
            // Потопленные клетки
            shipCoords.forEach(({x, y}) => {
                const idx = y * 10 + x;
                if (opponentBoard[idx]) {
                    opponentBoard[idx].classList.remove('hit');
                    opponentBoard[idx].classList.add('sunk');
                }
            });

            // Жёлтая рамка вокруг потопленного корабля
            const xs = shipCoords.map(c => c.x);
            const ys = shipCoords.map(c => c.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            for (let yy = minY - 1; yy <= maxY + 1; yy++) {
                for (let xx = minX - 1; xx <= maxX + 1; xx++) {
                    if (xx < 0 || xx > 9 || yy < 0 || yy > 9) continue;
                    if (shipCoords.some(c => c.x === xx && c.y === yy)) continue;

                    const idx = yy * 10 + xx;
                    const cell = opponentBoard[idx];
                    if (cell && !cell.classList.contains('sunk')) {
                        cell.classList.add('forbidden');
                    }
                }
            }
        });
    }
}

