import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SignalingClient from "../infrastructure/signalingClient";
import PeerEngine from "../domain/peer/PeerEngine";
import TransferController from "../domain/transfer/TransferController";
import JSZip from 'jszip';

const MESH_SEND_BATCH_SIZE = 3;

const Room = ({ roomId, onLeave }) => {
  const clientRef = useRef(null);

  // -- MESH NETWORK MAPS --
  const peersRef = useRef(new Map());
  const transfersRef = useRef(new Map());
  const pendingIceCandidatesRef = useRef(new Map());
  const makingOfferRef = useRef(new Set());
  const fallbackTimersRef = useRef(new Map());

  const didInit = useRef(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [activePeers, setActivePeers] = useState([]);
  const [selectedPeers, setSelectedPeers] = useState(new Set());

  const [isDragOver, setIsDragOver] = useState(false);
  const [files, setFiles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [copied, setCopied] = useState(false);

  const fileQueueRef = useRef([]);
  const isTransferringRef = useRef(false);

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

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 120, damping: 20 } } };

  const getTimestamp = () => new Date().toLocaleTimeString('en-US', { hour12: false });
  const addLog = (msg) => setLogs(prev => [...prev, `[${getTimestamp()}] ${msg}`]);

  useEffect(() => {
    if (logContainerRef.current) logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const client = new SignalingClient(import.meta.env.VITE_WS_URL || 'ws://localhost:5000');
    clientRef.current = client;

    addLog('Connecting to signaling server...');
    registerHandlers(client);

    client.connect().then(() => {
      setConnectionStatus('connected');
      addLog('Connected to signaling server');
      client.joinRoom(roomId);
      addLog(`Joined room: ${roomId}`);
    }).catch((err) => {
      setConnectionStatus('failed');
      addLog('Connection failed');
      console.error(err);
    });

    return () => {
      // Disconnect all peers securely
      transfersRef.current.forEach(tc => tc.detachChannel());
      peersRef.current.forEach(peer => peer.close());
      transfersRef.current.clear();
      peersRef.current.clear();
      pendingIceCandidatesRef.current.clear();
      makingOfferRef.current.clear();
      fallbackTimersRef.current.forEach(timer => clearTimeout(timer));
      fallbackTimersRef.current.clear();

      client.disconnect();
      addLog('Disconnected');
      didInit.current = false;
    };
  }, [roomId]);

  const rememberPeerInUi = (peerID, status = 'connecting') => {
    if (!peerID || peerID === clientRef.current?.peerId) return;

    setActivePeers(prev => {
      if (prev.some(peer => peer.id === peerID)) {
        return prev.map(peer => {
          if (peer.id !== peerID) return peer;
          const nextStatus = peer.status === 'connected' && status === 'connecting'
            ? peer.status
            : status;
          return { ...peer, status: nextStatus };
        });
      }

      return [...prev, { id: peerID, status, latency: null }];
    });

    setSelectedPeers(prev => new Set([...prev, peerID]));
  };

  const getOrCreatePeer = (peerID) => {
    if (!peerID || peerID === clientRef.current?.peerId) return null;

    const existingPeer = peersRef.current.get(peerID);
    if (existingPeer) return existingPeer;

    rememberPeerInUi(peerID);

    const peer = new PeerEngine();
    peer.initialize();
    peersRef.current.set(peerID, peer);
    setupPeer(peer, peerID);

    return peer;
  };

  const queueIceCandidate = (peerID, candidate) => {
    const queued = pendingIceCandidatesRef.current.get(peerID) || [];
    queued.push(candidate);
    pendingIceCandidatesRef.current.set(peerID, queued);
  };

  const flushPendingIceCandidates = async (peerID) => {
    const peer = peersRef.current.get(peerID);
    const queued = pendingIceCandidatesRef.current.get(peerID);

    if (!peer || !peer.hasRemoteDescription() || !queued || queued.length === 0) {
      return;
    }

    pendingIceCandidatesRef.current.delete(peerID);

    for (const candidate of queued) {
      try {
        await peer.addIceCandidate(candidate);
      } catch (err) {
        console.warn(`Dropped ICE candidate for ${peerID}:`, err);
      }
    }
  };

  const startOffer = async (peerID, reason = 'mesh') => {
    const client = clientRef.current;
    const peer = getOrCreatePeer(peerID);

    if (!client || !peer || makingOfferRef.current.has(peerID)) return;

    if (peer.getSignalingState() !== 'stable') {
      addLog(`Offer delayed for ${peerID.substring(0, 8)}: signaling busy`);
      return;
    }

    try {
      makingOfferRef.current.add(peerID);

      if (!peer.hasDataChannel()) {
        peer.createDataChannel('airshare-data');
      }

      const offer = await peer.createOffer();
      client.sendOffer(peerID, offer);
      addLog(`Offer sent to ${peerID.substring(0, 8)} (${reason})`);
    } catch (err) {
      console.error("Failed to create offer:", err);
      addLog(`Offer failed for ${peerID.substring(0, 8)}`);
    } finally {
      makingOfferRef.current.delete(peerID);
    }
  };

  const shouldSendFallbackOffer = (peerID) => {
    const localPeerID = clientRef.current?.peerId;
    return Boolean(localPeerID && peerID && localPeerID < peerID);
  };

  const scheduleFallbackOffer = (peerID) => {
    if (!shouldSendFallbackOffer(peerID) || fallbackTimersRef.current.has(peerID)) {
      return;
    }

    const timer = setTimeout(() => {
      fallbackTimersRef.current.delete(peerID);
      const peer = peersRef.current.get(peerID);

      if (peer?.hasRemoteDescription() || peer?.isReady()) {
        return;
      }

      startOffer(peerID, 'fallback');
    }, 6000);

    fallbackTimersRef.current.set(peerID, timer);
  };

  const registerHandlers = (client) => {
    client.on('onReconnecting', ({ attempt, delay }) => {
      addLog(`Connection lost. Reconnecting... (attempt ${attempt})`);
    });

    client.on('onReconnected', () => {
      addLog('Reconnected to signaling server');
    });

    client.on('onError', (error) => {
      const message = error?.message || 'Signaling error';
      addLog(`Signaling error: ${message}`);
      if (/room|join|invalid/i.test(message)) {
        setConnectionStatus('failed');
      }
    });

    client.on('onRoomJoined', (peersList = []) => {
      const existingPeers = peersList.filter(peerID => peerID && peerID !== client.peerId);

      addLog(`Existing peers: ${existingPeers.length}`);
      if (existingPeers.length === 0) {
        addLog('Waiting for peers...');
        return;
      }

      existingPeers.forEach(peerID => {
        rememberPeerInUi(peerID);
        startOffer(peerID, 'existing peer');
      });
    });

    client.on('onPeerJoined', (peerID) => {
      if (!peerID || peerID === client.peerId) return;

      if (peersRef.current.has(peerID)) {
        addLog(`Peer rejoined (WebRTC self-healing active): ${peerID}`);
        scheduleFallbackOffer(peerID);
        return;
      }

      addLog(`Peer joined: ${peerID}`);
      rememberPeerInUi(peerID);
      scheduleFallbackOffer(peerID);
    });

    client.on('onOffer', async ({ sdp, from }) => {
      if (!from || from === client.peerId) return;

      addLog(`Received offer from ${from}`);
      rememberPeerInUi(from);

      const peer = getOrCreatePeer(from);
      const polite = client.peerId > from;
      const signalingState = peer.getSignalingState();
      const offerCollision = makingOfferRef.current.has(from) || signalingState !== 'stable';

      try {
        if (offerCollision) {
          if (!polite) {
            addLog(`Ignored colliding offer from ${from.substring(0, 8)}`);
            return;
          }

          if (signalingState === 'have-local-offer' || makingOfferRef.current.has(from)) {
            await peer.rollbackLocalDescription();
          } else {
            addLog(`Offer skipped from ${from.substring(0, 8)}: signaling busy`);
            return;
          }
        }

        await peer.setRemoteDescription(sdp);
        await flushPendingIceCandidates(from);

        const answer = await peer.createAnswer();
        client.sendAnswer(from, answer);
      } catch (err) {
        console.error("Failed to handle offer:", err);
      }
    });

    client.on('onAnswer', async ({ sdp, from }) => {
      const peer = peersRef.current.get(from);
      if (!peer) {
        addLog(`Answer ignored from unknown peer: ${from}`);
        return;
      }

      try {
        await peer.setRemoteDescription(sdp);
        await flushPendingIceCandidates(from);
      } catch (err) {
        console.error("Failed to handle answer:", err);
      }
    });

    client.on('onIceCandidate', async ({ candidate, from }) => {
      const peer = peersRef.current.get(from);

      if (!peer || !peer.hasRemoteDescription()) {
        queueIceCandidate(from, candidate);
        return;
      }

      try {
        await peer.addIceCandidate(candidate);
      } catch (err) {
        queueIceCandidate(from, candidate);
      }
    });

    client.on('onPeerLeft', (peerID) => {
      addLog(`Peer left: ${peerID}`);

      const tc = transfersRef.current.get(peerID);
      if (tc) tc.detachChannel();

      const peer = peersRef.current.get(peerID);
      if (peer) peer.close();

      transfersRef.current.delete(peerID);
      peersRef.current.delete(peerID);
      pendingIceCandidatesRef.current.delete(peerID);
      makingOfferRef.current.delete(peerID);

      const timer = fallbackTimersRef.current.get(peerID);
      if (timer) clearTimeout(timer);
      fallbackTimersRef.current.delete(peerID);

      setActivePeers(prev => prev.filter(p => p.id !== peerID));
      setSelectedPeers(prev => {
        const next = new Set(prev);
        next.delete(peerID);
        return next;
      });
    });
  };
  const setupPeer = (peer, targetPeerID) => {
    const client = clientRef.current;

    peer.on('onIceCandidate', (candidate) => {
      client.sendIceCandidate(roomId, targetPeerID, candidate);
    });

    peer.on('onConnectionStateChange', ({ state }) => {
      if (state === 'connected') {
        setActivePeers(prev => prev.map(p => p.id === targetPeerID ? { ...p, status: 'connected' } : p));
        addLog(`P2P connected: ${targetPeerID}`);
      } else if (state === 'failed' || state === 'disconnected') {
        setActivePeers(prev => prev.map(p => p.id === targetPeerID ? { ...p, status: state } : p));
      }
    });

    peer.on('onDataChannelOpen', ({ label, channel }) => {
      addLog(`Data Channel Open with ${targetPeerID}`);
      channel.binaryType = 'arraybuffer';

      const tc = new TransferController(
        (progress) => {
          setFiles(prev => prev.map(f => f.status === 'Sending' ? { ...f, progress } : f));
        },
        (blob, filename) => {
          addLog(`Received file: ${filename}`);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename || 'airshare-file';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 0);
        },
        (avgLatency) => {
          setActivePeers(prev => prev.map(p => p.id === targetPeerID ? { ...p, latency: avgLatency } : p));
        }
      );

      tc.attachChannel(channel);
      transfersRef.current.set(targetPeerID, tc);
    });

    peer.on('onRemoteDataChannel', (channel) => {
      channel.binaryType = 'arraybuffer';
    });
  };

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const extensionMap = {
      'pdf': '[PDF]', 'doc': '[DOC]', 'docx': '[DOC]', 'txt': '[TXT]',
      'xls': '[XLS]', 'xlsx': '[XLS]', 'csv': '[CSV]',
      'mp4': '[VID]', 'avi': '[VID]', 'mov': '[VID]',
      'mp3': '[AUD]', 'wav': '[AUD]', 'flac': '[AUD]',
      'jpg': '[IMG]', 'png': '[IMG]', 'gif': '[IMG]',
      'zip': '[ZIP]', 'rar': '[ZIP]', '7z': '[ZIP]',
    };
    return extensionMap[ext] || '[FILE]';
  };

  const processFiles = async (filesArray) => {
    if (!filesArray || filesArray.length === 0) return;

    if (activePeers.filter(p => p.status === 'connected').length === 0) {
      addLog('Cannot send: No peers connected.');
      return;
    }

    if (selectedPeers.size === 0) {
      addLog('Cannot send: No peers selected.');
      return;
    }

    const newFiles = filesArray.map((file, idx) => ({
      id: Date.now() + idx,
      name: file.name,
      size: file.size,
      status: 'Queued',
      progress: 0,
      rawFile: file,
      targets: Array.from(selectedPeers)
    }));

    setFiles(prev => [...prev, ...newFiles]);
    fileQueueRef.current.push(...newFiles);

    addLog(`${newFiles.length} file(s) queued for ${selectedPeers.size} peer(s)`);

    if (!isTransferringRef.current) {
      pumpQueue();
    }
  };

  const sendToTargetsInBatches = async (file, targets, fileId) => {
    const results = [];
    const totalTargets = targets.length;
    const totalBatches = Math.ceil(totalTargets / MESH_SEND_BATCH_SIZE);

    addLog(`Mesh batching: ${totalTargets} peer(s), ${MESH_SEND_BATCH_SIZE} at a time`);

    for (let i = 0; i < totalTargets; i += MESH_SEND_BATCH_SIZE) {
      const batch = targets.slice(i, i + MESH_SEND_BATCH_SIZE);
      const batchNumber = Math.floor(i / MESH_SEND_BATCH_SIZE) + 1;

      addLog(`Sending batch ${batchNumber}/${totalBatches}: ${batch.length} peer(s)`);

      const settled = await Promise.allSettled(
        batch.map(({ controller }) => controller.send(file))
      );

      settled.forEach((result, index) => {
        results.push({
          peerID: batch[index].peerID,
          status: result.status,
          reason: result.reason
        });
      });

      const completedCount = results.filter(result => result.status === 'fulfilled').length;
      const batchFailedCount = settled.filter(result => result.status === 'rejected').length;

      setFiles(prev => prev.map(f =>
        f.id === fileId
          ? { ...f, progress: Math.min(99, Math.round((completedCount / totalTargets) * 100)) }
          : f
      ));

      if (batchFailedCount > 0) {
        addLog(`Batch ${batchNumber}/${totalBatches}: ${batchFailedCount} peer(s) failed`);
      }
    }

    return results;
  };

  const pumpQueue = async () => {
    isTransferringRef.current = true;

    while (fileQueueRef.current.length > 0) {
      const fileData = fileQueueRef.current.shift();
      const rawFile = fileData.rawFile;
      const targets = fileData.targets;

      const tcTargets = targets
        .map(peerID => ({ peerID, controller: transfersRef.current.get(peerID) }))
        .filter(({ controller }) => Boolean(controller));

      if (tcTargets.length === 0) {
        addLog(`Failed: Peers disconnected before send`);
        setFiles(prev => prev.map(f => f.id === fileData.id ? { ...f, status: 'Failed' } : f));
        continue;
      }

      const startTime = Date.now();
      addLog(`Sending: ${rawFile.name}...`);
      setFiles(prev => prev.map(f => f.id === fileData.id ? { ...f, status: 'Sending' } : f));

      try {
        const results = await sendToTargetsInBatches(rawFile, tcTargets, fileData.id);
        const successfulTransfers = results.filter(r => r.status === 'fulfilled').length;
        const failedTransfers = results.length - successfulTransfers;

        if (successfulTransfers === 0) {
          throw new Error('All peers failed to receive');
        }

        const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
        if (failedTransfers > 0) {
          addLog(`Partial: ${rawFile.name} reached ${successfulTransfers}/${results.length} peer(s) in ${elapsedSec}s`);
        } else {
          addLog(`Done: ${rawFile.name} in ${elapsedSec}s`);
        }

        setFiles(prev => prev.map(f =>
          f.id === fileData.id
            ? {
              ...f,
              status: failedTransfers > 0
                ? `Partial (${successfulTransfers}/${results.length})`
                : `Done (${elapsedSec}s)`,
              progress: Math.round((successfulTransfers / results.length) * 100)
            }
            : f
        ));
      } catch (err) {
        addLog(`Transfer failed: ${rawFile.name}`);
        setFiles(prev => prev.map(f => f.id === fileData.id ? { ...f, status: 'Failed' } : f));
      }
    }

    isTransferringRef.current = false;
  };

  const readDirectory = async (dirEntry, zip, path) => {
    const dirReader = dirEntry.createReader();
    const entries = await new Promise((resolve) => {
      const allEntries = [];
      const readEntries = () => {
        dirReader.readEntries((batch) => {
          if (batch.length === 0) resolve(allEntries);
          else {
            allEntries.push(...batch);
            readEntries();
          }
        }, () => resolve(allEntries));
      };
      readEntries();
    });

    for (const entry of entries) {
      const fullPath = `${path}/${entry.name}`;
      if (entry.isDirectory) {
        await readDirectory(entry, zip, fullPath);
      } else {
        const file = await new Promise((resolve) => entry.file(resolve, () => resolve(null)));
        if (file) {
          const internalPath = fullPath.substring(fullPath.indexOf('/') + 1);
          zip.file(internalPath, file);
        }
      }
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false);

    if (!e.dataTransfer || !e.dataTransfer.items) return;

    addLog('Scanning dropped items...');

    const items = Array.from(e.dataTransfer.items);
    const resolvedFiles = [];

    for (const item of items) {
      if (item.kind !== 'file') continue;

      const entry = item.webkitGetAsEntry();
      if (!entry) {
        resolvedFiles.push(item.getAsFile());
        continue;
      }

      if (entry.isFile) {
        resolvedFiles.push(item.getAsFile());
      } else if (entry.isDirectory) {
        addLog(`Zipping folder: ${entry.name}/ ...`);
        const zip = new JSZip();
        await readDirectory(entry, zip, entry.name);

        const blob = await zip.generateAsync({
          type: 'blob',
          compression: 'STORE'
        });

        const zipFile = new File([blob], `${entry.name}.zip`, { type: 'application/zip' });
        resolvedFiles.push(zipFile);
      }
    }

    if (resolvedFiles.length > 0) processFiles(resolvedFiles);
  };

  const handleFileInput = (e) => {
    if (!e.target.files) return;
    processFiles(Array.from(e.target.files));
    e.target.value = null;
  };

  const removeFile = (id) => setFiles(prev => prev.filter(f => f.id !== id));
  const handleZoneClick = () => { if (fileInputRef.current) fileInputRef.current.click(); };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="min-h-screen p-8 font-['Inter',sans-serif]">
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-12">
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-3 tracking-tight">
          Transfer <span className="text-[#FF5C00]">Room</span>
        </h1>
        <div className="flex flex-wrap items-center gap-3">
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

          {/* Disconnect Button Inline */}
          <motion.button
            onClick={onLeave}
            className="px-4 py-1.5 ml-1 bg-gradient-to-r from-[#FF5C00] to-[#FF7A33] text-white text-sm font-semibold tracking-wide rounded-md"
            style={{ boxShadow: '0 2px 8px rgba(255, 92, 0, 0.3)' }}
            whileHover={{ scale: 1.05, boxShadow: '0 4px 12px rgba(255, 92, 0, 0.4)' }}
            whileTap={{ scale: 0.98 }}
          >
            Disconnect
          </motion.button>
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-8 mb-8">
        {/* File Drop Zone */}
        <motion.div
          variants={itemVariants}
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={handleZoneClick}
          className={`lg:col-span-2 relative backdrop-blur-2xl rounded-lg p-12 min-h-[300px] flex flex-col items-center justify-center overflow-hidden transition-all duration-300 cursor-pointer ${isDragOver ? 'border-2 border-dashed border-[#FF5C00]' : 'border border-white/5'}`}
          style={{
            background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.8) 0%, rgba(15, 15, 15, 0.9) 100%)',
            boxShadow: isDragOver ? '0 0 30px rgba(255, 92, 0, 0.4), inset 0 0 20px rgba(255, 92, 0, 0.1)' : '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          }}
        >
          <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileInput} />
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-[#FF5C00]/10 to-transparent pointer-events-none" />

          {files.length === 0 ? (
            <div className="text-center">
              <svg className="w-20 h-20 mx-auto mb-6 text-[#FF5C00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <h2 className="text-3xl font-bold text-white mb-3">Drop Files Here</h2>
              <p className="text-gray-500 text-sm mb-8">or click to browse</p>
            </div>
          ) : (
            <div className="w-full space-y-3">
              <AnimatePresence>
                {files.map((file) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    className="bg-black/40 border border-white/10 rounded-lg p-4 flex items-center gap-4"
                    onClick={(e) => e.stopPropagation()}
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
                          initial={{ width: 0 }} animate={{ width: `${file.progress}%` }} transition={{ duration: 0.3 }}
                        />
                      </div>
                      <span className={`text-xs font-semibold w-24 text-right ${file.status.startsWith('Done') ? 'text-green-400' : file.status === 'Failed' ? 'text-red-400' : file.status === 'Sending' ? 'text-[#FF5C00]' : 'text-gray-400'}`}>
                        {file.status}
                      </span>
                      {file.status !== 'Sending' && (
                        <button onClick={(e) => { e.stopPropagation(); removeFile(file.id); }} className="ml-1 p-1 text-gray-600 hover:text-red-400 transition-colors rounded" title="Remove">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        {/* Connection Status Panel */}
        <motion.div
          variants={itemVariants}
          className="backdrop-blur-2xl rounded-lg border border-white/5 p-8"
          style={{
            background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.8) 0%, rgba(15, 15, 15, 0.9) 100%)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          }}
        >
          <h3 className="text-2xl font-bold text-white mb-6">P2P Mesh Status</h3>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-2.5 h-2.5">
                {connectionStatus === 'connecting' ? (
                  <>
                    <span className="absolute w-2.5 h-2.5 rounded-full bg-[#FF5C00] animate-ping" />
                    <span className="absolute w-2.5 h-2.5 rounded-full bg-[#FF5C00]" />
                  </>
                ) : connectionStatus === 'failed' ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" style={{ boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)' }} />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" style={{ boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)' }} />
                )}
              </div>
              <span className="text-gray-300 text-sm font-medium">
                {connectionStatus === 'connecting'
                  ? 'Connecting to server...'
                  : connectionStatus === 'failed'
                    ? 'Connection failed'
                  : (activePeers.filter(p => p.status === 'connected').length > 0 ? 'Active' : 'Waiting for peers...')}
              </span>
            </div>

            <div className="border-t border-white/5 pt-4">
              <p className="text-gray-500 text-xs mb-2 uppercase tracking-widest">Transport</p>
              <p className="text-white font-mono text-sm">SCTP/UDP WebRTC</p>
            </div>

            <div className="border-t border-white/5 pt-4">
              <p className="text-gray-500 text-xs mb-2 uppercase tracking-widest">Peers</p>
              <p className="text-white font-mono text-sm">
                {activePeers.filter(p => p.status === 'connected').length} Connected Nodes
              </p>
            </div>
          </div>

          {/* Active Peers Selector */}
          {activePeers.length > 0 && (
            <div className="border-t border-white/5 pt-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-medium text-sm">Send to Peers:</h4>
                <button
                  onClick={() => setSelectedPeers(new Set(activePeers.map(p => p.id)))}
                  className="text-xs text-[#FF5C00] hover:text-[#FF8C42] transition-colors bg-[#FF5C00]/10 px-2 py-1 rounded"
                >
                  Select All
                </button>
              </div>

              <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {activePeers.map(p => (
                  <label key={p.id} className="flex items-center gap-3 cursor-pointer group p-2 rounded hover:bg-white/5 transition-colors">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        className="peer hidden"
                        checked={selectedPeers.has(p.id)}
                        onChange={() => {
                          setSelectedPeers(prev => {
                            const next = new Set(prev);
                            if (next.has(p.id)) next.delete(p.id);
                            else next.add(p.id);
                            return next;
                          });
                        }}
                      />
                      <div className="w-5 h-5 rounded border border-white/20 bg-black/50 peer-checked:bg-[#FF5C00] peer-checked:border-[#FF5C00] transition-all flex items-center justify-center">
                        <svg className={`w-3 h-3 text-white transition-transform ${selectedPeers.has(p.id) ? 'scale-100' : 'scale-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-gray-300 text-sm font-mono truncate max-w-[150px]" title={p.id}>{p.id.substring(0, 8)}...</span>
                      {p.latency && <span className="text-[#FF5C00] text-[10px]">{p.latency}ms</span>}
                    </div>
                    <span className={`text-xs ml-auto font-medium ${p.status === 'connected' ? 'text-green-500' : 'text-yellow-500'}`}>
                      {p.status}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
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
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
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
