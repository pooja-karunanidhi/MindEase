import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { DoctorDiscovery } from './pages/DoctorDiscovery';
import { Chat } from './pages/Chat';
import { AdminDashboard } from './pages/AdminDashboard';
import { AIChatbot } from './components/AIChatbot';

function PrivateRoute({ children, role }: { children: React.ReactNode, role?: string }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/" />;
  
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route path="/dashboard" element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } />
            
            <Route path="/doctors" element={
              <PrivateRoute role="user">
                <DoctorDiscovery />
              </PrivateRoute>
            } />
            
            <Route path="/chat/:appointmentId" element={
              <PrivateRoute>
                <Chat />
              </PrivateRoute>
            } />
            
            <Route path="/admin" element={
              <PrivateRoute role="admin">
                <AdminDashboard />
              </PrivateRoute>
            } />
          </Routes>
        </Layout>
        <AIChatbot />
      </Router>
    </AuthProvider>
  );
}
