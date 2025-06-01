const db = require("../config/db");

const Group = {
  create: (name, createdBy, callback) => {
    db.query(
      "INSERT INTO groups (name, created_by) VALUES (?, ?)",
      [name, createdBy],
      callback
    );
  },

  addMember: (groupId, userId, callback) => {
    db.query(
      "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)",
      [groupId, userId],
      callback
    );
  },

  getGroups: (userId, callback) => {
    db.query(
      `
      SELECT g.*, u.username as creator_name 
      FROM groups g 
      JOIN users u ON g.created_by = u.id 
      JOIN group_members gm ON g.id = gm.group_id 
      WHERE gm.user_id = ?
    `,
      [userId],
      callback
    );
  },

  getGroupMembers: (groupId, callback) => {
    db.query(
      `
      SELECT u.id, u.username 
      FROM users u 
      JOIN group_members gm ON u.id = gm.user_id 
      WHERE gm.group_id = ?
    `,
      [groupId],
      callback
    );
  },
};

module.exports = Group;
