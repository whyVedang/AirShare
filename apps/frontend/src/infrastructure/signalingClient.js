class SignalingClient {
  constructor(serverUrl = 'ws://localhost:3000') {
    this.serverUrl = serverUrl;
    this.socket = null;
    this.isConnected = false;
    this.roomId = null;
    this.peerId = null;
    this.handlers = {
      onRoomJoined: null,
      onPeerJoined: null,
      onOffer: null,
      onAnswer: null,
      onIceCandidate: null,
      onPeerLeft: null,
      onError: null
    };
  }
  connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnected) return resolve();

      this.socket = new WebSocket(this.serverUrl);

      this.socket.onopen = () => {
        this.isConnected = true;

        this.peerId = crypto.randomUUID();

        console.log('[WS] Connected:', this.peerId);
        resolve();
      };

      this.socket.onerror = (error) => {
        console.error('[WS] Error:', error);
        this._triggerHandler('onError', error);
        reject(error);
      };

      this.socket.onclose = () => {
        console.log('[WS] Disconnected');
        this.isConnected = false;
        this.socket = null;
      }

      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this._handleMessage(data);
      };
    })
  }
  _handleMessage(data) {
    const { type, payload } = data;

    switch (type) {
      case 'existing-peers':
        this._triggerHandler('onRoomJoined', payload);
        break;

      case 'new-peer':
        this._triggerHandler('onPeerJoined', payload);
        break;

      case 'peer-disconnected':
        this._triggerHandler('onPeerLeft', payload);
        break;

      case 'offer':
        this._triggerHandler('onOffer', payload);
        break;

      case 'answer':
        this._triggerHandler('onAnswer', payload);
        break;

      case 'ice-candidate':
        this._triggerHandler('onIceCandidate', payload);
        break;

      default:
        console.warn('[WS] Unknown message:', type);
    }
  }

  _send(type, payload) {
    if (!this.isConnected) {
      throw new Error('Not connected');
    }
    const message = { type, payload };
    this.socket.send(JSON.stringify(message));
  }


  joinRoom(roomID) {
    this.roomId = roomID;
    this._send('join-room', {
      roomID,
      peerID: this.peerId
    });
  }


  sendOffer(targetPeerID, offer) {
    this._send('offer', {
      roomID: this.roomId,
      targetPeerID,
      sdp: offer
    });
  }

  sendAnswer(targetPeerID, answer) {
    this._send('answer', {
      roomID: this.roomId,
      targetPeerID,
      sdp: answer
    });
  }

  sendIceCandidate(targetPeerID, candidate) {
    this._send('ice-candidate', {
      roomID: this.roomId,
      targetPeerID,
      candidate
    });
  }
  on(event, handler) {
    if (this.handlers.hasOwnProperty(event)) {
      this.handlers[event] = handler;
    }
  }

  _triggerHandler(event, data) {
    if (this.handlers[event]) {
      this.handlers[event](data);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
    }
  }
}
export default SignalingClient;
