const multiplayer = {
  selectedDifficulties: JSON.parse(localStorage.getItem('selectedDifficulties')),
  connectionStatus: document.getElementById('connection-status'),
  gameContainer: document.getElementById('game-container'),
  canvas: null,
  currentLevelIndex: 0,
  stopwatchInterval: null,
  objects: [],
  uniqueObject: null,
  gameRunning: false,
  showStopwatch: localStorage.getItem('showStopwatch') === 'true',
  stopwatchElement: document.getElementById('stopwatch-display'),
  ctx: null,
  difficulties: {
    easy: { objectCount: 80, objectSize: 65 },
    medium: { objectCount: 170, objectSize: 50 },
    hard: { objectCount: 200, objectSize: 40 },
    insane: { objectCount: 500, objectSize: 30 }
  }
}

let conn;
let username;
let oppUsername;
let uid = generateUniqueId();
let myPeerID;
let isPlayer1;
let opponentTimes = [];
let opponentScores = [];
let opponentFails = [];
let opponentTotal = 0;
let playerFails = [];
let finishedCurrentLevel = false;
let countdownRunning = false;
let stopwatch = 0;
multiplayer.showStopwatch = localStorage.getItem('showStopwatch') == 'true';

const waitingRoom = document.getElementById('waiting-room');
const usernameInput = document.getElementById('username-input');
const startButton = document.getElementById('submit-button');
const responsiveContainer = document.getElementById('responsive-container');

const socket = io('http://localhost:3000');

function generateUniqueId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16); 
  });
}

usernameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    startMultiplayer();
  }
});

startButton.addEventListener('click', startMultiplayer);

function startMultiplayer() {
  username = usernameInput.value;
  if (username.length > 0) {
    document.getElementById('username-input-container').style.display = 'none';
    waitingRoom.style.display = 'block';

    peer = new Peer({
      host: 'localhost',
      port: 9000,
      path: '/peerjs',
    });

    peer.on('open', (peerId) => {
      myPeerID = peerId;
      console.log(`Connected to PeerJS server with ID: ${peerId}`);

      socket.emit('join', {
        uid: uid,
        username: username,
        selectedDifficulties: multiplayer.selectedDifficulties,
        peerId: myPeerID,
      });
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        console.log(`Incoming connection opened with: ${conn.peer}`);
      });
    });

    socket.on('matchFound', (data) => {
      console.log('Received data:', JSON.stringify(data));
      isPlayer1 = !data.isPlayer1;
      console.log(isPlayer1);
      const { opponentUid, opponentUsername, opponentPeerId } = data;
      oppUsername = opponentUsername;
      startPeerConnection(peer, opponentPeerId, opponentUsername);
    });
  } else {
    alert('Please enter a username.');
  }
}

function startPeerConnection(peer, opponentPeerId, opponentUsername) {
  console.log(`Attempting to connect to opponent Peer ID: ${opponentPeerId}`);

  peer.on('connection', (conn) => {
    console.log(`Incoming connection opened with Peer ID: ${conn.peer}`);
    multiplayer.connectionStatus.textContent = `Connected to ${opponentUsername}`;
    setupConnectionHandlers(conn);
  });

  conn = peer.connect(opponentPeerId);

  conn.on('open', () => {
    console.log(`Outgoing connection established with Peer ID: ${conn.peer}`);
    multiplayer.connectionStatus.textContent = `Connected to ${opponentUsername}`;
    setupConnectionHandlers(conn);
    decideLevelOrder();
  });

  conn.on('error', (err) => {
    console.log(`Outgoing connection error with Peer ID: ${opponentPeerId}:`, err);
    document.body.innerHTML = "<h2 style='color:white;text-align:center;'>Connection error with opponent</h2>";
    setTimeout(() => returnToMainMenu(), 1000);
  });
  conn.on('close', () => {
    document.body.innerHTML = "<h2 style='color:white;text-align:center;'>Opponent has disconnected</h2>";
    setTimeout(() => returnToMainMenu(), 1000);
  });
}

