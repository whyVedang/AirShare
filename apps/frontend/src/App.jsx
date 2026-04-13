import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import BackgroundEngine from './components/BackgroundEngine';
import Home from './pages/Home';
import Room from './pages/Room';
import About from './pages/About';
import Developers from './pages/Developers';

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

function App() {
  const [currentPage, setCurrentPage] = useState('home'); // 'home', 'room', 'about', 'developers'
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

  const navigateToDevelopers = () => {
    setCurrentPage('developers');
  };

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a', position: 'relative' }}>
      <BackgroundEngine />

      <div style={{ position: 'relative', zIndex: 10 }}>
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
                onNavigateToDevelopers={navigateToDevelopers}
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

          {currentPage === 'developers' && (
            <motion.div
              key="developers"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
            >
              <Developers onBack={navigateToHome} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
