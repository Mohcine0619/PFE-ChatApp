const db = require("../config/db");
const Group = require("../models/Group");

exports.getHomePage = (req, res) => {
  //gère le rendu de la page d'accueil
  db.query("SELECT * FROM users", (err, users) => {
    if (err) throw err;
    db.query(
      `SELECT g.*, u.username as creator_name 
       FROM groups g 
       JOIN users u ON g.created_by = u.id 
       WHERE g.id IN (
         SELECT group_id 
         FROM group_members 
         WHERE user_id = ?
       )`,
      [req.session.user.id],
      (err, groups) => {
        if (err) throw err;
        console.log("Groups for user:", req.session.user.id, groups); // Debug log
        db.query(
          "SELECT * FROM messages WHERE sender_id = ? OR receiver_id = ?",
          [req.session.user.id, req.session.user.id],
          (err, messages) => {
            if (err) throw err;
            res.render("chat", {
              users,
              groups,
              user: req.session.user,
              messages,
            });
          }
        );
      }
    );
  });
};

exports.getMessages = (req, res) => {
  //qui gère la récupération des messages entre l'utilisateur actuel et un autre utilisateur.
  const { userId } = req.params;
  db.query(
    "SELECT * FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)",
    [req.session.user.id, userId, userId, req.session.user.id],
    (err, messages) => {
      if (err) throw err;
      res.json(messages); //prendre le res comme json
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

exports.getGroupMessages = (req, res) => {
  const { groupId } = req.params;
  // Fetch group messages from the database
  db.query(
    "SELECT gm.*, u.username as sender_name FROM group_messages gm JOIN users u ON gm.sender_id = u.id WHERE gm.group_id = ? ORDER BY gm.timestamp ASC",
    [groupId],
    (err, messages) => {
      if (err) {
        console.error("Error fetching group messages:", err);
        return res.status(500).send("Error fetching group messages");
      }
      res.json(messages);
    }
  );
};

// Delete a group
exports.deleteGroup = (req, res) => {
  const groupId = req.params.groupId;
  const userId = req.session.user.id;

  // First check if the user is the creator of the group
  db.query(
    "SELECT created_by FROM groups WHERE id = ?",
    [groupId],
    (err, results) => {
      if (err) {
        console.error("Error checking group creator:", err);
        return res.status(500).json({ error: "Internal server error" });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: "Group not found" });
      }

      if (results[0].created_by !== userId) {
        return res
          .status(403)
          .json({ error: "Only the group creator can delete the group" });
      }

      // Start a transaction to delete group messages, members, and the group itself
      db.beginTransaction((err) => {
        if (err) {
          console.error("Error starting transaction:", err);
          return res.status(500).json({ error: "Internal server error" });
        }

        // Delete group messages
        db.query(
          "DELETE FROM group_messages WHERE group_id = ?",
          [groupId],
          (err) => {
            if (err) {
              return db.rollback(() => {
                console.error("Error deleting group messages:", err);
                res.status(500).json({ error: "Internal server error" });
              });
            }

            // Delete group members
            db.query(
              "DELETE FROM group_members WHERE group_id = ?",
              [groupId],
              (err) => {
                if (err) {
                  return db.rollback(() => {
                    console.error("Error deleting group members:", err);
                    res.status(500).json({ error: "Internal server error" });
                  });
                }

                // Delete the group
                db.query(
                  "DELETE FROM groups WHERE id = ?",
                  [groupId],
                  (err) => {
                    if (err) {
                      return db.rollback(() => {
                        console.error("Error deleting group:", err);
                        res
                          .status(500)
                          .json({ error: "Internal server error" });
                      });
                    }

                    // Commit the transaction
                    db.commit((err) => {
                      if (err) {
                        return db.rollback(() => {
                          console.error("Error committing transaction:", err);
                          res
                            .status(500)
                            .json({ error: "Internal server error" });
                        });
                      }

                      res.json({ message: "Group deleted successfully" });
                    });
                  }
                );
              }
            );
          }
        );
      });
    }
  );
};

exports.sendGroupMessage = (req, res) => {
  const { groupId, message } = req.body;
  if (!groupId || !message) {
    return res.status(400).send("Group ID and message are required.");
  }

  // First verify the user is a member of the group
  db.query(
    "SELECT * FROM group_members WHERE group_id = ? AND user_id = ?",
    [groupId, req.session.user.id],
    (err, results) => {
      if (err) {
        console.error("Error checking group membership:", err);
        return res.status(500).send("Error checking group membership");
      }

      if (results.length === 0) {
        return res.status(403).send("You are not a member of this group");
      }

      // If user is a member, insert the message
      db.query(
        "INSERT INTO group_messages (group_id, sender_id, message) VALUES (?, ?, ?)",
        [groupId, req.session.user.id, message],
        (err) => {
          if (err) {
            console.error("Error sending group message:", err);
            return res.status(500).send("Error sending message");
          }
          res.sendStatus(200);
        }
      );
    }
  );
};
