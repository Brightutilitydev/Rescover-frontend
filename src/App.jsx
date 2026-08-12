import React, { useState, useEffect } from 'react';
import { Microscope, LogOut } from 'lucide-react';
import AuthGateway from './views/AuthGateway';
import Dashboard from './views/Dashboard';
import WorkbenchView from './views/WorkbenchView';

export default function App() {
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem('rescover_user');
    return cached ? JSON.parse(cached) : null;
  });

  const [isRegistering, setIsRegistering] = useState(false);
  const [view, setView] = useState(() => localStorage.getItem('rescover_view') || 'dashboard');
  const [activePaperId, setActivePaperId] = useState(() => {
    return localStorage.getItem('rescover_active_paper') || null;
  });

  useEffect(() => {
    if (user) localStorage.setItem('rescover_user', JSON.stringify(user));
    else localStorage.removeItem('rescover_user');
  }, [user]);

  useEffect(() => {
    if (activePaperId) localStorage.setItem('rescover_active_paper', activePaperId);
    else localStorage.removeItem('rescover_active_paper');
  }, [activePaperId]);

  useEffect(() => {
    if (view === 'dashboard') localStorage.removeItem('rescover_view');
    else localStorage.setItem('rescover_view', view);
  }, [view]);

  const openDashboard = () => {
    setActivePaperId(null);
    setView('dashboard');
  };

  const openWorkbench = (paperId) => {
    setActivePaperId(paperId);
    setView('workbench');
  };

  const renderCurrentView = () => {
    if (!user) {
      return <AuthGateway isRegistering={isRegistering} onAuthSuccess={setUser} />;
    }

    if (view === 'workbench' && activePaperId) {
      return <WorkbenchView user={user} paperId={activePaperId} onBack={openDashboard} />;
    }

    return <Dashboard user={user} onOpenPaper={openWorkbench} />;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-slate-950 text-white py-4 px-6 flex justify-between items-center shadow-md">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={openDashboard}>
          <div className="bg-teal-600 p-2 rounded-lg"><Microscope className="h-6 w-6" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Rescover</h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">Validation & Collaboration</p>
          </div>
        </div>
        {user ? (
          <div className="flex items-center space-x-4">
            <div className="text-right"><p className="text-sm font-bold">{user.fullname}</p></div>
            <button onClick={() => {
              setUser(null);
              openDashboard();
            }} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"><LogOut className="h-5 w-5" /></button>
          </div>
        ) : (
          <div className="space-x-4">
            <button onClick={() => setIsRegistering(false)} className="text-sm font-semibold text-slate-400 hover:text-white transition">Sign In</button>
            <button onClick={() => setIsRegistering(true)} className="text-sm font-bold px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-500 transition">Register</button>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col p-6">
        {renderCurrentView()}
      </main>
    </div>
  );
}