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
  if (mse.appearance) sections.push(`[外觀] ${formatValue(mse.appearance.cleanliness, mse.appearance.cleanlinessOther)}, 合作: ${formatValue(mse.appearance.cooperation, mse.appearance.cooperationOther)}`);
  if (mse.speech) sections.push(`[言語] ${formatValue(mse.speech.speed, mse.speech.speedOther)}, ${formatValue(mse.speech.volume, mse.speech.volumeOther)}`);
  if (mse.mood) sections.push(`[情緒] 主觀: ${formatValue(mse.mood.subjective, mse.mood.other)}, 客觀: ${formatValue(mse.mood.objective, mse.mood.objectiveOther)}`);
  if (mse.thought) sections.push(`[思維] 過程: ${formatValue(mse.thought.process, mse.thought.processOther)}, 內容: ${formatValue(mse.thought.content, mse.thought.other)}`);
  if (mse.perception) sections.push(`[知覺] ${formatValue(mse.perception.hallucinations, mse.perception.other)}`);
  if (mse.cognition) sections.push(`[認知] 定向感: ${mse.cognition.orientation?.time ? '時間異常 ' : ''}${mse.cognition.orientation?.place ? '地點異常 ' : ''}${mse.cognition.orientation?.person ? '人物異常' : '正常'}`);
  if (mse.insight) sections.push(`[病識感] ${mse.insight}`);
  if (mse.risk) sections.push(`[風險] ${Array.isArray(mse.risk) ? mse.risk.join(', ') : '無'}`);
  return sections.join('\n');
};

const formatPEData = (pe: any) => {
  if (!pe) return "尚未進行 PE 評估。";
  const formatValue = (val: any, other: string | undefined) => {
    if (!val || (Array.isArray(val) && val.length === 0)) return '無異常';
    return Array.isArray(val) ? val.map(v => v === 'others' ? (other || '其他') : v).join(', ') : (val === 'others' ? (other || '其他') : val);
  };
  return `[意識] ${formatValue(pe.conscious, pe.consciousOther)}\n[HEENT] ${formatValue(pe.heent, pe.heentOther)}\n[神經] ${formatValue(pe.ne, pe.neOther)}`;
};

export const generateMedicalNote = async (
  patient: Patient,
  type: RecordType,
  referenceNotes: MedicalRecord[] = [],
  extraInfo: string = ''
) => {
  const apiKey = process.env.API_KEY;

  if (!apiKey || apiKey === 'undefined' || apiKey.length < 10) {
    return "⚠️ 偵測不到 API 金鑰。請確認您已在 Netlify 設定 API_KEY 環境變數，並「重新點擊 Deploy」讓設定生效。";
  }

  // 初始化 Gemini 3 Flash
  const ai = new GoogleGenAI({ apiKey });
  
  const promptText = `你是一位專業的精神科醫護助理。
請根據以下病患資料撰寫一份 ${type}。
病患：${patient.name.charAt(0)}Ｏ${patient.name.length > 2 ? patient.name.charAt(patient.name.length-1) : ''}
診斷：${getFullDiagnosisList(patient.diagnosis?.psychiatric, patient.diagnosis?.psychiatricOther)}
MSE：${formatMSEData(patient.mse)}
PE：${formatPEData(patient.pe)}
臨床重點：${patient.clinicalFocus || '穩定'}
${extraInfo ? `補充計畫：${extraInfo}` : ''}

【格式要求】
1. 禁止使用粗體語法 (**)。
2. 以醫學專業術語為主，繁體中文與英文交雜。
3. ${type === RecordType.PROGRESS_NOTE ? '請使用 SOAP 格式。' : '請直接撰寫病歷摘要。'}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: promptText,
      config: {
        systemInstruction: "你是一位在台灣工作的精神科專業醫療人員，撰寫內容必須嚴謹且符合醫療規範。嚴禁使用 markdown 粗體字元。",
        temperature: 0.7,
      }
    });

    return response.text || "⚠️ 模型沒有回傳文字，請稍後重試。";
  } catch (error: any) {
    console.error("API 呼叫詳細錯誤:", error);
    
    if (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      return "⚠️ 仍然出現頻率限制 (429)。\n\n【解決對策】\n1. 請確認您在 Netlify 設定變數後，有重新執行「Clear cache and deploy site」。\n2. 若您剛改為付費，請換一個新的 API Key 試試，有時舊 Key 的權限同步會卡住。";
    }

    return `⚠️ 生成紀錄失敗: ${error.message}`;
  }
};
