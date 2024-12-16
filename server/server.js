import { WebSocketServer } from 'ws';
import { networkInterfaces } from 'os';

// 获取本机所有 IP 地址
function getLocalIPs() {
    const nets = networkInterfaces();
    const results = [];

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // 跳过内部 IPv6 和非 IPv4 地址
            if (net.family === 'IPv4' && !net.internal) {
                results.push(net.address);
            }
        }
    }
    return results;
}

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

// 打印服务器信息
console.log('\n=== WebSocket 服务器已启动 ===');
console.log('本地地址:');
console.log(`  ws://localhost:${PORT}`);
console.log('\n可用的网络地址:');
getLocalIPs().forEach(ip => {
    console.log(`  ws://${ip}:${PORT}`);
});
console.log('\n等待客户端连接...\n');

// 存储房间信息
const rooms = new Map();
let clientIdCounter = 0; // 客户端 ID 计数器

// 生成随机房间号
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// 生成客户端 ID
function generateClientId() {
    clientIdCounter++;
    return `Client_${clientIdCounter}_${Date.now()}`;
}

// 处理 WebSocket 连接
wss.on('connection', (ws) => {
    // 为新连接的客户端分配 ID
    ws.clientId = generateClientId();
    console.log(`新客户端连接，ID: ${ws.clientId}`);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log(`收到来自 ${ws.clientId} 的消息:`, data);
            handleMessage(ws, data);
        } catch (error) {
            console.error(`处理 ${ws.clientId} 的消息时出错:`, error);
            ws.send(JSON.stringify({
                type: 'error',
                message: '无效的消息格式'
            }));
        }
    });

    ws.on('close', () => {
        console.log(`客户端 ${ws.clientId} 断开连接`);
        handleDisconnect(ws);
    });
});

// 处理消息
function handleMessage(ws, data) {
    console.log(`处理 ${ws.clientId} 的 ${data.type} 类型消息`);
    switch (data.type) {
        case 'create_room':
            handleCreateRoom(ws);
            break;
        case 'join_room':
            handleJoinRoom(ws, data.roomId);
            break;
        case 'move':
            handleMove(ws, data);
            break;
        case 'restart':
            handleRestart(ws, data);
            break;
        default:
            ws.send(JSON.stringify({
                type: 'error',
                message: '未知的消息类型'
            }));
    }
}

// 处理创建房间请求
function handleCreateRoom(ws) {
    const roomId = generateRoomId();
    rooms.set(roomId, {
        host: ws,
        guest: null,
        hostId: ws.clientId
    });
    ws.roomId = roomId;

    console.log(`客户端 ${ws.clientId} 创建了房间 ${roomId}`);
    ws.send(JSON.stringify({
        type: 'room_created',
        roomId: roomId
    }));
}

// 处理加入房间请求
function handleJoinRoom(ws, roomId) {
    const room = rooms.get(roomId);
    if (!room) {
        console.log(`客户端 ${ws.clientId} 尝试加入不存在的房间 ${roomId}`);
        ws.send(JSON.stringify({
            type: 'error',
            message: '房间不存在'
        }));
        return;
    }

    if (room.guest) {
        console.log(`客户端 ${ws.clientId} 尝试加入已满的房间 ${roomId}`);
        ws.send(JSON.stringify({
            type: 'error',
            message: '房间已满'
        }));
        return;
    }

    room.guest = ws;
    room.guestId = ws.clientId;
    ws.roomId = roomId;

    console.log(`客户端 ${ws.clientId} 加入了房间 ${roomId}`);
    console.log(`房间 ${roomId} 信息: 房主=${room.hostId}, 访客=${room.guestId}`);

    // 通知双方游戏开始
    room.host.send(JSON.stringify({ type: 'player_joined' }));
    room.guest.send(JSON.stringify({ type: 'player_joined' }));
}

// 处理移动请求
function handleMove(ws, data) {
    const room = rooms.get(data.roomId);
    if (!room) return;

    const opponent = room.host === ws ? room.guest : room.host;
    if (opponent) {
        console.log(`客户端 ${ws.clientId} 在房间 ${data.roomId} 移动到位置 ${data.cellIndex}`);
        opponent.send(JSON.stringify({
            type: 'move',
            cellIndex: data.cellIndex,
            roomId: data.roomId,
            currentPlayer: data.currentPlayer
        }));
    }
}

// 处理断开连接
function handleDisconnect(ws) {
    if (ws.roomId) {
        const room = rooms.get(ws.roomId);
        if (room) {
            console.log(`客户端 ${ws.clientId} 从房间 ${ws.roomId} 断开连接`);
            // 通知对手断开连接
            const opponent = room.host === ws ? room.guest : room.host;
            if (opponent) {
                opponent.send(JSON.stringify({
                    type: 'error',
                    message: '对手已断开连接'
                }));
            }
            // 删除房间
            rooms.delete(ws.roomId);
        }
    }
}

// 添加处理重新开始的函数
function handleRestart(ws, data) {
    const room = rooms.get(data.roomId);
    if (!room) return;

    const opponent = room.host === ws ? room.guest : room.host;
    if (opponent) {
        console.log(`客户端 ${ws.clientId} 在房间 ${data.roomId} 请求重新开始游戏`);
        opponent.send(JSON.stringify({
            type: 'restart'
        }));
    }
}

console.log('WebSocket 服务器已启动，监听端口 8080'); 