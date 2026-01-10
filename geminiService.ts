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
  
  const joinArr = (val: any) => Array.isArray(val) ? val.join(', ') : (val || '無');
  const formatValue = (val: any, other: string | undefined) => {
    if (val === 'others') return other || '其他';
    if (Array.isArray(val)) {
      return val.map(v => v === 'others' ? (other || '其他') : v).join(', ');
    }
    return val || '無';
  };

  const sections = [];
  if (mse.appearance) {
    sections.push(`[外觀態度] 整潔: ${formatValue(mse.appearance.cleanliness, mse.appearance.cleanlinessOther)}, 合作: ${formatValue(mse.appearance.cooperation, mse.appearance.cooperationOther)}, 精神運動: ${formatValue(mse.appearance.psychomotor, mse.appearance.other)}`);
  }
  if (mse.speech) {
    sections.push(`[言語] 速度: ${formatValue(mse.speech.speed, mse.speech.speedOther)}, 音量: ${formatValue(mse.speech.volume, mse.speech.volumeOther)}, 連貫性: ${formatValue(mse.speech.coherence, mse.speech.other)}`);
  }
  if (mse.mood) {
    sections.push(`[情緒情感] 主觀: ${formatValue(mse.mood.subjective, mse.mood.other)}, 客觀: ${formatValue(mse.mood.objective, mse.mood.objectiveOther)}`);
  }
  if (mse.thought) {
    sections.push(`[思維] 過程 (邏輯): ${formatValue(mse.thought.process, mse.thought.processOther)}, 內容 (妄想): ${formatValue(mse.thought.content, mse.thought.other)}`);
  }
  if (mse.perception) {
    sections.push(`[知覺] 幻覺: ${formatValue(mse.perception.hallucinations, mse.perception.other)}`);
  }
  if (mse.cognition) {
    const ori = mse.cognition.orientation;
    const timeStatus = ori?.time ? '異常' : '正常';
    const placeStatus = ori?.place ? '異常' : '正常';
    const personStatus = ori?.person ? '異常' : '正常';
    
    sections.push(`認知功能: 定向感(時/地/人): ${timeStatus}/${placeStatus}/${personStatus}, 注意力: ${formatValue(mse.cognition.attention, mse.cognition.attentionOther)}, 記憶力: ${joinArr(mse.cognition.memory)}, 抽象思考: ${formatValue(mse.cognition.abstraction, mse.cognition.other)}`);
  }
  if (mse.insight) {
    sections.push(`[病識感] ${mse.insight}`);
  }
  if (mse.risk) {
    sections.push(`[風險評估] ${joinArr(mse.risk)}${mse.riskOther ? ', 其他風險: '+mse.riskOther : ''}`);
  }
  
  return sections.join('\n');
};

const formatPEData = (pe: any) => {
  if (!pe) return "尚未進行 PE & NE 評估。";
  
  const formatValue = (val: any, other: string | undefined) => {
    if (!val || (Array.isArray(val) && val.length === 0)) return '無特定異常';
    if (Array.isArray(val)) {
      return val.map(v => v === 'others' ? (other || '其他') : v).join(', ');
    }
    return val === 'others' ? (other || '其他') : val;
  };

  const sections = [];
  sections.push(`[意識狀態] ${formatValue(pe.conscious, pe.consciousOther)}`);
  sections.push(`[頭頸部] ${formatValue(pe.heent, pe.heentOther)}`);
  sections.push(`[胸部] ${formatValue(pe.chest, pe.chestOther)}`);
  sections.push(`[心臟] ${formatValue(pe.heart, pe.heartOther)}`);
  sections.push(`[腹部] ${formatValue(pe.abdominal, pe.abdominalOther)}`);
  sections.push(`[四肢] ${formatValue(pe.extremities, pe.extremitiesOther)}`);
  sections.push(`[皮膚] ${formatValue(pe.skin, pe.skinOther)}`);
  sections.push(`[神經學] ${formatValue(pe.ne, pe.neOther)}`);
  
  return sections.join('\n');
};

export const generateMedicalNote = async (
  patient: Patient,
  type: RecordType,
  referenceNotes: MedicalRecord[] = [],
  extraInfo: string = ''
) => {
  // 每次調用時創建新實例以確保獲取最新的環境變量
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let formatInstruction = "";
  const admissionDateStr = patient.admissionDate 
    ? `民國 ${patient.admissionDate.year} 年 ${patient.admissionDate.month} 月 ${patient.admissionDate.day} 日`
    : "";

  switch (type) {
    case RecordType.PROGRESS_NOTE:
      formatInstruction = `
        1. 開頭第一行必須是「病程紀錄 (Progress Note)」。
        2. 採用「SOAP 格式」。
        3. S (Subjective): 僅記錄個案主訴。
        4. O (Objective): 極簡描述 MSE/PE。只准列出異常發現，忽略正常項目。
        5. A (Assessment): 絕對僅能列出「診斷名稱」。嚴禁包含病情分析文字。
        6. P (Plan): 必須以「純條列式」列出處置計畫（如 1., 2., 3...）。嚴禁散文描述。
      `;
      break;
    case RecordType.OFF_DUTY_SUMMARY:
      formatInstruction = `
        1. 嚴格禁止使用 SOAP 標籤。
        2. 開頭第一行必須是「Off Duty note」。
        3. 內容生成請主要使用「中文」。
        ${admissionDateStr ? `4. 必須在內容開頭提及病患於 ${admissionDateStr} 入院住院治療。` : ''}
      `;
      break;
    case RecordType.DISCHARGE_NOTE:
      formatInstruction = `
        1. 嚴格禁止使用 SOAP 標籤。
        2. 開頭第一行必須是「Discharge Note」。
        3. 採用「高度專業醫療整合風格」撰寫。
        ${admissionDateStr ? `4. 內容首段必須提及病患自 ${admissionDateStr} 入院以來之病程總結。` : ''}
        5. 結尾必須結合後續的安置計畫。
      `;
      break;
    default:
      formatInstruction = `開頭請標示紀錄名稱，嚴格禁止 SOAP 標籤。`;
  }

  const systemInstruction = `
    你是一個在嘉南療養院服務的資深醫療AI助手。
    【核心規範】
    1. 格式絕對隔離：只有病程紀錄 (Progress Note) 可使用 SOAP 標籤，其餘一律禁止。
    2. 禁止符號：輸出內容中絕對不得包含雙星號粗體語法。
    3. 專業度：維持資深精神科醫師/護理師口吻。
  `;

  const psychiatricDiag = getFullDiagnosisList(patient.diagnosis?.psychiatric, patient.diagnosis?.psychiatricOther);
  const medicalDiag = getFullDiagnosisList(patient.diagnosis?.medical, patient.diagnosis?.medicalOther);

  const patientContext = `
【臨床素材】
- 診斷：${psychiatricDiag} / ${medicalDiag}
- 臨床重點：${patient.clinicalFocus || '穩定觀察中'}
- MSE：\n${formatMSEData(patient.mse)}
- PE & NE：\n${formatPEData(patient.pe)}
${extraInfo ? `- 附加說明/原因/安置計畫：${extraInfo}` : ''}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: patientContext + "\n\n" + formatInstruction,
      config: {
        systemInstruction,
        temperature: 0.8,
      }
    });
    return response.text || "生成失敗。";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return "生成發生錯誤，請稍後再試。";
  }
};
