import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

const About = ({ onBack }) => {
  const { isDark } = useTheme();

  // Dynamic color classes based on theme
  const bgPrimary = isDark ? 'bg-[#0a0a0a]' : 'bg-[#FAF7F2]';
  const bgSecondary = isDark ? 'bg-[#141414]' : 'bg-[#F5F1ED]';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-gray-300' : 'text-slate-600';
  const textTertiary = isDark ? 'text-gray-400' : 'text-slate-500';
  const dividerColor = isDark ? 'from-[#FF5C00]/20' : 'from-[#FF5C00]/10';
  const techStack = [
    { name: 'WebRTC', why: 'Direct peer-to-peer without middleman' },
    { name: 'React', why: 'Fast component-based UI' },
    { name: 'Framer Motion', why: 'Smooth interactions' },
    { name: 'Tailwind CSS', why: 'Utility-first design system' },
    { name: 'WebSocket Signaling', why: 'Minimal room discovery server' },
    { name: 'ChunkManager', why: 'Adaptive 16KB-64KB chunking' }
  ];

  return (
    <div
      className={`min-h-screen font-['Inter',sans-serif] ${bgPrimary}`}
    >
      {/* Hero Section - Bold & Asymmetric */}
      <section className="relative py-24 md:py-40 px-8 md:px-12 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 md:gap-16 items-center">
            <div className="order-2 md:order-1">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <h1 className={`text-6xl md:text-7xl lg:text-8xl font-black ${textPrimary} leading-none tracking-tight mb-6`}>
                  Send Files.
                  <br />
                  <span className="text-[#FF5C00]">No Server.</span>
                </h1>
                <p className={`text-lg md:text-xl ${textSecondary} font-light mb-8 max-w-md leading-relaxed`}>
                  Direct peer-to-peer transfers. Encrypted. No storage. No middleman. Built for real people.
                </p>
                <div className="flex gap-4 mb-12">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-[#FF5C00]" />
                    <span className={`text-sm ${textSecondary} font-medium`}>Browser-Native P2P</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-[#FF5C00]" />
                    <span className={`text-sm ${textSecondary} font-medium`}>End-to-End Encrypted</span>
                  </div>
                </div>
              </motion.div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="hidden md:flex order-1 md:order-2 items-center justify-center relative h-96"
            >
              {/* P2P Transfer Animation */}
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Connection line */}
                <div className="absolute inset-y-1/2 left-0 right-0 h-1 bg-gradient-to-r from-[#FF5C00] to-transparent" style={{ transform: 'translateY(-2px)' }} />

                {/* Left - Laptop */}
                <motion.div
                  initial={{ opacity: 0, x: -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="absolute left-0 flex flex-col items-center"
                >
                  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="8" y="8" width="56" height="40" rx="2" stroke="#FF5C00" strokeWidth="2.5" />
                    <rect x="12" y="12" width="48" height="32" fill="rgba(255, 92, 0, 0.1)" />
                    <rect x="20" y="48" width="40" height="3" rx="1.5" fill="#FF5C00" />
                    <circle cx="40" cy="60" r="3" fill="#FF5C00" />
                  </svg>
                  <span className={`text-xs ${textTertiary} mt-2`}>Laptop</span>
                </motion.div>

                {/* Center - Animated File */}
                <motion.div
                  animate={{ x: [0, 120, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute left-1/2 flex flex-col items-center"
                  style={{ transform: 'translateX(-50%)' }}
                >
                  <motion.div
                    animate={{ opacity: [1, 0.6, 1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="10" y="8" width="40" height="44" rx="2" stroke="#FF8C42" strokeWidth="2.5" fill="rgba(255, 140, 66, 0.1)" />
                      <line x1="14" y1="20" x2="46" y2="20" stroke="#FF8C42" strokeWidth="1.5" />
                      <line x1="14" y1="28" x2="46" y2="28" stroke="#FF8C42" strokeWidth="1.5" />
                      <line x1="14" y1="36" x2="40" y2="36" stroke="#FF8C42" strokeWidth="1.5" />
                      <line x1="14" y1="44" x2="36" y2="44" stroke="#FF8C42" strokeWidth="1.5" />
                    </svg>
                  </motion.div>
                </motion.div>

                {/* Right - Phone */}
                <motion.div
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="absolute right-0 flex flex-col items-center"
                >
                  <svg width="60" height="80" viewBox="0 0 60 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="8" y="6" width="44" height="68" rx="3" stroke="#FF5C00" strokeWidth="2.5" />
                    <rect x="12" y="10" width="36" height="56" fill="rgba(255, 92, 0, 0.1)" rx="2" />
                    <circle cx="30" cy="72" r="2.5" fill="#FF5C00" />
                  </svg>
                  <span className={`text-xs ${textTertiary} mt-2`}>Phone</span>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Angle Divider */}
      <div className="px-8 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="h-px bg-gradient-to-r from-[#FF5C00]/20 to-transparent" />
        </div>
      </div>

      {/* What is AirShare - Bold Statement */}
      <section className={`py-32 md:py-48 px-8 md:px-12 ${bgSecondary} relative overflow-hidden`}>
        {/* Geometric Background Pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-5" preserveAspectRatio="none">
          <defs>
            <pattern id="diagonals-1" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="100" y2="100" stroke="#FF5C00" strokeWidth="1.5" />
              <line x1="100" y1="0" x2="0" y2="100" stroke="#FF5C00" strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#diagonals-1)" />
        </svg>

        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
          className="max-w-7xl mx-auto relative z-10"
        >
          <div className="space-y-8">
            <h2 className={`text-5xl md:text-7xl font-black ${textPrimary} leading-tight w-full md:w-4/5`}>
              No cloud. No server. No tracking.
            </h2>
            <p className={`text-lg md:text-2xl ${textSecondary} font-light leading-relaxed w-full md:w-3/5`}>
              AirShare is a browser-native, serverless platform for peer-to-peer file transfer. Files never leave your device. They transfer directly from one browser to another using WebRTC.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-16 md:mt-24">
            <div className="space-y-3">
              <div className="text-sm font-black text-[#FF5C00] tracking-widest">ENCRYPTION</div>
              <p className={`text-base ${textTertiary} leading-relaxed`}>
                DTLS/SRTP encryption. Your data stays encrypted end-to-end.
              </p>
            </div>
            <div className="space-y-3">
              <div className="text-sm font-black text-[#FF5C00] tracking-widest">NO LIMITS</div>
              <p className={`text-base ${textTertiary} leading-relaxed`}>
                Transfer files of any size. Adaptive chunking handles network conditions.
              </p>
            </div>
            <div className="space-y-3">
              <div className="text-sm font-black text-[#FF5C00] tracking-widest">ANY DEVICE</div>
              <p className={`text-base ${textTertiary} leading-relaxed`}>
                Desktop, tablet, mobile. Any browser supporting WebRTC works.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Divider */}
      <div className="px-8 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="h-px bg-gradient-to-r from-transparent to-[#FF5C00]/20" />
        </div>
      </div>

      {/* How It Works - Bold Statement */}
      <section className={`py-32 md:py-48 px-8 md:px-12 ${bgPrimary}`}>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="max-w-7xl mx-auto"
        >
          <h2 className={`text-5xl md:text-6xl font-black mb-20 leading-tight ${isDark ? 'bg-gradient-to-r from-[#FF5C00] to-white bg-clip-text text-transparent' : 'bg-gradient-to-r from-[#FF5C00] to-black bg-clip-text text-transparent'}`}>
            How it Works
          </h2>

          <div className="space-y-12 md:space-y-20">
            {/* Step 1 */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="grid md:grid-cols-12 gap-8 items-center"
            >
              <div className="md:col-span-1">
                <div className="text-6xl md:text-7xl font-black text-[#FF5C00]/20">01</div>
              </div>
              <div className="md:col-span-11">
                <h3 className={`text-3xl md:text-4xl font-black ${textPrimary} mb-3`}>Generate a Room Code</h3>
                <p className={`text-lg ${textTertiary} font-light`}>One user creates a transfer room and gets a unique code. That's it.</p>
              </div>
            </motion.div>

            {/* Step 2 */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="grid md:grid-cols-12 gap-8 items-center"
            >
              <div className="md:col-span-1">
                <div className="text-6xl md:text-7xl font-black text-[#FF5C00]/20">02</div>
              </div>
              <div className="md:col-span-11">
                <h3 className={`text-3xl md:text-4xl font-black ${textPrimary} mb-3`}>Share the Code</h3>
                <p className={`text-lg ${textTertiary} font-light`}>Share the code with your contact however you want. They enter it and connect directly.</p>
              </div>
            </motion.div>

            {/* Step 3 */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="grid md:grid-cols-12 gap-8 items-center"
            >
              <div className="md:col-span-1">
                <div className="text-6xl md:text-7xl font-black text-[#FF5C00]/20">03</div>
              </div>
              <div className="md:col-span-11">
                <h3 className={`text-3xl md:text-4xl font-black ${textPrimary} mb-3`}>Transfer Files</h3>
                <p className={`text-lg ${textTertiary} font-light`}>Files transfer browser-to-browser instantly. Direct. Encrypted. No servers involved.</p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Divider */}
      <div className="px-8 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="h-px bg-gradient-to-r from-[#FF5C00]/20 to-transparent" />
        </div>
      </div>

      {/* Key Features - Bold & Simple */}
      <section className={`py-32 md:py-48 px-8 md:px-12 ${bgSecondary} relative overflow-hidden`}>
        {/* Geometric Background Pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-5" preserveAspectRatio="none">
          <defs>
            <pattern id="diagonals-3" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
              <line x1="0" y1="60" x2="60" y2="0" stroke="#FF5C00" strokeWidth="1.5" />
              <line x1="60" y1="120" x2="120" y2="60" stroke="#FF5C00" strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#diagonals-3)" />
        </svg>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="max-w-7xl mx-auto relative z-10"
        >
          <h2 className={`text-5xl md:text-6xl font-black mb-20 leading-tight ${isDark ? 'bg-gradient-to-r from-[#FF5C00] to-white bg-clip-text text-transparent' : 'bg-gradient-to-r from-[#FF5C00] to-black bg-clip-text text-transparent'}`}>
            Built for the Real World
          </h2>

          <div className="grid md:grid-cols-2 gap-12">
            {[
              {
                title: 'Zero Server Storage',
                desc: 'Files never touch a server. End-to-end encrypted streams.'
              },
              {
                title: 'Unlimited Transfers',
                desc: 'No file size limits. Adaptive chunking handles any connection.'
              },
              {
                title: 'Works Everywhere',
                desc: 'Desktop, mobile, tablet. Any browser with WebRTC support.'
              },
              {
                title: 'Private by Default',
                desc: 'DTLS/SRTP encryption. No tracking. No data collection.'
              }
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                viewport={{ once: true }}
                className={`space-y-4 pb-8 md:pb-0 border-b border-[#FF5C00]/10 md:border-b-0`}
              >
                <h3 className={`text-2xl md:text-3xl font-bold ${textPrimary}`}>{feature.title}</h3>
                <p className={`text-lg ${textTertiary} font-light`}>{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Divider */}
      <div className="px-8 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="h-px bg-gradient-to-r from-transparent to-[#FF5C00]/20" />
        </div>
      </div>

      {/* Tech Stack - Minimal & Bold */}
      <section className={`py-32 md:py-48 px-8 md:px-12 ${bgPrimary}`}>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="max-w-7xl mx-auto"
        >
          <h2 className={`text-5xl md:text-6xl font-black mb-20 leading-tight ${textPrimary}`}>
            Built With
          </h2>

          <div className="grid md:grid-cols-3 gap-12">
            {techStack.map((tech, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
                viewport={{ once: true }}
                className="space-y-3"
              >
                <h3 className="text-2xl font-bold text-[#FF5C00]">{tech.name}</h3>
                <p className={`text-base ${textTertiary} leading-relaxed font-light`}>{tech.why}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Footer CTA */}
      <section className={`py-24 md:py-32 px-8 md:px-12 ${isDark ? 'bg-gradient-to-b from-[#141414] to-[#0a0a0a]' : 'bg-gradient-to-b from-[#F5F1ED] to-[#FAF7F2]'} relative overflow-hidden`}>
        {/* Geometric Background Pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-5" preserveAspectRatio="none">
          <defs>
            <pattern id="diagonals-5" x="0" y="0" width="90" height="90" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="90" y2="90" stroke="#FF5C00" strokeWidth="1.5" />
              <line x1="45" y1="0" x2="0" y2="45" stroke="#FF5C00" strokeWidth="1.5" />
              <line x1="90" y1="45" x2="45" y2="90" stroke="#FF5C00" strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#diagonals-5)" />
        </svg>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
          className="max-w-7xl mx-auto text-center relative z-10"
        >
          <h3 className={`text-3xl md:text-4xl font-bold ${textPrimary} mb-4`}>
            Ready to send files differently?
          </h3>
          <p className={`text-lg ${textTertiary} mb-12 font-light`}>
            Fast. Secure. Direct. No middleman.
          </p>
          <motion.button
            onClick={onBack}
            className="px-14 py-5 bg-[#FF5C00] text-white text-lg font-bold tracking-wide rounded-lg hover:bg-[#FF7A33] transition-colors duration-200"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            &lt; Back to Home
          </motion.button>
        </motion.div>
      </section>
    </div>
  );
};

export default About;

