const express = require('express');
var leven = require("leven");
const api = require('./routes');
const app = express();
const cors = require('cors');
var uniqid = require('uniqid');
const path = require('path');
const protectedRoutes = express.Router();
const userController = require('./controllers/user.controller');
var bodyParser = require('body-parser');
var experience_system = require('./systems/experience');

// configure the app to use bodyParser()
app.use(bodyParser.urlencoded({
    extended: true
}));

// Set up mongoose connection
const mongoose = require('mongoose');
let dev_db_url = 'mongodb://localhost:27017/quiz';
let mongoDB = process.env.MONGODB_URI || dev_db_url;
mongoose.connect(mongoDB, {
    useNewUrlParser: true
});
mongoose.Promise = global.Promise;
let db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type,authorization");
    res.header("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
    next();
});

app.use(express.json({
    limit: '10mb'
}));
app.use(express.urlencoded({
    limit: '10mb',
    extended: true
}));
protectedRoutes.use(require('express-fileupload')());

protectedRoutes.use(require('./middlewares/token.middleware'))
protectedRoutes.get('/quiz/user', userController.getUser);
protectedRoutes.get('/quiz/user/seen', userController.seen);
protectedRoutes.post('/quiz/user/avatar', function (req, res) {
    userController.updateAvatar(req, res)
});

app.use(cors());
app.use('/quiz/protected', protectedRoutes);
app.use('/quiz/api/connected', function (req, res) {
    var connected = 0;
    Rooms.forEach(room => {
        connected += room.players.length;
    });
    res.json({
        connected: connected
    });
})
app.use('/quiz/api', api)
// Serve only the static files form the dist directory
app.use("/quiz/", express.static('public'));
app.use("/assets", express.static('public/assets'));

app.get("/quiz/*", function (req, res) {
  res.sendFile(path.join(__dirname, "/public/index.html"));
});


let Rooms = [];

const Room = require('./models/room.model');

const server = app.listen(1234, function () {
    console.log('server running on port 1234');
    Room.find({}, function (err, rooms) {
        console.log('Loading rooms ...');
        rooms.forEach(function (room) {
            Rooms.push({
                _id: room._id,
                name: room.name,
                limit: 100,
                locked: false,
                owner: 'System',
                img: room.name + '.jpg',
                songs: room.songs,
                players: [],
                current: 0,
                roundCounter: 1,
                rounds: 1,
                roundResults: [],
                isPublic: true
            })
        });
        console.log('Loaded ' + Rooms.length + ' rooms');
        setInterval(function () {
            SendCurrentSongs()
        }, 1000);
    });
});

const io = require('socket.io')(server);

let counter = 0;
let roundCounter = 0;

function SendToConnected(type, message) {
    Rooms.forEach(function (room) {
        SendToRoom(room._id, type, message);
    });
}

function SendToRoom(room, type, message) {
    Rooms.find(x => x._id == room).players.forEach(function (item) {
        item.socket.emit(type, message);
    })
}

function Kick(_room, player) {
    var room = Rooms.find(x => x._id == _room);
    var kicked = room.players.find(x => x.username == player);
    if (room) {
        if (kicked) {
            kicked.socket.emit('kicked');
            room.players = room.players.filter(x => x.player_name != player);
            SendToRoom(_room, 'player_kicked', player)
            SendToRoom(_room, 'players_list', GetPlayersPoints(_room));
        }
    }
}

function SendToRoomExceptMe(room, type, message, me) {
    if (room) {
        Rooms.find(x => x._id == room).players.forEach(function (item) {
            if (item.socket.id !== me) {
                item.socket.emit(type, message);
            }
        })
    }
}

function newPlayer(room, player) {
    Rooms.find(x => x._id == room).players.push(player);
}

function GetPlayer(socket_id, _room) {
    var room = Rooms.find(x => x._id == _room);
    if (room) {
        return room.players.find(x => x.socket.id === socket_id);
    } else {
        return null;
    }
}

function RemovePlayer(socket_id, _room) {
    var room = Rooms.find(x => x._id == _room);
    if (room) {
        room.players = room.players.filter(x => x.socket.id !== socket_id);
    }
}

function GetPlayersPoints(room) {
    var res = Rooms.find(x => x._id == room).players.map(function (item) {
        return {
            _id: item._id,
            username: item.username,
            points: item.points,
            avatar: item.avatar,
            room: item.room
        }
    });
    return res;
}

function getPrivateRooms() {
    return Rooms.filter((room) => room.isPublic == false).map(function (data) {
        return {
            _id: data._id,
            name: data.name,
            owner: data.owner,
            theme: data.theme,
            limit: data.limit,
            locked: data.locked,
            players: data.players.length
        }
    });
}

function GetPlayersCount() {
    return Rooms.filter(x => x.isPublic == true).map(function (data) {
        return {
            _id: data._id,
            name: data.name,
            img: data.img,
            count: data.players.length
        }
    })
}

