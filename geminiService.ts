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
    sections.push(`[認知] 定向感: ${ori?.time?'時':''}${ori?.place?'地':''}${ori?.person?'人':''}異常, 注意力: ${formatValue(mse.cognition.attention, mse.cognition.attentionOther)}`);
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
  
  // 取得前一次同類型的紀錄內容
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

  let formatInstruction = "";
  switch (type) {
    case RecordType.PROGRESS_NOTE:
      formatInstruction = `
【格式要求】
1. 採用 SOAP 格式
2. S: 描述病患主觀訴求
3. O: 簡短摘要 MSE 與 PE/NE，不要展開細節
4. A: 僅寫出診斷名稱，禁止任何補充說明或重複描述 O 的內容
5. P: 列出 3-5 點治療計畫 (嚴禁超過 5 點)`;
      break;
    case RecordType.SPECIAL_HANDLING:
      formatInstruction = `針對病患目前的 MSE 異常（如被害妄想、躁動）推論必要之處置，禁止發明資料中未提及的暴力行為。`;
      break;
    default:
      formatInstruction = `專業醫療筆記格式。`;
  }

  const systemInstruction = `你是一位精神科醫療寫作專家。
【基本準則】
1. 嚴禁幻覺：禁止發明病患引句、對話或資料未提及的症狀。
2. 嚴禁擅自增加護理細節：除非資料明確記載，禁止寫入具體監控頻率(如每15分巡房)或餵食計畫。
3. 證據基礎：所有推論必須基於提供的 MSE/PE 資料。
4. 內容多樣性：新紀錄必須與前次紀錄有 30% 以上的差異化（包含句型與描述重點）。
5. 字數嚴格限制：${needsLengthLimit ? '總字數絕對禁止超過 400 個中文字。' : ''}
6. 禁止使用粗體語法 (**)。`;

  const promptText = `
【病患現況】
診斷：${getFullDiagnosisList(patient.diagnosis?.psychiatric, patient.diagnosis?.psychiatricOther)}
臨床重點：${patient.clinicalFocus || '穩定'}
MSE：\n${formatMSEData(patient.mse)}
PE/NE：\n${formatPEData(patient.pe)}
${extraInfo ? `補充資訊：${extraInfo}` : ''}

【對照組：前次同類型紀錄內容】
${lastRecordOfSameType ? lastRecordOfSameType.content : '無前次紀錄'}

【任務】
生成一份 ${type}。請確保內容與前次紀錄有明顯差異，且遵守所有禁令與格式要求：
${formatInstruction}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.85, // 稍微提高隨機性以確保 30% 差異
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
