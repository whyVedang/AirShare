import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SignalingClient from "../infrastructure/signalingClient"
import PeerEngine from "../domain/peer/PeerEngine"


const Room = ({ roomId, onLeave }) => {
  const clientRef = useRef(null);
  const peerRef = useRef(null);
  const didInit = useRef(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [latency, setLatency] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [files, setFiles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const logContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: 'spring',
        stiffness: 120,
        damping: 20
      }
    }
  };

  const getTimestamp = () => {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
  };

  const addLog = (msg) => {
    setLogs(prev => [...prev, `[${getTimestamp()}] ${msg}`]);
  };

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const client = new SignalingClient('ws://localhost:5000');
    clientRef.current = client;

    addLog('Connecting to signaling server...');

    registerHandlers(client);

    client.connect()
      .then(() => {
        setConnectionStatus('connecting');
        addLog('Connected to signaling server');
        client.joinRoom(roomId);
        addLog(`Joined room: ${roomId}`);
      })
      .catch((err) => {
        setConnectionStatus('failed');
        addLog('Connection failed');
        console.error(err);
      });

    return () => {
      client.disconnect();
      addLog('Disconnected');
      didInit.current = false
    };
  }, [roomId]);

  const registerHandlers = (client) => {

    client.on('onReconnecting', ({ attempt, delay }) => {
      setConnectionStatus('connecting');
      addLog(`Connection lost. Reconnecting... (attempt ${attempt}, ${delay / 1000}s)`);
    });

    client.on('onReconnected', () => {
      addLog('Reconnected to signaling server');
    });

    client.on('onRoomJoined', (peers) => {
      addLog(`👥 Existing peers: ${peers.length}`);

      if (peers.length === 0) {
        addLog('🕐 Waiting for peer...');
      }
      else {
        addLog('👀 Peer exists, waiting for offer...');
      }
    });

    // INITIATOR path: We are an existing peer and a new peer just joined.
    // Only existing peers send offers — this is how we prevent WebRTC glare.
    client.on('onPeerJoined', async (peerID) => {
      addLog(`Peer joined: ${peerID}`);

      cleanupPeer();
      const peer = new PeerEngine();
      peer.initialize();
      peerRef.current = peer;

      setupPeer(peer, peerID);
      
      // We MUST open the data channel BEFORE creating the offer
      // Otherwise the WebRTC offer has nothing to negotiate!
      peer.createDataChannel('airshare-data');

      try {
        const offer = await peer.createOffer();
        client.sendOffer(peerID, offer);
        addLog('Sent offer');
      } catch (err) {
        console.error("Failed to create offer:", err);
      }
    });

    // RECEIVER path: We just joined and received an offer from an existing peer.
    // We NEVER send an offer here — we only answer.
    client.on('onOffer', async ({ sdp, from }) => {
      addLog('Received offer');

      cleanupPeer();
      const peer = new PeerEngine();
      peer.initialize();
      peerRef.current = peer;

      setupPeer(peer, from);

      try {
        await peer.setRemoteDescription(sdp);
        const answer = await peer.createAnswer();
        client.sendAnswer(from, answer);
        addLog('Sent answer');
      } catch (err) {
        console.error("Failed to handle offer:", err);
      }
    });

    client.on('onAnswer', async ({ sdp }) => {
      addLog('Received answer');
      if (!peerRef.current) return;
      await peerRef.current.setRemoteDescription(sdp);
    });

    client.on('onIceCandidate', async ({ candidate }) => {
      addLog('📡 Received ICE candidate');
      if (!peerRef.current) return;
      try {
        await peerRef.current.addIceCandidate(candidate);
      } catch (err) {
        console.warn("ICE Candidate arrived too early, or failed:", err);
      }
    });
  };

  const cleanupPeer = () => {
    if (peerRef.current) {
      try {
        peerRef.current.close();
      } catch (e) {
        // ignore close errors on already-dead engines
      }
      peerRef.current = null;
    }
  };

  const setupPeer = (peer, targetPeerID) => {
    const client = clientRef.current;

    peer.on('onIceCandidate', (candidate) => {
      client.sendIceCandidate(targetPeerID, candidate);
      addLog('Sent ICE candidate');
    });

    peer.on('onConnectionStateChange', ({ state }) => {
      addLog(`State: ${state}`);

      if (state === 'connected') {
        setConnectionStatus('connected');
        addLog('P2P connection established!');
      }
    });

    peer.on('onDataChannelOpen', ({ label }) => {
      addLog(`Data Channel Open: ${label}`);
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const extensionMap = {
      'pdf': '📄',
      'doc': '📝', 'docx': '📝', 'txt': '📝',
      'xls': '📊', 'xlsx': '📊', 'csv': '📊',
      'mp4': '🎬', 'avi': '🎬', 'mov': '🎬',
      'mp3': '🎵', 'wav': '🎵', 'flac': '🎵',
      'jpg': '🖼️', 'png': '🖼️', 'gif': '🖼️',
      'zip': '📦', 'rar': '📦', '7z': '📦',
    };
    return extensionMap[ext] || '📎';
  };

  const processFiles = (filesArray) => {
    if (!filesArray || filesArray.length === 0) return;

    const newFiles = filesArray.map((file, idx) => ({
      id: Date.now() + idx,
      name: file.name,
      size: file.size,
      status: 'Queued',
      progress: 0
    }));

    setFiles(prev => [...prev, ...newFiles]);
    addLog(`${newFiles.length} file(s) added`);

    if (connectionStatus !== 'connected' || !peerRef.current) {
      addLog('Cannot send: Waiting for P2P connection...');
      return;
    }

    for (const file of filesArray) {
      try {
        addLog(`Starting transfer: ${file.name}`);
        console.log("File ready for ChunkManager:", file);
      } catch (error) {
        addLog(`Transfer failed: ${file.name}`);
        console.error(error);
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!e.dataTransfer || !e.dataTransfer.files) return;
    processFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileInput = (e) => {
    if (!e.target.files) return;
    processFiles(Array.from(e.target.files));
    e.target.value = null; // reset so they can select the same file again if needed
  };

  const handleZoneClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };


  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen p-8 font-['Inter',sans-serif]"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-12 flex items-center justify-between">
        <div>
          <h1 className="text-6xl font-bold text-white mb-2 tracking-tight">
            Transfer <span className="text-[#FF5C00]">Room</span>
          </h1>
          <div className="flex items-center gap-3">
            <p className="text-gray-500 text-sm">
              Code: <span className="text-white font-mono font-bold tracking-wider">{roomId}</span>
            </p>
            <button
              onClick={copyToClipboard}
              className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-md transition-colors relative"
              title="Copy Room Code"
            >
              {copied && (
                <span className="text-green-500 text-xs font-bold absolute -top-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap bg-black/80 px-2 py-1 rounded">Copied!</span>
              )}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
        <motion.button
          onClick={onLeave}
          className="px-6 py-3 bg-gradient-to-r from-[#FF5C00] to-[#FF7A33] text-white font-semibold tracking-wide rounded-lg"
          style={{
            boxShadow: '0 4px 16px rgba(255, 92, 0, 0.3)'
          }}
          whileHover={{ scale: 1.05, boxShadow: '0 6px 24px rgba(255, 92, 0, 0.4)' }}
          whileTap={{ scale: 0.98 }}
        >
          Disconnect
        </motion.button>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-8 mb-8">
        {/* File Drop Zone */}
        <motion.div
          variants={itemVariants}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleZoneClick}
          className={`lg:col-span-2 relative backdrop-blur-2xl rounded-lg p-12 min-h-[300px] flex flex-col items-center justify-center overflow-hidden transition-all duration-300 cursor-pointer ${isDragOver
            ? 'border-2 border-dashed border-[#FF5C00]'
            : 'border border-white/5'
            }`}
          style={{
            background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.8) 0%, rgba(15, 15, 15, 0.9) 100%)',
            boxShadow: isDragOver
              ? '0 0 30px rgba(255, 92, 0, 0.4), inset 0 0 20px rgba(255, 92, 0, 0.1)'
              : '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          }}
        >
          <input 
            type="file" 
            multiple 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileInput} 
          />
          {/* Subtle gradient overlay */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-[#FF5C00]/10 to-transparent pointer-events-none" />

          {files.length === 0 ? (
            <div className="text-center">
              <svg className="w-20 h-20 mx-auto mb-6 text-[#FF5C00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <h2 className="text-3xl font-bold text-white mb-3">
                Drop Files Here
              </h2>
              <p className="text-gray-500 text-sm mb-8">
                or click to browse
              </p>
            </div>
          ) : (
            <div className="w-full space-y-3">
              <AnimatePresence>
                {files.map((file) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-black/40 border border-white/10 rounded-lg p-4 flex items-center gap-4"
                  >
                    <span className="text-2xl">{getFileIcon(file.name)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{file.name}</p>
                      <p className="text-gray-500 text-xs">{formatFileSize(file.size)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1 bg-black/60 border border-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-[#FF5C00] to-[#FF8C42]"
                          initial={{ width: 0 }}
                          animate={{ width: `${file.progress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-400 w-16 text-right">{file.status}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        {/* Connection Status */}
        <motion.div
          variants={itemVariants}
          className="backdrop-blur-2xl rounded-lg border border-white/5 p-8"
          style={{
            background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.8) 0%, rgba(15, 15, 15, 0.9) 100%)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          }}
        >
          <h3 className="text-2xl font-bold text-white mb-6">
            P2P Status
          </h3>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-2.5 h-2.5">
                {connectionStatus === 'connecting' ? (
                  <>
                    <span className="absolute w-2.5 h-2.5 rounded-full bg-[#FF5C00] animate-ping" />
                    <span className="absolute w-2.5 h-2.5 rounded-full bg-[#FF5C00]" />
                  </>
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" style={{ boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)' }} />
                )}
              </div>
              <span className="text-gray-300 text-sm font-medium capitalize">
                {connectionStatus}
              </span>
            </div>

            <div className="border-t border-white/5 pt-4">
              <p className="text-gray-500 text-xs mb-2 uppercase tracking-widest">Transport</p>
              <p className="text-white font-mono text-sm">SCTP/UDP</p>
            </div>

            <div className="border-t border-white/5 pt-4">
              <p className="text-gray-500 text-xs mb-2 uppercase tracking-widest">Peers</p>
              <p className="text-white font-mono text-sm">
                {connectionStatus === 'connected' ? '1' : '0'} Connected
              </p>
            </div>

            <div className="border-t border-white/5 pt-4">
              <p className="text-gray-500 text-xs mb-2 uppercase tracking-widest">Latency</p>
              <p className="text-[#FF5C00] font-mono text-sm">
                {latency ? `${latency} ms` : 'Measuring...'}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Terminal Log */}
      <motion.div
        variants={itemVariants}
        ref={logContainerRef}
        className="backdrop-blur-2xl border border-white/5 rounded-lg p-6 h-48 overflow-y-auto font-mono text-sm"
        style={{
          background: 'rgba(0, 0, 0, 0.8)',
          boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.4)'
        }}
      >
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF5C00]" style={{ boxShadow: '0 0 6px rgba(255, 92, 0, 0.6)' }} />
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF8C42]" style={{ boxShadow: '0 0 6px rgba(255, 140, 66, 0.6)' }} />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" style={{ boxShadow: '0 0 6px rgba(34, 197, 94, 0.6)' }} />
          <span className="ml-2 text-gray-500 text-xs uppercase tracking-widest">Signaling Log</span>
        </div>
        {logs.map((log, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="text-[#FF5C00]/70 mb-1"
          >
            {log}
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

export default Room;
