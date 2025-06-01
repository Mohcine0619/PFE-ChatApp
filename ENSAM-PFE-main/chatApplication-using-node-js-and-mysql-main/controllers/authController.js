const bcrypt = require("bcrypt");
const db = require("../config/db");

exports.register = (req, res) => {
  const { username, password } = req.body; // recupere les variables de requete body
  db.query(
    "SELECT * FROM users WHERE username = ?",
    [username],
    (err, results) => {
      if (err) return res.status(500).send("Internal server error");
      if (results.length > 0) {
        return res.status(400).send("Username already exists");
      }
      const hashedPassword = bcrypt.hashSync(password, 10);
      db.query(
        "INSERT INTO users (username, password) VALUES (?, ?)",
        [username, hashedPassword],
        (err) => {
          if (err) return res.status(500).send("Internal server error");
          res.status(200).send("Registration successful");
        }
      );
    }
  );
};

exports.login = (req, res) => {
  const { username, password } = req.body;
  db.query(
    "SELECT * FROM users WHERE username = ?",
    [username],
    (err, results) => {
      if (err) return res.status(500).send("Internal server error");
      if (
        results.length === 0 ||
        !bcrypt.compareSync(password, results[0].password)
      ) {
        return res.status(400).send("Invalid username or password");
      }
      req.session.user = results[0];
      res.status(200).send("Login successful");
    }
  );
};

exports.logout = (req, res) => {
  req.session.destroy();
  res.redirect("/auth/login");
};

exports.updateSettings = (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  const userId = req.session.user.id;

  // First verify the old password if it's provided
  if (oldPassword) {
    db.query(
      "SELECT password FROM users WHERE id = ?",
      [userId],
      (err, results) => {
        if (err) {
          return res
            .status(500)
            .json({ success: false, message: "Database error" });
        }
        if (results.length === 0) {
          return res
            .status(404)
            .json({ success: false, message: "User not found" });
        }
        if (!bcrypt.compareSync(oldPassword, results[0].password)) {
          return res
            .status(400)
            .json({ success: false, message: "Current password is incorrect" });
        }

        // If old password is correct, proceed with updates
        updateUserSettings();
      }
    );
  } else {
    // If no password change requested, just update username
    updateUserSettings();
  }

  function updateUserSettings() {
    const updates = [];
    const params = [];

    // If username is provided, check if it's already taken
    if (username) {
      db.query(
        "SELECT id FROM users WHERE username = ? AND id != ?",
        [username, userId],
        (err, results) => {
          if (err) {
            return res
              .status(500)
              .json({ success: false, message: "Database error" });
          }
          if (results.length > 0) {
            return res
              .status(400)
              .json({ success: false, message: "Username already taken" });
          }

          // Username is available, proceed with update
          performUpdate();
        }
      );
    } else {
      // No username change, proceed with update
      performUpdate();
    }

    function performUpdate() {
      if (username) {
        updates.push("username = ?");
        params.push(username);
      }

      if (newPassword) {
        const hashedPassword = bcrypt.hashSync(newPassword, 10);
        updates.push("password = ?");
        params.push(hashedPassword);
      }

      if (updates.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No changes provided" });
      }

      params.push(userId);
      const query = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;

      db.query(query, params, (err, result) => {
        if (err) {
          return res
            .status(500)
            .json({ success: false, message: "Failed to update settings" });
        }

        // Update session with new username if it was changed
        if (username) {
          req.session.user.username = username;
        }

        res.json({ success: true, message: "Settings updated successfully" });
      });
    }
  }
};
