/**
 * PeerEngine - WebRTC Peer Connection Manager
 * 
 * Handles RTCPeerConnection lifecycle using SCTP over UDP for reliable,
 * order-independent data transfer via RTCDataChannel.
 * 
 * This is pure domain logic - no dependencies
 */
class SimpleEmitter {
   constructor() { this._listeners = new Map(); }
   on(event, fn) { if (!this._listeners.has(event)) this._listeners.set(event, new Set()); this._listeners.get(event).add(fn); return this; }
   off(event, fn) { this._listeners.get(event)?.delete(fn); return this; }
   emit(event, ...args) { this._listeners.get(event)?.forEach((fn) => fn(...args)); }
 }
export class SFUPeerEngine extends SimpleEmitter {
    constructor(signalingClient) {
        super();
        this.signaling = signalingClient;
        this.serverConnection = null;
        this.dataChannel = null;
        this.isHost = false;
        
        this._setupSignalingListeners();
    }

    _setupSignalingListeners() {
        // Listen for the Server responding to the Host
        this.signaling.on('server-answer', async (payload) => {
            if (this.isHost && this.serverConnection) {
                const rtcSessionDescription = new RTCSessionDescription({
                    type: 'answer',
                    sdp: payload.sdp
                });
                await this.serverConnection.setRemoteDescription(rtcSessionDescription);
            }
        });

        // Listen for the Server initiating contact with the Receiver
        this.signaling.on('server-offer', async (payload) => {
            if (!this.isHost) {
                await this.handleServerOffer(payload.sdp);
            }
        });

        this.signaling.on('server-ice-candidate', (payload) => {
            if (this.serverConnection) {
                this.serverConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
            }
        });
    }

    _createPeerConnection(roomID) {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.signaling.sendIceCandidate(roomID, 'server', event.candidate);
            }
        };

        pc.onconnectionstatechange = () => {
            this.emit('connection-state', pc.connectionState);
        };

        return pc;
    }

    // --- HOST LOGIC (Sender) ---
    async initAsHost(roomID) {
        this.isHost = true;
        this.serverConnection = this._createPeerConnection(roomID);

        // Host creates the channel that uploads to the server
        this.dataChannel = this.serverConnection.createDataChannel('file-transfer');
        this._setupDataChannel(this.dataChannel);

        const offer = await this.serverConnection.createOffer();
        await this.serverConnection.setLocalDescription(offer);

        this.signaling.sendHostOffer(roomID, offer.sdp);
    }

    // --- RECEIVER LOGIC (Downloader) ---
    requestServerConnection(roomID) {
        this.isHost = false;
        // Tell the server we want an offer
        this.signaling.sendReceiverRequest(roomID); 
    }

    async handleServerOffer(serverSdp) {
        this.serverConnection = this._createPeerConnection(this.signaling.roomID);

        // Receiver listens for the server to open the downstream channel
        this.serverConnection.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            this._setupDataChannel(this.dataChannel);
        };

        await this.serverConnection.setRemoteDescription(
            new RTCSessionDescription({ type: 'offer', sdp: serverSdp })
        );

        const answer = await this.serverConnection.createAnswer();
        await this.serverConnection.setLocalDescription(answer);

        this.signaling.sendReceiverAnswer(this.signaling.roomID, answer.sdp);
    }

    _setupDataChannel(channel) {
        channel.binaryType = 'arraybuffer';
        
        channel.onopen = () => this.emit('channel-open');
        channel.onclose = () => this.emit('channel-closed');
        
        channel.onmessage = (event) => {
            // Forward chunks to the ChunkManager/TransferController
            this.emit('data-received', event.data);
        };
    }

    sendData(chunk) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(chunk);
        }
    }

    disconnect() {
        if (this.dataChannel) this.dataChannel.close();
        if (this.serverConnection) this.serverConnection.close();
    }
}

