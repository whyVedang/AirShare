import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Room = ({ roomId, onLeave }) => {
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [transferProgress, setTransferProgress] = useState(0);
  const [latency, setLatency] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [files, setFiles] = useState([]);
  const [logs, setLogs] = useState([
    'Initializing WebRTC DataChannel...',
    'SCTP over UDP transport established',
    'Signaling server: Connected',
    'Awaiting peer connection...'
  ]);
  const logContainerRef = useRef(null);

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

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const getTimestamp = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour12: false });
  };

  const addLog = (message) => {
    setLogs(prev => [...prev, `[${getTimestamp()}] ${message}`]);
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

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const fileList = e.dataTransfer.files;
    const newFiles = Array.from(fileList).map((file, idx) => ({
      id: Date.now() + idx,
      name: file.name,
      size: file.size,
      status: 'Queued',
      progress: 0
    }));

    setFiles(prev => [...prev, ...newFiles]);
    addLog(`Received ${newFiles.length} file(s) for transfer`);
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
          <p className="text-gray-500 text-sm">
            Code: <span className="text-white font-mono font-bold tracking-wider">{roomId}</span>
          </p>
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
          className={`lg:col-span-2 relative backdrop-blur-2xl rounded-lg p-12 min-h-[300px] flex flex-col items-center justify-center overflow-hidden transition-all duration-300 ${isDragOver
              ? 'border-2 border-dashed border-[#FF5C00]'
              : 'border border-white/5'
            }`}
          style={{
            background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.8) 0%, rgba(15, 15, 15, 0.9) 100%)',
            boxShadow: isDragOver
              ? '0 0 30px rgba(255, 92, 0, 0.4), inset 0 0 20px rgba(255, 92, 0, 0.1)'
              : '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Subtle gradient overlay */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-[#FF5C00]/10 to-transparent" />

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
              <p className="text-white font-mono text-sm">0 Connected</p>
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
