import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { User, UserRole } from '../types';

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.NP);
  const [newPassword, setNewPassword] = useState('0000');
  const [adminPassword, setAdminPassword] = useState('');
  const [message, setMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{id: string, name: string} | null>(null);

  const ROLE_PRIORITY: Record<string, number> = {
    [UserRole.RESIDENT]: 1,
    [UserRole.NP]: 2,
    [UserRole.PA]: 3,
    [UserRole.ADMIN]: 4
  };

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      list.sort((a, b) => {
        const priorityA = ROLE_PRIORITY[a.role] || 99;
        const priorityB = ROLE_PRIORITY[b.role] || 99;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return a.name.localeCompare(b.name, 'zh-Hant-TW-u-co-stroke');
      });
      setUsers(list);
    } catch (err) {
      console.error("Fetch users error:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    await addDoc(collection(db, 'users'), {
      name: newName,
      password: newPassword,
      role: newRole
    });
    setNewName('');
    setNewPassword('0000');
    setNewRole(UserRole.NP);
    fetchUsers();
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case UserRole.NP: return '專科護理師';
      case UserRole.RESIDENT: return '住院醫師';
      case UserRole.PA: return '醫師助理';
      default: return '未知';
    }
  };

  const executeDeleteUser = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteDoc(doc(db, 'users', id));
      fetchUsers();
    } catch (err) {
      alert("刪除失敗。");
    }
  };

  const handleChangeAdminPassword = async () => {
    if (!adminPassword) return;
    await updateDoc(doc(db, 'config', 'admin'), { password: adminPassword });
    setMessage('管理員密碼修改成功');
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4 border-b pb-2 text-slate-800">修改管理員密碼</h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm text-slate-600 mb-1">新管理員密碼</label>
            <input 
              type="text"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="請輸入新密碼"
            />
          </div>
          <button 
            onClick={handleChangeAdminPassword}
            className="bg-slate-800 text-white px-6 py-2 rounded hover:bg-slate-700 transition"
          >
            更新密碼
          </button>
        </div>
        {message && <p className="text-green-600 text-sm mt-2">{message}</p>}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4 border-b pb-2 text-slate-800">管理工作人員名單</h2>
        <form onSubmit={handleAddUser} className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm text-slate-600 mb-1">姓名</label>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full p-2 border rounded" required />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">職稱</label>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)} className="w-full p-2 border rounded">
              <option value={UserRole.NP}>專科護理師</option>
              <option value={UserRole.RESIDENT}>住院醫師</option>
              <option value={UserRole.PA}>醫師助理</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">初始密碼</label>
            <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full p-2 border rounded" required />
          </div>
          <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700">新增人員</button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="p-3 border-b text-sm font-semibold text-slate-600">姓名</th>
                <th className="p-3 border-b text-sm font-semibold text-slate-600">職稱</th>
                <th className="p-3 border-b text-sm font-semibold text-slate-600">密碼</th>
                <th className="p-3 border-b text-sm font-semibold text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="hover:bg-slate-50 transition">
                  <td className="p-3 border-b">{user.name}</td>
                  <td className="p-3 border-b">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      user.role === UserRole.RESIDENT ? 'bg-purple-100 text-purple-700' :
                      user.role === UserRole.PA ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="p-3 border-b font-mono">{user.password}</td>
                  <td className="p-3 border-b">
                    <button onClick={() => setDeleteTarget({id: user.id, name: user.name})} className="text-red-600 hover:text-red-800 text-sm font-bold">刪除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl border-t-8 border-red-500">
            <div className="text-center">
              <h3 className="text-xl font-bold text-slate-900 mb-2">確認刪除人員？</h3>
              <p className="text-slate-500 text-sm mb-6">確定要將 「{deleteTarget.name}」 刪除嗎？</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 border rounded-xl font-bold text-slate-600">取消</button>
              <button onClick={executeDeleteUser} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold">確定刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
