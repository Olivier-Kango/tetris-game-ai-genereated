const BLOCK_SIZE = 30;
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

const canvas = document.getElementById('game-board');
const ctx = canvas.getContext('2d');
const previewCanvas = document.getElementById('next-piece-preview');
const previewCtx = previewCanvas.getContext('2d');

const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const linesElement = document.getElementById('lines');
const gameOverScreen = document.querySelector('.game-over');
const finalScoreElement = document.getElementById('final-score');

let board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0));
let score = 0;
let lines = 0;
let level = 1;
let gameLoop;
let currentPiece;
let nextPiece;
let dropInterval = 1000;
let lastDrop = 0;
let isPaused = false;

const PIECES = [
    {
        shape: [[1, 1, 1, 1]],  // I
        color: '#00f0f0'
    },
    {
        shape: [[1, 1, 1], [0, 1, 0]],  // T
        color: '#a000f0'
    },
    {
        shape: [[1, 1], [1, 1]],  // O
        color: '#f0f000'
    },
    {
        shape: [[1, 1, 0], [0, 1, 1]],  // Z
        color: '#f00000'
    },
    {
        shape: [[0, 1, 1], [1, 1, 0]],  // S
        color: '#00f000'
    },
    {
        shape: [[1, 1, 1], [1, 0, 0]],  // L
        color: '#f0a000'
    },
    {
        shape: [[1, 1, 1], [0, 0, 1]],  // J
        color: '#0000f0'
    }
];

class Piece {
    constructor(piece = null) {
        const randomPiece = piece || PIECES[Math.floor(Math.random() * PIECES.length)];
        this.shape = JSON.parse(JSON.stringify(randomPiece.shape));
        this.color = randomPiece.color;
        this.x = Math.floor((BOARD_WIDTH - this.shape[0].length) / 2);
        this.y = 0;
    }

    rotate() {
        const newShape = Array(this.shape[0].length).fill()
            .map(() => Array(this.shape.length).fill(0));
        
        for (let y = 0; y < this.shape.length; y++) {
            for (let x = 0; x < this.shape[0].length; x++) {
                newShape[x][this.shape.length - 1 - y] = this.shape[y][x];
            }
        }

        const originalShape = this.shape;
        this.shape = newShape;

        if (this.collision()) {
            this.shape = originalShape;
        }
    }

