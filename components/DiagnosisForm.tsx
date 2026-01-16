
import React, { useState, useEffect, useRef } from 'react';
import { DiagnosisData } from '../types';

interface Props {
  data?: DiagnosisData;
  onChange: (data: DiagnosisData) => void;
}

const DiagnosisForm: React.FC<Props> = ({ data, onChange }) => {
  const currentData: DiagnosisData = data || {
    psychiatric: [],
    psychiatricOther: '',
    medical: [],
    medicalOther: ''
  };

  const isComposing = useRef(false);
  const [localPsychOther, setLocalPsychOther] = useState(currentData.psychiatricOther || '');
  const [localMedOther, setLocalMedOther] = useState(currentData.medicalOther || '');

  // 當外部資料更新時同步本地狀態
  useEffect(() => {
    if (!isComposing.current) {
      setLocalPsychOther(currentData.psychiatricOther || '');
    }
  }, [currentData.psychiatricOther]);

  useEffect(() => {
    if (!isComposing.current) {
      setLocalMedOther(currentData.medicalOther || '');
    }
  }, [currentData.medicalOther]);

  const psychList = [
    'Schizophrenia', 'Bipolar disorder', 'Major depressive disorder',
    'Dementia (Major neurocognitive disorder)', 'Organic mental disorder',
    'Intellectual disability (Mental retardation)'
  ];

  const medList = ['Hypertension', 'Hyperlipidemia', 'Diabetes mellitus'];

  const toggle = (list: string[], val: string) => {
    return list.includes(val) ? list.filter(v => v !== val) : [...list, val];
  };

  const handlePsychOtherChange = (val: string) => {
    setLocalPsychOther(val);
    if (!isComposing.current) {
      onChange({...currentData, psychiatricOther: val});
    }
  };

  const handleMedOtherChange = (val: string) => {
    setLocalMedOther(val);
    if (!isComposing.current) {
      onChange({...currentData, medicalOther: val});
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-bold text-sm text-slate-500 mb-2">精神科診斷</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {psychList.map(item => (
            <label key={item} className="flex items-center gap-2 text-sm p-2 hover:bg-slate-50 rounded cursor-pointer">
              <input 
                type="checkbox" 
                checked={currentData.psychiatric.includes(item)}
                onChange={() => onChange({...currentData, psychiatric: toggle(currentData.psychiatric, item)})}
              />
              {item}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm p-2 hover:bg-slate-50 rounded cursor-pointer sm:col-span-2">
            <input 
              type="checkbox" 
              checked={currentData.psychiatric.includes('others')}
              onChange={() => onChange({...currentData, psychiatric: toggle(currentData.psychiatric, 'others')})}
            />
            其他 (請輸入):
            {currentData.psychiatric.includes('others') && (
              <input 
                className="flex-1 ml-2 border-b text-sm focus:border-blue-500 outline-none"
                value={localPsychOther}
                onCompositionStart={() => { isComposing.current = true; }}
                onCompositionEnd={(e) => {
                  isComposing.current = false;
                  handlePsychOtherChange(e.currentTarget.value);
                }}
                onChange={(e) => handlePsychOtherChange(e.target.value)}
              />
            )}
          </label>
        </div>
      </div>

      <div>
        <h4 className="font-bold text-sm text-slate-500 mb-2">內外科診斷</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {medList.map(item => (
            <label key={item} className="flex items-center gap-2 text-sm p-2 hover:bg-slate-50 rounded cursor-pointer">
              <input 
                type="checkbox" 
                checked={currentData.medical.includes(item)}
                onChange={() => onChange({...currentData, medical: toggle(currentData.medical, item)})}
              />
              {item}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm p-2 hover:bg-slate-50 rounded cursor-pointer sm:col-span-2">
            <input 
              type="checkbox" 
              checked={currentData.medical.includes('others')}
              onChange={() => onChange({...currentData, medical: toggle(currentData.medical, 'others')})}
            />
            其他 (請輸入):
            {currentData.medical.includes('others') && (
              <input 
                className="flex-1 ml-2 border-b text-sm focus:border-blue-500 outline-none"
                value={localMedOther}
                onCompositionStart={() => { isComposing.current = true; }}
                onCompositionEnd={(e) => {
                  isComposing.current = false;
                  handleMedOtherChange(e.currentTarget.value);
                }}
                onChange={(e) => handleMedOtherChange(e.target.value)}
              />
            )}
          </label>
        </div>
      </div>
    </div>
  );
};

export default DiagnosisForm;
