const db = require("../config/db");
const Group = require("../models/Group");

exports.getHomePage = (req, res) => {
  db.query("SELECT * FROM users", (err, users) => {
    if (err) throw err;
    Group.getGroups(req.session.user.id, (err, groups) => {
      if (err) throw err;
      db.query(
        "SELECT * FROM messages WHERE sender_id = ? OR receiver_id = ?",
        [req.session.user.id, req.session.user.id],
        (err, messages) => {
          if (err) throw err;
          console.log(
            "Rendering chat view with data: users=",
            users.length,
            " groups=",
            groups.length,
            " user=",
            req.session.user.username
          );
          res.render("chat", {
            users,
            groups,
            user: req.session.user,
            messages,
          });
        }
      );
    });
  });
};

exports.getMessages = (req, res) => {
  const { userId } = req.params;
  db.query(
    "SELECT * FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)",
    [req.session.user.id, userId, userId, req.session.user.id],
    (err, messages) => {
      if (err) throw err;
      res.json(messages);
    }
  );
};

exports.sendMessage = (req, res) => {
  const { receiverId, message } = req.body;
  if (!receiverId || !message) {
    return res.status(400).send("Receiver ID and message are required.");
  }
  db.query(
    "INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)",
    [req.session.user.id, receiverId, message],
    (err) => {
      if (err) throw err;
      res.sendStatus(200);
    }
  );
};

// Group controller functions
exports.createGroup = (req, res) => {
  const { name, members } = req.body;
  if (!name) {
    return res.status(400).send("Group name is required.");
  }

  Group.create(name, req.session.user.id, (err, result) => {
    if (err) throw err;
    const groupId = result.insertId;

    // Add creator as a member
    Group.addMember(groupId, req.session.user.id, (err) => {
      if (err) throw err;

      // Add other members
      if (members && members.length > 0) {
        const addMembers = members.map((userId) => {
          return new Promise((resolve, reject) => {
            Group.addMember(groupId, userId, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        });

        Promise.all(addMembers)
          .then(() => res.json({ groupId, name }))
          .catch((err) => res.status(500).send(err.message));
      } else {
        res.json({ groupId, name });
      }
    });
  });
};

exports.getGroups = (req, res) => {
  Group.getGroups(req.session.user.id, (err, groups) => {
    if (err) throw err;
    res.json(groups);
  });
};

exports.addGroupMember = (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.body;

  Group.addMember(groupId, userId, (err) => {
    if (err) throw err;
    res.sendStatus(200);
  });
};

exports.getGroupMembers = (req, res) => {
  const { groupId } = req.params;

  Group.getGroupMembers(groupId, (err, members) => {
    if (err) throw err;
    res.json(members);
  });
};
