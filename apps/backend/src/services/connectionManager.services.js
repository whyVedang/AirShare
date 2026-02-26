const rooms=new Map()
const max_PEER=6 

export const joinRoom=async(roomID,peerID,ws)=>{
    const room=createRoom(roomID)

    if(room.peers.size()>max_PEER){
        ws.send(JSON.stringify({type:"room full"}))
        return 
    }

    const existingPeer=[...room.peers.keys()]

    room.peers.set(peerID,ws)

    ws.roomID = roomID
    ws.peerID = peerID

    ws.send(JSON.stringify({
        type: 'existing-peers',
        payload: existingPeers
    }))

    // Notify others
    broadcast(roomID, peerID, {
        type: 'new-peer',
        payload: peerID
    })
}

export const createRoom=async(roomID)=>{
    if(!rooms.has(roomID)){
        rooms.set(roomID,{
            id:roomID,
            peers:new Map()
        })
    }
    return rooms.get(roomID)
}


export const leaveRoom=async(roomID)=>{
    const room=getRoom(roomID)
    if(!room) return

    room.peers.delete(peerID)

    broadcast(roomID, peerID, {
        type: 'peer-disconnected',
        payload: peerID
    })

    if (room.peers.size === 0) {
        rooms.delete(roomID)
    }
}

export const getRoom=async(roomID)=>{
    const room =rooms.get(roomID)
    if (room) return room 
    else return 
}

export const broadcast=async(roomID,excludePeerID,message)=>{
    const room=getRoom(roomID)

    room.peers.forEach((ws,peerID) => {
        if(peerID !== excludePeerID && ws.readyState === 1) {
            ws.send(JSON.stringify(message))
        }
    });
}

export const relaySignal=(roomID, fromPeerID, targetPeerID, message) =>{
  const room = getRoom(roomID)

  const targetWs = room.peers.get(targetPeerID)
  if (!targetWs) return

  targetWs.send(JSON.stringify({
    ...message,
    from: fromPeerID
  }))
}