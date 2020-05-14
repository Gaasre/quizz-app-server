const express = require('express');
const router = express.Router();

const user_controller = require('../controllers/user.controller');

router.post('/login', user_controller.Login);
router.get('/:id', user_controller.getPoints);
router.post('/signup', user_controller.new);
router.post('/rooms', user_controller.rooms);
module.exports = router;