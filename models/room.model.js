const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let RoomSchema = new Schema({
    name: { type: String },
    songs: { type: Array }
});


// Export the model
module.exports = mongoose.model('Room', RoomSchema);