import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

const Home = ({ onJoinRoom, onNavigateToAbout }) => {
  const { isDark } = useTheme();
  const [roomId, setRoomId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleCreateRoom = async () => {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) throw new Error("Failed to create room");

      const data = await response.json();

      navigate(`/room/${data.roomID}`);
    } catch (error) {
      console.error("Error creating room:", error);
      alert("Could not create room. Please try again.");
    }

    setIsGenerating(true);

    if (onJoinRoom) {
      setTimeout(() => {
        onJoinRoom(newRoomId);
      }, 1000);
    }
  };

  const handleJoinRoom = () => {
    if (roomId.trim() && onJoinRoom) {
      setTimeout(() => {
        onJoinRoom(roomId);
      }, 800);
    }
  };



  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15
      }
    }
  };

  return (
    <div className="min-h-screen relative font-['Inter',sans-serif]">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="min-h-screen flex flex-col items-center justify-center p-6"
      >
        {/* Logo with P2P Illustration */}
        <motion.div variants={itemVariants} className="text-center mb-8 md:mb-10 relative">
          {/* P2P Visualization */}
          <div className="relative inline-block">
            {/* Left Device Node */}
            <motion.div
              className="absolute left-[-120px] top-1/2 transform -translate-y-1/2"
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <svg width="80" height="80" viewBox="0 0 80 80" className="drop-shadow-lg">
                {/* Device Circle */}
                <circle cx="40" cy="40" r="30" fill="url(#gradient1)" opacity="0.2" />
                <circle cx="40" cy="40" r="25" fill="none" stroke="url(#gradient1)" strokeWidth="2" />

                {/* Laptop Icon */}
                <rect x="25" y="30" width="30" height="20" rx="2" fill="white" opacity="0.9" />
                <rect x="20" y="50" width="40" height="3" rx="1" fill="white" opacity="0.7" />

                {/* Signal Waves */}
                <motion.path
                  d="M 55 35 Q 60 40 55 45"
                  stroke="#FF5C00"
                  strokeWidth="2"
                  fill="none"
                  opacity="0.6"
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.path
                  d="M 60 30 Q 68 40 60 50"
                  stroke="#FF8C42"
                  strokeWidth="2"
                  fill="none"
                  opacity="0.4"
                  animate={{ opacity: [0.2, 0.6, 0.2] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                />

                <defs>
                  <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FF5C00" />
                    <stop offset="100%" stopColor="#FF8C42" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>

            {/* Right Device Node */}
            <motion.div
              className="absolute right-[-120px] top-1/2 transform -translate-y-1/2"
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1
              }}
            >
              <svg width="80" height="80" viewBox="0 0 80 80" className="drop-shadow-lg">
                {/* Device Circle */}
                <circle cx="40" cy="40" r="30" fill="url(#gradient2)" opacity="0.2" />
                <circle cx="40" cy="40" r="25" fill="none" stroke="url(#gradient2)" strokeWidth="2" />

                {/* Phone Icon */}
                <rect x="30" y="25" width="20" height="30" rx="3" fill="white" opacity="0.9" />
                <circle cx="40" cy="50" r="2" fill="#FF5C00" opacity="0.7" />

                {/* Signal Waves */}
                <motion.path
                  d="M 25 35 Q 20 40 25 45"
                  stroke="#FF5C00"
                  strokeWidth="2"
                  fill="none"
                  opacity="0.6"
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                />
                <motion.path
                  d="M 20 30 Q 12 40 20 50"
                  stroke="#FF8C42"
                  strokeWidth="2"
                  fill="none"
                  opacity="0.4"
                  animate={{ opacity: [0.2, 0.6, 0.2] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 1.3 }}
                />

                <defs>
                  <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FF8C42" />
                    <stop offset="100%" stopColor="#FF5C00" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>

            {/* Connection Lines */}
            <svg className="absolute left-[-100px] top-1/2 transform -translate-y-1/2 pointer-events-none" width="800" height="4" style={{ zIndex: -1 }}>
              <motion.line
                x1="0"
                y1="2"
                x2="800"
                y2="2"
                stroke="url(#lineGradient)"
                strokeWidth="2"
                strokeDasharray="10 5"
                animate={{ strokeDashoffset: [0, -30] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                opacity="0.3"
              />
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#FF5C00" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#FF8C42" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#FF5C00" stopOpacity="0.8" />
                </linearGradient>
              </defs>
            </svg>

            {/* Animated File Icons */}
            <motion.div
              className="absolute left-[-50px] top-1/2 transform -translate-y-1/2"
              animate={{
                x: [0, 600],
                opacity: [0, 1, 1, 0]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
                times: [0, 0.1, 0.9, 1]
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" fill="#FF5C00" opacity="0.8" />
                <polyline points="13 2 13 9 20 9" fill="#FF8C42" opacity="0.6" />
              </svg>
            </motion.div>

            <motion.div
              className="absolute left-[-50px] top-1/2 transform -translate-y-1/2"
              animate={{
                x: [0, 600],
                opacity: [0, 1, 1, 0]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1,
                times: [0, 0.1, 0.9, 1]
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" fill="#FF8C42" opacity="0.8" />
                <polyline points="13 2 13 9 20 9" fill="#FF5C00" opacity="0.6" />
              </svg>
            </motion.div>

            {/* Main Title */}
            <h1 className="text-6xl md:text-8xl font-black mb-2 tracking-tighter relative z-10" style={{ lineHeight: 0.85 }}>
              <span style={{ color: isDark ? '#ffffff' : '#000000' }}>Air</span><span className="text-[#FF5C00]">Share</span>
            </h1>
            <div className="h-1 bg-gradient-to-r from-[#FF5C00] via-[#FF8C42] to-transparent mt-4" />
          </div>

          <p className="text-gray-500 text-lg font-medium mt-6 md:mt-8 tracking-wide">
            Direct. Encrypted. Unstoppable.
          </p>
          <p className="text-[#FF5C00]/40 text-xs mt-2 font-mono uppercase tracking-widest">
            WebRTC • P2P • Zero-Server
          </p>
        </motion.div>

        {/* Cards Grid */}
        <div className="w-full max-w-6xl grid md:grid-cols-2 gap-6">
          {/* Create Room Card */}
          <motion.div
            variants={itemVariants}
            className="relative backdrop-blur-2xl rounded-lg p-6 md:p-8 border border-white/5 overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.8) 0%, rgba(15, 15, 15, 0.9) 100%)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
            }}
          >
            {/* Subtle gradient overlay */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#FF5C00]/10 to-transparent" />

            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-8 bg-gradient-to-b from-[#FF5C00] to-[#FF8C42]" />
              <h2 className="text-3xl font-bold text-white tracking-tight">
                Create Room
              </h2>
            </div>
            <p className="text-gray-500 mb-6 text-sm leading-relaxed">
              Start a new transfer session and share your unique room code
            </p>

            <motion.button
              onClick={handleCreateRoom}
              className="w-full py-4 px-8 bg-gradient-to-r from-[#FF5C00] to-[#FF7A33] text-white rounded-lg font-bold text-base tracking-wide relative overflow-hidden group"
              style={{
                boxShadow: '0 4px 20px rgba(255, 92, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              }}
              whileHover={{
                scale: 1.02,
                boxShadow: '0 6px 30px rgba(255, 92, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="relative z-10">Generate Code</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </motion.button>


          </motion.div>

          {/* Join Room Card */}
          <motion.div
            variants={itemVariants}
            className="relative backdrop-blur-2xl rounded-lg p-6 md:p-8 border border-white/5 overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.8) 0%, rgba(15, 15, 15, 0.9) 100%)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
            }}
          >
            {/* Subtle gradient overlay */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-[#FF5C00]/10 to-transparent" />

            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-8 bg-gradient-to-b from-[#FF8C42] to-[#FF5C00]" />
              <h2 className="text-3xl font-bold text-white tracking-tight">
                Join Room
              </h2>
            </div>
            <p className="text-gray-500 mb-6 text-sm leading-relaxed">
              Enter a room code to connect and start transferring
            </p>

            <div className="space-y-5">
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-3 uppercase tracking-widest">
                  Room Code
                </label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
                  placeholder="ABC123"
                  className="w-full py-4 px-6 bg-black/60 border border-white/10 text-white rounded-lg font-mono text-2xl text-center placeholder:text-gray-700 focus:outline-none focus:border-[#FF5C00]/50 focus:ring-2 focus:ring-[#FF5C00]/20 transition-all uppercase tracking-widest"
                  style={{
                    boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.4)'
                  }}
                  maxLength={6}
                />
              </div>

              <motion.button
                onClick={handleJoinRoom}
                disabled={!roomId.trim()}
                className="w-full py-4 px-8 bg-white/5 hover:bg-white/10 disabled:bg-black/40 disabled:cursor-not-allowed border border-white/10 hover:border-[#FF5C00]/30 disabled:border-white/5 text-white rounded-lg font-bold text-base tracking-wide transition-all disabled:text-gray-700"
                style={!roomId.trim() ? {} : {
                  boxShadow: '0 2px 12px rgba(255, 92, 0, 0.1)'
                }}
                whileHover={roomId.trim() ? {
                  scale: 1.02,
                  boxShadow: '0 4px 20px rgba(255, 92, 0, 0.2)'
                } : {}}
                whileTap={roomId.trim() ? { scale: 0.98 } : {}}
              >
                Connect to Room
              </motion.button>
            </div>
          </motion.div>
        </div>

        {/* Footer Navigation */}
        <motion.div
          variants={itemVariants}
          className="mt-8 flex gap-6"
        >
          <motion.button
            onClick={() => onNavigateToAbout?.()}
            className="px-6 py-2 text-gray-500 hover:text-[#FF5C00] text-sm font-medium tracking-wide border-b border-transparent hover:border-[#FF5C00]/50 transition-all"
            whileHover={{ y: -2 }}
          >
            About
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default Home;
