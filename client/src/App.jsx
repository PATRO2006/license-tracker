import React, { useEffect, useState, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar, Toast } from './components.jsx';
import { useAuth } from './auth.jsx';
import { api } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clients from './pages/Clients.jsx';
import ClientDetail from './pages/ClientDetail.jsx';
import Requests from './pages/Requests.jsx';
import Notifications from './pages/Notifications.jsx';
import ClientHome from './pages/ClientHome.jsx';
import TrainingReport from './pages/TrainingReport.jsx';

export default function App() {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [toast, setToast] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const notify = useCallback((msg) => setToast(msg), []);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    api.requests('Pending').then((r) => setPendingCount(r.length)).catch(() => {});
  }, [refreshKey, user]);

  if (!user) return <Login />;

  const isAdmin = user.role === 'admin';

  return (
    <div className="app">
      <Sidebar pendingCount={pendingCount} notify={notify} />
      <div className="main">
        <Routes>
          {isAdmin ? (
            <>
              <Route path="/" element={<Dashboard key={refreshKey} />} />
              <Route path="/clients" element={<Clients key={refreshKey} notify={notify} onChange={refresh} />} />
              <Route path="/clients/:id" element={<ClientDetail key={refreshKey} notify={notify} onChange={refresh} />} />
              <Route path="/requests" element={<Requests key={refreshKey} notify={notify} onChange={refresh} />} />
              <Route path="/training-report" element={<TrainingReport key={refreshKey} />} />
              <Route path="/notifications" element={<Notifications key={refreshKey} />} />
            </>
          ) : (
            <Route path="/" element={<ClientHome key={refreshKey} notify={notify} onChange={refresh} />} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
