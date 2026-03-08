import React, { useState } from 'react';
import BackgroundEngine from '../components/BackgroundEngine';
import Home from '../pages/Home';
import Room from '../pages/Room';
import About from '../pages/About';
import Developers from '../pages/Developers';

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
        {currentPage === 'home' && (
          <Home 
            onJoinRoom={navigateToRoom}
            onNavigateToAbout={navigateToAbout}
            onNavigateToDevelopers={navigateToDevelopers}
          />
        )}
        
        {currentPage === 'room' && (
          <Room roomId={roomId} onLeave={navigateToHome} />
        )}
        
        {currentPage === 'about' && (
          <About onBack={navigateToHome} />
        )}
        
        {currentPage === 'developers' && (
          <Developers onBack={navigateToHome} />
        )}
      </div>
    </div>
  );
}

export default App;
