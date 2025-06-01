const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

router.get('/', chatController.getHomePage);
router.get('/messages/:userId', chatController.getMessages);
router.post('/messages', chatController.sendMessage);

// Group routes
router.post('/groups', chatController.createGroup);
router.get('/groups', chatController.getGroups);
router.post('/groups/:groupId/members', chatController.addGroupMember);
router.get('/groups/:groupId/members', chatController.getGroupMembers);

module.exports = router; 