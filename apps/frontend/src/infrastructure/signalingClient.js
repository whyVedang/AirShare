class SignalingClient {
  constructor(serverUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:5000') {
    this.serverUrl = serverUrl;
    this.socket = null;
    this.isConnected = false;
    this.roomID = null;
    this.peerID = null;
    this.handlers = {
      onRoomJoined: null,
      onPeerJoined: null,
      onOffer: null,
      onAnswer: null,
      onIceCandidate: null,
      onPeerLeft: null,
      onError: null,
      onReconnecting: null,
      onReconnected: null,
    };

    // Reconnection state
    this._intentionalDisconnect = false;
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 8;
    this._reconnectTimer = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnected) return resolve();

      // Generate a stable peerID that survives reconnects within the same session
      if (!this.peerID) {
        this.peerID = crypto.randomUUID();
      }

      this.socket = new WebSocket(this.serverUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this._reconnectAttempts = 0;
        resolve();
      };

      this.socket.onerror = (error) => {
        console.error('[WS] Error:', error);
        this._triggerHandler('onError', error);
        // Only reject on first-ever connection attempt, not during reconnects
        if (this._reconnectAttempts === 0) {
          reject(error);
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.socket = null;

        // Only auto-reconnect if this was NOT caused by us calling disconnect()
        if (!this._intentionalDisconnect) {
          this._scheduleReconnect();
        }
      };

      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this._handleMessage(data);
      };
    });
  }

  _scheduleReconnect() {
    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
      console.error('[WS] Max reconnection attempts reached. Giving up.');
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped at 16s)
    const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 16000);
    this._reconnectAttempts++;


    this._triggerHandler('onReconnecting', { attempt: this._reconnectAttempts, delay });

    this._reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();

        // After reconnecting, automatically re-join the room we were in
        if (this.roomID) {
          this.joinRoom(this.roomID);
        }

        this._triggerHandler('onReconnected', { peerID: this.peerID });
      } catch (err) {
        // _scheduleReconnect will be triggered again via the socket.onclose handler
        console.warn('[WS] Reconnect attempt failed:', err);
      }
    }, delay);
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
    if (!this.isConnected || !this.socket) {
      console.warn('[WS] Cannot send — not connected.');
      return;
    }
    this.socket.send(JSON.stringify({ type, payload }));
  }

  joinRoom(roomID) {
    this.roomID = roomID;
    this._send('join-room', {
      roomID,
      peerID: this.peerID
    });
  }

  sendOffer(targetPeerID, offer) {
    this._send('offer', {
      roomID: this.roomID,
      targetPeerID,
      sdp: offer
    });
  }

  sendAnswer(targetPeerID, answer) {
    this._send('answer', {
      roomID: this.roomID,
      targetPeerID,
      sdp: answer
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
    this._intentionalDisconnect = true;

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
    }
  }


  sendIceCandidate(roomID, targetPeerID, candidate) {
    this._send('ice-candidate', { roomID, targetPeerID, candidate });
  }

  sendHostOffer(roomID, sdp) {
    this._send('host-offer', { roomID, sdp });
  }

  sendReceiverRequest(roomID) {
    this._send('receiver-request', { roomID });
  }

  sendReceiverAnswer(roomID, sdp) {
    this._send('receiver-answer', { roomID, sdp });
  }
}

export default SignalingClient;
