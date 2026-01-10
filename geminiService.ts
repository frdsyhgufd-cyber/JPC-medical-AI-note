
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

const generateWithRetry = async (ai: any, params: any, retries = 3, delay = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      const isQuotaError = error.message?.includes('429') || error.status === 429;
      if (isQuotaError && i < retries - 1) {
        const waitTime = delay * Math.pow(2, i);
        console.warn(`Gemini API 429 錯誤，正在進行第 ${i + 1} 次重試，等待 ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
};

export const generateMedicalNote = async (
  patient: Patient,
  type: RecordType,
  referenceNotes: MedicalRecord[] = [],
  extraInfo: string = ''
) => {
  // 直接使用提供的 API Key
  const ai = new GoogleGenAI({ apiKey: "gen-lang-client-0336749694" });
  const lastSameTypeRecord = referenceNotes.find(r => r.type === type);

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
        5. 請系統性地整合住院期間的所有病程紀錄 (Progress Notes) 與治療重點。
        6. 內容必須包含：入院主訴摘要、住院期間病情演變過程、重要藥物調整之反應、以及各項復健治療成效評估。
        7. 必須以專業、客觀且具備醫學邏輯的口吻描述。
        8. 結尾必須結合後續的安置計畫。
      `;
      break;

    case RecordType.SUPPORTIVE_PSYCHOTHERAPY:
      formatInstruction = `
        1. 嚴格禁止使用 SOAP 標籤。
        2. 開頭第一行必須是「支持性心理治療紀錄」。
        3. 內容必須「極度簡短」，總字數嚴格限制在 150 字以內。
        4. 結構規範：
           (a) 治療目標：僅能列出「一個」核心目標。
           (b) 治療內容：採條列式（最多 3 點），敘述必須精簡。
           (c) 效果評估：敘述必須簡短（如：mild effect, effective, 可接受, 部分配合改善等）。
      `;
      break;

    case RecordType.PSYCHOTHERAPY:
      formatInstruction = `
        1. 嚴格禁止使用 SOAP 標籤。
        2. 開頭第一行必須是「特殊心理治療紀錄」。
        3. 描述個案心理動力、互動過程與治療技巧。
      `;
      break;

    case RecordType.SPECIAL_HANDLING:
      formatInstruction = `
        1. 開頭第一行必須是「精神科住院病人特別處理紀錄」。
        2. 嚴格禁止使用 SOAP 標籤。
        3. 生成內容應展現施予「特別處理」之醫療合理性，架構如下：
           (a) 【特別處理原因】：分析個案目前受精神症狀（如：${patient.mse?.thought.content.join('/')}、幻覺、易怒情緒或不配合治療行為）之影響，如何導致其具備潛在之「攻擊、干擾或自傷之虞」。
           (b) 【臨床處置內容】：描述治療團隊提供的密集照護計畫（如：密切觀察行為、加強心理支持、調整藥物、或採取必要的限制措施）。
           (c) 【預期目標】：預防危險行為發生並確保病房環境安全。
        4. 連結邏輯：請嘗試將個案當前 MSE 的異常項目（如：躁動、被害妄想、不合作）與風險評估進行邏輯連結，若症狀與風險明顯無關則維持一般專業描述。
      `;
      break;

    case RecordType.WEEKLY_SUMMARY:
      formatInstruction = `1. 第一行必須是「Weekly Summary」。2. 禁止 SOAP。`;
      break;
    
    case RecordType.MONTHLY_SUMMARY:
      formatInstruction = `1. 第一行必須是「Monthly Summary」。2. 禁止 SOAP。`;
      break;

    case RecordType.PHYSIO_PSYCHO_EXAM:
      formatInstruction = `1. 第一行「生理心理功能檢查紀錄」。2. 禁止 SOAP。`;
      break;

    default:
      formatInstruction = `開頭請標示紀錄名稱，嚴格禁止 SOAP 標籤。`;
  }

  const systemInstruction = `
    你是一個在嘉南療養院服務的資深醫療AI助手。
    【核心規範】
    1. 格式絕對隔離：只有病程紀錄 (Progress Note) 可使用 SOAP 標籤，其餘紀錄一律禁止。
    2. 禁止符號：輸出內容中絕對不得包含「**」粗體語法。
    3. 特別處理紀錄：必須強調「症狀 -> 風險 -> 處置」的邏輯鏈，展現醫療必要性。
    4. 專業度：維持資深精神科醫師/護理師口吻，僅使用正式醫學術語。
    5. 重點：如果提供住院日期，Discharge Note 與 Off Duty Note 必須精確標註。
  `;

  const psychiatricDiag = getFullDiagnosisList(patient.diagnosis?.psychiatric, patient.diagnosis?.psychiatricOther);
  const medicalDiag = getFullDiagnosisList(patient.diagnosis?.medical, patient.diagnosis?.medicalOther);

  const patientContext = `
【臨床素材】
- 診斷：${psychiatricDiag} / ${medicalDiag}
${admissionDateStr ? `- 住院日期：${admissionDateStr}` : ''}
- 臨床重點：${patient.clinicalFocus || '穩定觀察中'}
- MSE：\n${formatMSEData(patient.mse)}
- PE & NE：\n${formatPEData(patient.pe)}
${extraInfo ? `- 附加說明/原因/安置計畫：${extraInfo}` : ''}

${lastSameTypeRecord ? `【前次紀錄供差異化】\n${lastSameTypeRecord.content}` : ''}
  `;

  const wordLimit = (type === RecordType.OFF_DUTY_SUMMARY || type === RecordType.DISCHARGE_NOTE) ? 600 : (type === RecordType.SUPPORTIVE_PSYCHOTHERAPY ? 150 : 400);

  const prompt = `
    請生成正式的「${type}」。
    規範細節：
    ${formatInstruction}
    限制：${wordLimit} 字以內，不含日期，禁止使用「**」粗體符號。
  `;

  try {
    const response = await generateWithRetry(ai, {
      model: 'gemini-3-flash-preview',
      contents: patientContext + "\n\n" + prompt,
      config: {
        systemInstruction,
        temperature: 0.85,
      }
    });
    return response.text || "生成失敗。";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return "生成發生錯誤，請稍後再試。";
  }
};