function setupConnectionHandlers(conn) {
  conn.on('data', (data) => {
    console.log('Received data from opponent:', JSON.stringify(data));
    
    if (data.type === 'levelOrder') {
      levelsInOrder = data.levels;
      waitingRoom.style.display = 'none';
      startLevelSeries();
    }
    if(data.type == 'score'){
      console.log(data.outOfTime);
      if(data.outOfTime){
        opponentFails[data.index] = 1;
        opponentTimes[data.index] = 0;
        opponentScores[data.index] = 0;
      }else{
        opponentTimes[data.index] = data.time;
        opponentScores[data.index] = data.points;
        opponentFails[data.index] = 0;
      }
      console.log("wfop is " + waitingForOtherPlayer + " // cr is " + countdownRunning);
      if(data.index == multiplayer.currentLevelIndex && !waitingForOtherPlayer && !countdownRunning && !data.outOfTime){
        startOpponentLevelTimer();
      }
    }
    if (data.type == 'message') {
      addMessageToDisplay(data.message, data.sender);
      fetch('notify.wav')
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
          const send = audioContext.createBufferSource();
          send.buffer = audioBuffer;
        
          send.connect(audioContext.destination);
        
          send.start(0);
      })
    }
  });

  conn.on('error', (err) => {
    console.log(`Connection error with Peer ID ${conn.peer}:`, err);
  });
}

function decideLevelOrder() {
  const connectionStatus = document.getElementById('connection-status');
  const levelOrderContainer = document.getElementById('level-order-container');
  const levelSlots = document.querySelectorAll('.level-slot');
  const timerElement = document.getElementById('timer');
  const confirmButton = document.getElementById('confirm-order');

  if (isPlayer1) {
    waitingRoom.style.display = 'none';
    levelOrderContainer.style.display = 'block';

    const difficultyOptions = document.getElementById('difficulty-options');
    difficultyOptions.innerHTML = '';
    multiplayer.selectedDifficulties.forEach(difficulty => {
      const option = document.createElement('div');
      option.textContent = difficulty;
      option.draggable = true;
      option.style.cursor = 'move';
      option.style.padding = '5px';
      option.style.border = '1px solid #ddd';
      option.style.margin = '5px';
      difficultyOptions.appendChild(option);
    });

    let droppedLevels = [null, null, null, null];
    difficultyOptions.querySelectorAll('div').forEach(difficulty => {
      difficulty.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', difficulty.textContent);
      });
    });

    levelSlots.forEach((slot, index) => {
      slot.addEventListener('dragover', (event) => {
        event.preventDefault();
      });

      slot.addEventListener('drop', (event) => {
        event.preventDefault();
        const data = event.dataTransfer.getData('text/plain');
        if (!slot.textContent) {
          slot.textContent = data;
          droppedLevels[index] = data;
        } else {
          alert("This slot is already filled.");
        }
      });
    });

    let timeLeft = 15;
    const timerInterval = setInterval(() => {
      timerElement.textContent = `Time left: ${timeLeft}s`;
      timeLeft--;
      if (timeLeft < 0) {
        clearInterval(timerInterval);

        const chosenLevels = [];
        levelSlots.forEach(slot => {
          if (slot.textContent) {
            chosenLevels.push(slot.textContent);
          }
        });
        for (let i = 0; i < 4; i++) {
          if(chosenLevels.length < 4){
            const randomIndex = Math.floor(Math.random() * multiplayer.selectedDifficulties.length);
            const randomDifficulty = multiplayer.selectedDifficulties[randomIndex];
            chosenLevels.push(randomDifficulty);
          }
        }
        
        conn.send({
          type: 'levelOrder',
          isPlayer1: true,
          levels: chosenLevels
        });
        finalizeLevelOrder(chosenLevels);
      }
    }, 1000);

    confirmButton.addEventListener('click', () => {
      const chosenLevels = [];
      levelSlots.forEach(slot => {
        if (slot.textContent) {
          chosenLevels.push(slot.textContent);
        }
      });

      if (chosenLevels.length < 4) {
        alert("Please fill in all the slots before confirming!");
        return;
      }

      clearInterval(timerInterval);
      conn.send({
        type: 'levelOrder',
        isPlayer1: true,
        levels: chosenLevels
      });
      finalizeLevelOrder(chosenLevels);
    });
  } else {
    connectionStatus.textContent = "Opponent is ordering levels...";
    levelOrderContainer.style.display = 'none';
  }
}

