const express = require('express');
const router = express.Router();

router.post('/room', require('../controllers/user.controller').newRoom);
router.use('/user', require('./user.route'));

module.exports = router;