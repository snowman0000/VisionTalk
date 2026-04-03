/**
 * VisionTalk — WebRTC Signaling Server
 * Handles room management, WebRTC handshakes, and in-call chat.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ─── Room Management ──────────────────────────────────────────
const rooms = new Map();   // roomId -> Set of socket IDs
const users = new Map();   // socketId -> { roomId, username }

// ─── REST Endpoints ───────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: rooms.size, users: users.size });
});

app.get('/create-room', (req, res) => {
  const roomId = uuidv4().slice(0, 8).toUpperCase();
  rooms.set(roomId, new Set());
  console.log(`[Room] Created: ${roomId}`);
  res.json({ roomId });
});

// ─── Socket.IO Events ────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Connect] ${socket.id}`);

  // Join a room
  socket.on('join-room', ({ roomId, username }) => {
    // Create room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    const room = rooms.get(roomId);

    // Check room capacity (max 2)
    if (room.size >= 2) {
      socket.emit('room-full', { roomId });
      return;
    }

    // Join
    socket.join(roomId);
    room.add(socket.id);
    users.set(socket.id, { roomId, username: username || 'Anonymous' });

    console.log(`[Join] ${username || socket.id} → Room ${roomId} (${room.size}/2)`);

    // Notify others in the room
    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      username: username || 'Anonymous'
    });

    // Tell the joiner about existing users
    const existingUsers = [];
    room.forEach(id => {
      if (id !== socket.id) {
        const user = users.get(id);
        existingUsers.push({ userId: id, username: user?.username || 'Anonymous' });
      }
    });
    socket.emit('room-joined', { roomId, users: existingUsers });
  });

  // WebRTC signaling
  socket.on('offer', ({ to, offer }) => {
    console.log(`[Offer] ${socket.id} → ${to}`);
    io.to(to).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    console.log(`[Answer] ${socket.id} → ${to}`);
    io.to(to).emit('answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  // Chat messages
  socket.on('send-message', ({ roomId, message, username }) => {
    socket.to(roomId).emit('receive-message', {
      from: socket.id,
      username: username || 'Anonymous',
      message,
      timestamp: Date.now()
    });
  });

  // ASL transcription relay
  socket.on('asl-transcription', ({ roomId, text, username }) => {
    socket.to(roomId).emit('asl-transcription', {
      from: socket.id,
      username: username || 'Anonymous',
      text,
      timestamp: Date.now()
    });
  });

  // Screen sharing signaling
  socket.on('screen-share-started', ({ roomId }) => {
    socket.to(roomId).emit('screen-share-started', { from: socket.id });
  });

  socket.on('screen-share-stopped', ({ roomId }) => {
    socket.to(roomId).emit('screen-share-stopped', { from: socket.id });
  });

  // Disconnect
  socket.on('disconnect', () => {
    const userData = users.get(socket.id);
    if (userData) {
      const { roomId, username } = userData;
      const room = rooms.get(roomId);

      if (room) {
        room.delete(socket.id);
        socket.to(roomId).emit('user-left', {
          userId: socket.id,
          username
        });

        // Clean up empty rooms
        if (room.size === 0) {
          rooms.delete(roomId);
          console.log(`[Room] Deleted: ${roomId}`);
        }
      }
      users.delete(socket.id);
    }
    console.log(`[Disconnect] ${socket.id}`);
  });
});

// ─── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('  VisionTalk Signaling Server');
  console.log('='.repeat(50));
  console.log(`  Port: ${PORT}`);
  console.log(`  WebSocket: ws://localhost:${PORT}`);
  console.log('='.repeat(50) + '\n');
});
