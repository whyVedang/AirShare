import React from 'react';
import { motion } from 'framer-motion';

const About = ({ onBack }) => {
  const containerVariants = {
    hidden: { opacity: 0, x: 100 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: 'spring',
        stiffness: 80,
        damping: 20,
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
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen p-12 font-['Inter',sans-serif]"
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-20">
          <h1 className="text-7xl font-bold text-white mb-4 tracking-tight">
            About <span className="text-[#FF5C00]">AirShare</span>
          </h1>
          <div className="h-1 w-24 bg-gradient-to-r from-[#FF5C00] to-[#FF8C42] rounded-full" />
        </motion.div>

        {/* Content */}
        <div className="space-y-12">
          <motion.section variants={itemVariants}>
            <h2 className="text-3xl font-bold text-white mb-6">
              What is AirShare?
            </h2>
            <p className="text-gray-300 text-lg leading-relaxed mb-4">
              AirShare is a <span className="text-[#FF5C00] font-semibold">serverless peer-to-peer</span> file 
              transfer application that enables direct browser-to-browser file sharing without any 
              centralized storage.
            </p>
            <p className="text-gray-400 leading-relaxed">
              Built on WebRTC technology, your files are transferred directly between peers using 
              encrypted DataChannels. No server ever touches your data.
            </p>
          </motion.section>

          <motion.section variants={itemVariants}>
            <h2 className="text-3xl font-bold text-white mb-6">
              Technology Stack
            </h2>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="border-l-2 border-[#FF5C00] pl-5 py-2 bg-black/20 rounded-r">
                <h3 className="text-lg font-semibold text-[#FF5C00] mb-2">
                  WebRTC DataChannels
                </h3>
                <p className="text-gray-400 text-sm">
                  Direct peer-to-peer connections using SCTP over UDP for reliable, 
                  ordered data transfer.
                </p>
              </div>
              
              <div className="border-l-2 border-[#FF8C42] pl-5 py-2 bg-black/20 rounded-r">
                <h3 className="text-lg font-semibold text-[#FF8C42] mb-2">
                  React + Canvas
                </h3>
                <p className="text-gray-400 text-sm">
                  Modern UI with hardware-accelerated graphics for smooth visualization.
                </p>
              </div>
              
              <div className="border-l-2 border-[#FF5C00] pl-5 py-2 bg-black/20 rounded-r">
                <h3 className="text-lg font-semibold text-[#FF5C00] mb-2">
                  ChunkManager
                </h3>
                <p className="text-gray-400 text-sm">
                  Adaptive chunking algorithm (16KB-64KB) for optimal throughput 
                  and congestion control.
                </p>
              </div>
              
              <div className="border-l-2 border-[#FF8C42] pl-5 py-2 bg-black/20 rounded-r">
                <h3 className="text-lg font-semibold text-[#FF8C42] mb-2">
                  Zero Server Storage
                </h3>
                <p className="text-gray-400 text-sm">
                  Files stream directly between browsers. Signaling server only 
                  facilitates initial handshake.
                </p>
              </div>
            </div>
          </motion.section>

          <motion.section variants={itemVariants}>
            <h2 className="text-3xl font-bold text-white mb-6">
              Privacy & Security
            </h2>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start gap-3">
                <span className="text-[#FF5C00]">•</span>
                <span>End-to-end transfer - no intermediary storage</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#FF5C00]">•</span>
                <span>Encrypted WebRTC connections (DTLS/SRTP)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#FF5C00]">•</span>
                <span>No file size limits or bandwidth throttling</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#FF5C00]">•</span>
                <span>Temporary room codes - sessions expire after transfer</span>
              </li>
            </ul>
          </motion.section>
        </div>

        {/* Back Button */}
        <motion.div variants={itemVariants} className="mt-16">
          <motion.button
            onClick={onBack}
            className="px-10 py-4 bg-gradient-to-r from-[#FF5C00] to-[#FF7A33] text-white font-semibold text-base tracking-wide rounded-lg"
            style={{
              boxShadow: '0 4px 20px rgba(255, 92, 0, 0.3)'
            }}
            whileHover={{ 
              scale: 1.05,
              boxShadow: '0 6px 30px rgba(255, 92, 0, 0.5)'
            }}
            whileTap={{ scale: 0.98 }}
          >
            ← Back to Home
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default About;

