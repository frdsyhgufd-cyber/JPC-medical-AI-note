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
    sections.push(`[認知功能] 定向感(時/地/人): ${timeStatus}/${placeStatus}/${personStatus}, 注意力: ${formatValue(mse.cognition.attention, mse.cognition.attentionOther)}, 記憶力: ${Array.isArray(mse.cognition.memory) ? mse.cognition.memory.join(', ') : '正常'}, 抽象思考: ${formatValue(mse.cognition.abstraction, mse.cognition.other)}`);
  }
  if (mse.insight) {
    sections.push(`[病識感] ${mse.insight}`);
  }
  if (mse.risk) {
    sections.push(`[風險評估] ${Array.isArray(mse.risk) ? mse.risk.join(', ') : '無'}${mse.riskOther ? ', 其他風險: '+mse.riskOther : ''}`);
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
  const apiKey = process.env.API_KEY;

  if (!apiKey || apiKey === 'undefined' || apiKey.length < 10) {
    return "⚠️ 系統錯誤：未偵測到 API 金鑰，請檢查 Netlify 設定。";
  }

  // 每次生成時建立新實體，確保即時讀取付費狀態
  const ai = new GoogleGenAI({ apiKey });
  
  let formatInstruction = "";
  const admissionDateStr = patient.admissionDate 
    ? `民國 ${patient.admissionDate.year} 年 ${patient.admissionDate.month} 月 ${patient.admissionDate.day} 日`
    : "";

  switch (type) {
    case RecordType.PROGRESS_NOTE:
      formatInstruction = `
【格式要求】
1. 第一行：病程紀錄 (Progress Note)
2. 使用 SOAP 標籤區分內容
3. 禁止使用粗體 ** 字元
4. 繁體中文撰寫，醫學專業術語可用英文`;
      break;
    case RecordType.OFF_DUTY_SUMMARY:
      formatInstruction = `
【格式要求】
1. 第一行：Off Duty note
2. 條列或敘述病患現況
3. 提及 ${admissionDateStr ? admissionDateStr : '近日'} 入院
4. 禁止使用粗體 ** 字元`;
      break;
    default:
      formatInstruction = `第一行為「${type}」，禁止使用粗體 ** 字元。`;
  }

  const systemInstruction = "你是一個在台灣精神科病房服務的醫學專家。請撰寫正式、簡潔的病歷內容。禁止使用粗體語法 (**)。";

  const promptText = `
【病患基本資料】
姓名：${patient.name.charAt(0)}Ｏ${patient.name.length > 2 ? patient.name.charAt(patient.name.length-1) : ''}
診斷：${getFullDiagnosisList(patient.diagnosis?.psychiatric, patient.diagnosis?.psychiatricOther)}
臨床重點：${patient.clinicalFocus || '穩定'}
MSE 評估：\n${formatMSEData(patient.mse)}
PE 評估：\n${formatPEData(patient.pe)}
${extraInfo ? `補充原因/安置計畫：${extraInfo}` : ''}

【任務】
生成一份專業的 ${type}：
${formatInstruction}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    return response.text || "⚠️ API 回傳空內容，請重試。";
  } catch (error: any) {
    console.error("Gemini API Error Detail:", error);
    
    // 專門捕捉付費帳戶生效前的暫時性限制
    if (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      return "⚠️ 偵測到頻率限制。雖然您已開啟付費計畫，但 Google 系統同步需要 5-10 分鐘。請稍候幾分鐘再試一次，生效後即可無限制使用。";
    }

    return `⚠️ 生成紀錄失敗：${error.message || '連線錯誤'}`;
  }
};
