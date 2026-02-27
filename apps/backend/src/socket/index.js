import WebSocket from 'ws';

export const WebSocketINIT=(server)=>{

    
    const wss = new WebSocket.Server({ server })
    
    wss.on('connection', (ws) => {
        
        ws.on('message', (raw) => {
            try {
                const data = JSON.parse(raw)
                handleMessage(ws, data)
            } catch (err) {
                console.error('Invalid JSON')
            }
        })
        
        ws.on('close', () => {
            if (ws.roomId && ws.peerId) {
                const { leaveRoom } = require('../services/connectionManager.services')
                leaveRoom(ws.roomId, ws.peerId)
            }
        })
    })
}  