import { GoogleGenAI } from "@google/genai";
import { Patient, RecordType, MedicalRecord } from "./types";

const getFullDiagnosisList = (list: string[] | undefined, otherText: string | undefined) => {
  if (!list || list.length === 0) return "無特定診斷";
  return list
    .map(item => item === 'others' ? (otherText || '其他診斷') : item)
    .filter(item => item !== 'others')
    .join(', ');
};

const formatMSEData = (mse: any) => {
  if (!mse) return "尚未進行 MSE 評估。";
  
  const formatValue = (val: any, other: string | undefined) => {
    if (val === 'others') return other || '其他';
    if (Array.isArray(val)) {
      if (val.length === 0) return '正常/無異常';
      return val.map(v => v === 'others' ? (other || '其他') : v).join(', ');
    }
    return val || '正常/無異常';
  };

  const sections = [];
  if (mse.appearance) {
    sections.push(`[外觀] 整潔: ${formatValue(mse.appearance.cleanliness, mse.appearance.cleanlinessOther)}, 合作: ${formatValue(mse.appearance.cooperation, mse.appearance.cooperationOther)}, 精神運動: ${formatValue(mse.appearance.psychomotor, mse.appearance.other)}`);
  }
  if (mse.speech) {
    sections.push(`[言語] 速度/音量: ${formatValue(mse.speech.speed, mse.speech.speedOther)}/${formatValue(mse.speech.volume, mse.speech.volumeOther)}, 連貫性: ${formatValue(mse.speech.coherence, mse.speech.other)}`);
  }
  if (mse.mood) {
    sections.push(`[情緒情感] ${formatValue(mse.mood.subjective, mse.mood.other)} / ${formatValue(mse.mood.objective, mse.mood.objectiveOther)}`);
  }
  if (mse.thought) {
    sections.push(`[思維] 邏輯: ${formatValue(mse.thought.process, mse.thought.processOther)}, 妄想: ${formatValue(mse.thought.content, mse.thought.other)}`);
  }
  if (mse.perception) {
    sections.push(`[知覺] 幻覺: ${formatValue(mse.perception.hallucinations, mse.perception.other)}`);
  }
  if (mse.cognition) {
    const ori = mse.cognition.orientation;
    const abnormalItems = [];
    if (ori?.time) abnormalItems.push('時間');
    if (ori?.place) abnormalItems.push('地點');
    if (ori?.person) abnormalItems.push('人物');
    
    const oriDisplay = abnormalItems.length > 0 
      ? `${abnormalItems.join('/')}定向感異常` 
      : '定向感正常';
      
    sections.push(`[認知] ${oriDisplay}, 注意力: ${formatValue(mse.cognition.attention, mse.cognition.attentionOther)}`);
  }
  if (mse.insight) {
    sections.push(`[病識感] ${mse.insight}`);
  }
  if (mse.risk) {
    sections.push(`[風險] ${Array.isArray(mse.risk) ? mse.risk.join(', ') : '無'}`);
  }
  
  return sections.join('\n');
};

const formatPEData = (pe: any) => {
  if (!pe) return "無異常。";
  const formatValue = (val: any, other: string | undefined) => {
    if (!val || (Array.isArray(val) && val.length === 0)) return '無特定異常';
    if (Array.isArray(val)) return val.join(', ');
    return val;
  };
  return `意識: ${formatValue(pe.conscious, pe.consciousOther)}, 
          神經學: ${formatValue(pe.ne, pe.neOther)}, 
          其餘系統: 正常`;
};

