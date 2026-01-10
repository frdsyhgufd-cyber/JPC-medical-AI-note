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
    return "⚠️ 系統設定錯誤：API 金鑰缺失。請檢查 Netlify 環境變數是否正確設定。";
  }

  const ai = new GoogleGenAI({ apiKey });
  
  let formatInstruction = "";
  const admissionDateStr = patient.admissionDate 
    ? `民國 ${patient.admissionDate.year} 年 ${patient.admissionDate.month} 月 ${patient.admissionDate.day} 日`
    : "";

  switch (type) {
    case RecordType.PROGRESS_NOTE:
      formatInstruction = `
【特定格式要求】
1. 第一行必須是「病程紀錄 (Progress Note)」。
2. 採用 SOAP 格式。
3. S: 個案主訴。
4. O: 極簡 MSE/PE 異常發現。
5. A: 僅列出診斷名稱。
6. P: 以「純條列式」列出處置。`;
      break;
    case RecordType.OFF_DUTY_SUMMARY:
      formatInstruction = `
【特定格式要求】
1. 第一行必須是「Off Duty note」。
2. 禁止使用 SOAP。
3. 主要使用繁體中文。
${admissionDateStr ? `4. 提及病患於 ${admissionDateStr} 入院。` : ''}`;
      break;
    case RecordType.DISCHARGE_NOTE:
      formatInstruction = `
【特定格式要求】
1. 第一行必須是「Discharge Note」。
2. 禁止使用 SOAP。
3. 總結自 ${admissionDateStr || '入院'} 以來的完整病程。
4. 結尾包含後續安置計畫。`;
      break;
    default:
      formatInstruction = `第一行標示「${type}」，禁止使用 SOAP 標籤。`;
  }

  const systemInstruction = "你是一個在台灣嘉南療養院服務的專業精神科醫療助理。請以專業、簡潔的醫護口吻撰寫內容。絕對禁止使用雙星號 (**) 粗體語法。請使用繁體中文，但醫學專有名詞可使用英文。";

  const psychiatricDiag = getFullDiagnosisList(patient.diagnosis?.psychiatric, patient.diagnosis?.psychiatricOther);
  const medicalDiag = getFullDiagnosisList(patient.diagnosis?.medical, patient.diagnosis?.medicalOther);

  const promptText = `
【病患基本資料】
- 姓名：${patient.name.charAt(0)}Ｏ${patient.name.length > 2 ? patient.name.charAt(patient.name.length-1) : ''}
- 診斷：${psychiatricDiag} / ${medicalDiag}
- 臨床重點：${patient.clinicalFocus || '穩定觀察中'}
- MSE 評估結果：\n${formatMSEData(patient.mse)}
- PE & NE 檢查結果：\n${formatPEData(patient.pe)}
${extraInfo ? `- 補充資訊 (原因/計畫)：${extraInfo}` : ''}

【生成任務】
請根據上述臨床素材，依照以下規範生成一份 ${type}：
${formatInstruction}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest', // 改用 Lite 模型，通常配額更高且更穩定
      contents: [{ parts: [{ text: promptText }] }],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    if (!response || !response.text) {
      throw new Error("模型回傳內容為空");
    }

    return response.text;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    // 專門針對 429 資源耗盡錯誤的提示
    if (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      return "⚠️ 您的 API 使用配額已達上限。請等待 1~5 分鐘後再試，或考慮到 Google AI Studio 綁定信用卡以提升配額（仍在額度內免費）。";
    }

    return `⚠️ 生成紀錄時發生錯誤。詳細錯誤：${error.message || '請確認 API Key 有效'}`;
  }
};
