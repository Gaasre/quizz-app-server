const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let UserSchema = new Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    xp: { type: Number, default: 0 },
    nextLevelXP: { type: Number, default: 100 },
    level: { type: Number, default: 1 },
    avatar: { type: String, default: ''},
    seen: { type: Boolean, default: false }
});


// Export the model
module.exports = mongoose.model('User', UserSchema);