function finalizeLevelOrder(levels) {
  const levelOrderContainer = document.getElementById('level-order-container');
  const connectionStatus = document.getElementById('connection-status');
  const timerElement = document.getElementById('timer');

  levelOrderContainer.style.display = 'none';
  connectionStatus.style.display = 'none';
  timerElement.textContent = '';

  levelsInOrder = levels;
  startLevelSeries();
}

multiplayer.canvas = document.createElement('canvas');
multiplayer.canvas.style.position = 'absolute';
multiplayer.canvas.style.top = '0';
multiplayer.canvas.style.left = '0';
multiplayer.canvas.style.zIndex = '1';
multiplayer.gameContainer.appendChild(multiplayer.canvas);

let levelsInOrder = []

let gameReady = false;
let playerPoints = 0;
let waitingForOtherPlayer = false;
let speedFactor = 0.9;
let peer;

multiplayer.ctx = multiplayer.canvas.getContext('2d');

multiplayer.canvas.width = 567;
multiplayer.canvas.height = 567;

class multipGameObject {
  constructor(x, y, size, dx, dy, isUnique = false) {
      this.x = x;
      this.y = y;
      this.size = size;
      this.dx = dx;
      this.dy = dy;
      this.isUnique = isUnique;
      this.image = new Image();
      this.image.src = isUnique ? 'luigi.png' : this.randomImage();

      this.lastTimestamp = performance.now();
  }

  randomImage() {
      const images = ['mario.png', 'yoshi.png', 'wario.png'];
      return images[Math.floor(Math.random() * images.length)];
  }

  draw() {
      multiplayer.ctx.drawImage(this.image, this.x, this.y, this.size, this.size);
  }

  update() {
      const currentTimestamp = performance.now();
      const deltaTime = (currentTimestamp - this.lastTimestamp) / 1000;

      const speedFactor = deltaTime * 50;

      const nextX = this.x + this.dx * speedFactor;
      const nextY = this.y + this.dy * speedFactor;

      if (nextX <= 0 || nextX + this.size >= multiplayer.canvas.width) {
          this.dx *= -1;
      }

      if (nextY <= 0 || nextY + this.size >= multiplayer.canvas.height) {
          this.dy *= -1;
      }

      this.x += this.dx * speedFactor;
      this.y += this.dy * speedFactor;

      this.lastTimestamp = currentTimestamp;
  }
}


let lastTimestamp = 0;

function initializeGame(difficulty) {
  updateStopwatchDisplay();
  multiplayer.objects = [];

  const { objectCount, objectSize } = multiplayer.difficulties[difficulty];

  for (let i = 0; i < objectCount; i++) {
      const x = Math.random() * (multiplayer.canvas.width - objectSize);
      const y = Math.random() * (multiplayer.canvas.height - objectSize);
      const dx = (Math.random() - 0.5) * 4;
      const dy = (Math.random() - 0.5) * 4;

      const isUnique = i === 0;
      const obj = new multipGameObject(x, y, objectSize, dx, dy, isUnique);
      multiplayer.objects.push(obj);

      if (isUnique) multiplayer.uniqueObject = obj;
  }

  multiplayer.gameRunning = true;
  requestAnimationFrame(animate);
}

function animate(timestamp) {
  if (!multiplayer.gameRunning) return;

  const deltaTime = timestamp - (multiplayer.lastTimestamp || timestamp);
  multiplayer.lastTimestamp = timestamp;

  multiplayer.ctx.clearRect(0, 0, multiplayer.canvas.width, multiplayer.canvas.height);

  multiplayer.objects.forEach(obj => {
      obj.update(deltaTime);
      obj.draw();
  });

  requestAnimationFrame(animate);
}

let countdownTimerId = null;

