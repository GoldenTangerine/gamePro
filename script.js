let currentPlayer = 'X';
let gameBoard = ['', '', '', '', '', '', '', '', ''];
let gameActive = true;
let remainingPieces = {
    'X': 4,
    'O': 4
};
let moveHistory = [];
let turnCount = 0;
let isAIMode = false;

const winningCombinations = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // 横向
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // 纵向
    [0, 4, 8], [2, 4, 6]             // 对角线
];

const statusDisplay = document.getElementById('status');
const cells = document.querySelectorAll('.cell');
const restartButton = document.getElementById('restart');
const pvpButton = document.getElementById('pvp');
const pveButton = document.getElementById('pve');
const selectView = document.getElementById('selectView');
const gameView = document.getElementById('gameView');
const backButton = document.getElementById('backToSelect');

function updateHoverState() {
    cells.forEach(cell => {
        cell.classList.remove('x-turn', 'o-turn');
        if (cell.textContent === '') {
            cell.classList.add(currentPlayer.toLowerCase() + '-turn');
        }
    });
}

function handleCellClick(e) {
    const clickedCell = e.target;
    const cellIndex = parseInt(clickedCell.getAttribute('data-index'));

    if (gameBoard[cellIndex] !== '' || !gameActive) return;

    if (remainingPieces[currentPlayer] <= 0) {
        statusDisplay.textContent = `${currentPlayer} 没有剩余棋子了！`;
        return;
    }

    gameBoard[cellIndex] = currentPlayer;
    clickedCell.textContent = currentPlayer;
    clickedCell.classList.add(currentPlayer.toLowerCase());
    remainingPieces[currentPlayer]--;
    moveHistory.push({player: currentPlayer, index: cellIndex});
    turnCount++;

    if (checkWin()) {
        const winningCells = Array.from(document.querySelectorAll('.cell.win'))
            .map(cell => parseInt(cell.getAttribute('data-index')) + 1)
            .join(', ');
        const playerSpan = `<span class="current-player ${currentPlayer.toLowerCase()}">${currentPlayer}</span>`;
        statusDisplay.innerHTML = `玩家 ${playerSpan} 获胜！(位置 ${winningCells})`;
        statusDisplay.classList.add('winner');
        gameActive = false;
        return;
    }

    if (turnCount > 6) {
        const oldestMove = moveHistory.shift();
        if (oldestMove) {
            const cell = document.querySelector(`[data-index="${oldestMove.index}"]`);
            gameBoard[oldestMove.index] = '';
            cell.textContent = '';
            cell.classList.remove('x', 'o');
            remainingPieces[oldestMove.player]++;
        }
    }

    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    updateStatus();
    updateHoverState();

    if (isAIMode && currentPlayer === 'O') {
        makeAIMove();
    }
}

function checkWin() {
    for (let combination of winningCombinations) {
        if (combination.every(index => gameBoard[index] === currentPlayer)) {
            combination.forEach(index => {
                const cell = document.querySelector(`[data-index="${index}"]`);
                cell.classList.add('win');
            });
            return true;
        }
    }
    return false;
}

function restartGame() {
    currentPlayer = 'X';
    gameBoard = ['', '', '', '', '', '', '', '', ''];
    gameActive = true;
    remainingPieces = {'X': 4, 'O': 4};
    moveHistory = [];
    turnCount = 0;
    statusDisplay.classList.remove('winner', 'draw');
    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('x', 'o', 'x-turn', 'o-turn', 'win');
    });
    updateStatus();
    updateHoverState();
}

cells.forEach(cell => cell.addEventListener('click', handleCellClick));
restartButton.addEventListener('click', restartGame); 

// 初始化悬停状态
updateHoverState();

function updateStatus() {
    if (gameActive && !document.querySelector('.winner')) {
        const playerSpan = `<span class="current-player ${currentPlayer.toLowerCase()}">${currentPlayer}</span>`;
        statusDisplay.innerHTML = `当前玩家: ${playerSpan} (剩余棋子: X-${remainingPieces['X']}, O-${remainingPieces['O']})`;
    }
}

function makeAIMove() {
    if (!gameActive || currentPlayer === 'X') return;

    setTimeout(() => {
        const winMove = findWinningMove();
        if (winMove !== -1) {
            handleCellClick({ target: document.querySelector(`[data-index="${winMove}"]`) });
            return;
        }

        const blockMove = findBlockingMove();
        if (blockMove !== -1) {
            handleCellClick({ target: document.querySelector(`[data-index="${blockMove}"]`) });
            return;
        }

        if (gameBoard[4] === '' && remainingPieces['O'] > 0) {
            handleCellClick({ target: document.querySelector('[data-index="4"]') });
            return;
        }

        const availableMoves = gameBoard
            .map((cell, index) => cell === '' ? index : -1)
            .filter(index => index !== -1);

        if (availableMoves.length > 0 && remainingPieces['O'] > 0) {
            const randomIndex = availableMoves[Math.floor(Math.random() * availableMoves.length)];
            handleCellClick({ target: document.querySelector(`[data-index="${randomIndex}"]`) });
        }
    }, 500);
}

function findWinningMove() {
    return findStrategicMove('O');
}

function findBlockingMove() {
    return findStrategicMove('X');
}

function findStrategicMove(player) {
    for (let combination of winningCombinations) {
        const cells = combination.map(index => ({ value: gameBoard[index], index }));
        const playerCells = cells.filter(cell => cell.value === player);
        const emptyCells = cells.filter(cell => cell.value === '');
        
        if (playerCells.length === 2 && emptyCells.length === 1) {
            return emptyCells[0].index;
        }
    }
    return -1;
}

function switchMode(mode) {
    isAIMode = mode === 'ai';
    pvpButton.classList.toggle('active', !isAIMode);
    pveButton.classList.toggle('active', isAIMode);
    showGameView();
}

pvpButton.addEventListener('click', () => switchMode('pvp'));
pveButton.addEventListener('click', () => switchMode('ai'));

// 初始化游戏状态
updateStatus();
updateHoverState();

// 初始化游戏
restartGame();

function showGameView() {
    selectView.classList.add('hidden');
    gameView.classList.remove('hidden');
    restartGame();
}

function showSelectView() {
    gameView.classList.add('hidden');
    selectView.classList.remove('hidden');
}

// 添加返回按钮事件监听
backButton.addEventListener('click', showSelectView);

// 初始化时显示选择页面
showSelectView();