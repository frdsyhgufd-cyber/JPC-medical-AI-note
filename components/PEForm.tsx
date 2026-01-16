
import React, { useState, useEffect, useRef } from 'react';
import { PEData } from '../types';

interface Props {
  data?: PEData;
  onChange: (data: PEData) => void;
}

const SectionTitle = ({ text }: { text: string }) => (
  <h4 className="bg-slate-50 p-2 font-bold text-xs mb-3 rounded text-slate-600 border-l-4 border-emerald-500 tracking-wider">
    {text}
  </h4>
);

const MultiSelect = ({ options, values, onToggle, otherValue, onOtherChange }: any) => {
  const currentValues = Array.isArray(values) ? values : (values ? [values] : []);
  const isComposing = useRef(false);
  const [localOther, setLocalOther] = useState(otherValue || '');

  useEffect(() => {
    if (!isComposing.current) setLocalOther(otherValue || '');
  }, [otherValue]);

  const handleTextChange = (val: string) => {
    setLocalOther(val);
    if (!isComposing.current && onOtherChange) {
      onOtherChange(val);
    }
  };

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
      {options.map((opt: string) => (
        <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input 
            type="checkbox" 
            checked={currentValues.includes(opt)} 
            onChange={() => {
              const next = currentValues.includes(opt) 
                ? currentValues.filter((v: any) => v !== opt) 
                : [...currentValues, opt];
              onToggle(next);
            }} 
          /> {opt}
        </label>
      ))}
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input 
          type="checkbox" 
          checked={currentValues.includes('others')} 
          onChange={() => {
            const next = currentValues.includes('others') 
              ? currentValues.filter((v: any) => v !== 'others') 
              : [...currentValues, 'others'];
            onToggle(next);
          }} 
        /> 其他:
        {currentValues.includes('others') && (
          <input 
            className="border-b outline-none ml-1 text-sm p-1 focus:border-emerald-500 w-32" 
            value={localOther} 
            onCompositionStart={() => { isComposing.current = true; }}
            onCompositionEnd={(e) => {
              isComposing.current = false;
              handleTextChange(e.currentTarget.value);
            }}
            onChange={(e) => handleTextChange(e.target.value)} 
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </label>
    </div>
  );
};

const PEForm: React.FC<Props> = ({ data, onChange }) => {
  const defaultPE: PEData = {
    conscious: [], heent: [], chest: [], heart: [],
    abdominal: [], extremities: [], skin: [], ne: []
  };

  const current = data || defaultPE;

  return (
    <div className="space-y-2">
      <div>
        <SectionTitle text="意識狀態 (Consciousness)" />
        <MultiSelect 
          options={['清楚']} 
          values={current.conscious} 
          onToggle={(v: any) => onChange({...current, conscious: v})}
          otherValue={current.consciousOther}
          onOtherChange={(v: any) => onChange({...current, consciousOther: v})}
        />
      </div>

      <div>
        <SectionTitle text="頭頸部 (HEENT)" />
        <MultiSelect 
          options={['結膜無蒼白', '鞏膜無黃疸']} 
          values={current.heent} 
          onToggle={(v: any) => onChange({...current, heent: v})}
          otherValue={current.heentOther}
          onOtherChange={(v: any) => onChange({...current, heentOther: v})}
        />
      </div>

      <div>
        <SectionTitle text="胸部 (Chest)" />
        <MultiSelect 
          options={['胸廓擴張對稱', '呼吸順暢', '呼吸音正常']} 
          values={current.chest} 
          onToggle={(v: any) => onChange({...current, chest: v})}
          otherValue={current.chestOther}
          onOtherChange={(v: any) => onChange({...current, chestOther: v})}
        />
      </div>

      <div>
        <SectionTitle text="心臟 (Heart)" />
        <MultiSelect 
          options={['心跳規律', '無心雜音']} 
          values={current.heart} 
          onToggle={(v: any) => onChange({...current, heart: v})}
          otherValue={current.heartOther}
          onOtherChange={(v: any) => onChange({...current, heartOther: v})}
        />
      </div>

      <div>
        <SectionTitle text="腹部 (Abdomen)" />
        <MultiSelect 
          options={['柔軟平坦', '腸蠕動音正常', '無壓痛']} 
          values={current.abdominal} 
          onToggle={(v: any) => onChange({...current, abdominal: v})}
          otherValue={current.abdominalOther}
          onOtherChange={(v: any) => onChange({...current, abdominalOther: v})}
        />
      </div>

      <div>
        <SectionTitle text="四肢 (Extremities)" />
        <MultiSelect 
          options={['肌力正常', '關節活動範圍完整', '無凹陷性水腫']} 
          values={current.extremities} 
          onToggle={(v: any) => onChange({...current, extremities: v})}
          otherValue={current.extremitiesOther}
          onOtherChange={(v: any) => onChange({...current, extremitiesOther: v})}
        />
      </div>

      <div>
        <SectionTitle text="皮膚 (Skin)" />
        <MultiSelect 
          options={['皮膚張力 (Turgor) 正常', '無皮疹']} 
          values={current.skin} 
          onToggle={(v: any) => onChange({...current, skin: v})}
          otherValue={current.skinOther}
          onOtherChange={(v: any) => onChange({...current, skinOther: v})}
        />
      </div>

      <div>
        <SectionTitle text="神經學檢查 (NE)" />
        <MultiSelect 
          options={['無局部神經學缺損']} 
          values={current.ne} 
          onToggle={(v: any) => onChange({...current, ne: v})}
          otherValue={current.neOther}
          onOtherChange={(v: any) => onChange({...current, neOther: v})}
        />
      </div>
    </div>
  );
};

export default PEForm;
