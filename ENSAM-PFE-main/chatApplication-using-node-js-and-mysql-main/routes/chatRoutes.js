// routes/chatRoutes.js
const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");

router.get("/", chatController.getHomePage);
router.get("/messages/:userId", chatController.getMessages);
router.post("/messages", chatController.sendMessage);

// Group routes
router.post("/groups", chatController.createGroup);
router.get("/groups", chatController.getGroups);
router.post("/groups/:groupId/members", chatController.addGroupMember);
router.get("/groups/:groupId/members", chatController.getGroupMembers);
router.get("/groups/:groupId/messages", chatController.getGroupMessages);
router.post("/groups/:groupId/messages", chatController.sendGroupMessage);

// Delete a group
router.delete("/groups/:groupId", chatController.deleteGroup);

module.exports = router;