function setToLast(player, room) {
    var both = room.roundResults.filter(x => x.both == true);
    if (both.length > 0) {
        both.sort((a, b) => {
            return b.position - a.position;
        });
        player.position = both[0].position + 1;
    } else {
        player.position = 0;
    }
    return player.position;
}

function HandleAnswer(answer, socket, _room) {
    var player = GetPlayer(socket.id, _room);
    var room = Rooms.find(x => x._id == _room);
    if (room.songs[room.current].title.includes('(')) {
        room.songs[room.current].title = room.songs[room.current].title.split('(')[0]
    }
    if (room.songs[room.current].title.includes('-')) {
        room.songs[room.current].title = room.songs[room.current].title.split('-')[0]
    }
    if (leven(room.songs[room.current].artist, answer) <= 5) {
        socket.emit('right_artist', room.songs[room.current].artist);
        var _player = room.roundResults.find(x => x.player === player);
        if (_player) {
            if (_player.both == false) {
                var position = setToLast(_player, room);
                if (position < 3) {
                    player.points += 1 + (3 - position);
                    experience_system.ApplyXP(player, (1 + (3 - position)) * 10);
                } else {
                    player.points += 1;
                    experience_system.ApplyXP(player, 10);
                }
                userController.updatePlayerLevels(player);
                _player.both = true;
                SendToRoom(_room, 'player_point', {
                    username: player.username,
                    points: player.points,
                    position: position
                });
            }
        } else {
            player.points += 1;
            experience_system.ApplyXP(player, 10);
            userController.updatePlayerLevels(player);
            room.roundResults.push({
                position: -1,
                player: player,
                both: false
            });
            SendToRoom(_room, 'player_point', {
                username: player.username,
                points: player.points,
                position: -1
            });
        }
    } else if (leven(room.songs[room.current].title, answer) <= 5) {
        socket.emit('right_song', room.songs[room.current].title);
        var _player = room.roundResults.find(x => x.player === player);
        if (_player) {
            if (_player.both == false) {
                var position = setToLast(_player, room);
                if (position < 3) {
                    player.points += 1 + (3 - position);
                    experience_system.ApplyXP(player, (1 + (3 - position)) * 10);
                } else {
                    player.points += 1;
                    experience_system.ApplyXP(player, 10);
                }
                userController.updatePlayerLevels(player);
                _player.both = true;
                SendToRoom(_room, 'player_point', {
                    username: player.username,
                    points: player.points,
                    position: position
                });
            }
        } else {
            player.points += 1;
            experience_system.ApplyXP(player, 10);
            userController.updatePlayerLevels(player);
            room.roundResults.push({
                position: -1,
                player: player,
                both: false
            });
            SendToRoom(_room, 'player_point', {
                username: player.username,
                points: player.points,
                position: -1
            });
        }
    } else if (leven(room.songs[room.current].artist + ' ' + room.songs[room.current].title, answer) <= 5 ||
        leven(room.songs[room.current].title + ' ' + room.songs[room.current].artist, answer) <= 5) {
        socket.emit('full_right', room.songs[room.current]);
        player.points += 3;
        experience_system.ApplyXP(player, 30);
        userController.updatePlayerLevels(player);
        var _p = {
            position: 0,
            player: player,
            both: true
        };
        var position = setToLast(_p, room);
        if (position < 3) {
            player.points += 1 + (3 - position);
            experience_system.ApplyXP(player, (1 + (3 - position)) * 10);
        } else {
            player.points += 1;
            experience_system.ApplyXP(player, 10);
        }
        userController.updatePlayerLevels(player);
        room.roundResults.push({
            position: position,
            player: player,
            both: true
        });
        SendToRoom(_room, 'player_point', {
            username: player.username,
            points: player.points,
            position: position
        })
    } else {
        socket.emit('wrong_song', '');
    }
}

function sendRoundEnd(_room) {
    if (_room) {
        SendToRoom(_room._id, 'round_end');
    }
}

function ResetScores(_room) {
    _room.players.forEach(player => {
        player.points = 0;
    });
    SendToRoom(_room._id, 'players_list', GetPlayersPoints(_room._id));
}

function SendCurrentSongs() {
    if (counter === 34) {
        for (var i = 0; i < Rooms.length; i++) {
            var room = Rooms[i];
            if (room.roundCounter < 20) {
                room.roundCounter += 1;
                counter = 0;
            } else {
                sendRoundEnd(room)
            }
        }
    } else if (counter === 30) {
        for (var i = 0; i < Rooms.length; i++) {
            var room = Rooms[i];
            var current_song = room.songs[room.current];
            if (current_song.title.includes('(')) {
                current_song.title = current_song.title.split('(')[0]
            }
            if (current_song.title.includes('-')) {
                current_song.title = current_song.title.split('-')[0]
            }
            SendToRoom(room._id, 'waiting', current_song);
            room.roundResults = [];
            if (room.current == room.songs.length - 1) {
                room.current = 0;
            } else {
                room.current += 1;
            }
        }
    } else if (counter === 1) {
        for (var i = 0; i < Rooms.length; i++) {
            var room = Rooms[i];
            var current_song = room.songs[room.current];
            SendToRoom(room._id, 'current_song', {
                preview: current_song.preview,
                picture: current_song.picture,
                rounds: room.rounds,
                roundCounter: room.roundCounter
            });
        }
    } else if (counter == 44) {
        for (var i = 0; i < Rooms.length; i++) {
            var room = Rooms[i];
            counter = 0;
            room.roundCounter = 1;
            room.rounds += 1;
            ResetScores(room);
        }
    }
    counter += 1;
}