    collision() {
        for (let y = 0; y < this.shape.length; y++) {
            for (let x = 0; x < this.shape[y].length; x++) {
                if (this.shape[y][x]) {
                    const boardX = this.x + x;
                    const boardY = this.y + y;

                    if (boardX < 0 || boardX >= BOARD_WIDTH ||
                        boardY >= BOARD_HEIGHT ||
                        (boardY >= 0 && board[boardY][boardX])) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    merge() {
        for (let y = 0; y < this.shape.length; y++) {
            for (let x = 0; x < this.shape[y].length; x++) {
                if (this.shape[y][x]) {
                    if (this.y + y >= 0) {
                        board[this.y + y][this.x + x] = this.color;
                    }
                }
            }
        }
    }
}

function clearLines() {
    let linesCleared = 0;
    
    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
        if (board[y].every(cell => cell !== 0)) {
            board.splice(y, 1);
            board.unshift(Array(BOARD_WIDTH).fill(0));
            linesCleared++;
            y++;
        }
    }

    if (linesCleared > 0) {
        lines += linesCleared;
        score += [0, 100, 300, 500, 800][linesCleared] * level;
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(100, 1000 - (level - 1) * 100);
        
        scoreElement.textContent = score;
        levelElement.textContent = level;
        linesElement.textContent = lines;
    }
}

function draw() {
    // Clear board
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw board
    for (let y = 0; y < BOARD_HEIGHT; y++) {
        for (let x = 0; x < BOARD_WIDTH; x++) {
            if (board[y][x]) {
                ctx.fillStyle = board[y][x];
                ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
            }
        }
    }

    // Draw current piece
    if (currentPiece) {
        ctx.fillStyle = currentPiece.color;
        for (let y = 0; y < currentPiece.shape.length; y++) {
            for (let x = 0; x < currentPiece.shape[y].length; x++) {
                if (currentPiece.shape[y][x]) {
                    ctx.fillRect(
                        (currentPiece.x + x) * BLOCK_SIZE,
                        (currentPiece.y + y) * BLOCK_SIZE,
                        BLOCK_SIZE - 1,
                        BLOCK_SIZE - 1
                    );
                }
            }
        }
    }

    // Draw next piece preview
    previewCtx.fillStyle = '#222';
    previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    
    if (nextPiece) {
        previewCtx.fillStyle = nextPiece.color;
        const offsetX = (previewCanvas.width - nextPiece.shape[0].length * BLOCK_SIZE) / 2;
        const offsetY = (previewCanvas.height - nextPiece.shape.length * BLOCK_SIZE) / 2;
        
        for (let y = 0; y < nextPiece.shape.length; y++) {
            for (let x = 0; x < nextPiece.shape[y].length; x++) {
                if (nextPiece.shape[y][x]) {
                    previewCtx.fillRect(
                        offsetX + x * BLOCK_SIZE,
                        offsetY + y * BLOCK_SIZE,
                        BLOCK_SIZE - 1,
                        BLOCK_SIZE - 1
                    );
                }
            }
        }
    }
}

function update(timestamp) {
    if (!isPaused) {
        if (timestamp - lastDrop > dropInterval) {
            currentPiece.y++;
            
            if (currentPiece.collision()) {
                currentPiece.y--;
                currentPiece.merge();
                clearLines();
                
                currentPiece = nextPiece;
                nextPiece = new Piece();
                
                if (currentPiece.collision()) {
                    gameOver();
                    return;
                }
            }
            
            lastDrop = timestamp;
        }
    }
    
    draw();
    gameLoop = requestAnimationFrame(update);
}

function gameOver() {
    cancelAnimationFrame(gameLoop);
    gameOverScreen.style.display = 'block';
    finalScoreElement.textContent = score;
}

function startGame() {
    // Reset game state
    board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0));
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    isPaused = false;
    
    // Reset UI
    scoreElement.textContent = '0';
    levelElement.textContent = '1';
    linesElement.textContent = '0';
    gameOverScreen.style.display = 'none';
    
    // Create initial pieces
    currentPiece = new Piece();
    nextPiece = new Piece();
    
    // Start game loop
    lastDrop = performance.now();
    gameLoop = requestAnimationFrame(update);
}

document.addEventListener('keydown', event => {
    if (!currentPiece || isPaused) return;

    switch (event.code) {
        case 'ArrowLeft':
            currentPiece.x--;
            if (currentPiece.collision()) {
                currentPiece.x++;
            }
            break;
        case 'ArrowRight':
            currentPiece.x++;
            if (currentPiece.collision()) {
                currentPiece.x--;
            }
            break;
        case 'ArrowDown':
            currentPiece.y++;
            if (currentPiece.collision()) {
                currentPiece.y--;
                currentPiece.merge();
                clearLines();
                currentPiece = nextPiece;
                nextPiece = new Piece();
                
                if (currentPiece.collision()) {
                    gameOver();
                }
            }
            lastDrop = performance.now();
            break;
        case 'ArrowUp':
            currentPiece.rotate();
            break;
        case 'Space':
            while (!currentPiece.collision()) {
                currentPiece.y++;
            }
            currentPiece.y--;
            currentPiece.merge();
            clearLines();
            currentPiece = nextPiece;
            nextPiece = new Piece();
            
            if (currentPiece.collision()) {
                gameOver();
            }
            break;
        case 'KeyP':
            isPaused = !isPaused;
            break;
    }
});

// Start the game
startGame();