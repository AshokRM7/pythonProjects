import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SignIn from './components/SignIn';
import Home from './components/Home';
import { DashboardPage } from './pages/DashboardPage';

export default function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already signed in
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setCurrentUser(storedUser);
    }
    setIsLoading(false);
  }, []);

  const handleSignIn = (username: string) => {
    localStorage.setItem('currentUser', username);
    setCurrentUser(username);
  };

  const handleSignOut = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Dashboard is the landing page. It is protected. */}
        <Route
          path="/"
          element={
            currentUser ? (
              <DashboardPage />
            ) : (
              <Navigate to="/signin" replace />
            )
          }
        />

        <Route
          path="/home"
          element={
            currentUser ? (
              <Home currentUser={currentUser} onSignOut={handleSignOut} />
            ) : (
              <Navigate to="/signin" replace />
            )
          }
        />
        <Route
          path="/home/ticket/:ticketId"
          element={
            currentUser ? (
              <Home currentUser={currentUser} onSignOut={handleSignOut} />
            ) : (
              <Navigate to="/signin" replace />
            )
          }
        />
        <Route
          path="/signin"
          element={
            !currentUser ? (
              <SignIn onSignIn={handleSignIn} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
