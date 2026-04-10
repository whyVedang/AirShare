import React from 'react';
import { motion } from 'framer-motion';

const Developers = ({ onBack }) => {
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
      className="min-h-screen p-12"
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-20">
          <h1 className="text-7xl font-bold text-white mb-4 tracking-tight">
            For <span className="text-[#FF5C00]">Developers</span>
          </h1>
          <div className="h-1 w-24 bg-gradient-to-r from-[#FF5C00] to-[#FF8C42] rounded-full" />
        </motion.div>

        {/* Architecture Section */}
        <div className="space-y-12">
          <motion.section variants={itemVariants}>
            <h2 className="text-3xl font-bold text-white mb-6">
              Architecture
            </h2>
            <div className="bg-black/80 border border-white/10 rounded-lg p-8 font-mono" style={{
              boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.4)'
            }}>
              <pre className="text-[#FF5C00]/80 text-sm overflow-x-auto">
                {`┌─────────────────────────────────────────────┐
│  Browser A          Signaling Server         │
│     ↓                      ↓                  │
│  [Offer/Answer Exchange via Socket.io]       │
│     ↓                      ↓                  │
│  [ICE Candidate Gathering]                   │
│     ↓                                         │
│  ┌──────────────────────────────────┐        │
│  │   WebRTC P2P DataChannel         │        │
│  │   SCTP over UDP                  │        │
│  │   Transport Layer                │        │
│  └──────────────────────────────────┘        │
│     ↓                                         │
│  Browser B                                    │
└─────────────────────────────────────────────┘`}
              </pre>
            </div>
          </motion.section>

          <motion.section variants={itemVariants}>
            <h2 className="text-3xl font-bold text-white mb-6">
              Technical Specifications
            </h2>
            <div className="space-y-4">
              <div className="border-l-2 border-[#FF5C00] pl-6 py-3 bg-black/20 rounded-r">
                <h3 className="font-mono text-[#FF5C00] font-semibold mb-2">
                  Transport Protocol
                </h3>
                <p className="text-gray-300 text-sm font-['JetBrains_Mono',monospace]">
                  <span className="text-gray-500">Protocol:</span> SCTP (Stream Control Transmission Protocol)
                  <br />
                  <span className="text-gray-500">Layer:</span> Over UDP via WebRTC DataChannels
                  <br />
                  <span className="text-gray-500">Features:</span> Reliable, ordered delivery with congestion control
                </p>
              </div>

              <div className="border-l-2 border-[#FF8C42] pl-6 py-3 bg-black/20 rounded-r">
                <h3 className="font-mono text-[#FF8C42] font-semibold mb-2">
                  Chunking Strategy
                </h3>
                <p className="text-gray-300 text-sm font-['JetBrains_Mono',monospace]">
                  <span className="text-gray-500">Base Size:</span> 16KB chunks
                  <br />
                  <span className="text-gray-500">Adaptive Range:</span> 16KB - 64KB (dynamic based on network conditions)
                  <br />
                  <span className="text-gray-500">Algorithm:</span> AIMD (Additive Increase Multiplicative Decrease)
                </p>
              </div>

              <div className="border-l-2 border-[#FF5C00] pl-6 py-3 bg-black/20 rounded-r">
                <h3 className="font-mono text-[#FF5C00] font-semibold mb-2">
                  Signaling Server
                </h3>
                <p className="text-gray-300 text-sm font-['JetBrains_Mono',monospace]">
                  <span className="text-gray-500">Framework:</span> Node.js + ws (WebSocket)
                  <br />
                  <span className="text-gray-500">Role:</span> SDP/ICE candidate exchange only
                  <br />
                  <span className="text-gray-500">Data Flow:</span> Zero file data passes through server
                </p>
              </div>
            </div>
          </motion.section>

          <motion.section variants={itemVariants}>
            <h2 className="text-3xl font-bold text-white mb-6">
              Frontend Stack
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { name: 'React 18', version: '18.2.0', type: 'UI Framework' },
                { name: 'Canvas API', version: 'Native', type: 'Graphics' },
                { name: 'Framer Motion', version: '^12.0.0', type: 'Animations' },
                { name: 'Vite', version: '8.0.7', type: 'Build Tool' },
                { name: 'Tailwind CSS', version: '3.4.1', type: 'Styling' },
                { name: 'WebSocket (ws)', version: 'Native', type: 'Signaling' },
                { name: 'Zustand', version: '4.5.0', type: 'State Management' },
                { name: 'WebRTC', version: 'Native', type: 'P2P Transfer' },
              ].map((tech, i) => (
                <div key={i} className="bg-black/60 border border-white/10 rounded-lg p-4" style={{
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                }}>
                  <h4 className="text-white font-semibold">{tech.name}</h4>
                  <p className="text-[#FF5C00] font-mono text-sm mt-1">{tech.version}</p>
                  <p className="text-gray-500 text-xs mt-1">{tech.type}</p>
                </div>
              ))}
            </div>
          </motion.section>

          <motion.section variants={itemVariants}>
            <h2 className="text-3xl font-bold text-white mb-6">
              Repository
            </h2>
            <div className="bg-black/80 border border-white/10 rounded-lg p-8" style={{
              boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.4)'
            }}>
              <p className="text-gray-400 mb-4">
                AirShare is open source and available on GitHub:
              </p>
              <code className="text-[#FF5C00] font-mono text-lg">
                github.com/username/airshare
              </code>
            </div>
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
}

export default Developers;

