// Get the game-container element
const gameContainer = document.getElementById('game-container');

// Create a canvas element dynamically
const canvas = document.createElement('canvas');
canvas.style.position = 'absolute'; // Align canvas to the container
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.zIndex = '1'; // Ensure it overlays the game-container
gameContainer.appendChild(canvas);

const ctx = canvas.getContext('2d');

// Set canvas size to match the game-container
canvas.width = 566; // 80vmin based on viewport width
canvas.height = 566; // 80vmin (assuming square container)

let objects = [];
let uniqueObject = null;
let gameRunning = false;

const difficulties = {
    easy: { objectCount: 80, objectSize: 50 },
    medium: { objectCount: 185, objectSize: 40 },
    hard: { objectCount: 200, objectSize: 37 },
    insane: { objectCount: 400, objectSize: 30 }
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
}

// Set difficulty and start game
function setDifficulty(selectedDifficulty) {
    gameRunning = true;
    document.getElementById('difficulty-selection').style.display = 'none';
    gameContainer.style.display = 'block';

    initializeGame(selectedDifficulty);
    animate();
}

canvas.addEventListener('click', (event) => {
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
                alert('You found the unique object!');
                gameRunning = false;
            }
        }
    });
});