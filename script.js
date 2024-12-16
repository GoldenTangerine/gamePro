// 游戏状态变量
let currentPlayer = 'X';                 // 当前玩家
let gameBoard = ['', '', '', '', '', '', '', '', '']; // 棋盘状态
let gameActive = true;                   // 游戏是否进行中
let remainingPieces = {                  // 每个玩家剩余的棋子数
    'X': 4,
    'O': 4
};
let moveHistory = [];                    // 记录移动历史
let turnCount = 0;                       // 回合计数
let isAIMode = false;                    // 是否为AI模式
let isNetworkGame = false;              // 是否为网络对战模式

// 获胜组合的所有可能情况
const winningCombinations = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],    // 横向
    [0, 3, 6], [1, 4, 7], [2, 5, 8],    // 纵向
    [0, 4, 8], [2, 4, 6]                // 对角线
];

// DOM 元素
const statusDisplay = document.getElementById('status');
const cells = document.querySelectorAll('.cell');
const restartButton = document.getElementById('restart');
const pvpButton = document.getElementById('pvp');
const pveButton = document.getElementById('pve');
const selectView = document.getElementById('selectView');
const gameView = document.getElementById('gameView');
const backButton = document.getElementById('backToSelect');

// 更新悬停状态，显示当前玩家的标记
function updateHoverState() {
    cells.forEach(cell => {
        cell.classList.remove('x-turn', 'o-turn');
        if (cell.textContent === '') {
            cell.classList.add(currentPlayer.toLowerCase() + '-turn');
        }
    });
}

// 处理格子点击事件
function handleCellClick(e) {
    const clickedCell = e.target;
    const cellIndex = parseInt(clickedCell.getAttribute('data-index'));

    // 检查是否可以在此格子落子
    if (gameBoard[cellIndex] !== '' || !gameActive) return;

    // 检查玩家是否还有剩余棋子
    if (remainingPieces[currentPlayer] <= 0) {
        statusDisplay.textContent = `${currentPlayer} 没有剩余棋子了！`;
        return;
    }

    // 如果是网络对战模式，发送移动消息
    if (isNetworkGame) {
        if (!networkGame.isMyTurn) {
            return; // 不是自己的回合
        }
        if (currentPlayer !== networkGame.myMark) {
            return; // 不是自己的标记
        }
        networkGame.sendMove(cellIndex);
    }

    // 放置棋子
    gameBoard[cellIndex] = currentPlayer;
    clickedCell.textContent = currentPlayer;
    clickedCell.classList.add(currentPlayer.toLowerCase());
    remainingPieces[currentPlayer]--;
    moveHistory.push({player: currentPlayer, index: cellIndex});
    turnCount++;

    // 检查是否获胜
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

    // 三回合后移除最早放置的棋子
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

    // 切换玩家
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    
    // 如果是网络对战模式，更新回合状态
    if (isNetworkGame) {
        networkGame.isMyTurn = false;
    }
    
    updateStatus();
    updateHoverState();

    // 如果是AI模式且轮到AI
    if (isAIMode && currentPlayer === 'O') {
        makeAIMove();
    }
}

// 检查是否获胜
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

// 重新开始游戏
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

// 更新游戏状态显示
function updateStatus() {
    if (gameActive && !document.querySelector('.winner')) {
        const playerSpan = `<span class="current-player ${currentPlayer.toLowerCase()}">${currentPlayer}</span>`;
        statusDisplay.innerHTML = `当前玩家: ${playerSpan} (剩余棋子: X-${remainingPieces['X']}, O-${remainingPieces['O']})`;
    }
}

// AI移动逻辑
function makeAIMove() {
    if (!gameActive || currentPlayer === 'X') return;

    setTimeout(() => {
        // 1. 检查获胜机会
        const winMove = findWinningMove();
        if (winMove !== -1) {
            handleCellClick({ target: document.querySelector(`[data-index="${winMove}"]`) });
            return;
        }

        // 2. 检查阻止对手获胜
        const blockMove = findBlockingMove();
        if (blockMove !== -1) {
            handleCellClick({ target: document.querySelector(`[data-index="${blockMove}"]`) });
            return;
        }

        // 3. 选择中心位置
        if (gameBoard[4] === '' && remainingPieces['O'] > 0) {
            handleCellClick({ target: document.querySelector('[data-index="4"]') });
            return;
        }

        // 4. 随机选择可用位置
        const availableMoves = gameBoard
            .map((cell, index) => cell === '' ? index : -1)
            .filter(index => index !== -1);

        if (availableMoves.length > 0 && remainingPieces['O'] > 0) {
            const randomIndex = availableMoves[Math.floor(Math.random() * availableMoves.length)];
            handleCellClick({ target: document.querySelector(`[data-index="${randomIndex}"]`) });
        }
    }, 500);
}

// 查找AI获胜移动
function findWinningMove() {
    return findStrategicMove('O');
}

// 查找阻止玩家获胜的移动
function findBlockingMove() {
    return findStrategicMove('X');
}

// 查找战略移动位置
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

// 切换游戏模式
function switchMode(mode) {
    isAIMode = mode === 'ai';
    pvpButton.classList.toggle('active', !isAIMode);
    pveButton.classList.toggle('active', isAIMode);
    showGameView();
}

// 显示游戏视图
function showGameView() {
    selectView.classList.add('hidden');
    gameView.classList.remove('hidden');
    restartGame();
}

// 显示选择视图
function showSelectView() {
    gameView.classList.add('hidden');
    selectView.classList.remove('hidden');
    isNetworkGame = false;  // 重置网络游戏状态
}

// 事件监听器
cells.forEach(cell => cell.addEventListener('click', handleCellClick));
restartButton.addEventListener('click', restartGame);
pvpButton.addEventListener('click', () => switchMode('pvp'));
pveButton.addEventListener('click', () => switchMode('ai'));
backButton.addEventListener('click', showSelectView);

// 初始化游戏
showSelectView();