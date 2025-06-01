const db = require('../config/db');

const Message = {
  create: (senderId, receiverId, message, callback) => {
    db.query('INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)', [senderId, receiverId, message], callback);
  },
  findByUsers: (userId1, userId2, callback) => {
    db.query('SELECT * FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)', 
      [userId1, userId2, userId2, userId1], callback);
  }
};

module.exports = Message;