let selectedDifficulties = JSON.parse(localStorage.getItem('selectedDifficulties')); // Array
const connectionStatus = document.getElementById('connection-status');

const peer = new Peer(undefined, {
  host: '/',
  port: 3001,
  path: '/peerjs'
});

let conn;
let username;
let opponentUsername;
let uid = generateUniqueId(); // Generate a unique ID for the user

const waitingRoom = document.getElementById('waiting-room');
const usernameInput = document.getElementById('username-input');
const startButton = document.getElementById('start-button');

const socket = io('http://localhost:3000'); // Connect to the server

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

    // Send user information to the server
    socket.emit('join', {
      uid: uid,
      username: username,
      selectedDifficulties: selectedDifficulties
    });

    socket.on('matchmakingTimeout', () => {
        connectionStatus.textContent = 'Matchmaking timeout.';
    });

    socket.on('matchFound', (opponentUid, opponentUsername) => {
      // Match found! Connect to the opponent using PeerJS
      connectionStatus.textContent = 'Connected to ' + opponentUsername;
      conn = peer.connect(opponentUid);
        conn.on('open', () => {
          // Decide who orders the levels (randomly)
          decideLevelOrder();

          // ... (rest of game logic)
        });

        conn.on('levelOrder', (data) => {
            if (!data.isPlayer1) {
              // Opponent is ordering the levels
              document.getElementById('connection-status').textContent = 'Opponent is choosing levels...';
              // ... (handle the received level order)
            }
        });

        conn.on('error', (err) => {
            connectionStatus.textContent = 'Connection error: ' + err;
        });
    });
  } else {
    alert('Please enter a username.');
  }
}

function decideLevelOrder() {
  const isPlayer1 = Math.random() < 0.5;

  if (isPlayer1) {
    const levelOrderContainer = document.getElementById('level-order-container');
    levelOrderContainer.style.display = 'block';

    const levelSlots = document.querySelectorAll('.level-slot');
    const difficultyOptions = document.querySelectorAll('#difficulty-options div');

    // Drag-and-drop logic
    difficultyOptions.forEach(difficulty => {
      difficulty.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', difficulty.textContent);
      });
    });

    levelSlots.forEach(slot => {
      slot.addEventListener('dragover', (event) => {
        event.preventDefault();
      });

      slot.addEventListener('drop', (event) => {
        event.preventDefault();
        const   
   ata = event.dataTransfer.getData('text/plain');
        slot.textContent = data;
      });
    });

    // Set a timer for level order selection
    const timerElement = document.getElementById('timer');
    let timeLeft = 15; // Adjust the time limit as needed
    const timerInterval = setInterval(() => {
      timerElement.textContent = `Time left: ${timeLeft}s`;
      timeLeft--;
      if (timeLeft === 0) {
        clearInterval(timerInterval);
        // Automatically select a random level order
        const chosenLevels = [];
        while (chosenLevels.length < 4) {
          const randomIndex = Math.floor(Math.random() * selectedDifficulties.length);
          const randomDifficulty = selectedDifficulties[randomIndex];
          chosenLevels.push(randomDifficulty);
          // Update the level slots visually
          levelSlots[chosenLevels.length - 1].textContent = randomDifficulty;
        }
        conn.send({
          type: 'levelOrder',
          isPlayer1: true,
          levels: chosenLevels
        });
        levelOrderContainer.style.display = 'none';
        levelsInOrder = chosenLevels;
      }
    }, 1000);

    // Confirm button logic
    const confirmButton = document.getElementById('confirm-order');
    confirmButton.addEventListener('click', () => {
      const chosenLevels = [];
      levelSlots.forEach(slot => {
        chosenLevels.push(slot.textContent);
      });
      conn.send({
        type: 'levelOrder',
        isPlayer1: true,
        levels: chosenLevels
      });
      levelsInOrder = chosenLevels;
      levelOrderContainer.style.display = 'none';
    });
  } else {
    // Player 2 waits for the opponent to order the levels
    conn.on('levelOrder', (data) => {
      if (data.isPlayer1) {
        levelsInOrder = data.levels;
        // Start playing the game with the opponent's level order
        // ... (implement game logic)
      }
    });
  }
}





















