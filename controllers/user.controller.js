const User = require('../models/user.model');
const Room = require('../models/room.model');
const jwt = require('jsonwebtoken');
const fs = require('fs');

exports.getPoints = function (req, res) {
    User.findOne({
        _id: req.params.id
    }, function (err, doc) {
        if (err) {
            res.send(err);
        }
        res.json({
            points: doc.points
        });
    })
};

exports.newRoom = function (req, res) {
    var rooms = req.body;
    rooms.forEach(r => {
        var room = new Room(r);
        room.save(function (err, _room) {
            if (err) return console.error(err);
            console.log(_room.name + " saved to collection.");
        });
    });
    res.send('saved!');
}

exports.updatePlayerLevels = function (player) {
    User.findOne({
        _id: player._id
    }, function (err, doc) {
        doc.xp = player.xp;
        doc.level = player.level;
        doc.nextLevelXP = player.nextLevelXP;
        doc.save();
    })
}

exports.updateAvatar = function (req, res) {
    var avatar = req.files.file;
    var extension = avatar.name.split('.')[1];
    var user = req.decoded.id;
    User.findOne({
        _id: user
    }, function (err, doc) {
        console.log(__dirname);
        fs.unlink('/home/musicQuizz/public/assets/avatars/' + doc.avatar, function (error) {
            if (error) {
                console.log(error);
            }
            doc.avatar = user + '.' + extension;
            doc.save();
            if (err) {
                res.send(err);
            }
            avatar.mv('/home/musicQuizz/public/assets/avatars/' + user + '.' + extension, function (err2) {
                if (err2) {
                    console.log(err2);
                } else {
                    console.log("uploaded");
                    res.json({
                        points: doc.points,
                        id: doc._id,
                        username: doc.username,
                        email: doc.email,
                        avatar: doc.avatar
                    });
                }
            });
        });
    })
}

exports.updatePoints = function (player, added) {
    User.findOne({
        _id: player
    }, function (err, doc) {
        doc.points = doc.points + added;
        doc.save();
    })
}

exports.seen = function (req, res) {
    User.findOne({
        _id: req.decoded.id
    }, function (err, doc) {
        doc.seen = true;
        doc.save();
        res.json({
            success: true
        });
    })
}

exports.getUser = function (req, res) {
    User.findOne({
        _id: req.decoded.id
    }, function (err, doc) {
        if (err) {
            res.send(err);
        }
        if (doc) {
            res.json({
                id: doc._id,
                xp: doc.xp,
                nextLevelXP: doc.nextLevelXP,
                level: doc.level,
                username: doc.username,
                email: doc.email,
                avatar: doc.avatar,
                seen: doc.seen
            });
        } else {
            res.json({});
        }
    })
};

exports.getPlayer = function (id, cb) {
    User.findOne({
        _id: id
    }, function (err, doc) {
        cb(doc);
    });
};

exports.rooms = function (req, res) {
    req.body.forEach(element => {
        let room = new Room(element);
        room.save(function (err, doc) {
            if (err) {
                console.log(err);
            }
        });
    });
    res.send('done');
    console.log('Saved ' + req.body.length + ' rooms')
};

exports.new = function (req, res) {
    let user = new User(req.body);
    user.save(function (err, doc) {
        if (err) {
            console.log(err);
            if (err.code === 11000) {
                res.json({
                    error: 'E-mail already used'
                });
            } else {
                res.json({
                    error: err
                });
            }
        } else {
            var token = jwt.sign({
                id: doc._id,
            }, 'C9HtJO5DgS', {
                expiresIn: 60 * 60 * 24 // expires in 24 hours
            });
            res.json({
                token: token,
                id: doc._id,
                username: doc.username,
                email: doc.email,
                id: doc._id,
                xp: doc.xp,
                nextLevelXP: doc.nextLevelXP,
                avatar: doc.avatar,
                seen: doc.seen
            })
        }
    });
};

exports.Login = function (req, res) {
    User.findOne({
        email: req.body.email
    }, function (err, doc) {
        if (err) {
            res.send(err);
        }
        if (doc) {
            if (doc.password == req.body.password) {
                var token = jwt.sign({
                    id: doc._id,
                }, 'C9HtJO5DgS', {
                    expiresIn: 60 * 60 * 24 // expires in 24 hours
                });
                console.log(token);
                res.json({
                    token: token,
                    id: doc._id,
                    username: doc.username,
                    email: doc.email,
                    id: doc._id,
                    xp: doc.xp,
                    nextLevelXP: doc.nextLevelXP,
                    avatar: doc.avatar,
                    seen: doc.seen
                })
            } else {
                res.json({
                    error: 'Wrong Password'
                });
            }
        } else {
            res.json({
                error: 'Wrong Email'
            });
        }
    })
};