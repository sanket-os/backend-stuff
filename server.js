// We will maintain two in-memory maps:

// socket.id  → username
// roomName   → [usernames]


// Why?

// Sockets disconnect (fragile)

// Usernames are meaningful (human)

// UI should never see socket IDs (UX crime)



/**
 * ============================================================
 * REAL-TIME CHAT SERVER (SOCKET.IO + EXPRESS)
 * ============================================================
 *
 * This server:
 * 1. Serves static frontend files
 * 2. Establishes WebSocket connections
 * 3. Handles global chat messages
 * 4. Handles group (room-based) chat
 * 5. Uses USERNAMES instead of socket IDs
 *
 * NOTE:
 * - All data is stored in MEMORY (RAM)
 * - Restarting server = everything resets
 * - This is perfect for learning, demos, interviews
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

/**
 * ------------------------------------------------------------
 * SERVER SETUP
 * ------------------------------------------------------------
 */

// Express handles HTTP routes & static files
const app = express();

// HTTP server is REQUIRED for WebSockets
const server = http.createServer(app);

// Socket.IO attaches itself to the HTTP server
const io = new Server(server);

/**
 * ------------------------------------------------------------
 * IN-MEMORY DATA STORES (VERY IMPORTANT)
 * ------------------------------------------------------------
 */

/**
 * Keeps track of which socket belongs to which username
 * Example:
 * {
 *   "socket123": "Alice",
 *   "socket456": "Bob"
 * }
 */
const socketToUser = {};

/**
 * Keeps track of chat rooms and their members
 * Example:
 * {
 *   "developers": ["Alice", "Bob"],
 *   "designers": ["Charlie"]
 * }
 */
const chatRooms = {};

/**
 * ------------------------------------------------------------
 * SERVE FRONTEND FILES
 * ------------------------------------------------------------
 *
 * Any file inside the "public" folder can be accessed directly.
 * Example:
 * - /index.html
 * - /style.css
 * - /client.js
 */
app.use(express.static("public"));

/**
 * ------------------------------------------------------------
 * SOCKET.IO CONNECTION HANDLER
 * ------------------------------------------------------------
 *
 * This function runs ONCE per connected client.
 * Every browser tab = one socket.
 */
io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);

  /**
   * Send a welcome message ONLY to this client.
   * This proves the WebSocket connection is alive.
   */
  socket.emit("message", "Welcome to the WebSocket server 👋");

  /**
   * ----------------------------------------------------------
   * REGISTER USERNAME (GLOBAL CHAT ENTRY POINT)
   * ----------------------------------------------------------
   *
   * This event comes from frontend when user sends first message.
   * We store the username against socket.id.
   */
  socket.on("send_message", (data) => {
    const { username, message } = data;

    // Store username if not already stored
    if (!socketToUser[socket.id]) {
      socketToUser[socket.id] = username;
    }

    console.log(`📩 Global message from ${username}:`, message);

    /**
     * Broadcast message to ALL clients EXCEPT sender.
     * Sender already rendered message optimistically.
     */
    socket.broadcast.emit("broadcast", {
      username,
      message,
    });
  });

  /**
   * ----------------------------------------------------------
   * CREATE GROUP (ROOM)
   * ----------------------------------------------------------
   *
   * Rooms are logical groupings managed by Socket.IO.
   * They exist only in memory.
   */
  socket.on("create_group", (roomName) => {
    const username = socketToUser[socket.id];

    console.log(`📦 Group created: ${roomName}`);

    // Create room if it does not exist
    if (!chatRooms[roomName]) {
      chatRooms[roomName] = [];
    }

    // Join socket to room
    socket.join(roomName);

    // Add user to room (avoid duplicates)
    if (!chatRooms[roomName].includes(username)) {
      chatRooms[roomName].push(username);
    }

    /**
     * Notify ALL clients about available groups.
     * This keeps UI in sync.
     */
    io.emit("update_groups_list", Object.keys(chatRooms));

    /**
     * Update members list inside this room only.
     */
    io.to(roomName).emit(
      "update_members_list",
      chatRooms[roomName]
    );
  });

  /**
   * ----------------------------------------------------------
   * JOIN EXISTING GROUP
   * ----------------------------------------------------------
   */
  socket.on("join_group", (roomName) => {
    const username = socketToUser[socket.id];

    console.log(`🚪 ${username} joined room: ${roomName}`);

    // Room must exist
    if (!chatRooms[roomName]) return;

    socket.join(roomName);

    // Add user if not already present
    if (!chatRooms[roomName].includes(username)) {
      chatRooms[roomName].push(username);
    }

    // Notify room members about updated list
    io.to(roomName).emit(
      "update_members_list",
      chatRooms[roomName]
    );
  });

  /**
   * ----------------------------------------------------------
   * GROUP MESSAGE
   * ----------------------------------------------------------
   *
   * Message is delivered ONLY to users in that room.
   */
  socket.on("group_message", (data) => {
    const { roomId, message } = data;
    const username = socketToUser[socket.id];

    console.log(
      `💬 Group message in [${roomId}] from ${username}:`,
      message
    );

    io.to(roomId).emit("receive_group_message", {
      sender: username,
      message,
    });
  });

  /**
   * ----------------------------------------------------------
   * DISCONNECT HANDLING (VERY IMPORTANT)
   * ----------------------------------------------------------
   *
   * Fired when:
   * - User closes tab
   * - Network drops
   * - Browser crashes
   */
  socket.on("disconnect", () => {
    const username = socketToUser[socket.id];

    console.log(`❌ ${username} disconnected`);

    // Remove user from all rooms
    for (const room in chatRooms) {
      chatRooms[room] = chatRooms[room].filter(
        (user) => user !== username
      );

      // Update remaining members
      io.to(room).emit(
        "update_members_list",
        chatRooms[room]
      );
    }

    // Remove socket-to-user mapping
    delete socketToUser[socket.id];
  });
});

/**
 * ------------------------------------------------------------
 * BASIC HTTP ROUTE (OPTIONAL)
 * ------------------------------------------------------------
 */
app.get("/", (req, res) => {
  res.send("🚀 WebSocket Chat Server is running");
});

/**
 * ------------------------------------------------------------
 * START SERVER
 * ------------------------------------------------------------
 */
server.listen(4000, () => {
  console.log("✅ Server running at http://localhost:4000");
});


// ✔ UI shows real usernames
// ✔ Socket IDs stay private
// ✔ Disconnects are handled
// ✔ No duplicate members
// ✔ Clean separation of concerns