// WebSocket 连接管理
class NetworkGame {
    constructor() {
        this.ws = null;
        this.roomId = null;
        this.playerType = null;  // 'host' 或 'guest'
        this.isMyTurn = false;
        this.myMark = null;      // 添加标记 'X' 或 'O'
        this.gameStarted = false; // 添加游戏开始状态
        this.serverAddress = null;
    }

    // 添加服务器地址验证方法
    validateAddress(address) {
        // 检查基本格式
        if (!address) return { valid: false, message: '请输入服务器地址' };
        
        // 检查格式是否为 host:port
        const parts = address.split(':');
        if (parts.length !== 2) {
            return { valid: false, message: '地址格式应为: 主机:端口' };
        }
        
        // 检查端口是否为有效数字
        const port = parseInt(parts[1]);
        if (isNaN(port) || port < 1 || port > 65535) {
            return { valid: false, message: '端口号无效 (1-65535)' };
        }
        
        return { valid: true };
    }

    // 修改连接方法
    connect(address) {
        const validation = this.validateAddress(address);
        if (!validation.valid) {
            this.updateNetworkStatus(validation.message, 'error');
            return;
        }

        try {
            // 显示连接中状态
            this.updateNetworkStatus('正在连接...', 'connecting');
            document.getElementById('connectBtn').disabled = true;
            document.getElementById('connectBtn').innerHTML = `
                <div class="loading-spinner"></div>
                连接中...
            `;

            this.serverAddress = address;
            this.ws = new WebSocket(`ws://${address}`);

            // 设置连接超时
            const timeout = setTimeout(() => {
                if (this.ws.readyState !== WebSocket.OPEN) {
                    this.ws.close();
                    this.updateNetworkStatus('连接超时', 'error');
                    this.resetConnectButton();
                }
            }, 5000);

            this.ws.onopen = () => {
                clearTimeout(timeout);
                console.log('[WebSocket] 连接已建立');
                this.updateNetworkStatus(`已连接到 ${address}`, 'success');
                document.querySelector('.server-connect').style.display = 'none';
                document.querySelector('.room-operations').style.display = 'block';
                this.resetConnectButton();
                document.querySelector('.network-controls').classList.add('connected');
            };

            this.ws.onclose = () => {
                console.log('[WebSocket] 连接已关闭');
                this.updateNetworkStatus('与服务器断开连接', 'error');
                document.querySelector('.server-connect').style.display = 'flex';
                document.querySelector('.room-operations').style.display = 'none';
                this.resetConnectButton();
            };

            this.ws.onerror = (error) => {
                console.error('[WebSocket] 错误:', error);
                this.updateNetworkStatus('连接错误', 'error');
                this.resetConnectButton();
            };

            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                console.log('[WebSocket] 收到消息:', {
                    类型: message.type,
                    数据: message,
                    当前玩家: currentPlayer,
                    我的标记: this.myMark,
                    是否我的回合: this.isMyTurn
                });
                this.handleMessage(message);
            };
        } catch (error) {
            console.error('[WebSocket] 连接错误:', error);
            this.updateNetworkStatus('连接地址无效', 'error');
            this.resetConnectButton();
        }
    }

    // 重置连接按钮
    resetConnectButton() {
        const connectBtn = document.getElementById('connectBtn');
        connectBtn.disabled = false;
        connectBtn.innerHTML = `
            <i class="fas fa-plug"></i>
            连接服务器
        `;
    }

    // 创建房间
    createRoom() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.playerType = 'host';
            this.ws.send(JSON.stringify({
                type: 'create_room'
            }));
        }
    }

    // 加入房间
    joinRoom(roomId) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // 检查是否是自己创建的房间
            if (roomId === this.roomId) {
                this.updateNetworkStatus('不能加入自己创建的房间', 'error');
                return;
            }
            this.playerType = 'guest';
            this.roomId = roomId;
            this.ws.send(JSON.stringify({
                type: 'join_room',
                roomId: roomId
            }));
        }
    }

    // 发送移动信息
    sendMove(cellIndex) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isMyTurn) {
            const message = {
                type: 'move',
                roomId: this.roomId,
                cellIndex: cellIndex,
                currentPlayer: currentPlayer,
                moveData: {
                    turnCount: turnCount,
                    remainingPieces: remainingPieces,
                    boardState: gameBoard.slice()
                }
            };

            console.log('[WebSocket] 发送移动命令:', {
                移动类型: 'move',
                房间ID: this.roomId,
                移动位置: cellIndex,
                当前玩家: currentPlayer,
                玩家标记: this.myMark,
                回合数: turnCount,
                剩余棋子: remainingPieces,
                棋盘状态: gameBoard.slice(),
                移动历史: moveHistory
            });

            this.ws.send(JSON.stringify(message));
        } else {
            console.error('[WebSocket] 无法发送移动:', {
                连接状态: this.ws ? this.ws.readyState : 'no connection',
                是否我的回合: this.isMyTurn,
                房间ID: this.roomId,
                当前玩家: currentPlayer,
                玩家标记: this.myMark
            });
        }
    }

    // 处理接收到的消息
    handleMessage(message) {
        switch (message.type) {
            case 'room_created':
                console.log('[WebSocket] 处理房间创建:', {
                    房间ID: message.roomId,
                    玩家类型: this.playerType
                });
                this.roomId = message.roomId;
                this.myMark = 'X';  // 房主是 X
                this.updateNetworkStatus(`房间已创建，等待对手加入...\n房间号: ${this.roomId}`, 'waiting');
                // 禁用加入房间功能
                document.getElementById('joinRoomBtn').disabled = true;
                document.getElementById('roomIdInput').disabled = true;
                document.getElementById('createRoomBtn').disabled = true;
                break;

            case 'player_joined':
                console.log('[WebSocket] 处理玩家加入:', {
                    玩家类型: this.playerType,
                    我的标记: this.myMark
                });
                if (this.playerType === 'guest') {
                    this.myMark = 'O';  // 加入者是 O
                    this.isMyTurn = false;
                }
                this.updateNetworkStatus('对手已加入房间，游戏开始！', 'success');
                this.gameStarted = true;
                startNetworkGame(this.myMark);
                break;

            case 'move':
                console.log('[WebSocket] 处理移动:', {
                    移动位置: message.cellIndex,
                    当前玩家: message.currentPlayer,
                    游戏状态: {
                        棋盘: gameBoard,
                        回合数: turnCount,
                        剩余棋子: remainingPieces
                    }
                });
                if (this.ws && gameBoard[message.cellIndex] === '') {
                    const cell = document.querySelector(`[data-index="${message.cellIndex}"]`);
                    if (cell) {
                        // 更新游戏状态
                        gameBoard[message.cellIndex] = message.currentPlayer;
                        cell.textContent = message.currentPlayer;
                        cell.classList.add(message.currentPlayer.toLowerCase());
                        remainingPieces[message.currentPlayer]--;
                        moveHistory.push({player: message.currentPlayer, index: message.cellIndex});
                        turnCount++;

                        // 检查获胜
                        if (checkWin()) {
                            const winningCells = Array.from(document.querySelectorAll('.cell.win'))
                                .map(cell => parseInt(cell.getAttribute('data-index')) + 1)
                                .join(', ');
                            const playerSpan = `<span class="current-player ${message.currentPlayer.toLowerCase()}">${message.currentPlayer}</span>`;
                            statusDisplay.innerHTML = `玩家 ${playerSpan} 获胜！(位置 ${winningCells})`;
                            statusDisplay.classList.add('winner');
                            gameActive = false;
                            return;
                        }

                        // 三回合后移除最早的棋子
                        if (turnCount > 6) {
                            const oldestMove = moveHistory.shift();
                            if (oldestMove) {
                                const oldCell = document.querySelector(`[data-index="${oldestMove.index}"]`);
                                gameBoard[oldestMove.index] = '';
                                oldCell.textContent = '';
                                oldCell.classList.remove('x', 'o');
                                remainingPieces[oldestMove.player]++;
                            }
                        }

                        // 切换玩家并更新状态
                        currentPlayer = message.currentPlayer === 'X' ? 'O' : 'X';
                        this.isMyTurn = true;
                        updateStatus();
                        updateHoverState();
                    }
                }
                break;

            case 'error':
                console.error('[WebSocket] 错误消息:', message.message);
                this.updateNetworkStatus('错误: ' + message.message, 'error');
                break;
        }
    }

    // 更新网络状态显示
    updateNetworkStatus(status, type = 'info') {
        const networkStatus = document.getElementById('networkStatus');
        const statusDot = document.querySelector('.status-dot');
        if (networkStatus && statusDot) {
            networkStatus.textContent = status;
            
            // 移除所有状态类
            statusDot.classList.remove('connected', 'disconnected', 'waiting', 'error');
            
            // 根据状态类型添加对应的类
            switch (type) {
                case 'success':
                    statusDot.classList.add('connected');
                    break;
                case 'error':
                    statusDot.classList.add('error');
                    break;
                case 'waiting':
                    statusDot.classList.add('waiting');
                    break;
                default:
                    statusDot.classList.add('disconnected');
            }
        }
    }
}

