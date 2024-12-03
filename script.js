// Get the game-container element
const gameContainer = document.getElementById('game-container');

// Create a canvas element dynamically
const canvas = document.createElement('canvas');
canvas.style.position = 'absolute'; // Align canvas to the container
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.zIndex = '1'; // Ensure it overlays the game-container
gameContainer.appendChild(canvas);

let selectedDifficulties = [];
let levelSeries = [];
let currentLevelIndex = 0;
let points = 0;
let stopwatch = 0;
let stopwatchInterval = null;
let objects = [];
let levelTimes = [];
let uniqueObject = null;
let gameRunning = false;
let showStopwatch = localStorage.getItem('showStopwatch') === 'true';

const ctx = canvas.getContext('2d');
const optionsButton = document.getElementById('options-button');
const optionsMenu = document.getElementById('options-menu');
const showStopwatchToggle = document.getElementById('show-stopwatch-toggle');
const saveOptionsButton = document.getElementById('save-options');
const closeOptionsButton = document.getElementById('close-options');
const stopwatchElement = document.getElementById('stopwatch-display');

// Set canvas size to match the game-container
canvas.width = 566; // 80vmin based on viewport width
canvas.height = 566; // 80vmin (assuming square container)

//optionsButton.addEventListener('click', () => {
//    optionsMenu.style.display = 'block';  // Show the options menu
//    optionsMenu.style.position = 'absolute'; // Make sure it's below the "Start Game" button
//    optionsMenu.style.top = 'calc(100% + 10px)';  // Position it below the "Start Game" button
//});

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

// Start single-player game
function startSinglePlayer() {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('difficulty-selection').style.display = 'block';
    const difficultyButtons = document.querySelectorAll('.difficulty-button');
    difficultyButtons.forEach(button => {
        button.classList.remove('selected');
        button.style.backgroundColor = 'grey'; // Ensure the button is grey when unselected
    });
}

function proceedToCustomization() {
    randomizeDifficulties();  // Randomize the selected difficulty order

    document.getElementById('difficulty-selection').style.display = 'none';
    updateStopwatchVisibility();
    startLevelSeries();
}

// Set difficulty and start game
function setDifficulty(difficulty) {
    toggleDifficulty(difficulty);
    updateDifficultyButtonColours();  // Update button colors after selection
    console.log('Selected difficulties:', selectedDifficulties);
}

function toggleDifficulty(difficulty) {
    const index = selectedDifficulties.indexOf(difficulty);
    const button = document.querySelector(`button[data-difficulty="${difficulty}"]`);

    if (index === -1) {
        // Add difficulty to the selected list
        selectedDifficulties.push(difficulty);
        // Highlight the button
        button.classList.add('selected');
        button.style.backgroundColor = 'lightblue'; // Highlight the button
    } else {
        // Remove difficulty from the selected list
        selectedDifficulties.splice(index, 1);
        // Remove the highlight
        button.classList.remove('selected');
        button.style.backgroundColor = 'grey'; // Reset the button color
    }
}

function randomizeDifficulties() {
    // Shuffle the selectedDifficulties array
    for (let i = selectedDifficulties.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [selectedDifficulties[i], selectedDifficulties[j]] = [selectedDifficulties[j], selectedDifficulties[i]]; // Swap
    }
}

function updateDifficultyButtonColours() {
    const difficultyButtons = document.querySelectorAll('.difficulty-button');
    
    difficultyButtons.forEach(button => {
        const difficulty = button.id;  // Assuming the button id is the difficulty name
        if (selectedDifficulties.includes(difficulty)) {
            button.style.backgroundColor = '';  // Reset to default color if selected
        } else {
            button.style.backgroundColor = 'grey';  // Set to grey if not selected
        }
    });
    document.getElementById('difNext').backgroundColor ='';
}

document.addEventListener('DOMContentLoaded', () => {
    updateDifficultyButtonColours();  // Update button colors when page loads
});

function startLevelSeries() {
    levelSeries = [...selectedDifficulties];

    // Show the game container
    const gameContainer = document.getElementById('game-container');
    gameContainer.style.display = 'block';

    points = 0;
    currentLevelIndex = 0;
    levelTimes = [];  // Reset levelTimes for the new series
    playNextLevel();
}

function updateStopwatchVisibility() {
    if (stopwatchElement) {
        if (showStopwatch) {
            stopwatchElement.style.display = 'block';  // Show the stopwatch
        } else {
            stopwatchElement.style.display = 'none';  // Hide the stopwatch
        }
    }
}

optionsButton.addEventListener('click', () => {
    optionsMenu.style.display = 'block';  // Show the options menu
});

saveOptionsButton.addEventListener('click', () => {
    showStopwatch = showStopwatchToggle.checked; // Update the showStopwatch value
    localStorage.setItem('showStopwatch', showStopwatch);  // Save it to localStorage
    optionsMenu.style.display = 'none';  // Close the options menu after saving
});

closeOptionsButton.addEventListener('click', () => {
    optionsMenu.style.display = 'none';  // Close the options menu without saving
});


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

    const totalPoints = levelSeries.reduce((total, difficulty, index) => {
        const timeTaken = levelTimes[index]; // Retrieve time for each level
        const levelPoints = calculateLevelPoints(difficulty, timeTaken);
        return total + levelPoints;
    }, 0);

    endingScreen.innerHTML = `
        <h2>Series Complete!</h2>
        <h3>Your Total Points: ${totalPoints}</h3> <!-- Show the total points -->
        <ul>
            ${levelSeries
                .map((difficulty, index) => {
                    const timeTaken = levelTimes[index];  // Retrieve time for each level
                    const levelPoints = calculateLevelPoints(difficulty, timeTaken);
                    return `<li>${difficulty} - Time: ${timeTaken}s - Points: ${levelPoints}</li>`;
                })
                .join('')}
        </ul>
        <button onclick="returnToMainMenu()">Return to Main Menu</button>
    `;
    stopwatch = 0;
    stopwatchElement.style.display = 'none';
    document.body.appendChild(endingScreen); // Add the ending screen to the page
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
    levelSeries = [];
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

    // Let's set a reasonable scaling factor for time-based penalty (e.g., 2 seconds per penalty)
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
                completeLevel(levelSeries[currentLevelIndex], stopwatch);

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
    if (currentLevelIndex >= levelSeries.length) {
        endSeries();
        return;
    }

    const difficulty = levelSeries[currentLevelIndex];
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