function RemoveRoom(id) {
    Rooms = Rooms.filter(x => x._id != id);
}

function newLobby(socket, lobby) {
    var exist = Rooms.find(x => x.name == lobby.name)
    if (!exist) {
        var _id = uniqid();
        var songs = getSongsByTheme(lobby.theme);
        Rooms.push({
            _id: _id,
            name: lobby.name,
            owner: lobby.owner,
            theme: lobby.theme,
            songs: songs,
            current: 0,
            roundCounter: 1,
            rounds: 1,
            roundResults: [],
            players: [],
            limit: lobby.limit,
            locked: lobby.locked,
            password: lobby.password,
            isPublic: false
        });
        socket.emit('lobby_created', _id);
    } else {
        socket.emit('lobby_exist', '');
    }
}

function getSongsByTheme(theme) {
    for (var i = 0; i < Rooms.length; i++) {
        if (Rooms[i].name == theme) {
            return Rooms[i].songs;
        }
    }
}

io.on('connection', function (socket) {
    var _playerRoom;
    socket.on('disconnect', function () {
        if (_playerRoom) {
            var room = Rooms.find(x => x._id == _playerRoom);
            RemovePlayer(socket.id, _playerRoom);
            if (room) {
                if (room.players.length == 0 && !room.isPublic) {
                    RemoveRoom(_playerRoom);
                } else {
                    SendToRoom(_playerRoom, 'players_list', GetPlayersPoints(_playerRoom));
                    if (room.isPublic) {
                        SendToConnected('rooms', GetPlayersCount());
                    }
                }
            }
        }
    })
    socket.on('new_player', function (data) {
        userController.getPlayer(data.id, (Player) => {
            var room = Rooms.find(r => r._id == data.room);
            Player['socket'] = socket;
            if (room) {
                if (room.isPublic == true || room.locked == false || room.owner == Player.username) {
                    if (room.limit == room.players.length) {
                        socket.emit('room_full')
                    } else {
                        Player['room'] = room;
                        Player['points'] = 0
                        _playerRoom = data.room;
                        console.log('new player ' + Player.username + ' on room: ' + Player.room.name);
                        socket.emit('players_list', GetPlayersPoints(data.room));
                        socket.emit('room_info', {
                            locked: room.locked,
                            theme: room.theme,
                            owner: room.owner,
                            limit: room.limit,
                            name: room.name,
                            rounds: room.rounds,
                            roundCounter: room.roundCounter
                        });
                        newPlayer(data.room, Player);
                        SendToRoom(data.room, 'new_player', {
                            _id: Player._id,
                            avatar: Player.avatar,
                            username: Player.username,
                            points: 0
                        });
                        SendToConnected('rooms', GetPlayersCount());
                    }
                } else {
                    socket.emit('lobby_auth_req', '');
                }
            } else {
                socket.emit('room_not_found', '');
            }
        });
    })
    socket.on('chat_message', function (data) {
        SendToRoomExceptMe(_playerRoom, 'chat_message', {
            from: data.from,
            content: data.content
        }, socket.id);
    })
    socket.on('song_submission', function (data) {
        HandleAnswer(data.guess, socket, _playerRoom);
    })
    socket.on('get_lobbies', function (data) {
        socket.emit('lobbies', getPrivateRooms());
        socket.emit('rooms', GetPlayersCount());
    })
    socket.on('new_lobby', function (data) {
        newLobby(socket, data);
    })
    socket.on('kick', function (data) {
        Kick(_playerRoom, data);
    })
    socket.on('lobby_auth', function (data) {
        userController.getPlayer(data.id, (Player) => {
            var room = Rooms.find(x => x._id == data.room);
            Player['socket'] = socket;
            Player['room'] = room;
            Player['points'] = 0;
            if (room.password == data.password) {
                if (room.limit == room.players.length) {
                    socket.emit('room_full')
                } else {
                    _playerRoom = data.room;
                    console.log('new player ' + Player.username + ' on room: ' + Player.room.name);
                    socket.emit('players_list', GetPlayersPoints(data.room));
                    socket.emit('room_info', {
                        locked: room.locked,
                        theme: room.theme,
                        owner: room.owner,
                        limit: room.limit,
                        name: room.name,
                        rounds: room.rounds,
                        roundCounter: room.roundCounter
                    });
                    newPlayer(data.room, Player);
                    SendToRoom(data.room, 'new_player', {
                        _id: Player._id,
                        avatar: Player.avatar,
                        username: Player.username,
                        points: 0
                    });
                    SendToConnected('rooms', GetPlayersCount());
                }
            } else {
                socket.emit('lobby_auth_refused', '');
            }
        })
    });
});