class PeerEngine {
  constructor(config = {}) {
    this.config = {
      // ICE servers for NAT traversal (STUN) and relay fallback (TURN)
      // Configured via environment variables; falls back to Google STUN for local dev
      iceServers: config.iceServers || [
        { urls: import.meta.env.VITE_STUN_URL || 'stun:stun.l.google.com:19302' },
        ...(import.meta.env.VITE_TURN_URL ? [{
          urls: import.meta.env.VITE_TURN_URL,
          username: import.meta.env.VITE_TURN_USERNAME || '',
          credential: import.meta.env.VITE_TURN_CREDENTIAL || ''
        }] : [])
      ],
      // SCTP settings for data channel
      dataChannelOptions: {
        ordered: true,
        ...config.dataChannelOptions
      }
    };

    this.peerConnection = null;
    this.dataChannel = null;
    this.remoteDataChannel = null;
    this.connectionState = 'new';
    this.iceConnectionState = 'new';
    this.peerId = null;
    
    // Event callbacks (dependency injection pattern)
    this.callbacks = {
      onConnectionStateChange: null,
      onIceCandidate: null,
      onDataChannelOpen: null,
      onDataChannelClose: null,
      onDataChannelMessage: null,
      onDataChannelError: null,
      onRemoteDataChannel: null,
      onIceGatheringComplete: null
    };
  }

  /**
   * Initializes RTCPeerConnection with STUN configuration
   */
  initialize() {
    if (this.peerConnection) {
      console.warn('[PeerEngine] Already initialized');
      return;
    }

    const rtcConfig = {
      iceServers: this.config.iceServers,
      iceCandidatePoolSize: 10, // Pre-gather ICE candidates
      bundlePolicy: 'max-bundle', // Use single transport for all media
      rtcpMuxPolicy: 'require' // Multiplex RTP and RTCP
    };

    this.peerConnection = new RTCPeerConnection(rtcConfig);

    this._setupPeerConnectionListeners();
  }

  /**
   * Sets up RTCPeerConnection event listeners
   * @private
   */
  _setupPeerConnectionListeners() {
    // Connection state monitoring
    this.peerConnection.onconnectionstatechange = () => {
      this.connectionState = this.peerConnection.connectionState;
      this._triggerCallback('onConnectionStateChange', {
        state: this.connectionState
      });

      // Auto-cleanup on failure
      if (this.connectionState === 'failed' || this.connectionState === 'closed') {
        console.warn('[PeerEngine] Connection failed or closed');
      }
    };

    // ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      this.iceConnectionState = this.peerConnection.iceConnectionState;
    };