// 创建网络游戏实例
const networkGame = new NetworkGame();

// 修改 HTML 以添加网络对战相关的 UI
function createNetworkUI() {
    const networkControls = document.createElement('div');
    networkControls.className = 'network-controls';
    networkControls.innerHTML = `
        <div class="network-header">
            <h3>联机对战</h3>
            <div class="connection-status">
                <span class="status-dot"></span>
                <span id="networkStatus">未连接</span>
            </div>
        </div>
        <div class="server-connect">
            <div class="input-group">
                <i class="fas fa-server"></i>
                <input type="text" id="serverAddress" placeholder="输入服务器地址 (例如: localhost:8080)">
            </div>
            <button id="connectBtn" class="network-btn">
                <i class="fas fa-plug"></i>
                连接服务器
            </button>
        </div>
        <div class="room-operations" style="display: none;">
            <div class="network-actions">
                <button id="createRoomBtn" class="network-btn">
                    <i class="fas fa-plus-circle"></i>
                    创建房间
                </button>
                <div class="join-room">
                    <div class="input-group">
                        <i class="fas fa-door-open"></i>
                        <input type="text" id="roomIdInput" placeholder="输入房间号">
                    </div>
                    <button id="joinRoomBtn" class="network-btn">
                        <i class="fas fa-sign-in-alt"></i>
                        加入房间
                    </button>
                </div>
            </div>
        </div>
        <div id="roomInfo" class="room-info" style="display: none;">
            <div class="room-status"></div>
        </div>
    `;

    // 将网络控制UI添加到选择视图中
    const selectView = document.getElementById('selectView');
    selectView.appendChild(networkControls);

    // 添加连接服务器事件监听
    document.getElementById('connectBtn').addEventListener('click', () => {
        const addressInput = document.getElementById('serverAddress');
        const address = addressInput.value.trim();
        const inputGroup = addressInput.parentElement;
        
        // 移除之前的验证样式
        addressInput.classList.remove('invalid');
        inputGroup.classList.remove('invalid');
        
        if (!address) {
            addressInput.classList.add('invalid');
            inputGroup.classList.add('invalid');
            networkGame.updateNetworkStatus('请输入服务器地址', 'error');
            return;
        }
        
        networkGame.connect(address);
    });

    // 添加创建房间事件监听
    document.getElementById('createRoomBtn').addEventListener('click', () => {
        networkGame.createRoom();
    });

    // 添加加入房间事件监听
    document.getElementById('joinRoomBtn').addEventListener('click', () => {
        const roomId = document.getElementById('roomIdInput').value;
        if (roomId) {
            networkGame.joinRoom(roomId);
        } else {
            networkGame.updateNetworkStatus('请输入房间号', 'error');
        }
    });
}

