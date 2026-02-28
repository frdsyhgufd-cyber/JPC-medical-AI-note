
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../firebase';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  deleteDoc
} from 'firebase/firestore';
import { Patient, RecordType, MedicalRecord, User } from '../types';
import { generateMedicalNote } from '../geminiService';
import DiagnosisForm from './DiagnosisForm';
import MSEForm from './MSEForm';
import PEForm from './PEForm';

const PatientDetailView: React.FC<{ patientId: string; user: User; onBack: () => void }> = ({ patientId, user, onBack }) => {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<RecordType[]>([]);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [backgroundTemp, setBackgroundTemp] = useState('');
  const [openRecords, setOpenRecords] = useState<string[]>([]);
  
  const recordRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [showBatchPrompt, setShowBatchPrompt] = useState(false);
  const [offDutyInput, setOffDutyInput] = useState('急性病房轉至復健病房繼續治療');
  const [dischargeInput, setDischargeInput] = useState('返家並門診追蹤');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'records'), where('patientId', '==', patientId));
      const rSnap = await getDocs(q);
      let fetchedRecords = rSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MedicalRecord));
      fetchedRecords.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecords(fetchedRecords);
    } catch (err) {
      console.error("抓取紀錄失敗:", err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        const pDoc = await getDoc(doc(db, 'patients', patientId));
        if (pDoc.exists()) {
          const data = { id: pDoc.id, ...pDoc.data() } as Patient;
          setPatient(data);
          setBackgroundTemp(data.background || '');
        }
        await fetchRecords();
      } catch (err) {
        console.error("載入失敗:", err);
      }
    };
    fetchPatientData();
  }, [patientId, fetchRecords]);

  const savePatientField = async (field: keyof Patient, value: any) => {
    if (!patient) return;
    setPatient(prev => prev ? { ...prev, [field]: value } : null);
    try {
      await updateDoc(doc(db, 'patients', patientId), { [field]: value });
    } catch (err) {
      console.error("雲端儲存失敗:", err);
    }
  };

  const toggleType = (type: RecordType) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleBatchGenerate = () => {
    if (selectedTypes.length === 0 || aiGenerating) return;
    
    const needsOffDuty = selectedTypes.includes(RecordType.OFF_DUTY_SUMMARY);
    const needsDischarge = selectedTypes.includes(RecordType.DISCHARGE_NOTE);
    
    if (needsOffDuty || needsDischarge) {
      setShowBatchPrompt(true);
    } else {
      startAiProcess(selectedTypes, {
        [RecordType.OFF_DUTY_SUMMARY]: '',
        [RecordType.DISCHARGE_NOTE]: ''
      });
    }
  };

  const startAiProcess = async (types: RecordType[], inputs: { [key: string]: string }) => {
    const allProgressNotes = records.filter(r => r.type === RecordType.PROGRESS_NOTE).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    setAiGenerating(true);
    try {
      let combinedContent = "";
      const combinedType = types.join(" + ");

      for (let i = 0; i < types.length; i++) {
        const type = types[i];
        const extraInfo = inputs[type] || "";
        
        const isSummaryType = [RecordType.WEEKLY_SUMMARY, RecordType.MONTHLY_SUMMARY, RecordType.OFF_DUTY_SUMMARY, RecordType.DISCHARGE_NOTE].includes(type);
        
        if (isSummaryType && allProgressNotes.length === 0) {
          throw new Error(`⚠️ 素材不足：查無病程紀錄，無法生成 ${type}。`);
        }

        let referenceContext: MedicalRecord[] = [];
        if (isSummaryType) {
          if (type === RecordType.WEEKLY_SUMMARY) {
            referenceContext = allProgressNotes.slice(-5);
          } else if (type === RecordType.MONTHLY_SUMMARY) {
            referenceContext = allProgressNotes.slice(-25);
          } else {
            referenceContext = allProgressNotes;
          }
        } else {
          referenceContext = records.filter(r => r.type === type).slice(0, 3);
        }

        let content = await generateMedicalNote(patient!, type, referenceContext, extraInfo);
        if (content.startsWith("⚠️")) {
          throw new Error(content);
        }

        // 附加輔助紀錄者資訊
        const helperLine = `輔助紀錄者：${user.name}`;
        if (type === RecordType.PROGRESS_NOTE) {
          const target = "主治醫師評語與建議：";
          if (content.includes(target)) {
            content = content.replace(target, `\n${helperLine}\n\n${target}`);
          } else {
            content += `\n\n${helperLine}`;
          }
        } else {
          content += `\n\n${helperLine}`;
        }

        combinedContent += content;
        if (i < types.length - 1) {
          combinedContent += "\n\n" + "=".repeat(30) + "\n\n";
        }
      }

      await addDoc(collection(db, 'records'), { 
        patientId, 
        type: combinedType, 
        content: combinedContent, 
        createdAt: new Date().toISOString() 
      });
      await fetchRecords(); 
      setSelectedTypes([]);
    } catch (err: any) {
      alert(`紀錄生成失敗：${err.message}`);
    } finally {
      setAiGenerating(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteDoc(doc(db, 'records', deleteTargetId));
      setRecords(prev => prev.filter(r => r.id !== deleteTargetId));
      setDeleteTargetId(null);
    } catch (err) { alert("刪除失敗"); }
  };

  const toggleRecord = (id: string) => {
    const isOpening = !openRecords.includes(id);
    setOpenRecords(isOpening ? [id] : []);
    if (isOpening) {
      setTimeout(() => recordRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    alert("已複製到剪貼簿");
  };

  if (loading && records.length === 0) return <div className="p-10 text-center text-slate-500 font-bold">載入資料中...</div>;
  if (!patient) return <div className="p-10 text-center text-red-500">找不到病患資料</div>;

  const orderedRecordTypes = [
    RecordType.PROGRESS_NOTE,
    RecordType.PHYSIO_PSYCHO_EXAM,
    RecordType.PSYCHOTHERAPY,
    RecordType.SUPPORTIVE_PSYCHOTHERAPY,
    RecordType.SPECIAL_HANDLING,
    RecordType.WEEKLY_SUMMARY,
    RecordType.MONTHLY_SUMMARY,
    RecordType.OFF_DUTY_SUMMARY,
    RecordType.DISCHARGE_NOTE
  ];

  return (
    <div className="relative space-y-6 pb-20">
      <button onClick={onBack} title="返回病患名單" className="fixed bottom-8 left-8 z-[100] bg-blue-600 hover:bg-blue-700 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-90 group border-4 border-white">
        <span className="text-2xl">←</span>
      </button>

      <div className="bg-blue-600 text-white p-6 rounded-2xl shadow-lg">
        <h2 className="text-3xl font-bold">{patient.name.split('')[0]}Ｏ{patient.name.length > 2 ? patient.name.split('')[patient.name.length - 1] : ''}</h2>
        <p className="opacity-90 mt-1 text-lg">
          {patient.gender === 'male' ? '男' : '女'} | {new Date().getFullYear() - 1911 - (patient.birthYearROC || 0)} 歲 | {patient.ward}房 {patient.bed}床
          {patient.admissionDate && ` | 入院: 民國 ${patient.admissionDate.year}/${patient.admissionDate.month}/${patient.admissionDate.day}`}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold mb-4 text-slate-800">診斷設定</h3>
            <DiagnosisForm data={patient.diagnosis} onChange={(data) => savePatientField('diagnosis', data)} />
          </section>

          <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold mb-4 text-slate-800">背景資料</h3>
            <button onClick={() => setShowBackgroundModal(true)} className="w-full py-3 border-2 border-dashed border-blue-200 text-blue-600 rounded-lg bg-blue-50 font-bold hover:bg-blue-100 transition">
              {patient.background ? "檢視 / 修改背景資料" : "點擊輸入病患背景資料"}
            </button>
          </section>

          <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold mb-4 text-slate-800">目前臨床重點</h3>
            <textarea className="w-full p-3 border rounded-lg h-32 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={patient.clinicalFocus || ''} onChange={(e) => savePatientField('clinicalFocus', e.target.value)} placeholder="請輸入目前病患的主觀訴求與觀察..." />
          </section>

          <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">MSE 評估</h3>
            </div>
            <MSEForm 
              data={patient.mse} 
              onChange={(data) => savePatientField('mse', data)} 
            />
          </section>

          <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">PE & NE 評估</h3>
            </div>
            <PEForm 
              data={patient.pe} 
              onChange={(data) => savePatientField('pe', data)} 
            />
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white p-6 rounded-xl shadow-md border-2 border-blue-100 sticky top-4">
            <div className="flex justify-between items-center mb-4 text-blue-800">
              <h3 className="text-lg font-bold">生成紀錄</h3>
              <span className="text-[10px] bg-blue-100 px-2 py-0.5 rounded-full font-bold">AI 輔助</span>
            </div>
            <div className="space-y-2">
              {orderedRecordTypes.map(type => (
                <label 
                  key={type} 
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
                    selectedTypes.includes(type) ? 'bg-blue-50 border-blue-300' : 'hover:bg-slate-50'
                  }`}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedTypes.includes(type)}
                    onChange={() => toggleType(type)}
                    disabled={aiGenerating}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className={`text-sm font-bold ${
                    type === RecordType.PROGRESS_NOTE ? 'text-blue-700' : 
                    (type === RecordType.OFF_DUTY_SUMMARY || type === RecordType.DISCHARGE_NOTE) ? 'text-indigo-700' : 'text-slate-700'
                  }`}>
                    {type === RecordType.OFF_DUTY_SUMMARY ? 'Off Duty note' : type}
                  </span>
                </label>
              ))}
              
              <button 
                disabled={selectedTypes.length === 0 || aiGenerating} 
                onClick={handleBatchGenerate} 
                className={`w-full mt-4 p-4 rounded-xl text-white font-bold shadow-lg transition transform active:scale-95 ${
                  selectedTypes.length === 0 || aiGenerating 
                    ? 'bg-slate-300 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {aiGenerating ? '紀錄生成中...' : `開始生成勾選紀錄 (${selectedTypes.length})`}
              </button>
            </div>
            {aiGenerating && <div className="mt-4 p-3 bg-yellow-50 text-yellow-700 rounded-lg text-sm animate-pulse text-center font-bold border border-yellow-200">紀錄生成中....</div>}
          </section>
        </div>
      </div>

      <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mt-6">
        <h3 className="text-lg font-bold mb-4 text-slate-800">歷史紀錄</h3>
        <div className="space-y-3">
          {records.length === 0 ? <p className="text-slate-400 text-center py-10 italic">尚無歷史紀錄</p> : records.map(record => (
            <div key={record.id} ref={el => { recordRefs.current[record.id] = el; }} className="p-4 border rounded-xl bg-white shadow-sm hover:border-blue-200 transition space-y-3">
              <div className="flex justify-between items-center gap-3">
                <div className="flex-1">
                  <span className={`font-bold ${record.type === RecordType.PROGRESS_NOTE ? 'text-blue-700' : 'text-slate-800'}`}>{record.type}</span>
                  <div className="text-xs text-slate-400">{new Date(record.createdAt).toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleRecord(record.id)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${openRecords.includes(record.id) ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {openRecords.includes(record.id) ? '收合' : '展開'}
                  </button>
                  <button onClick={() => handleCopy(record.content)} className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white transition">複製</button>
                  <button onClick={() => setDeleteTargetId(record.id)} className="px-4 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition">刪除</button>
                </div>
              </div>
              {openRecords.includes(record.id) && (
                <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-100 animate-fadeIn">
                  <div className="bg-white p-4 rounded border whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-sans shadow-sm min-h-[100px]">
                    {record.content}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {deleteTargetId && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-sm w-full shadow-2xl border-t-8 border-red-500 text-center text-slate-900">
            <h3 className="text-xl font-bold mb-4">確認刪除紀錄？</h3>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTargetId(null)} className="flex-1 py-3 border rounded-xl font-bold text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={executeDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700">確定刪除</button>
            </div>
          </div>
        </div>
      )}

      {showBatchPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[250] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border-t-8 border-indigo-600">
            <h3 className="text-xl font-bold mb-4 text-center">補充生成資訊</h3>
            
            {selectedTypes.includes(RecordType.OFF_DUTY_SUMMARY) && (
              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-1">Off Duty note 原因</label>
                <textarea 
                  className="w-full h-24 p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" 
                  value={offDutyInput} 
                  onChange={(e) => setOffDutyInput(e.target.value)} 
                  placeholder="例如：急性病房轉至復健病房繼續治療" 
                />
              </div>
            )}

            {selectedTypes.includes(RecordType.DISCHARGE_NOTE) && (
              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-1">Discharge 安置計畫</label>
                <textarea 
                  className="w-full h-24 p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" 
                  value={dischargeInput} 
                  onChange={(e) => setDischargeInput(e.target.value)} 
                  placeholder="例如：返家並門診追蹤" 
                />
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowBatchPrompt(false)} className="flex-1 py-2.5 border rounded-xl font-bold text-slate-600 hover:bg-slate-50">取消</button>
              <button 
                onClick={() => { 
                  setShowBatchPrompt(false); 
                  startAiProcess(selectedTypes, {
                    [RecordType.OFF_DUTY_SUMMARY]: offDutyInput,
                    [RecordType.DISCHARGE_NOTE]: dischargeInput
                  }); 
                }} 
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md"
              >
                開始生成
              </button>
            </div>
          </div>
        </div>
      )}

      {showBackgroundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-blue-50">
              <h3 className="text-xl font-bold text-slate-800">病患背景資料 (長期固定)</h3>
              <button onClick={() => setShowBackgroundModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl">✕</button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              <textarea className="w-full h-[50vh] p-4 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm leading-relaxed" value={backgroundTemp} onChange={(e) => setBackgroundTemp(e.target.value)} placeholder="請輸入病患的家族史、醫療病史、個人發展史等長期資料..." />
            </div>
            <div className="p-6 border-t flex justify-end gap-3 bg-slate-50">
              <button onClick={() => setShowBackgroundModal(false)} className="px-6 py-2 border rounded-lg bg-white font-bold hover:bg-slate-50 transition">取消</button>
              <button onClick={() => { savePatientField('background', backgroundTemp); setShowBackgroundModal(false); }} className="px-8 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700 transition">確認儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientDetailView;