function startOpponentLevelTimer() {
  if (countdownRunning) return;
  countdownRunning = true;

  let oppTimer = 5;
  const timerElement = document.createElement('div');
  timerElement.id = 'opponent-countdown-text';
  timerElement.style.textAlign = 'center';
  timerElement.textContent = `Opponent finished! You have ${oppTimer} seconds to complete the level.`;
  timerElement.style.top = `${multiplayer.canvas.offsetTop + 125}px`;
  responsiveContainer.appendChild(timerElement);
  let cli = multiplayer.currentLevelIndex;

  const intervalId = setInterval(() => {
    oppTimer--;
    timerElement.textContent = `Opponent finished! You have ${oppTimer} seconds to complete the level.`;

    if (oppTimer <= 0) {
      clearInterval(intervalId);
      timerElement.remove();
      completeLevel(levelsInOrder[multiplayer.currentLevelIndex], levelTimes[multiplayer.currentLevelIndex], true);
      moveToNextLevel(cli);
    }
  }, 1000);
}

function moveToNextLevel(index) {
  countdownRunning = false;
  if(index == multiplayer.currentLevelIndex){
    playNextLevel();
  }
}

let audioSource;
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function startLevelSeries() {
  fetch('wanted.wav')
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
    .then(audioBuffer => {
      audioSource = audioContext.createBufferSource();
      audioSource.buffer = audioBuffer;

      audioSource.loop = true;

      audioSource.connect(audioContext.destination);

      audioSource.start(0);
  })
  .catch(error => console.error('Error loading audio:', error));
  multiplayer.gameContainer.style.display = 'block';
  playerPoints = 0;
  multiplayer.currentLevelIndex = -1;
  levelTimes = [];
  playNextLevel();
}

function updateStopwatchVisibility(appear) {
  if (multiplayer.gameRunning && multiplayer.showStopwatch) {
    clearInterval(multiplayer.stopwatchInterval);
    stopwatch = 0;
    updateStopwatchDisplay();
    console.log("timer interval cleared");
    multiplayer.stopwatchElement.style.display = 'block';
    multiplayer.stopwatchInterval = setInterval(() => {
      stopwatch++;
      updateStopwatchDisplay();
      fetch('tick.wav')
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
          tick = audioContext.createBufferSource();
          tick.buffer = audioBuffer;
          const gainNode = audioContext.createGain();
          tick.connect(gainNode);
          gainNode.connect(audioContext.destination);
          tick.start(0);

          gainNode.gain.value = 0.3;
        })
    }, 1000);
    console.log("timer interval set");
  } else {
    multiplayer.stopwatchElement.style.display = 'none';
  }
  if(!appear){
    multiplayer.stopwatchElement.style.display = 'none';
  }
}

function updateStopwatchDisplay() {
  if (multiplayer.stopwatchElement) {
    multiplayer.stopwatchElement.textContent = `Time: ${stopwatch} seconds`;
  }
}

let messageInput;