// 开始网络对战游戏
function startNetworkGame(playerMark) {
    currentPlayer = 'X'; // 游戏总是从 X 开始
    gameActive = true;
    isNetworkGame = true;
    networkGame.isMyTurn = playerMark === 'X';
    
    // 显示游戏视图
    showGameView();
    restartGame();
    
    // 更新状态显示
    updateStatus();
    if (playerMark === 'O') {
        statusDisplay.innerHTML += ' (等待对手移动...)';
    }
}

// 处理对手的移动
function handleOpponentMove(cellIndex) {
    const cell = document.querySelector(`[data-index="${cellIndex}"]`);
    if (cell && gameBoard[cellIndex] === '') {
        networkGame.isMyTurn = false;
        originalHandleCellClick({ target: cell });
        networkGame.isMyTurn = true;
        updateStatus();
    }
}

// 修改原有的 handleCellClick 函数
const originalHandleCellClick = handleCellClick;
handleCellClick = function(e) {
    if (!gameActive) return;
    
    if (isNetworkGame) {
        if (!networkGame.isMyTurn) {
            return; // 不是自己的回合
        }
        if (currentPlayer !== networkGame.myMark) {
            return; // 不是自己的标记
        }
    }

    const cellIndex = parseInt(e.target.getAttribute('data-index'));
    
    if (gameBoard[cellIndex] !== '' || !gameActive) return;
    
    if (remainingPieces[currentPlayer] <= 0) {
        statusDisplay.textContent = `${currentPlayer} 没有剩余棋子了！`;
        return;
    }

    if (isNetworkGame) {
        console.log('[WebSocket] 尝试移动:', {
            位置: cellIndex,
            当前玩家: currentPlayer,
            是否我的回合: networkGame.isMyTurn,
            玩家标记: networkGame.myMark
        });
        
        // 先发送移动消息到服务器
        networkGame.sendMove(cellIndex);
        
        // 本地更新
        gameBoard[cellIndex] = currentPlayer;
        e.target.textContent = currentPlayer;
        e.target.classList.add(currentPlayer.toLowerCase());
        remainingPieces[currentPlayer]--;
        moveHistory.push({player: currentPlayer, index: cellIndex});
        turnCount++;

        // 检查获胜
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

        // 三回合后移除最早的棋子
        if (turnCount > 6) {
            const oldestMove = moveHistory.shift();
            if (oldestMove) {
                const oldCell = document.querySelector(`[data-index="${oldestMove.index}"]`);
                gameBoard[oldestMove.index] = '';
                oldCell.textContent = '';
                oldCell.classList.remove('x', 'o');
                remainingPieces[oldestMove.player]++;
            }
        }

        // 切换玩家
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        networkGame.isMyTurn = false;
        updateStatus();
        updateHoverState();
    } else {
        originalHandleCellClick(e);
    }
};

