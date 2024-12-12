const gameContainer = document.getElementById('game-container');

const canvas = document.createElement('canvas');
canvas.style.position = 'absolute';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.zIndex = '1';
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
let optionsOpen = false;
let multiplayerSelected = false;

const ctx = canvas.getContext('2d');
const optionsButton = document.getElementById('options-button');
const optionsMenu = document.getElementById('options-menu');
const showStopwatchToggle = document.getElementById('show-stopwatch-toggle');
const saveOptionsButton = document.getElementById('save-options');
const closeOptionsButton = document.getElementById('close-options');
const stopwatchElement = document.getElementById('stopwatch-display');

canvas.width = 567;
canvas.height = 567;

const difficulties = {
    easy: { objectCount: 80, objectSize: 65 },
    medium: { objectCount: 170, objectSize: 50 },
    hard: { objectCount: 200, objectSize: 40 },
    insane: { objectCount: 500, objectSize: 30 }
};

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

        if (this.x <= 0 || this.x + this.size >= canvas.width) this.dx *= -1;
        if (this.y <= 0 || this.y + this.size >= canvas.height) this.dy *= -1;
    }
}

function initializeGame(difficulty) {
    stopwatch = 0;
    updateStopwatchDisplay();
    objects = [];
    const { objectCount, objectSize } = difficulties[difficulty];

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

function startMultiPlayer(){
    multiplayerSelected = true;
    startSinglePlayer();
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

function startSinglePlayer() {
    optionsMenu.style.display = 'none';
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('difficulty-selection').style.display = 'block';
    const difficultyButtons = document.querySelectorAll('.difficulty-button');
    difficultyButtons.forEach(button => {
        button.classList.remove('selected');
        button.style.backgroundColor = 'grey';
    });
}

function proceedToCustomization() {
    if(multiplayerSelected){
        localStorage.setItem('selectedDifficulties', JSON.stringify(selectedDifficulties));
        window.location.href = 'multiplayer.html';
    }else{
        randomizeDifficulties();
        updateStopwatchVisibility();
        startLevelSeries();
    }
    document.getElementById('difficulty-selection').style.display = 'none';
}

function setDifficulty(difficulty) {
    toggleDifficulty(difficulty);
    updateDifficultyButtonColours();
    console.log('Selected difficulties:', selectedDifficulties);    
}

function toggleDifficulty(difficulty) {
    const index = selectedDifficulties.indexOf(difficulty);
    const button = document.querySelector(`button[data-difficulty="${difficulty}"]`);

    if (index === -1) {
        selectedDifficulties.push(difficulty);
        button.classList.add('selected');
        button.style.backgroundColor = 'lightblue';
    } else {
        selectedDifficulties.splice(index, 1);
        button.classList.remove('selected');
        button.style.backgroundColor = 'grey';
    }
}

function randomizeDifficulties() {
    for (let i = selectedDifficulties.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [selectedDifficulties[i], selectedDifficulties[j]] = [selectedDifficulties[j], selectedDifficulties[i]];
    }
}

function updateDifficultyButtonColours() {
    const difficultyButtons = document.querySelectorAll('.difficulty-button');
    
    difficultyButtons.forEach(button => {
        const difficulty = button.id;
        if (selectedDifficulties.includes(difficulty)) {
            button.style.backgroundColor = '';
        } else {
            button.style.backgroundColor = 'grey';
        }
    });
    document.getElementById('difNext').backgroundColor ='';
}

document.addEventListener('DOMContentLoaded', () => {
    updateDifficultyButtonColours();
});

function startLevelSeries() {
    levelSeries = [...selectedDifficulties];

    const gameContainer = document.getElementById('game-container');
    gameContainer.style.display = 'block';

    points = 0;
    currentLevelIndex = 0;
    levelTimes = [];
    playNextLevel();
}

function updateStopwatchVisibility() {
    if (stopwatchElement) {
        if (showStopwatch) {
            stopwatchElement.style.display = 'block';
        } else {
            stopwatchElement.style.display = 'none';
        }
    }
}

optionsButton.addEventListener('click', () => {
    if(optionsOpen){
        optionsMenu.style.display = 'none';
        optionsOpen = false;
    }else{
        optionsMenu.style.display = 'block';
        optionsOpen = true;
    }
});

saveOptionsButton.addEventListener('click', () => {
    showStopwatch = showStopwatchToggle.checked;
    localStorage.setItem('showStopwatch', showStopwatch);
    optionsMenu.style.display = 'none';
    optionsOpen = false;
});

closeOptionsButton.addEventListener('click', () => {
    optionsMenu.style.display = 'none';
    optionsOpen = false;
});


function updateStopwatchDisplay() {
    if (stopwatchElement) {
        stopwatchElement.textContent = `Time: ${stopwatch} seconds`;
    }
}

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
        const timeTaken = levelTimes[index];
        const levelPoints = calculateLevelPoints(difficulty, timeTaken);
        return total + levelPoints;
    }, 0);

    endingScreen.innerHTML = `
        <h2>Series Complete!</h2>
        <h3>Total Points: ${totalPoints}</h3> <!-- Show the total points -->
        <ul>
            ${levelSeries
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
    document.body.appendChild(endingScreen);
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function completeLevel(difficulty, timeTaken) {
    const levelPoints = calculateLevelPoints(difficulty, timeTaken);
    points += levelPoints;
}

function returnToMainMenu() {
    document.getElementById('ending-screen').remove();
    document.getElementById('main-menu').style.display = 'block';

    selectedDifficulties = [];
    levelSeries = [];
    points = 0;
    currentLevelIndex = 0;

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

                completeLevel(levelSeries[currentLevelIndex], stopwatch);

                gameRunning = false;
                clearInterval(stopwatchInterval);

                showContinueButton();
            }
        }
    });
});


function showContinueButton() {
    const continueButtonContainer = document.createElement('div');
    continueButtonContainer.id = 'continue-button-container';
    continueButtonContainer.style.position = 'absolute';
    continueButtonContainer.style.top = `${canvas.offsetTop + canvas.height + 75}px`;

    const continueButton = document.createElement('button');
    continueButton.textContent = 'Continue';
    continueButton.onclick = () => {
        continueButtonContainer.remove();
        currentLevelIndex++;
        playNextLevel();
    };

    continueButtonContainer.appendChild(continueButton);
    document.body.appendChild(continueButtonContainer);
}

function playNextLevel() {
    if (currentLevelIndex >= levelSeries.length) {
        endSeries();
        return;
    }

    const difficulty = levelSeries[currentLevelIndex];
    initializeGame(difficulty);
    gameRunning = true;

    stopwatch = 0;
    levelTimes[currentLevelIndex] = 0;

    stopwatchInterval = setInterval(() => {
        stopwatch++;
        levelTimes[currentLevelIndex] = stopwatch;
        updateStopwatchDisplay();
    }, 1000);

    animate();
}