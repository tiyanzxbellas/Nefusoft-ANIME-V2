import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import Welcome from './pages/Welcome';

const FloatingLiveChat = lazy(() => import('./components/FloatingLiveChat'));
const Home = lazy(() => import('./pages/Home'));
const Explore = lazy(() => import('./pages/Explore'));
const Ongoing = lazy(() => import('./pages/Ongoing'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Watch = lazy(() => import('./pages/Watch'));
const History = lazy(() => import('./pages/History'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Manga = lazy(() => import('./pages/Manga'));
const Donghua = lazy(() => import('./pages/Donghua'));

import { useEffect } from 'react';

function AppContent() {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  useEffect(() => {
    const isManga = location.pathname.startsWith('/manga');
    console.log("Current pathname is:", location.pathname, "isManga is:", isManga);

    // 1. Viewport Meta tag
    let metaViewport = document.querySelector('meta[name="viewport"]');
    if (!metaViewport) {
      metaViewport = document.createElement('meta');
      metaViewport.name = 'viewport';
      document.head.appendChild(metaViewport);
    }

    if (isManga) {
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=5.0, user-scalable=yes');
      document.documentElement.style.touchAction = 'auto';
      document.body.style.touchAction = 'auto';
    } else {
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      document.documentElement.style.touchAction = 'manipulation';
      document.body.style.touchAction = 'manipulation';
    }

    // 2. Gesture prevention for non-manga (especially iOS Safari)
    const handleGestureStart = (e) => {
      if (!isManga) {
        e.preventDefault();
      }
    };

    const handleTouchMove = (e) => {
      if (!isManga && e.touches.length > 1) {
        e.preventDefault();
      }
    };

    // Add event listeners (gesturestart is Safari-specific)
    document.addEventListener('gesturestart', handleGestureStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    // Cleanup on path change or unmount
    return () => {
      document.removeEventListener('gesturestart', handleGestureStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [location.pathname]);

  return (
    <>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/home" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/manga" element={<Manga />} />
        <Route path="/donghua" element={<Donghua />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/history" element={<History />} />
        <Route path="/ongoing" element={<Ongoing />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/anime/:slug/:episode?" element={<Watch />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      {!isLanding && <FloatingLiveChat />}
    </>
  );
}

function App() {
  return (
    <Router>
      <Suspense fallback={<div className="min-h-screen bg-[#0a0a0c]"></div>}>
        <AppContent />
      </Suspense>
    </Router>
  );
}

export default App;