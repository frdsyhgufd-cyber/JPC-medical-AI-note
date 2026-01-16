
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  getDoc,
  setDoc
} from 'firebase/firestore';
import { User, UserRole, Patient } from './types';
import Login from './components/Login';
import AdminPanel from './components/AdminPanel';
import NPPanel from './components/NPPanel';
import PatientDetailView from './components/PatientDetailView';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<'LOGIN' | 'ADMIN' | 'DASHBOARD' | 'PATIENT_DETAIL'>('LOGIN');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Initialize Admin User if not exists
  useEffect(() => {
    const initAdmin = async () => {
      const adminRef = doc(db, 'config', 'admin');
      const snap = await getDoc(adminRef);
      if (!snap.exists()) {
        await setDoc(adminRef, { password: '0614' });
      }
    };
    initAdmin();
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    if (user.role === UserRole.ADMIN) {
      setView('ADMIN');
    } else {
      setView('DASHBOARD');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedPatientId(null);
    setView('LOGIN');
  };

  const openPatient = (id: string) => {
    setSelectedPatientId(id);
    setView('PATIENT_DETAIL');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-10">
      <header className="bg-blue-800 text-white p-6 shadow-md text-center">
        <h1 className="text-2xl md:text-3xl font-bold tracking-wide">
          衛生福利部嘉南療養院病歷寫作輔助系統
        </h1>
        {currentUser && (
          <div className="mt-2 flex justify-center items-center gap-4">
            <span className="bg-blue-700 px-3 py-1 rounded-full text-sm">
              當前使用者: {currentUser.name} ({
                currentUser.role === UserRole.ADMIN ? '管理員' : 
                currentUser.role === UserRole.NP ? '專科護理師' :
                currentUser.role === UserRole.RESIDENT ? '住院醫師' : 
                currentUser.role === UserRole.FELLOW ? '研究員' : '醫師助理'
              })
            </span>
            <button 
              onClick={handleLogout}
              className="text-sm underline hover:text-blue-200"
            >
              登出
            </button>
          </div>
        )}
      </header>

      <main className="container mx-auto mt-8 px-4 max-w-6xl">
        {view === 'LOGIN' && <Login onLogin={handleLogin} />}
        
        {view === 'ADMIN' && currentUser?.role === UserRole.ADMIN && (
          <AdminPanel />
        )}

        {view === 'DASHBOARD' && currentUser && currentUser.role !== UserRole.ADMIN && (
          <NPPanel 
            user={currentUser} 
            onSelectPatient={openPatient}
          />
        )}

        {view === 'PATIENT_DETAIL' && selectedPatientId && (
          <div className="space-y-4">
            <button 
              onClick={() => setView('DASHBOARD')}
              className="mb-4 flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
            >
              ← 返回病患名單
            </button>
            <PatientDetailView 
              patientId={selectedPatientId} 
              onBack={() => setView('DASHBOARD')} 
            />
          </div>
        )}
      </main>
      
      <footer className="mt-20 text-center text-slate-400 text-sm py-4 border-t border-slate-200">
        &copy; {new Date().getFullYear()} 衛生福利部嘉南療養院 - 病歷寫作輔助系統
      </footer>
    </div>
  );
};

export default App;