export const generateMedicalNote = async (
  patient: Patient,
  type: RecordType,
  referenceNotes: MedicalRecord[] = [],
  extraInfo: string = ''
) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey.length < 10) {
    return "⚠️ 系統錯誤：未偵測到 API 金鑰，請檢查 Netlify 設定。";
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const lastRecordOfSameType = referenceNotes
    .filter(r => r.type === type)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const needsLengthLimit = [
    RecordType.PROGRESS_NOTE,
    RecordType.SPECIAL_HANDLING,
    RecordType.SUPPORTIVE_PSYCHOTHERAPY,
    RecordType.PSYCHOTHERAPY,
    RecordType.PHYSIO_PSYCHO_EXAM
  ].includes(type);

  const psychDiag = getFullDiagnosisList(patient.diagnosis?.psychiatric, patient.diagnosis?.psychiatricOther);
  const medDiag = getFullDiagnosisList(patient.diagnosis?.medical, patient.diagnosis?.medicalOther);

  // 構造基本資料摘要
  const age = patient.birthYearROC ? (new Date().getFullYear() - 1911 - patient.birthYearROC) : '不詳';
  const gender = patient.gender === 'male' ? '男' : (patient.gender === 'female' ? '女' : '其他');
  const disability = patient.hasDisabilityCertificate ? '領有身心障礙手冊' : '無身心障礙手冊';
  const catastrophic = patient.hasCatastrophicIllnessCard ? '領有重大傷病卡' : '無重大傷病卡';
  const patientSummaryLine = `${age}歲，${gender}性，${disability}，${catastrophic}，此次入院精神科診斷為：${psychDiag}。`;

  let formatInstruction = "";
  switch (type) {
    case RecordType.PROGRESS_NOTE:
      formatInstruction = `
【格式要求】
1. 採用 SOAP 格式。
2. S: 描述病患主觀訴求。
3. O: 簡短摘要 MSE 與 PE/NE。
4. A: 僅列出精神科與內外科診斷，禁止補充說明。
5. P: 列出 3-5 點治療計畫。
6. 【重要】在 P 之後換行，新增區塊「主治醫師評語與建議」，內容應根據病患風險與現況提供臨床照護提醒（如預防跌倒、副作用觀察等）。`;
      break;
    case RecordType.SUPPORTIVE_PSYCHOTHERAPY:
      formatInstruction = `
【格式要求】必須採下列結構撰寫：
治療目標：[具體目標，如建立關係或衛教]
治療內容：[具體行動或衛教項目，若為過程請採 1. 2. 3. 條列]
效果評估：[如 mild effect / effective / 可接受 / 穩定]
(參考範例：目標為建立治療性關係，內容為傾聽關懷，評估為 mild effect)`;
      break;
    case RecordType.PSYCHOTHERAPY:
      formatInstruction = `
【特殊心理治療紀錄生成原則】
1. 具體病徵描述：著重以具體例子說明個案狀況。例如個案的特定負向思考（如「我一點用處都沒有」、「大家都在針對我」）或其他具體臨床表現。
2. 治療技巧運用：詳細紀錄使用的專業治療技巧（如認知行為治療 CBT 之認知重建、辯證行為治療之正念、或給予同理、情感反映等技巧）。
3. 適應技能發展：描述如何協助病患發展新的適應技能（Adaptive skills），以改善其應對能力或心理功能。`;
      break;
    case RecordType.SPECIAL_HANDLING:
      formatInstruction = `
【特別處理紀錄生成原則】
1. 特別處理原因：重點記錄病患因精神症狀影響（如幻聽指示、嚴重妄想、情緒極度不穩），導致有攻擊他人或自傷之虞。請合理連結 MSE 中的欄位資訊（如衝動控制、被害妄想、易怒等）來強化此項處置的合理性。
2. 處置內容：說明治療團隊必須提供密集的經常性照護，並採取必要之心理支持、行為引導或藥物調整，以避免危險行為發生。
3. 若欄位內容與風險差異過大，則無需強行連結。`;
      break;
    case RecordType.WEEKLY_SUMMARY:
    case RecordType.MONTHLY_SUMMARY:
    case RecordType.OFF_DUTY_SUMMARY:
    case RecordType.DISCHARGE_NOTE:
      formatInstruction = `
【彙整紀錄生成原則】
1. 禁止使用 SOAP 格式。
2. 請採用專業的「敘事方式 (Narrative)」撰寫，整合並摘要病患的住院病程。
3. 紀錄結構如下：
   第一行：紀錄名稱（例如：${type}）
   第二行：${patientSummaryLine}
   第三行開始：根據提供的病程紀錄 (Progress Note) 進行內容整合與彙寫。
4. 特定補充：
   ${type === RecordType.OFF_DUTY_SUMMARY ? `- 必須包含 Off Duty note 原因：${extraInfo}` : ''}
   ${type === RecordType.DISCHARGE_NOTE ? `- 必須包含 Discharge 安置計畫：${extraInfo}` : ''}`;
      break;
    default:
      formatInstruction = `專業醫療筆記格式。`;
  }

  const systemInstruction = `你是一位精神科醫療寫作專家。
【基本準則】
1. 嚴禁幻覺：禁止發明病患引句、對話或資料未提及的症狀。
2. 嚴禁擅自增加護理細節：除非資料明確記載，禁止寫入具體監控頻率或餵食計畫。
3. 證據基礎：所有推論必須基於提供的 MSE/PE 資料。
4. 內容多樣性：新紀錄必須與前次紀錄有 30% 以上的差異化。
5. 字數限制：${needsLengthLimit ? '總字數禁止超過 400 個中文字。' : ''}
6. 禁止使用粗體語法 (**)。`;

  const promptText = `
【病患現況】
精神科診斷：${psychDiag}
內外科診斷：${medDiag}
福利身分：${patient.hasDisabilityCertificate ? '有身障手冊' : '無身障手冊'}, ${patient.hasCatastrophicIllnessCard ? '有重大傷病卡' : '無重大傷病卡'}
臨床重點：${patient.clinicalFocus || '穩定'}
MSE：\n${formatMSEData(patient.mse)}
PE/NE：\n${formatPEData(patient.pe)}
${extraInfo ? `補充資訊：${extraInfo}` : ''}

【參考素材：過去的病程紀錄】
${referenceNotes.map(r => `[${r.createdAt}] ${r.content}`).join('\n\n')}

【對照組：前次同類型紀錄】
${lastRecordOfSameType ? lastRecordOfSameType.content : '無前次紀錄'}

【任務】
生成一份 ${type}。請遵守格式要求與禁令：
${formatInstruction}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.8, 
      }
    });

    return response.text || "⚠️ API 回傳空內容。";
  } catch (error: any) {
    if (error.message?.includes('429')) {
      return "⚠️ 頻率限制中，請稍候 1 分鐘後再試。";
    }
    return `⚠️ 生成失敗：${error.message}`;
  }
};
