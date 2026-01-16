
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  updateDoc 
} from 'firebase/firestore';
import { User, Patient } from '../types';

interface NPPanelProps {
  user: User;
  onSelectPatient: (id: string) => void;
}

const NPPanel: React.FC<NPPanelProps> = ({ user, onSelectPatient }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [newNpPassword, setNewNpPassword] = useState('');
  const [message, setMessage] = useState('');
  
  const [deleteTarget, setDeleteTarget] = useState<{id: string, name: string} | null>(null);

  const [formData, setFormData] = useState<Partial<Patient>>({
    name: '',
    ward: '',
    bed: '',
    gender: 'male',
    birthYearROC: undefined,
    admissionDate: undefined,
    hasDisabilityCertificate: false,
    hasCatastrophicIllnessCard: false
  });

  const fetchPatients = async () => {
    try {
      const q = query(collection(db, 'patients'), where('npId', '==', user.id));
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
      setPatients(list);
    } catch (err) {
      console.error("抓取病患失敗:", err);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [user.id]);

  const maskName = (name: string) => {
    if (!name || name.length < 2) return name;
    const chars = name.split('');
    chars[name.length - 2] = 'Ｏ';
    return chars.join('');
  };

  const sortedPatients = useMemo(() => {
    return [...patients].sort((a, b) => {
      if (a.ward && b.ward && a.ward !== b.ward) return a.ward.localeCompare(b.ward);
      if (a.bed && b.bed && a.bed !== b.bed) return a.bed.localeCompare(b.bed);
      return a.name.localeCompare(b.name, 'zh-Hant-TW');
    });
  }, [patients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    try {
      if (editingPatient) {
        await updateDoc(doc(db, 'patients', editingPatient.id), formData);
      } else {
        await addDoc(collection(db, 'patients'), {
          ...formData,
          npId: user.id
        });
      }
      
      setFormData({ 
        name: '', ward: '', bed: '', gender: 'male', 
        birthYearROC: undefined, admissionDate: undefined,
        hasDisabilityCertificate: false,
        hasCatastrophicIllnessCard: false 
      });
      setShowAddForm(false);
      setEditingPatient(null);
      fetchPatients();
    } catch (err) {
      alert("儲存失敗。");
    }
  };

  const confirmDelete = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setDeleteTarget({ id, name });
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);

    try {
      await deleteDoc(doc(db, 'patients', id));
      setPatients(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error("刪除失敗:", err);
      alert("刪除失敗，請再試一次。");
      fetchPatients();
    }
  };

  const handleEdit = (e: React.MouseEvent, patient: Patient) => {
    e.stopPropagation();
    setEditingPatient(patient);
    setFormData(patient);
    setShowAddForm(true);
  };

  const updatePassword = async () => {
    if (!newNpPassword) return;
    await updateDoc(doc(db, 'users', user.id), { password: newNpPassword });
    setMessage('密碼已成功更新');
    setTimeout(() => setMessage(''), 3000);
  };

  const calculateAge = (birthYear?: number) => {
    if (!birthYear) return 'N/A';
    return new Date().getFullYear() - 1911 - birthYear;
  };

  const handleDateChange = (field: 'year' | 'month' | 'day', value: string) => {
    const num = parseInt(value);
    if (isNaN(num)) {
      setFormData(prev => ({
        ...prev,
        admissionDate: prev.admissionDate ? { ...prev.admissionDate, [field]: undefined } : undefined
      }));
      return;
    }
    
    let validNum = Math.max(1, num);
    if (field === 'month') validNum = Math.min(12, validNum);
    if (field === 'day') validNum = Math.min(31, validNum);

    setFormData(prev => ({
      ...prev,
      admissionDate: {
        ...(prev.admissionDate || { year: 113, month: 1, day: 1 }),
        [field]: validNum
      }
    }));
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">修改我的密碼</label>
          <input 
            type="text" 
            value={newNpPassword}
            onChange={(e) => setNewNpPassword(e.target.value)}
            className="w-full p-2 border rounded text-sm" 
            placeholder="新密碼"
          />
        </div>
        <button onClick={updatePassword} className="bg-slate-700 text-white px-4 py-2 rounded text-sm hover:bg-slate-600 transition">
          更新
        </button>
        {message && <span className="text-green-600 text-xs py-2">{message}</span>}
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">負責病患名單</h2>
        <button 
          onClick={() => {
            setEditingPatient(null);
            setFormData({ 
              name: '', ward: '', bed: '', gender: 'male', 
              birthYearROC: undefined, admissionDate: undefined,
              hasDisabilityCertificate: false,
              hasCatastrophicIllnessCard: false
            });
            setShowAddForm(!showAddForm);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition"
        >
          {showAddForm ? '取消新增' : '＋ 新增病患'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md border border-blue-100 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700">病患姓名 (全名) *</label>
              <input 
                required
                className="w-full p-2 border rounded"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700">病房</label>
              <input 
                className="w-full p-2 border rounded"
                value={formData.ward}
                onChange={(e) => setFormData({...formData, ward: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700">床號</label>
              <input 
                className="w-full p-2 border rounded"
                value={formData.bed}
                onChange={(e) => setFormData({...formData, bed: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700">性別</label>
              <select 
                className="w-full p-2 border rounded"
                value={formData.gender}
                onChange={(e) => setFormData({...formData, gender: e.target.value as any})}
              >
                <option value="male">男</option>
                <option value="female">女</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700">出生年 (民國)</label>
              <input 
                type="number"
                min="1"
                className="w-full p-2 border rounded"
                value={formData.birthYearROC || ''}
                onChange={(e) => setFormData({...formData, birthYearROC: parseInt(e.target.value) || undefined})}
                placeholder="例如: 80"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <label className="block text-sm font-bold mb-2 text-blue-800">身分註記 (勾選)</label>
            <div className="flex gap-6 p-3 bg-slate-50 rounded-lg border">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={formData.hasDisabilityCertificate || false}
                  onChange={(e) => setFormData({...formData, hasDisabilityCertificate: e.target.checked})}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                領有身心障礙手冊
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={formData.hasCatastrophicIllnessCard || false}
                  onChange={(e) => setFormData({...formData, hasCatastrophicIllnessCard: e.target.checked})}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                領有重大傷病卡
              </label>
            </div>
          </div>

          <div className="border-t pt-4">
            <label className="block text-sm font-bold mb-2 text-blue-800">住院日期 (民國)</label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">民國年</label>
                <input 
                  type="number"
                  min="1"
                  className="w-full p-2 border rounded"
                  value={formData.admissionDate?.year || ''}
                  onChange={(e) => handleDateChange('year', e.target.value)}
                  placeholder="年"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">月</label>
                <input 
                  type="number"
                  min="1"
                  max="12"
                  className="w-full p-2 border rounded"
                  value={formData.admissionDate?.month || ''}
                  onChange={(e) => handleDateChange('month', e.target.value)}
                  placeholder="月"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">日</label>
                <input 
                  type="number"
                  min="1"
                  max="31"
                  className="w-full p-2 border rounded"
                  value={formData.admissionDate?.day || ''}
                  onChange={(e) => handleDateChange('day', e.target.value)}
                  placeholder="日"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="bg-blue-600 text-white px-8 py-2 rounded-lg font-bold shadow-md">
              {editingPatient ? '儲存修改' : '確認新增'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden border border-slate-200">
        <ul className="divide-y divide-slate-100">
          {sortedPatients.length === 0 ? (
            <li className="p-10 text-center text-slate-400">目前尚無病患資料，請點擊上方按鈕新增。</li>
          ) : (
            sortedPatients.map(patient => (
              <li 
                key={patient.id} 
                className="group flex flex-wrap items-center justify-between p-4 hover:bg-blue-50 cursor-pointer transition"
                onClick={() => onSelectPatient(patient.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                    {patient.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800">{maskName(patient.name)} <span className="text-slate-400 font-normal text-sm ml-1">({calculateAge(patient.birthYearROC)}歲 / {patient.gender === 'male' ? '男' : '女'})</span></h3>
                      <div className="flex gap-1">
                        {patient.hasDisabilityCertificate && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">身障</span>}
                        {patient.hasCatastrophicIllnessCard && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">重大</span>}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      病房: {patient.ward || '-'} | 床號: {patient.bed || '-'}
                      {patient.admissionDate && ` | 住院: 民國 ${patient.admissionDate.year}/${patient.admissionDate.month}/${patient.admissionDate.day}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={(e) => handleEdit(e, patient)}
                    className="px-3 py-1 text-blue-600 hover:bg-blue-100 rounded text-sm font-medium transition"
                  >
                    修改基本資料
                  </button>
                  <button 
                    onClick={(e) => confirmDelete(e, patient.id, patient.name)}
                    className="px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm font-medium transition"
                  >
                    刪除
                  </button>
                  <span className="self-center ml-2 text-slate-300 group-hover:text-blue-500">→</span>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl animate-fadeIn border-t-8 border-red-500">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold">!</div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">確認刪除病患？</h3>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                確定要刪除病患 「<span className="font-bold text-slate-800">{maskName(deleteTarget.name)}</span>」 的所有資料嗎？此動作無法復原。
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                取消
              </button>
              <button 
                type="button"
                onClick={executeDelete}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg transition"
              >
                確定刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NPPanel;