function endSeries() {
  audioSource.stop(0);
  fetch('openhat.wav')
  .then(response => response.arrayBuffer())
  .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
  .then(audioBuffer => {
    const sfx1 = audioContext.createBufferSource();
    sfx1.buffer = audioBuffer;

    sfx1.connect(audioContext.destination);

    sfx1.start(0);
  })
  fetch('luigi.wav')
  .then(response => response.arrayBuffer())
  .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
  .then(audioBuffer => {
    const sfx2 = audioContext.createBufferSource();
    sfx2.buffer = audioBuffer;
    const gainNode = audioContext.createGain();
    sfx2.connect(gainNode);
    gainNode.connect(audioContext.destination);
    sfx2.start(0);
  })
  updateStopwatchVisibility(false);
  document.getElementById('game-container').style.display = 'none';
  const endingScreen = document.createElement('div');
  endingScreen.id = 'ending-screen';
  endingScreen.style.position = 'absolute';
  endingScreen.style.top = '50%';
  endingScreen.style.left = '50%';
  endingScreen.style.transform = 'translate(-50%, -50%)';
  endingScreen.style.textAlign = 'center';
  
  opponentTotal = 0;
  opponentScores.forEach(score => {
    opponentTotal += score;
  });
  
  const winnerText = playerPoints > opponentTotal
    ? `${username} wins!`
    : playerPoints < opponentTotal
    ? `${oppUsername} wins!`
    : `It's a tie!`;

  endingScreen.innerHTML = `
    <h2>${winnerText}</h2>
    <div style="display: flex; justify-content: space-between;">
      <div>
        <h3>Your Score: ${playerPoints}</h3>
        <ul>
          ${levelsInOrder.map((difficulty, index) => {
            let playerTimeTaken;
            let playerLevelPoints;
            if(playerFails[index] == 0){
              playerTimeTaken = levelTimes[index];
              playerLevelPoints = calculateLevelPoints(difficulty, playerTimeTaken);
            }else{
              playerTimeTaken = 'N/A';
              playerLevelPoints = 0;
            }
            return `<li>${capitalizeFirstLetter(difficulty)} - Time: ${playerTimeTaken}s - Points: ${playerLevelPoints}</li>`;
          }).join('')}
        </ul>
      </div>
      <div>
        <h3>${oppUsername}'s Score: ${opponentTotal}</h3>
        <ul>
          ${levelsInOrder.map((difficulty, index) => {
            let oppTimeTaken;
            let oppLevelPoints;
            if(opponentFails[index] == 0){
              oppTimeTaken = opponentTimes[index] || 0;
              oppLevelPoints = calculateLevelPoints(difficulty, oppTimeTaken);
            }else{
              console.log(index + ' should be set to a fail');
              oppTimeTaken = 'N/A';
              oppLevelPoints = 0;
            }
            return `<li>${capitalizeFirstLetter(difficulty)} - Time: ${oppTimeTaken}s - Points: ${oppLevelPoints}</li>`;
          }).join('')}
        </ul>
      </div>
    </div>
    <button onclick="returnToMainMenu()">Return to Main Menu</button>
  `;

  const messageContainer = document.createElement('div');
  messageContainer.id = 'message-container';
  messageContainer.style.position = 'absolute';
  messageContainer.style.bottom = '20px';
  messageContainer.style.left = '50%';
  messageContainer.style.transform = 'translateX(-50%)';
  messageContainer.style.textAlign = 'center';
  messageContainer.style.width = '80%';
  responsiveContainer.appendChild(messageContainer);

  const messagesDisplay = document.createElement('div');
  messagesDisplay.id = 'messages-display';
  messagesDisplay.style.display = 'flex';
  messagesDisplay.style.flexDirection = 'column-reverse';
  messagesDisplay.style.justifyContent = 'flex-start';
  messagesDisplay.style.maxHeight = '50vh';
  messagesDisplay.style.overflowY = 'auto';
  messagesDisplay.style.marginBottom = '10px';
  messageContainer.appendChild(messagesDisplay);

  messageInput = document.createElement('input');
  messageInput.type = 'text';
  messageInput.maxLength = 20;
  messageInput.placeholder = 'Enter your message';
  messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      sendMessage(messageInput.value);
    }
  });
  messageContainer.appendChild(messageInput);

  responsiveContainer.appendChild(endingScreen);
  responsiveContainer.appendChild(messageContainer);

  setTimeout(() => {
    returnToMainMenu();
  }, 20000);
}

let canSendMessage = true;

function sendMessage(message) {
  if(!canSendMessage){return;}
  const trimmedMessage = message.trim();
  if (trimmedMessage.length > 0 && !trimmedMessage.includes('http')) {
    conn.send({
      type: 'message',
      message: trimmedMessage,
      sender: username
    });

    socket.emit('message', {
      sender: username,
      recipient: oppUsername,
      message: trimmedMessage
    });

    addMessageToDisplay(trimmedMessage, username);
    if (messageInput) {
      messageInput.value = '';
    }
  }
  canSendMessage = false;
  setTimeout(() => {
    canSendMessage = true;
  }, 500);
  fetch('send.wav')
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
    .then(audioBuffer => {
      const send = audioContext.createBufferSource();
      send.buffer = audioBuffer;

      send.connect(audioContext.destination);

      send.start(0);
  })
  messageInput.style.display = 'none';
}

function addMessageToDisplay(message, sender) {
  const messageElement = document.createElement('div');
  messageElement.textContent = `${sender}: ${message}`;

  const messagesDisplay = document.getElementById('messages-display');
  if (messagesDisplay) {
    messagesDisplay.insertBefore(messageElement, messagesDisplay.firstChild);

    const intervalId = setInterval(() => {
      if (messagesDisplay.children.length > 5) {
        fadeOutOldestMessage(messagesDisplay);
      } else {
        clearInterval(intervalId);
      }
    }, 500);
  }
}