// Made for 1495 x 712
const gameContainer = document.getElementById('game-container');

// Create a canvas element dynamically
const canvas = document.createElement('canvas');
canvas.style.position = 'absolute'; // Align canvas to the container
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.zIndex = '1'; // Ensure it overlays the game-container
gameContainer.appendChild(canvas);

let levelsInOrder = []
let currentLevelIndex = 0;
let points = 0;
let stopwatchInterval = null;
let objects = [];
let uniqueObject = null;
let gameRunning = false;
let showStopwatch = localStorage.getItem('showStopwatch') === 'true';

let gameReady = false;
let playerPoints = 0;
let opponentPoints = 0;
let playerLevelTimes = [];
let opponentLevelTimes = [];
let opponentFinishedLevel = false;
let opponentLevelTimer = null;

const ctx = canvas.getContext('2d');
const showStopwatchToggle = document.getElementById('show-stopwatch-toggle');
const stopwatchElement = document.getElementById('stopwatch-display');

// Set canvas size to match the game-container
canvas.width = 567; // 80vmin based on viewport width
canvas.height = 567; // 80vmin (assuming square container)

const difficulties = {
    easy: { objectCount: 80, objectSize: 65 },
    medium: { objectCount: 170, objectSize: 50 },
    hard: { objectCount: 200, objectSize: 40 },
    insane: { objectCount: 500, objectSize: 30 }
};

// Object class
class GameObject {
    constructor(x, y, size, dx, dy, isUnique = false) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.dx = dx;
        this.dy = dy;
        this.isUnique = isUnique;
        this.image = new Image();
        this.image.src = isUnique ? 'luigi.png' : this.randomImage();
    }

    randomImage() {
        const images = ['mario.png', 'yoshi.png', 'wario.png'];
        return images[Math.floor(Math.random() * images.length)];
    }

    draw() {
        ctx.drawImage(this.image, this.x, this.y, this.size, this.size);
    }

    update() {
        this.x += this.dx;
        this.y += this.dy;

        // Bounce off the container edges
        if (this.x <= 0 || this.x + this.size >= canvas.width) this.dx *= -1;
        if (this.y <= 0 || this.y + this.size >= canvas.height) this.dy *= -1;
    }
}

function initializeGame(difficulty) {
    stopwatch = 0;
    updateStopwatchDisplay();
    objects = [];
    const { objectCount, objectSize } = difficulties[difficulty];

    // Create objects
    for (let i = 0; i < objectCount; i++) {
        const x = Math.random() * (canvas.width - objectSize);
        const y = Math.random() * (canvas.height - objectSize);
        const dx = (Math.random() - 0.5) * 4;
        const dy = (Math.random() - 0.5) * 4;

        const isUnique = i === 0;
        const obj = new GameObject(x, y, objectSize, dx, dy, isUnique);
        objects.push(obj);

        if (isUnique) uniqueObject = obj;
    }
}

