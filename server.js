const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const _ = require('lodash');
const { PeerServer } = require('peer');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: 'http://127.0.0.1:5500',
    methods: ['GET', 'POST'],
  },
});

const users = [];
const MAX_QUEUE_WAIT_TIME = 120;

app.use(cors());

app.get('/', (req, res) => {
  res.send('Server is running...');
});

function calculateDifficultySimilarity(diff1, diff2) {
  const difficultyWeights = { easy: 1, medium: 2, hard: 3, insane: 4 };
  let totalWeight1 = 0, totalWeight2 = 0, matchingDifficulties = 0;

  for (const diff of diff1) {
    totalWeight1 += difficultyWeights[diff];
    if (diff2.includes(diff)) matchingDifficulties++;
  }
  
  for (const diff of diff2) {
    totalWeight2 += difficultyWeights[diff];
  }

  return (matchingDifficulties / Math.max(totalWeight1, totalWeight2)) * 100;
}

io.on('connection', (socket) => {
  socket.on('join', (data) => {
    const { uid, username, selectedDifficulties, peerId } = data;
    console.log('A user connected: ', username);
  
    if (!peerId) {
      console.error(`User ${username} attempted to join without a Peer ID.`);
      return;
    }
  
    users.push({ id: socket.id, uid, username, selectedDifficulties, peerId, queueEntryTime: Date.now() });
  
    let bestMatch = null, highestSimilarity = 0;
  
    for (const user of users) {
      if (user.id !== socket.id) {
        const similarity = calculateDifficultySimilarity(selectedDifficulties, user.selectedDifficulties);
        if (similarity > highestSimilarity) {
          bestMatch = user;
          highestSimilarity = similarity;
        }
      }
    }
  
    if (bestMatch) {
      socket.emit('matchFound', {
        opponentUid: bestMatch.uid,
        opponentUsername: bestMatch.username,
        opponentPeerId: bestMatch.peerId,
        isPlayer1: true
      });
  
      io.to(bestMatch.id).emit('matchFound', {
        opponentUid: uid,
        opponentUsername: username,
        opponentPeerId: peerId,
        isPlayer1: false
      });
      console.log(username + " and " + bestMatch.username + " have been matched!");
  
      _.remove(users, u => u.id === bestMatch.id || u.id === socket.id);
    } else {
      socket.emit('waitingForMatch');
    }
  });

  socket.on('disconnect', () => {
    _.remove(users, (user) => user.id === socket.id);
  });

  socket.on('message', (data) => {
    console.log(data.sender + " => " + data.recipient + ": " + data.message)
  });

  setInterval(() => {
    const currentTime = Date.now();
    _.remove(users, (user) => {
      if ((currentTime - user.queueEntryTime) / 1000 > MAX_QUEUE_WAIT_TIME) {
        io.to(user.id).emit('matchmakingTimeout');
        return true;
      }
      return false;
    });
  }, 1000);
});

const peerServer = PeerServer({
  port: 9000,
  path: '/peerjs',
  allow_discovery: true,
});

peerServer.on('connection', (conn) => {
  const user = users.find(user => user.peerId === conn.peer);

  if (user) {
    console.log(`User found for Peer ID: ${conn.peer}, Username: ${user.username}`);

    conn.on('data', (data) => {
      console.log(`Data received from Peer ID ${conn.peer}:`, data);
    });

    conn.on('close', () => {
      console.log(`Connection closed for Peer ID: ${conn.peer}`);
    });
  }
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});

console.log('PeerJS server running on port 9000');