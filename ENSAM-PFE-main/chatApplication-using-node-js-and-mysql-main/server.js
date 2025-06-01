const express = require("express");
const http = require("http"); //pour creer des serveur http
const socketIo = require("socket.io");
const session = require("express-session");
const bodyParser = require("body-parser"); //Importer le module body-parser pour analyser les corps de requêtes HTTP.
const db = require("./config/db");
const authRoutes = require("./routes/authRoutes"); //Importer les routes d'authentification.
const chatRoutes = require("./routes/chatRoutes");
const authMiddleware = require("./middleware/authMiddleware");
const { engine } = require("express-handlebars"); //Importer le moteur de templates Handlebars.
const RedisStore = require("connect-redis").default; //Importer le module connect-redis pour stocker les sessions dans Redis.
const redis = require("redis"); //Importer le module redis pour interagir avec Redis.

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let onlineUsers = {}; // Store online users

// Configure Handlebars
app.engine(
  "handlebars",
  engine({
    defaultLayout: "main",
    helpers: {
      eq: function (a, b) {
        return a === b;
      },
    },
    cache: false, // Disable template caching in development
  })
);
app.set("view engine", "handlebars");

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Redis client setup
const redisClient = redis.createClient();
redisClient.on("error", (err) => console.log("Redis Client Error", err));
redisClient.connect().catch(console.error);

// Session middleware
const sessionMiddleware = session({
  store: new RedisStore({ client: redisClient }),
  secret: "secret",
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false, // set to true if using https
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
});

app.use(sessionMiddleware);

// Socket.IO middleware
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Routes
app.use("/auth", authRoutes);
app.use("/chat", authMiddleware, chatRoutes);

// Serve static files from the public directory
app.use(express.static("public"));

app.get("/chat", (req, res) => {
  res.render("chat", {
    user: req.session.user,
    users: getAllUsers(),
    messages: getMessagesForUser(req.session.user.id),
  });
}); //Définir une route GET pour /chat qui rend la vue chat avec les utilisateurs et les messages pour l'utilisateur actuel.

io.on("connection", (socket) => {
  //gerer la connextion
  console.log("New client connected");

  socket.on("storeSocketId", (userId) => {
    if (!userId) {
      console.error("No userId provided");
      return;
    }

    // Get user info from database
    db.query(
      "SELECT username FROM users WHERE id = ?",
      [userId],
      (err, results) => {
        if (err) {
          console.error("Error fetching user:", err);
          return;
        }

        if (results.length > 0) {
          const username = results[0].username;
          onlineUsers[userId] = { socketId: socket.id, username: username };
          io.emit("updateOnlineUsers", onlineUsers);
          console.log("Connected user ID:", userId);
        } else {
          console.error("User not found:", userId);
        }
      }
    );
  });

  socket.on("disconnect", () => {
    const userId = Object.keys(onlineUsers).find(
      (key) => onlineUsers[key].socketId === socket.id
    );
    if (userId) {
      delete onlineUsers[userId];
      io.emit("updateOnlineUsers", onlineUsers);
      console.log("Online user IDs:", Object.keys(onlineUsers));
    }
    console.log("Client disconnected");
  });

  socket.on("sendMessage", (data) => {
    console.log("Message received:", data);
    // Check if it's a group message
    if (data.isGroupMessage) {
      // Save group message to database with current timestamp
      const currentTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
      db.query(
        "INSERT INTO group_messages (group_id, sender_id, message, timestamp) VALUES (?, ?, ?, ?)",
        [data.receiverId, data.senderId, data.message, currentTimestamp],
        (err, result) => {
          if (err) {
            console.error("Error saving group message:", err);
            return;
          }
          
          // Get the inserted message with sender info
          db.query(
            "SELECT gm.*, u.username as sender_name FROM group_messages gm JOIN users u ON gm.sender_id = u.id WHERE gm.id = ?",
            [result.insertId],
            (err, messages) => {
              if (err) {
                console.error("Error fetching saved message:", err);
                return;
              }

              const savedMessage = messages[0];
              
              // Get group members and send message to all of them
              db.query(
                "SELECT user_id FROM group_members WHERE group_id = ?",
                [data.receiverId],
                (err, members) => {
                  if (err) {
                    console.error("Error fetching group members:", err);
                    return;
                  }

                  // Send to all group members
                  members.forEach((member) => {
                    const memberSocketId = onlineUsers[member.user_id]?.socketId;
                    if (memberSocketId) {
                      io.to(memberSocketId).emit("receiveMessage", {
                        sender: savedMessage.sender_name,
                        senderId: savedMessage.sender_id,
                        receiverId: savedMessage.group_id,
                        message: savedMessage.message,
                        isGroupMessage: true,
                        groupName: data.groupName,
                        timestamp: savedMessage.timestamp
                      });
                    }
                  });
                }
              );
            }
          );
        }
      );
    } else {
      // Regular direct message
      const currentTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
      db.query(
        "INSERT INTO messages (sender_id, receiver_id, message, timestamp) VALUES (?, ?, ?, ?)",
        [data.senderId, data.receiverId, data.message, currentTimestamp],
        (err) => {
          if (err) {
            console.error("Error saving direct message:", err);
            return;
          }
          
          io.emit("receiveMessage", {
            sender: data.sender,
            senderId: data.senderId,
            receiverId: data.receiverId,
            message: data.message,
            timestamp: currentTimestamp
          });
        }
      );
    }
  });
});

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
//demarrer le server sr le port 3000
