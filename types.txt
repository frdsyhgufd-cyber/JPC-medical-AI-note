
export enum UserRole {
  ADMIN = 'ADMIN',
  NP = 'NP',           // 專科護理師
  RESIDENT = 'RESIDENT', // 住院醫師
  PA = 'PA'            // 醫師助理
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  password: string;
}

export interface Patient {
  id: string;
  npId: string; // 負責醫護人員 ID
  name: string;
  ward?: string;
  bed?: string;
  gender: 'male' | 'female' | 'other';
  birthYearROC?: number; // 民國年
  admissionDate?: {
    year: number;
    month: number;
    day: number;
  };
  background?: string;
  diagnosis?: DiagnosisData;
  clinicalFocus?: string;
  mse?: MSEData;
  pe?: PEData; 
}

export interface DiagnosisData {
  psychiatric: string[];
  psychiatricOther?: string;
  medical: string[];
  medicalOther?: string;
}

export interface MSEData {
  appearance: { 
    cleanliness: string; cleanlinessOther?: string;
    cooperation: string[]; cooperationOther?: string;
    psychomotor: string[]; other: string 
  };
  speech: { 
    speed: string; speedOther?: string;
    volume: string; volumeOther?: string;
    coherence: string[]; other: string 
  };
  mood: { 
    subjective: string[]; other: string; 
    objective: string[]; objectiveOther?: string; 
  };
  thought: { 
    process: string[]; processOther?: string;
    content: string[]; other: string 
  };
  perception: { 
    hallucinations: string[]; other: string 
  };
  cognition: { 
    orientation: { time: boolean; place: boolean; person: boolean }; 
    attention: string; attentionOther?: string;
    memory: string[]; 
    abstraction: string[]; other: string 
  };
  insight: string;
  risk: string[];
  riskOther?: string;
}

export interface PEData {
  conscious: string[]; consciousOther?: string;
  heent: string[]; heentOther?: string;
  chest: string[]; chestOther?: string;
  heart: string[]; heartOther?: string;
  abdominal: string[]; abdominalOther?: string;
  extremities: string[]; extremitiesOther?: string;
  skin: string[]; skinOther?: string;
  ne: string[]; neOther?: string;
}

export enum RecordType {
  PROGRESS_NOTE = '病程紀錄 (Progress Note)',
  PHYSIO_PSYCHO_EXAM = '生理心理功能檢查紀錄',
  PSYCHOTHERAPY = '特殊心理治療紀錄',
  SUPPORTIVE_PSYCHOTHERAPY = '支持性心理治療紀錄',
  SPECIAL_HANDLING = '精神科住院病人特別處理紀錄',
  WEEKLY_SUMMARY = 'Weekly Summary',
  MONTHLY_SUMMARY = 'Monthly Summary',
  OFF_DUTY_SUMMARY = 'Off Duty note',
  DISCHARGE_NOTE = 'Discharge Note'
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  type: RecordType;
  content: string;
  createdAt: string; 
}