function fadeOutOldestMessage(container) {
  const oldestMessage = container.lastChild;
  
  if (oldestMessage) {
    oldestMessage.style.transition = 'opacity 1s ease-out';
    oldestMessage.style.opacity = '0';

    setTimeout(() => {
      if (oldestMessage.parentElement === container) {
        oldestMessage.remove();
      }
    }, 1000);
  }
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function completeLevel(difficulty, timeTaken, outOfTime) {
  console.log('complete level fire');
  let levelPoints = 0;
  if(!outOfTime){
    levelPoints = calculateLevelPoints(difficulty, timeTaken);
    playerFails[multiplayer.currentLevelIndex] = 0;
  }else{
    playerFails[multiplayer.currentLevelIndex] = 1;
  }
  conn.send({
    type: 'score',
    points: levelPoints,
    time: timeTaken,
    index: multiplayer.currentLevelIndex,
    noTime: outOfTime
  });
  playerPoints += levelPoints;
  clearInterval(multiplayer.stopwatchInterval);
}

function returnToMainMenu() {
  window.location.href = 'index.html';

  multiplayer.selectedDifficulties = [];
  levelsInOrder = [];
  playerPoints = 0;
  multiplayer.currentLevelIndex = -1;
  const difficultyButtons = document.querySelectorAll('.difficulty-button');
  difficultyButtons.forEach(button => {
      button.classList.remove('selected');
      button.style.backgroundColor = 'grey';
  });
}

function calculateLevelPoints(difficulty, timeTaken) {
    const basePoints = 100;
    const difficultyMultiplier = getDifficultyMultiplier(difficulty);

    const timePenaltyFactor = 2;

    const rawScore = basePoints * difficultyMultiplier;

    const timePenalty = Math.max(timePenaltyFactor * timeTaken, 0);

    return Math.max(rawScore - timePenalty, 0);
}

function getDifficultyMultiplier(difficulty) {
    switch (difficulty) {
        case 'easy':
            return 1;
        case 'medium':
            return 1.5;
        case 'hard':
            return 2;
        case 'insane':
            return 3;
        default:
            return 1;
    }
}

multiplayer.canvas.addEventListener('click', (event) => {
  if (!multiplayer.gameRunning) return;

  const rect = multiplayer.canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  multiplayer.objects.forEach(obj => {
      if (
          mouseX > obj.x &&
          mouseX < obj.x + obj.size &&
          mouseY > obj.y &&
          mouseY < obj.y + obj.size
      ) {
          if (obj.isUnique) {
            completeLevel(levelsInOrder[multiplayer.currentLevelIndex], stopwatch);
            waitingForOtherPlayer = true;
            multiplayer.gameRunning = false;
            if(!countdownRunning){
              showContinueText();
            }
          }
      }
  });
});

function showContinueText() {
  console.log('show continue text fire');
  let contTimer = 5;
  const countdownText = document.createElement('div');
  countdownText.id = 'opponent-countdown-text';
  countdownText.style.position = 'absolute';
  countdownText.style.top = `${multiplayer.canvas.offsetTop + 125}px`;
  countdownText.style.textAlign = 'center';
  let cli = multiplayer.currentLevelIndex;
  countdownText.textContent = `Found Luigi! Opponent has ${contTimer} seconds to finish...`;
  responsiveContainer.appendChild(countdownText);

  const intervalId = setInterval(() => {
    contTimer--;
    countdownText.textContent = `Found Luigi! Opponent has ${contTimer} seconds to finish...`;

    if (contTimer <= 0) {
      clearInterval(intervalId);
      countdownText.remove();
      moveToNextLevel(cli);
    }
  }, 1000);
}

function playNextLevel() {
  levelTimes[multiplayer.currentLevelIndex] = stopwatch;
  multiplayer.currentLevelIndex++;
  waitingForOtherPlayer = false;
  if (multiplayer.currentLevelIndex >= levelsInOrder.length) {
    endSeries();
    return;
  }

  const difficulty = levelsInOrder[multiplayer.currentLevelIndex];
  initializeGame(difficulty);
  updateStopwatchVisibility(true);
  multiplayer.gameRunning = true;

  levelTimes[multiplayer.currentLevelIndex] = 0;

  requestAnimationFrame(animate);
}