    // ICE candidate gathering
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this._triggerCallback('onIceCandidate', event.candidate);
      } else {
        this._triggerCallback('onIceGatheringComplete');
      }
    };

    // Handle incoming data channels (receiver side)
    this.peerConnection.ondatachannel = (event) => {
      this.remoteDataChannel = event.channel;
      this._setupDataChannelListeners(this.remoteDataChannel);
      this._triggerCallback('onRemoteDataChannel', event.channel);
    };

    // ICE gathering state
    this.peerConnection.onicegatheringstatechange = () => {
    };
  }

  /**
   * Creates a data channel for sending data (initiator side)
   * Uses SCTP over UDP for reliable, order-independent delivery
   * @param {string} label - Channel label
   * @returns {RTCDataChannel}
   */
  createDataChannel(label = 'airshare-transfer') {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    if (this.dataChannel) {
      console.warn('[PeerEngine] Data channel already exists');
      return this.dataChannel;
    }

    this.dataChannel = this.peerConnection.createDataChannel(
      label,
      this.config.dataChannelOptions
    );

    this._setupDataChannelListeners(this.dataChannel);
    
    return this.dataChannel;
  }

  /**
   * Sets up data channel event listeners
   * @private
   * @param {RTCDataChannel} channel
   */
  _setupDataChannelListeners(channel) {
    channel.onopen = () => {
      this._triggerCallback('onDataChannelOpen', {
        label: channel.label,
        channel
      });
    };

    channel.onclose = () => {
      this._triggerCallback('onDataChannelClose', {
        label: channel.label
      });
    };

    channel.onmessage = (event) => {
      this._triggerCallback('onDataChannelMessage', {
        data: event.data,
        channel
      });
    };

    channel.onerror = (error) => {
      console.error(`[PeerEngine] Data channel error: ${channel.label}`, error);
      this._triggerCallback('onDataChannelError', {
        error,
        channel
      });
    };

    channel.onbufferedamountlow = () => {
    };
  }

  /**
   * Creates an SDP offer
   * @returns {Promise<RTCSessionDescriptionInit>}
   */
  async createOffer() {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });

      await this.peerConnection.setLocalDescription(offer);
      return offer;
    } catch (error) {
      console.error('[PeerEngine] Failed to create offer:', error);
      throw error;
    }
  }

  /**
   * Creates an SDP answer
   * @returns {Promise<RTCSessionDescriptionInit>}
   */
  async createAnswer() {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    try {
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      return answer;
    } catch (error) {
      console.error('[PeerEngine] Failed to create answer:', error);
      throw error;
    }
  }

  /**
   * Sets remote SDP description
   * @param {RTCSessionDescriptionInit} description
   */
  async setRemoteDescription(description) {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    try {
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(description)
      );
    } catch (error) {
      console.error('[PeerEngine] Failed to set remote description:', error);
      throw error;
    }
  }

  /**
   * Rolls back a local offer during SDP glare handling.
   */
  async rollbackLocalDescription() {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    if (this.peerConnection.signalingState !== 'have-local-offer') {
      return;
    }

    try {
      await this.peerConnection.setLocalDescription({ type: 'rollback' });
    } catch (error) {
      console.error('[PeerEngine] Failed to rollback local description:', error);
      throw error;
    }
  }

  /**
   * Adds ICE candidate
   * @param {RTCIceCandidateInit} candidate
   */
  async addIceCandidate(candidate) {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    try {
      await this.peerConnection.addIceCandidate(
        new RTCIceCandidate(candidate)
      );
    } catch (error) {
      console.error('[PeerEngine] Failed to add ICE candidate:', error);
      throw error;
    }
  }

  getSignalingState() {
    return this.peerConnection?.signalingState || 'closed';
  }

  hasRemoteDescription() {
    return Boolean(this.peerConnection?.remoteDescription);
  }

  hasDataChannel() {
    return Boolean(this.dataChannel || this.remoteDataChannel);
  }

  /**
   * Sends data through the data channel
   * @param {ArrayBuffer|string} data
   */
  send(data) {
    const channel = this.dataChannel || this.remoteDataChannel;
    
    if (!channel) {
      throw new Error('No data channel available');
    }

    if (channel.readyState !== 'open') {
      throw new Error(`Data channel not open: ${channel.readyState}`);
    }

    // Check buffered amount to prevent overflow
    if (channel.bufferedAmount > 16 * 1024 * 1024) { // 16MB threshold
      console.warn('[PeerEngine] High buffer amount, consider throttling');
    }

    channel.send(data);
  }

  /**
   * Registers event callbacks
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (this.callbacks.hasOwnProperty(event)) {
      this.callbacks[event] = callback;
    } else {
      console.warn(`[PeerEngine] Unknown event: ${event}`);
    }
  }

  /**
   * Triggers registered callback
   * @private
   */
  _triggerCallback(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event](data);
    }
  }

  /**
   * Gets current connection statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    if (!this.peerConnection) {
      return null;
    }

    const stats = await this.peerConnection.getStats();
    const result = {};

    stats.forEach((report) => {
      if (report.type === 'data-channel') {
        result.dataChannel = {
          label: report.label,
          state: report.state,
          messagesSent: report.messagesSent,
          messagesReceived: report.messagesReceived,
          bytesSent: report.bytesSent,
          bytesReceived: report.bytesReceived
        };
      }
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        result.connection = {
          bytesSent: report.bytesSent,
          bytesReceived: report.bytesReceived,
          currentRoundTripTime: report.currentRoundTripTime,
          availableOutgoingBitrate: report.availableOutgoingBitrate
        };
      }
    });

    return result;
  }

  /**
   * Gets current state
   * @returns {Object}
   */
  getState() {
    return {
      connectionState: this.connectionState,
      iceConnectionState: this.iceConnectionState,
      hasDataChannel: !!(this.dataChannel || this.remoteDataChannel),
      dataChannelState: (this.dataChannel || this.remoteDataChannel)?.readyState || 'none'
    };
  }

  /**
   * Checks if peer connection is ready for data transfer
   * @returns {boolean}
   */
  isReady() {
    const channel = this.dataChannel || this.remoteDataChannel;
    return (
      this.connectionState === 'connected' &&
      channel &&
      channel.readyState === 'open'
    );
  }

  /**
   * Closes the peer connection and cleans up resources
   */
  close() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.remoteDataChannel) {
      this.remoteDataChannel.close();
      this.remoteDataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.connectionState = 'closed';
    this.iceConnectionState = 'closed';
  }
}

export default PeerEngine;