function animate() {
    if (!gameRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    objects.forEach(obj => {
        obj.update();
        obj.draw();
    });

    requestAnimationFrame(animate);
}

function startOpponentLevelTimer() {
  const timer = 5; // Adjust the timer duration as needed
  const timerElement = document.createElement('div');
  timerElement.textContent = `Opponent finished! You have ${timer} seconds to complete the level.`;
  document.body.appendChild(timerElement);

  const intervalId = setInterval(() => {
    timer--;
    timerElement.textContent = `Opponent finished! You have ${timer} seconds to complete the level.`;
    if (timer === 0) {
      clearInterval(intervalId);
      timerElement.remove();
      // Force the player to move to the next level, even if they haven't finished the current one
      currentLevelIndex++;
      playNextLevel();
    }
  }, 1000);

  setTimeout(() => {
    clearInterval(intervalId);
    timerElement.remove();
    // Force the player to move to the next level, even if they haven't finished the current one
    currentLevelIndex++;
    playNextLevel();
  }, timer * 1000);
}

conn.on('levelOrder', (data) => {
  if (data.isPlayer1) {
    levelsInOrder = data.levels;
    startLevelSeries();
  } else {
    // You're player 2, start the game with the received level order
    levelsInOrder = data.levels;
    startLevelSeries();
  }
});

conn.on('levelCompleted', () => {
  // Handle opponent's level completion
  if (!opponentFinishedLevel) {
    opponentFinishedLevel = true;
    startOpponentLevelTimer();
  }
});

function startLevelSeries() {
  // Show the game container
  const gameContainer = document.getElementById('game-container');
  gameContainer.style.display = 'block';

  points = 0;
  currentLevelIndex = 0;
  levelTimes = []; // Reset levelTimes for the new series
  playNextLevel();
}

function updateStopwatchVisibility() {
  if (stopwatchElement) {
      if (gameRunning && showStopwatch) {
          stopwatchElement.style.display = 'block'; // Show the stopwatch
      } else {
          stopwatchElement.style.display = 'none'; // Hide the stopwatch
      }
  }
}


function updateStopwatchDisplay() {
  if (stopwatchElement) {
      stopwatchElement.textContent = `Time: ${stopwatch} seconds`;
  }
}

// End the series and show the score
function endSeries() {
  document.getElementById('game-container').style.display = 'none';
  const endingScreen = document.createElement('div');
  endingScreen.id = 'ending-screen';
  endingScreen.style.position = 'absolute';
  endingScreen.style.top = '50%';
  endingScreen.style.left = '50%';
  endingScreen.style.transform = 'translate(-50%, -50%)';
  endingScreen.style.textAlign = 'center';
  const totalPoints = levelsInOrder.reduce((total, difficulty, index) => {
      const timeTaken = levelTimes[index]; // Retrieve time for each level
      const levelPoints = calculateLevelPoints(difficulty, timeTaken);
      return total + levelPoints;
  }, 0);
  endingScreen.innerHTML = `
      <h2>Series Complete!</h2>
      <h3>Total Points: ${totalPoints}</h3> <!-- Show the total points -->
      <ul>
          ${levelsInOrder
              .map((difficulty, index) => {
                  const timeTaken = levelTimes[index];  // Retrieve time for each level
                  const levelPoints = calculateLevelPoints(difficulty, timeTaken);
                  return `<li>${capitalizeFirstLetter(difficulty)} - Time: ${timeTaken}s - Points: ${levelPoints}</li>`;
              })
              .join('')}
      </ul>
      <button onclick="returnToMainMenu()">Return to Main Menu</button>
  `;
  stopwatch = 0;
  stopwatchElement.style.display = 'none';
  document.body.appendChild(endingScreen); // Add the ending screen to the page

  // Message logic
  const messageContainer = document.createElement('div');
  messageContainer.id = 'message-container';
  messageContainer.style.position = 'absolute';
  messageContainer.style.top = '50%';
  messageContainer.style.left = '50%';
  messageContainer.style.transform   
  = 'translate(-50%, -50%)';
  messageContainer.style.textAlign   
  = 'center';

  messageDisplay = document.createElement('div');
  messageDisplay.id = 'message-display';
  messageContainer.appendChild(messageDisplay);

  messageInput = document.createElement('input');
  messageInput.type = 'text';
  messageInput.maxLength = 20;
  messageInput.placeholder = 'Enter your message (max 20 characters)';
  messageContainer.appendChild(messageInput);

  messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      sendMessage();
    }
  });

  document.body.appendChild(messageContainer);

  // Start 15-second timer
  const timer = 15;
  const timerInterval = setInterval(() => {
    timer--;
    if (timer === 0) {
      clearInterval(timerInterval);
      messageContainer.remove();
      returnToMainMenu();
    }
  }, 1000);
}

function sendMessage() {
  const message = messageInput.value.trim();
  if (message.length > 0 && !message.includes('http')) {
    conn.send({
      type: 'message',
      message: `${username}: ${message}`
    });
    addMessageToDisplay(message);
    messageInput.value = '';
  }
}

