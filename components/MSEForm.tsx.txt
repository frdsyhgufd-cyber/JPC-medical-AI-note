
import React from 'react';
import { MSEData } from '../types';

interface Props {
  data?: MSEData;
  onChange: (data: MSEData) => void;
}

const MSEForm: React.FC<Props> = ({ data, onChange }) => {
  const defaultMSE: MSEData = {
    appearance: { cleanliness: '', cooperation: [], psychomotor: [], other: '' },
    speech: { speed: '', volume: '', coherence: [], other: '' },
    mood: { subjective: [], objective: [], other: '' },
    thought: { process: [], content: [], other: '' },
    perception: { hallucinations: [], other: '' },
    cognition: { orientation: { time: false, person: false, place: false }, attention: '', memory: [], abstraction: [], other: '' },
    insight: '',
    risk: [],
    riskOther: ''
  };

  const current = data || defaultMSE;

  // 輔助函式：確保資料是陣列（處理舊資料遷移）
  const ensureArray = (val: any) => Array.isArray(val) ? val : (val ? [val] : []);

  const SectionTitle = ({ text }: { text: string }) => <h4 className="bg-slate-100 p-2 font-bold text-sm mb-3 rounded text-slate-700 border-l-4 border-blue-500">{text}</h4>;

  const SingleSelect = ({ options, value, onSelect, otherValue, onOtherChange }: any) => (
    <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
      {options.map((opt: string) => (
        <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="radio" checked={value === opt} onChange={() => onSelect(opt)} /> {opt}
        </label>
      ))}
      {onOtherChange && (
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="radio" checked={value === 'others'} onChange={() => onSelect('others')} /> 其他:
          {value === 'others' && (
            <input className="border-b outline-none ml-1 text-sm p-1 focus:border-blue-500" value={otherValue || ''} onChange={(e) => onOtherChange(e.target.value)} />
          )}
        </label>
      )}
    </div>
  );

  const MultiSelect = ({ options, values, onToggle, otherValue, onOtherChange, excludeMap = {} }: any) => {
    const currentValues = ensureArray(values);
    
    return (
      <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
        {options.map((opt: string) => (
          <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={currentValues.includes(opt)} 
              onChange={() => {
                let next = currentValues.includes(opt) 
                  ? currentValues.filter((v: any) => v !== opt) 
                  : [...currentValues, opt];
                
                // 互斥邏輯
                if (!currentValues.includes(opt)) {
                  if (excludeMap[opt]) {
                    // 如果勾選的是互斥項，清除所有其他項
                    next = [opt];
                  } else {
                    // 如果勾選的是普通項，清除所有互斥項
                    Object.keys(excludeMap).forEach(key => {
                      if (next.includes(key)) next = next.filter((v: any) => v !== key);
                    });
                  }
                }
                onToggle(next);
              }} 
            /> {opt}
          </label>
        ))}
        {onOtherChange && (
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={currentValues.includes('others')} 
              onChange={() => {
                const isAdding = !currentValues.includes('others');
                let next = isAdding ? [...currentValues, 'others'] : currentValues.filter((v: any) => v !== 'others');
                
                // 勾選其他時也要清除互斥項
                if (isAdding) {
                  Object.keys(excludeMap).forEach(key => {
                    if (next.includes(key)) next = next.filter((v: any) => v !== key);
                  });
                }
                onToggle(next);
              }} 
            /> 其他:
            {currentValues.includes('others') && (
              <input className="border-b outline-none ml-1 text-sm p-1 focus:border-blue-500" value={otherValue || ''} onChange={(e) => onOtherChange(e.target.value)} />
            )}
          </label>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* A */}
      <div>
        <SectionTitle text="A. 外觀與態度 (Appearance & Attitude)" />
        <p className="text-[10px] font-bold text-slate-400 mb-1">整潔度</p>
        <SingleSelect 
          options={['整潔', '不整潔', '極度邋遢']} 
          value={current.appearance.cleanliness} 
          onSelect={(v: any) => onChange({...current, appearance: {...current.appearance, cleanliness: v}})}
          onOtherChange={(v: any) => onChange({...current, appearance: {...current.appearance, cleanlinessOther: v}})}
          otherValue={current.appearance.cleanlinessOther}
        />
        
        <p className="text-[10px] font-bold text-slate-400 mb-1">合作度</p>
        <MultiSelect 
          options={['合作', '不合作', '敵意', '過度防衛']} 
          values={current.appearance.cooperation} 
          onToggle={(v: any) => onChange({...current, appearance: {...current.appearance, cooperation: v}})}
          excludeMap={{ '合作': ['不合作', '敵意', '過度防衛'] }}
          onOtherChange={(v: any) => onChange({...current, appearance: {...current.appearance, cooperationOther: v}})}
          otherValue={current.appearance.cooperationOther}
        />
        
        <p className="text-[10px] font-bold text-slate-400 mb-1">精神運動</p>
        <MultiSelect 
          options={['正常', '遲緩', '躁動', '異常動作 (Tic/顫抖)']} 
          values={current.appearance.psychomotor} 
          onToggle={(v: any) => onChange({...current, appearance: {...current.appearance, psychomotor: v}})}
          excludeMap={{ '正常': ['遲緩', '躁動', '異常動作 (Tic/顫抖)'] }}
          onOtherChange={(v: any) => onChange({...current, appearance: {...current.appearance, other: v}})}
          otherValue={current.appearance.other}
        />
      </div>

      {/* B */}
      <div>
        <SectionTitle text="B. 言語 (Speech)" />
        <p className="text-[10px] font-bold text-slate-400 mb-1">速度</p>
        <SingleSelect 
          options={['正常', '緩慢', '快速', '不發一語']} 
          value={current.speech.speed} 
          onSelect={(v: any) => onChange({...current, speech: {...current.speech, speed: v}})}
          onOtherChange={(v: any) => onChange({...current, speech: {...current.speech, speedOther: v}})}
          otherValue={current.speech.speedOther}
        />
        
        <p className="text-[10px] font-bold text-slate-400 mb-1">音量</p>
        <SingleSelect 
          options={['適中', '輕聲細語', '大聲咆哮']} 
          value={current.speech.volume} 
          onSelect={(v: any) => onChange({...current, speech: {...current.speech, volume: v}})}
          onOtherChange={(v: any) => onChange({...current, speech: {...current.speech, volumeOther: v}})}
          otherValue={current.speech.volumeOther}
        />
        
        <p className="text-[10px] font-bold text-slate-400 mb-1">連貫性</p>
        <MultiSelect 
          options={['連貫', '答非所問', '語無倫次']} 
          values={current.speech.coherence} 
          onToggle={(v: any) => onChange({...current, speech: {...current.speech, coherence: v}})} 
          excludeMap={{ '連貫': ['答非所問', '語無倫次'] }}
          onOtherChange={(v: any) => onChange({...current, speech: {...current.speech, other: v}})} 
          otherValue={current.speech.other}
        />
      </div>

      {/* C */}
      <div>
        <SectionTitle text="C. 情緒與情感 (Mood & Affect)" />
        <p className="text-[10px] font-bold text-slate-400 mb-1">主觀情緒</p>
        <MultiSelect 
          options={['穩定', '憂鬱', '焦慮', '亢奮']} 
          values={current.mood.subjective} 
          onToggle={(v: any) => onChange({...current, mood: {...current.mood, subjective: v}})} 
          excludeMap={{ '穩定': ['憂鬱', '焦慮', '亢奮'] }} 
          onOtherChange={(v: any) => onChange({...current, mood: {...current.mood, other: v}})} 
          otherValue={current.mood.other}
        />
        
        <p className="text-[10px] font-bold text-slate-400 mb-1">客觀情感</p>
        <MultiSelect 
          options={['適切', '平淡 (Flat)', '易怒', '不一致']} 
          values={current.mood.objective} 
          onToggle={(v: any) => onChange({...current, mood: {...current.mood, objective: v}})} 
          excludeMap={{ '適切': ['平淡 (Flat)', '易怒', '不一致'] }}
          onOtherChange={(v: any) => onChange({...current, mood: {...current.mood, objectiveOther: v}})}
          otherValue={current.mood.objectiveOther}
        />
      </div>

      {/* D */}
      <div>
        <SectionTitle text="D. 思維 (Thought)" />
        <p className="text-[10px] font-bold text-slate-400 mb-1">過程 (邏輯)</p>
        <MultiSelect 
          options={['邏輯連貫', '思考鬆散', '思考中斷', '思考奔馳', '意念飛耀']} 
          values={current.thought.process} 
          onToggle={(v: any) => onChange({...current, thought: {...current.thought, process: v}})} 
          excludeMap={{ '邏輯連貫': ['思考鬆散', '思考中斷', '思考奔馳', '意念飛耀'] }}
          onOtherChange={(v: any) => onChange({...current, thought: {...current.thought, processOther: v}})}
          otherValue={current.thought.processOther}
        />
        
        <p className="text-[10px] font-bold text-slate-400 mb-1">內容 (妄想)</p>
        <MultiSelect 
          options={['無異常', '被害妄想', '關係妄想', '誇大妄想', '被控制妄想', '被偷妄想']} 
          values={current.thought.content} 
          onToggle={(v: any) => onChange({...current, thought: {...current.thought, content: v}})} 
          excludeMap={{ '無異常': ['被害妄想', '關係妄想', '誇大妄想', '被控制妄想', '被偷妄想'] }} 
          onOtherChange={(v: any) => onChange({...current, thought: {...current.thought, other: v}})} 
          otherValue={current.thought.other}
        />
      </div>

      {/* E */}
      <div>
        <SectionTitle text="E. 知覺 (Perception)" />
        <p className="text-[10px] font-bold text-slate-400 mb-1">幻覺</p>
        <MultiSelect options={['無', '幻聽', '幻視']} values={current.perception.hallucinations} onToggle={(v: any) => onChange({...current, perception: {...current.perception, hallucinations: v}})} excludeMap={{ '無': ['幻聽', '幻視'] }} otherValue={current.perception.other} onOtherChange={(v: any) => onChange({...current, perception: {...current.perception, other: v}})} />
      </div>

      {/* F */}
      <div>
        <SectionTitle text="F. 認知功能 (Cognition)" />
        <p className="text-[10px] font-bold text-slate-500 mb-2">定向感</p>
        <div className="flex flex-wrap gap-4 mb-4">
          <label className="text-sm flex items-center gap-2 cursor-pointer bg-red-50 p-2 rounded border border-red-100 select-none">
            <input type="checkbox" checked={current.cognition.orientation.time} onChange={() => onChange({...current, cognition: {...current.cognition, orientation: {...current.cognition.orientation, time: !current.cognition.orientation.time}}})} /> 時間定向感異常
          </label>
          <label className="text-sm flex items-center gap-2 cursor-pointer bg-red-50 p-2 rounded border border-red-100 select-none">
            <input type="checkbox" checked={current.cognition.orientation.place} onChange={() => onChange({...current, cognition: {...current.cognition, orientation: {...current.cognition.orientation, place: !current.cognition.orientation.place}}})} /> 地點定向感異常
          </label>
          <label className="text-sm flex items-center gap-2 cursor-pointer bg-red-50 p-2 rounded border border-red-100 select-none">
            <input type="checkbox" checked={current.cognition.orientation.person} onChange={() => onChange({...current, cognition: {...current.cognition, orientation: {...current.cognition.orientation, person: !current.cognition.orientation.person}}})} /> 人物定向感異常
          </label>
        </div>
        
        <p className="text-[10px] font-bold text-slate-400 mb-1">注意力</p>
        <SingleSelect 
          options={['集中', '易分心']} 
          value={current.cognition.attention} 
          onSelect={(v: any) => onChange({...current, cognition: {...current.cognition, attention: v}})} 
          onOtherChange={(v: any) => onChange({...current, cognition: {...current.cognition, attentionOther: v}})}
          otherValue={current.cognition.attentionOther}
        />
        
        <p className="text-[10px] font-bold text-slate-400 mb-1">記憶力</p>
        <MultiSelect options={['近期記憶缺損', '遠期記憶缺損']} values={current.cognition.memory} onToggle={(v: any) => onChange({...current, cognition: {...current.cognition, memory: v}})} />
        
        <p className="text-[10px] font-bold text-slate-400 mb-1">抽象思考</p>
        <MultiSelect 
          options={['無法解釋諺語']} 
          values={current.cognition.abstraction} 
          onToggle={(v: any) => onChange({...current, cognition: {...current.cognition, abstraction: v}})}
          onOtherChange={(v: any) => onChange({...current, cognition: {...current.cognition, other: v}})}
          otherValue={current.cognition.other}
        />
      </div>

      {/* G */}
      <div>
        <SectionTitle text="G. 病識感 (Insight)" />
        <SingleSelect 
          options={[
            '完全缺乏', 
            '部分 (知道生病但不認為需要就醫或無法配合治療)', 
            '完整 (主動求助)'
          ]} 
          value={current.insight} 
          onSelect={(v: any) => onChange({...current, insight: v})} 
        />
      </div>

      {/* H */}
      <div>
        <SectionTitle text="H. 風險 (Risk)" />
        <MultiSelect options={['無', '自傷或自殺風險', '暴力風險', '跌倒風險', '逃跑風險']} values={current.risk} onToggle={(v: any) => onChange({...current, risk: v})} excludeMap={{ '無': ['自傷或自殺風險', '暴力風險', '跌倒風險', '逃跑風險'] }} otherValue={current.riskOther} onOtherChange={(v: any) => onChange({...current, riskOther: v})} />
      </div>
    </div>
  );
};

export default MSEForm;
