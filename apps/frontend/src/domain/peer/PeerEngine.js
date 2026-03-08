/**
 * PeerEngine - WebRTC Peer Connection Manager
 * 
 * Handles RTCPeerConnection lifecycle using SCTP over UDP for reliable,
 * order-independent data transfer via RTCDataChannel.
 * 
 * This is pure domain logic - no React dependencies.
 */

class PeerEngine {
  constructor(config = {}) {
    this.config = {
      // Standard STUN servers for NAT traversal
      iceServers: config.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ],
      // SCTP settings for data channel
      dataChannelOptions: {
        ordered: false, // Allow out-of-order delivery to prevent head-of-line blocking
        maxRetransmits: 3, // Retry failed chunks
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
    
    console.log('[PeerEngine] RTCPeerConnection initialized with STUN servers');
    
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
      console.log('[PeerEngine] Connection state:', this.connectionState);
      
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
      console.log('[PeerEngine] ICE connection state:', this.iceConnectionState);
    };

    // ICE candidate gathering
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[PeerEngine] New ICE candidate:', event.candidate.type);
        this._triggerCallback('onIceCandidate', event.candidate);
      } else {
        console.log('[PeerEngine] ICE gathering complete');
        this._triggerCallback('onIceGatheringComplete');
      }
    };

    // Handle incoming data channels (receiver side)
    this.peerConnection.ondatachannel = (event) => {
      console.log('[PeerEngine] Received remote data channel:', event.channel.label);
      this.remoteDataChannel = event.channel;
      this._setupDataChannelListeners(this.remoteDataChannel);
      this._triggerCallback('onRemoteDataChannel', event.channel);
    };

    // ICE gathering state
    this.peerConnection.onicegatheringstatechange = () => {
      console.log('[PeerEngine] ICE gathering state:', this.peerConnection.iceGatheringState);
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

    // Create data channel with SCTP configuration
    this.dataChannel = this.peerConnection.createDataChannel(
      label,
      this.config.dataChannelOptions
    );

    console.log('[PeerEngine] Created data channel:', label);
    
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
      console.log(`[PeerEngine] Data channel opened: ${channel.label}`);
      console.log(`[PeerEngine] Protocol: ${channel.protocol || 'SCTP'}`);
      console.log(`[PeerEngine] Ordered: ${channel.ordered}`);
      console.log(`[PeerEngine] Max retransmits: ${channel.maxRetransmits}`);
      
      this._triggerCallback('onDataChannelOpen', {
        label: channel.label,
        channel
      });
    };

    channel.onclose = () => {
      console.log(`[PeerEngine] Data channel closed: ${channel.label}`);
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
      console.log('[PeerEngine] Buffer amount low - ready for more data');
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
      
      console.log('[PeerEngine] Created and set local offer');
      
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
      
      console.log('[PeerEngine] Created and set local answer');
      
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
      
      console.log('[PeerEngine] Set remote description:', description.type);
    } catch (error) {
      console.error('[PeerEngine] Failed to set remote description:', error);
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
      
      console.log('[PeerEngine] Added ICE candidate');
    } catch (error) {
      console.error('[PeerEngine] Failed to add ICE candidate:', error);
      throw error;
    }
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
    console.log('[PeerEngine] Closing peer connection');

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
