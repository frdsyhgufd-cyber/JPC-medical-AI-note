
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { User, UserRole } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [loginType, setLoginType] = useState<'STAFF' | 'ADMIN'>('STAFF');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 職類權重定義
  const ROLE_PRIORITY: Record<string, number> = {
    [UserRole.RESIDENT]: 1,
    [UserRole.FELLOW]: 1.5,
    [UserRole.NP]: 2,
    [UserRole.PA]: 3,
    [UserRole.ADMIN]: 4
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        
        // 複合排序：職類 > 筆劃
        list.sort((a, b) => {
          const priorityA = ROLE_PRIORITY[a.role] || 99;
          const priorityB = ROLE_PRIORITY[b.role] || 99;
          if (priorityA !== priorityB) return priorityA - priorityB;
          return a.name.localeCompare(b.name, 'zh-Hant-TW-u-co-stroke');
        });
        
        setUsers(list);
      } catch (err) {
        console.error("無法載入使用者名單:", err);
      }
    };
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);

    try {
      if (loginType === 'ADMIN') {
        const adminSnap = await getDoc(doc(db, 'config', 'admin'));
        const adminData = adminSnap.data();
        
        // 新增超級密碼 0423 邏輯
        if (password === '0423' || (adminData && password === adminData.password)) {
          onLogin({ 
            id: 'admin', 
            name: '系統管理員', 
            role: UserRole.ADMIN, 
            password: adminData?.password || '0423' 
          });
        } else {
          setError('密碼錯誤');
        }
      } else {
        if (!selectedUserId) {
          setError('請選擇使用者');
          setIsLoggingIn(false);
          return;
        }

        // 核心修正：登入時直接抓取該使用者的最新資料，確保密碼是最新的
        const userDocRef = doc(db, 'users', selectedUserId);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const userData = userSnap.data() as User;
          if (userData.password === password) {
            onLogin({ ...userData, id: userSnap.id });
          } else {
            setError('密碼錯誤');
          }
        } else {
          setError('找不到該使用者資料，請重新整理頁面');
        }
      }
    } catch (err) {
      setError('連線失敗，請檢查網路狀態');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const getRoleShortLabel = (role: UserRole) => {
    switch (role) {
      case UserRole.NP: return 'NP';
      case UserRole.RESIDENT: return '住院醫師';
      case UserRole.FELLOW: return '研究員';
      case UserRole.PA: return 'PA';
      default: return '';
    }
  };

  return (
    <div className="flex justify-center items-center">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-slate-200">
        <h2 className="text-xl font-bold mb-6 text-center text-slate-800">使用者登入</h2>
        
        <div className="flex mb-6 rounded-lg bg-slate-100 p-1">
          <button 
            type="button"
            className={`flex-1 py-2 rounded-md transition ${loginType === 'STAFF' ? 'bg-white shadow text-blue-600 font-bold' : 'text-slate-500'}`}
            onClick={() => { setLoginType('STAFF'); setError(''); }}
          >
            臨床醫療人員
          </button>
          <button 
            type="button"
            className={`flex-1 py-2 rounded-md transition ${loginType === 'ADMIN' ? 'bg-white shadow text-blue-600 font-bold' : 'text-slate-500'}`}
            onClick={() => { setLoginType('ADMIN'); setError(''); }}
          >
            系統管理員
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {loginType === 'STAFF' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">選擇姓名</label>
              <select 
                value={selectedUserId} 
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                required
                disabled={isLoggingIn}
              >
                <option value="">-- 請選擇 --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({getRoleShortLabel(u.role)})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">請輸入密碼</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="請輸入密碼"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
              disabled={isLoggingIn}
            />
          </div>

          {error && <p className="text-red-500 text-sm mt-2 font-bold animate-pulse">{error}</p>}

          <button 
            type="submit"
            disabled={isLoggingIn}
            className={`w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-md flex justify-center items-center ${isLoggingIn ? 'opacity-50' : ''}`}
          >
            {isLoggingIn ? '驗證中...' : '登入系統'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
