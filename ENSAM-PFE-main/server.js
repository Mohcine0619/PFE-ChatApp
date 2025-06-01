const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const session = require("express-session");
const bodyParser = require("body-parser");
const db = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const chatRoutes = require("./routes/chatRoutes");
const authMiddleware = require("./middleware/authMiddleware");
const { engine } = require("express-handlebars");
const RedisStore = require("connect-redis").default;
const redis = require("redis");

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
app.use(express.static("public"));

// Socket.IO connection handling
io.on("connection", (socket) => {
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
      // Get group members and send message to all of them
      db.query(
        "SELECT user_id FROM group_members WHERE group_id = ?",
        [data.receiverId],
        (err, members) => {
          if (err) throw err;
          members.forEach((member) => {
            const memberSocketId = onlineUsers[member.user_id]?.socketId;
            if (memberSocketId) {
              io.to(memberSocketId).emit("receiveMessage", {
                sender: data.sender,
                senderId: data.senderId,
                receiverId: data.receiverId,
                message: data.message,
                isGroupMessage: true,
                groupName: data.groupName,
              });
            }
          });
        }
      );
    } else {
      // Regular direct message
      io.emit("receiveMessage", {
        sender: data.sender,
        senderId: data.senderId,
        receiverId: data.receiverId,
        message: data.message,
      });
    }
  });
});

// Start server
server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
