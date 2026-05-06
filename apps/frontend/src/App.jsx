import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import BackgroundEngine from './components/BackgroundEngine';
import ThemeToggle from './components/ThemeToggle';
import Home from './pages/Home';
import Room from './pages/Room';
import About from './pages/About';
import { ThemeProvider, useTheme } from './context/ThemeContext';

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 }
};

const pageTransition = {
  type: 'tween',
  duration: 0.3,
  ease: 'easeInOut'
};

function AppContent() {
  const { isDark } = useTheme();
  const [currentPage, setCurrentPage] = useState('home');
  const [roomId, setRoomId] = useState('');

  const navigateToRoom = (id) => {
    setRoomId(id);
    setCurrentPage('room');
  };

  const navigateToHome = () => {
    setCurrentPage('home');
    setRoomId('');
  };

  const navigateToAbout = () => {
    setCurrentPage('about');
  };

  const backgroundColor = isDark ? '#0a0a0a' : '#FAF7F2';

  return (
    <div className="w-screen h-screen overflow-hidden" style={{ background: backgroundColor, position: 'relative', transition: 'background-color 0.3s ease' }}>
      <BackgroundEngine />
      <ThemeToggle />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
        <AnimatePresence mode="wait">
          {currentPage === 'home' && (
            <motion.div
              key="home"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
            >
              <Home
                onJoinRoom={navigateToRoom}
                onNavigateToAbout={navigateToAbout}
              />
            </motion.div>
          )}

          {currentPage === 'room' && (
            <motion.div
              key="room"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
            >
              <Room roomId={roomId} onLeave={navigateToHome} />
            </motion.div>
          )}

          {currentPage === 'about' && (
            <motion.div
              key="about"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
            >
              <About onBack={navigateToHome} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
