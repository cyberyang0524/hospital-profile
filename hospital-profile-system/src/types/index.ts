// LLM 配置
export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

// 对话消息
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 对话输入
export interface ConversationInput {
  userId: string;
  conversationId?: string;
  messages: Message[];
  metadata?: Record<string, unknown>;
}

// 标签信息
export interface TagInfo {
  id?: string;
  tagCategory: string;
  tagName: string;
  tagValue: string;
  confidence: number;
  evidence: string;
  reasoning?: string;
  updatedAt?: string;
}

// 分析结果
export interface AnalysisResult {
  userId: string;
  extractedTags: TagInfo[];
  summary: string;
  keyInsights: string[];
}

// 患者画像
export interface PatientProfile {
  userId: string;
  userName?: string;
  phone?: string;
  profileVersion: number;
  lastInteraction?: string;
  updatedAt?: string;
  tags: TagInfo[];
  tagsByCategory: Record<string, TagInfo[]>;
  memories?: MemoryInfo[];
}

// 记忆信息
export interface MemoryInfo {
  memoryId: string;
  content: string;
  category?: string;
  importance: number;
  createdAt: string;
  lastAccessed?: string;
}

// 相似患者
export interface SimilarPatient {
  patientId: string;
  similarityScore: number;
  commonTags: string[];
}

// API 响应
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 标签分类配置
export const TAG_CATEGORIES = {
  personality: {
    name: '性格特征',
    icon: '👤',
    tags: ['脾气大', '脾气温和', '容易急躁', '有耐心', '易怒', '配合度高', '不配合', '挑剔', '随和', '固执', '健谈', '内向', '表达清晰', '表达含糊', '积极', '消极', '焦虑', '乐观'],
  },
  consumption: {
    name: '消费能力',
    icon: '💰',
    tags: ['高消费', '中消费', '低消费', '价格敏感', '主动咨询高端服务', '无所谓', '自费', '医保', '商业保险', '专家号需求', '普通门诊'],
  },
  health: {
    name: '健康状况',
    icon: '🏥',
    tags: ['腿脚不便', '轮椅需求', '行动正常', '行动受限', '需要陪同', '独自就诊', '子女代为咨询', '了解病情', '不了解病情', '常客', '新患者'],
  },
  preference: {
    name: '服务偏好',
    icon: '⭐',
    tags: ['VIP需求', '需要特别关注', '普通服务即可', '快速响应', '正常响应', '不着急', '高投诉风险', '低投诉风险', '高复诊意愿', '低复诊意愿'],
  },
} as const;
