/**
 * SignalingClient - Lightweight Socket.io wrapper for WebRTC handshake
 * 
 * Handles ephemeral SDP/ICE exchange for P2P connection establishment.
 * Once WebRTC connection is established, this can go idle to maintain
 * data sovereignty (serverless architecture).
 */

import io from 'socket.io-client';

class SignalingClient {
  constructor(serverUrl = 'http://localhost:3000') {
    this.serverUrl = serverUrl;
    this.socket = null;
    this.isConnected = false;
    this.roomId = null;
    this.peerId = null;
    
    // Event handlers
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

  /**
   * Connects to the signaling server
   * @returns {Promise<void>}
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.peerId = this.socket.id;
        console.log(`[SignalingClient] Connected to server. Peer ID: ${this.peerId}`);
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('[SignalingClient] Connection error:', error);
        this._triggerHandler('onError', error);
        reject(error);
      });

      this._setupEventListeners();
    });
  }

  /**
   * Sets up Socket.io event listeners for WebRTC signaling
   * @private
   */
  _setupEventListeners() {
    // Room events
    this.socket.on('room:joined', (data) => {
      console.log('[SignalingClient] Joined room:', data);
      this.roomId = data.roomId;
      this._triggerHandler('onRoomJoined', data);
    });

    this.socket.on('peer:joined', (data) => {
      console.log('[SignalingClient] Peer joined:', data);
      this._triggerHandler('onPeerJoined', data);
    });

    this.socket.on('peer:left', (data) => {
      console.log('[SignalingClient] Peer left:', data);
      this._triggerHandler('onPeerLeft', data);
    });

    // WebRTC signaling events
    this.socket.on('webrtc:offer', (data) => {
      console.log('[SignalingClient] Received offer from:', data.from);
      this._triggerHandler('onOffer', data);
    });

    this.socket.on('webrtc:answer', (data) => {
      console.log('[SignalingClient] Received answer from:', data.from);
      this._triggerHandler('onAnswer', data);
    });

    this.socket.on('webrtc:ice-candidate', (data) => {
      console.log('[SignalingClient] Received ICE candidate from:', data.from);
      this._triggerHandler('onIceCandidate', data);
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('[SignalingClient] Server error:', error);
      this._triggerHandler('onError', error);
    });
  }

  /**
   * Joins or creates a room for P2P connection
   * @param {string} roomId - Room identifier
   * @returns {Promise<Object>}
   */
  joinRoom(roomId) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Not connected to signaling server'));
        return;
      }

      this.socket.emit('room:join', { roomId }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          this.roomId = roomId;
          resolve(response);
        }
      });
    });
  }

  /**
   * Sends SDP offer to peer
   * @param {string} targetPeerId - Target peer ID
   * @param {RTCSessionDescriptionInit} offer - SDP offer
   */
  sendOffer(targetPeerId, offer) {
    if (!this.isConnected) {
      throw new Error('Not connected to signaling server');
    }

    this.socket.emit('webrtc:offer', {
      to: targetPeerId,
      from: this.peerId,
      roomId: this.roomId,
      offer
    });

    console.log('[SignalingClient] Sent offer to:', targetPeerId);
  }

  /**
   * Sends SDP answer to peer
   * @param {string} targetPeerId - Target peer ID
   * @param {RTCSessionDescriptionInit} answer - SDP answer
   */
  sendAnswer(targetPeerId, answer) {
    if (!this.isConnected) {
      throw new Error('Not connected to signaling server');
    }

    this.socket.emit('webrtc:answer', {
      to: targetPeerId,
      from: this.peerId,
      roomId: this.roomId,
      answer
    });

    console.log('[SignalingClient] Sent answer to:', targetPeerId);
  }

  /**
   * Sends ICE candidate to peer
   * @param {string} targetPeerId - Target peer ID
   * @param {RTCIceCandidate} candidate - ICE candidate
   */
  sendIceCandidate(targetPeerId, candidate) {
    if (!this.isConnected) {
      throw new Error('Not connected to signaling server');
    }

    this.socket.emit('webrtc:ice-candidate', {
      to: targetPeerId,
      from: this.peerId,
      roomId: this.roomId,
      candidate
    });

    console.log('[SignalingClient] Sent ICE candidate to:', targetPeerId);
  }

  /**
   * Registers event handlers
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function
   */
  on(event, handler) {
    if (this.handlers.hasOwnProperty(event)) {
      this.handlers[event] = handler;
    } else {
      console.warn(`[SignalingClient] Unknown event: ${event}`);
    }
  }

  /**
   * Triggers registered event handler
   * @private
   */
  _triggerHandler(event, data) {
    if (this.handlers[event]) {
      this.handlers[event](data);
    }
  }

  /**
   * Goes idle after WebRTC connection is established
   * Reduces server load and maintains data sovereignty
   */
  goIdle() {
    if (!this.socket) return;

    console.log('[SignalingClient] Going idle - WebRTC connection established');
    
    // Remove message listeners but keep connection for potential reconnection
    this.socket.off('webrtc:offer');
    this.socket.off('webrtc:answer');
    this.socket.off('webrtc:ice-candidate');
    
    // Optionally reduce reconnection attempts
    this.socket.io.opts.reconnectionAttempts = 2;
  }

  /**
   * Disconnects from signaling server (ephemeral handshake complete)
   */
  disconnect() {
    if (!this.socket) return;

    console.log('[SignalingClient] Disconnecting from signaling server');
    
    if (this.roomId) {
      this.socket.emit('room:leave', { roomId: this.roomId });
    }

    this.socket.disconnect();
    this.socket = null;
    this.isConnected = false;
    this.roomId = null;
    
    console.log('[SignalingClient] Disconnected - P2P connection is direct now');
  }

  /**
   * Gets current connection state
   * @returns {Object}
   */
  getState() {
    return {
      isConnected: this.isConnected,
      peerId: this.peerId,
      roomId: this.roomId,
      serverUrl: this.serverUrl
    };
  }

  /**
   * Checks if connected to signaling server
   * @returns {boolean}
   */
  isActive() {
    return this.isConnected && this.socket !== null;
  }
}

export default SignalingClient;