// 初始化网络功能
document.addEventListener('DOMContentLoaded', () => {
    createNetworkUI();
    networkGame.init();
});

// 添加 CSS 样式
const style = document.createElement('style');
style.textContent = `
.room-info {
    margin-top: 15px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 10px;
}

.room-status {
    font-size: 1.1em;
    margin-bottom: 10px;
    color: #2c3e50;
}

.waiting {
    color: #f39c12;
    animation: pulse 1s infinite;
}

@keyframes pulse {
    0% { opacity: 0.6; }
    50% { opacity: 1; }
    100% { opacity: 0.6; }
}

.server-connect {
    margin-bottom: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.room-operations {
    border-top: 1px solid #eee;
    padding-top: 20px;
    margin-top: 20px;
}

#serverAddress {
    width: 100%;
}
`;
document.head.appendChild(style); 

// 添加新的样式
const additionalStyle = document.createElement('style');
additionalStyle.textContent = `
/* 连接按钮状态 */
#connectBtn:disabled {
    opacity: 0.7;
    cursor: wait;
}

/* 加载动画 */
.loading-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    margin-right: 8px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* 状态点动画 */
.status-dot.connecting {
    background-color: #f1c40f;
    animation: blink 1s infinite;
}

@keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
}

/* 连接成功动画 */
.network-controls {
    transition: all 0.3s ease;
}

.network-controls.connected {
    animation: connectSuccess 0.5s ease;
}

@keyframes connectSuccess {
    0% { transform: scale(1); }
    50% { transform: scale(1.02); }
    100% { transform: scale(1); }
}

/* 输入框验证样式 */
#serverAddress.invalid {
    border-color: #e74c3c;
    animation: shake 0.5s ease-in-out;
}

.input-group.invalid {
    border-color: #e74c3c;
    box-shadow: 0 0 0 2px rgba(231, 76, 60, 0.2);
}

@keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
}

/* 禁用状态样式 */
.input-group input:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
    opacity: 0.7;
}

.network-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    background-color: #95a5a6;
}

.network-btn:disabled:hover {
    transform: none;
    background-color: #95a5a6;
}
`;
document.head.appendChild(additionalStyle); 