const express = require("express");
const path = require("path");
const router = express.Router();
const authController = require("../controllers/authController");

router.get("/register", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/index.html"))
);
router.post("/register", authController.register);
router.get("/login", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/login.html"))
);
router.post("/login", authController.login);
router.get("/logout", authController.logout);
router.post("/update-settings", authController.updateSettings);

module.exports = router;
