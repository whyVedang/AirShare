class SignalingClient {
  constructor(serverUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:5000') {
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

      // Generate a stable peerId that survives reconnects within the same session
      if (!this.peerId) {
        this.peerId = crypto.randomUUID();
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
        if (this.roomId) {
          this.joinRoom(this.roomId);
        }

        this._triggerHandler('onReconnected', { peerId: this.peerId });
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
    // Flag as intentional so onclose does NOT trigger auto-reconnect
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
  sendHostOffer(roomID, sdp) {
    this.send({ type: 'host-offer', payload: { roomID, sdp } });
  }

  sendReceiverRequest(roomID) {
    this.send({ type: 'receiver-request', payload: { roomID } });
  }

  sendReceiverAnswer(roomID, sdp) {
    this.send({ type: 'receiver-answer', payload: { roomID, sdp } });
  }

  sendIceCandidate(roomID, targetPeerID, candidate) {
    this.send({ type: 'ice-candidate', payload: { roomID, candidate } });
  }
}

export default SignalingClient;