conn.on('message', (data) => {
  addMessageToDisplay(data.message);
});

function addMessageToDisplay(message) {
  const messageElement = document.createElement('div');
  messageElement.textContent = message;
  messageDisplay.appendChild(messageElement);
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function completeLevel(difficulty, timeTaken) {
    const levelPoints = calculateLevelPoints(difficulty, timeTaken); // Calculate points for the current level
    points += levelPoints; // Add the points for this level to the total score
}

function returnToMainMenu() {
    // Hide the ending screen and show the main menu
    document.getElementById('ending-screen').remove();
    document.getElementById('main-menu').style.display = 'block';

    // Reset variables for the next game
    selectedDifficulties = [];
    levelsInOrder = [];
    points = 0;  // Reset points
    currentLevelIndex = 0;

    // Reset button styles
    const difficultyButtons = document.querySelectorAll('.difficulty-button');
    difficultyButtons.forEach(button => {
        button.classList.remove('selected');
        button.style.backgroundColor = 'grey'; // Ensure the button is grey when unselected
    });
}

function calculateLevelPoints(difficulty, timeTaken) {
    const basePoints = 100; // Base points for completing any level
    const difficultyMultiplier = getDifficultyMultiplier(difficulty);

    const timePenaltyFactor = 2;  // The larger this value, the more time impacts the score

    // Calculate the raw score based on difficulty
    const rawScore = basePoints * difficultyMultiplier;

    // Penalize score based on the time it took (the faster, the better)
    const timePenalty = Math.max(timePenaltyFactor * timeTaken, 0);  // Ensure non-negative penalty

    // Final points: Higher points for quicker times, penalize for longer times
    return Math.max(rawScore - timePenalty, 0);  // Ensure score is at least 0
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

canvas.addEventListener('click', (event) => {
    if (!gameRunning) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    objects.forEach(obj => {
        if (
            mouseX > obj.x &&
            mouseX < obj.x + obj.size &&
            mouseY > obj.y &&
            mouseY < obj.y + obj.size
        ) {
            if (obj.isUnique) {
                const basePoints = 100;
                const timePenalty = Math.min(stopwatch, basePoints);
                points += basePoints - timePenalty;

                // Record the time taken for the current level
                completeLevel(levelsInOrder[currentLevelIndex], stopwatch);

                // Remove the alert
                gameRunning = false;
                clearInterval(stopwatchInterval);  // Stop the stopwatch

                // Display continue button after finding the unique object
                showContinueButton();
            }
        }
    });
});


// Function to show the "Continue" button
function showContinueButton() {
    const continueButtonContainer = document.createElement('div');
    continueButtonContainer.id = 'continue-button-container';
    continueButtonContainer.style.position = 'absolute';
    continueButtonContainer.style.top = `${canvas.offsetTop + canvas.height + 75}px`; // Position below the canvas

    const continueButton = document.createElement('button');
    continueButton.textContent = 'Continue';
    continueButton.onclick = () => {
        // Hide continue button and start next level
        continueButtonContainer.remove();
        currentLevelIndex++;  // Move to the next level
        playNextLevel();
    };

    continueButtonContainer.appendChild(continueButton);
    document.body.appendChild(continueButtonContainer);  // Add button to the body
}

// Function to move to the next level
function playNextLevel() {
  if (currentLevelIndex >= levelsInOrder.length) {
    endSeries();
    return;
  }

  const difficulty = levelsInOrder[currentLevelIndex];
  initializeGame(difficulty);
  gameRunning = true;

  // Start stopwatch
  stopwatch = 0;
  levelTimes[currentLevelIndex] = 0; // Reset time for this level

  // Start the stopwatch interval
  stopwatchInterval = setInterval(() => {
    stopwatch++;
    levelTimes[currentLevelIndex] = stopwatch; // Store the time for this level
    updateStopwatchDisplay();
  }, 1000);

  animate();
}