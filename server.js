const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const _ = require('lodash'); // Useful utility library

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const users = [];
const MAX_QUEUE_WAIT_TIME = 120; // Maximum wait time in seconds

// Define a function to calculate difficulty similarity
function calculateDifficultySimilarity(diff1, diff2) {
    const difficultyWeights = {
      easy: 1,
      medium: 2,
      hard: 3,
      insane: 4
    };
  
    let totalWeight1 = 0;
    let totalWeight2 = 0;
    let matchingDifficulties = 0;
  
    for (const diff of diff1) {
      totalWeight1 += difficultyWeights[diff];
      if (diff2.includes(diff)) {
        matchingDifficulties++;
      }
    }
  
    for (const diff of diff2) {
      totalWeight2 += difficultyWeights[diff];
    }
  
    // Calculate a weighted similarity score based on difficulty weights and matching difficulties
    const similarity = (matchingDifficulties / Math.max(totalWeight1, totalWeight2)) * 100;
  
    return similarity;
  }

  io.on('connection', (socket) => {
    let queueEntryTime = Date.now(); // Track when the user joined the queue
  
    socket.on('join', (data) => {
      const { uid, username, selectedDifficulties } = data;
      users.push({ id: socket.id, uid, username, selectedDifficulties, queueEntryTime });
  
      // Improved Matchmaking Logic:
      let bestMatch = null;
      let highestSimilarity = 0;
  
      for (const user of users) {
        if (user.id !== socket.id) {
          const similarity = calculateDifficultySimilarity(
            selectedDifficulties,
            user.selectedDifficulties
          );
          if (similarity > highestSimilarity) {
            bestMatch = user;
            highestSimilarity = similarity;
          }
        }
      }
  
      if (bestMatch) {
        // Found a match!
        socket.emit('matchFound', bestMatch.uid, bestMatch.username);
        bestMatch.socket.emit('matchFound', uid, username);
        users.splice(users.indexOf(bestMatch), 1);
        users.splice(users.indexOf(socket), 1);
      } else {
        // No match found yet, add to queue
        socket.emit('waitingForMatch'); // Inform client they're waiting
      }
    });
  
    socket.on('disconnect', () => {
      // Remove user from the waiting queue when they disconnect
      users = _.remove(users, (user) => user.id !== socket.id);
    });
  
    // Check for queue timeout periodically (e.g., every second)
    setInterval(() => {
      const currentTime = Date.now();
      for (const user of users) {
        const waitingTime = (currentTime - user.queueEntryTime) / 1000; // Time in seconds
        if (waitingTime > MAX_QUEUE_WAIT_TIME) {
          // User has waited too long, remove from queue and notify
          socket.to(user.id).emit('matchmakingTimeout');
          users = _.remove(users, (u) => u.id !== user.id);
        }
      }
    }, 1000); // Check every second
  });
  
  server.listen(3000, () => {
    console.log('Server listening on port 3000');
  });