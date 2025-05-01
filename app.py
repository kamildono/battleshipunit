# app.py
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from threading import Timer, Thread
import time

app = Flask(__name__)
CORS(app)

# Список уже занятых ролей (player1/player2)
selected_roles = []

# Игровые состояния
games = {
    'player1': {
        'board': [['' for _ in range(10)] for _ in range(10)],
        'ready': False,
        'turn': True,
        'shots': [],
        'ships': [],
        'last_ping': time.time()
    },
    'player2': {
        'board': [['' for _ in range(10)] for _ in range(10)],
        'ready': False,
        'turn': False,
        'shots': [],
        'ships': [],
        'last_ping': time.time()
    },
    'last_activity': time.time()
}

def reset_game():
    global games, selected_roles
    selected_roles.clear()
    games = {
        'player1': {
            'board': [['' for _ in range(10)] for _ in range(10)],
            'ready': False,
            'turn': True,
            'shots': [],
            'ships': [],
            'last_ping': time.time()
        },
        'player2': {
            'board': [['' for _ in range(10)] for _ in range(10)],
            'ready': False,
            'turn': False,
            'shots': [],
            'ships': [],
            'last_ping': time.time()
        },
        'last_activity': time.time()
    }

def get_ship_cells(ship):
    coords = []
    x, y, size, orientation = ship['x'], ship['y'], ship['size'], ship['orientation']
    for i in range(size):
        cx = x + (i if orientation == 'horizontal' else 0)
        cy = y + (i if orientation == 'vertical' else 0)
        coords.append((cx, cy))
    return coords

def update_sunk_ships(player):
    board = games[player]['board']
    for ship in games[player]['ships']:
        if ship.get('sunk'): continue
        cells = get_ship_cells(ship)
        if all(board[cy][cx] == 'X' for cx, cy in cells):
            ship['sunk'] = True
            for cx, cy in cells:
                board[cy][cx] = 'B'

def all_ships_sunk(player):
    ships = games[player]['ships']
    return bool(ships) and all(ship.get('sunk', False) for ship in ships)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/status', methods=['GET'])
def status():
    return jsonify({
        'player1_taken': 'player1' in selected_roles,
        'player2_taken': 'player2' in selected_roles
    })

@app.route('/api/select_role', methods=['POST'])
def select_role():
    data = request.json
    role = data.get('role')
    if role not in ('player1', 'player2'):
        return jsonify({'status': 'error', 'message': 'Недопустимая роль'}), 400
    if role in selected_roles:
        return jsonify({'status': 'error', 'message': f'Роль {role} уже занята'}), 409
    selected_roles.append(role)
    games[role]['last_ping'] = time.time()
    return jsonify({'status': 'ok'})

@app.route('/api/get_state/<player>', methods=['GET'])
def get_state(player):
    opponent = 'player2' if player == 'player1' else 'player1'
    now = time.time()
    opponent_online = (now - games[opponent]['last_ping']) < 30

    sunk_ships = []
    for ship in games[opponent]['ships']:
        if ship.get('sunk'):
            sunk_ships.append([
                {'x': cx, 'y': cy}
                for cx, cy in get_ship_cells(ship)
            ])

    return jsonify({
        'own_board': games[player]['board'],
        'opponent_shots': games[player]['shots'],
        'own_shots': games[opponent]['shots'],
        'ready': games[player]['ready'],
        'opponent_ready': games[opponent]['ready'],
        'your_turn': games[player]['turn'],
        'sunk_ships': sunk_ships,
        'selected_roles': selected_roles,
        'opponent_online': opponent_online
    })

@app.route('/api/place_ship', methods=['POST'])
def place_ship():
    games['last_activity'] = time.time()
    data = request.json
    player = data['player']
    games[player]['last_ping'] = time.time()
    ships = data['ships']
    games[player]['ships'] = ships
    board = [['' for _ in range(10)] for _ in range(10)]
    for ship in ships:
        x, y, size, ori = ship['x'], ship['y'], ship['size'], ship['orientation']
        for i in range(size):
            if ori == 'horizontal':
                board[y][x + i] = 'S'
            else:
                board[y + i][x] = 'S'
    games[player]['board'] = board
    games[player]['ready'] = True
    return jsonify({'status': 'ok'})

@app.route('/api/shoot', methods=['POST'])
def shoot():
    games['last_activity'] = time.time()
    data = request.json
    player = data['player']
    games[player]['last_ping'] = time.time()
    x, y = data['x'], data['y']
    opponent = 'player2' if player == 'player1' else 'player1'

    hit = False
    if games[opponent]['board'][y][x] == 'S':
        hit = True
        games[opponent]['board'][y][x] = 'X'
    elif games[opponent]['board'][y][x] == '':
        games[opponent]['board'][y][x] = 'O'

    games[player]['shots'].append({'x': x, 'y': y, 'hit': hit})
    update_sunk_ships(opponent)

    sunk = False
    sunk_cells = []
    for ship in games[opponent]['ships']:
        if ship.get('sunk') and (x, y) in get_ship_cells(ship):
            sunk = True
            sunk_cells = get_ship_cells(ship)
            break

    victory = False
    if all_ships_sunk(opponent):
        victory = True
        Timer(10.0, reset_game).start()

    if not hit:
        games[player]['turn'] = False
        games[opponent]['turn'] = True

    return jsonify({
        'hit': hit,
        'sunk': sunk,
        'sunk_cells': sunk_cells,
        'your_turn': games[player]['turn'],
        'victory': victory
    })

@app.route('/api/heartbeat', methods=['POST'])
def heartbeat():
    data = request.json
    player = data.get('player')
    if player in ('player1', 'player2'):
        games[player]['last_ping'] = time.time()
        return jsonify({'status': 'ok'})
    return jsonify({'status': 'error'}), 400

@app.route('/api/reset', methods=['POST'])
def reset_endpoint():
    data = request.json
    player = data.get('player')
    if player not in ('player1', 'player2'):
        return jsonify({'status': 'error', 'message': 'Invalid player'}), 400
    opponent = 'player2' if player == 'player1' else 'player1'
    if time.time() - games[opponent]['last_ping'] > 15:
        reset_game()
        return jsonify({'status': 'ok', 'message': 'Game reset'})
    return jsonify({'status': 'error', 'message': 'Opponent still online'}), 403

def monitor_inactivity():
    while True:
        time.sleep(60)
        if time.time() - games.get('last_activity', 0) > 120:
            reset_game()

Thread(target=monitor_inactivity, daemon=True).start()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
