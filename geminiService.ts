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
    return "⚠️ 系統設定錯誤：API 金鑰缺失。請檢查 Netlify 環境變數設定。";
  }

  // 每次呼叫都新建實例，確保讀取最新金鑰狀態
  const ai = new GoogleGenAI({ apiKey });
  
  let formatInstruction = "";
  const admissionDateStr = patient.admissionDate 
    ? `民國 ${patient.admissionDate.year} 年 ${patient.admissionDate.month} 月 ${patient.admissionDate.day} 日`
    : "";

  switch (type) {
    case RecordType.PROGRESS_NOTE:
      formatInstruction = `
【格式】
1. 第一行：病程紀錄 (Progress Note)
2. 採用 SOAP 格式 (S, O, A, P 分開標註)
3. 繁體中文為主，醫學術語可用英文
4. 嚴禁使用粗體 ** 語法`;
      break;
    case RecordType.OFF_DUTY_SUMMARY:
      formatInstruction = `
【格式】
1. 第一行：Off Duty note
2. 敘述體，禁止使用 SOAP
${admissionDateStr ? `3. 提及病患於 ${admissionDateStr} 入院` : ''}
4. 嚴禁使用粗體 ** 語法`;
      break;
    case RecordType.DISCHARGE_NOTE:
      formatInstruction = `
【格式】
1. 第一行：Discharge Note
2. 總結完整病程與後續計畫
3. 嚴禁使用粗體 ** 語法`;
      break;
    default:
      formatInstruction = `標題為「${type}」，嚴禁使用粗體語法。`;
  }

  const systemInstruction = "你是一位專業的精神科醫療助理。請以簡潔的醫療筆記格式撰寫內容，禁止使用雙星號 (**) 粗體語法。";

  const promptText = `
【病患資料】
姓名：${patient.name.charAt(0)}Ｏ${patient.name.length > 1 ? patient.name.charAt(patient.name.length-1) : ''}
診斷：${getFullDiagnosisList(patient.diagnosis?.psychiatric, patient.diagnosis?.psychiatricOther)}
MSE 內容：\n${formatMSEData(patient.mse)}
PE/NE 內容：\n${formatPEData(patient.pe)}
臨床重點：${patient.clinicalFocus || '穩定'}
${extraInfo ? `補充原因/計畫：${extraInfo}` : ''}

【任務】
生成一份專業的 ${type}：
${formatInstruction}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    return response.text || "⚠️ 模型回傳空內容";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    if (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      return "⚠️ 偵測到 API 配額已用盡。建議醫師：\n1. 稍等 1 分鐘後再試。\n2. 至 Google AI Studio 綁定信用卡提升配額（仍在免費額度內，$0元）。";
    }
    return `⚠️ 生成失敗：${error.message}`;
  }
};
