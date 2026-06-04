import type {
  LLMConfig,
  ConversationInput,
  AnalysisResult,
  PatientProfile,
  ApiResponse,
  TagInfo,
} from '@/types';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const DEFAULT_TIMEOUT_MS = 20000;

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }

    const controller = options.signal ? undefined : new AbortController();
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
      : undefined;

    try {
      const response = await fetch(url, {
        ...options,
        signal: options.signal ?? controller?.signal,
        headers,
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let detail: string | undefined;

        if (contentType.includes('application/json')) {
          const data = await response.json().catch(() => undefined);
          if (data && typeof data === 'object') {
            const anyData = data as Record<string, unknown>;
            const candidate =
              anyData.detail ??
              anyData.message ??
              anyData.error ??
              anyData.msg;
            if (typeof candidate === 'string') {
              detail = candidate;
            }
          }
        } else {
          const text = await response.text().catch(() => '');
          if (text) {
            detail = text;
          }
        }

        throw new Error(detail || `HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return response.json();
      }

      return (await response.text()) as unknown as T;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  // LLM 配置
  async getLLMConfig(): Promise<LLMConfig | null> {
    const stored = localStorage.getItem('llm_config');
    if (!stored) return null;
    try {
      return JSON.parse(stored) as LLMConfig;
    } catch {
      return null;
    }
  }

  async saveLLMConfig(config: LLMConfig): Promise<void> {
    localStorage.setItem('llm_config', JSON.stringify(config));
  }

  // 对话分析
  async analyzeConversation(input: ConversationInput): Promise<AnalysisResult> {
    const stored = localStorage.getItem('llm_config');
    let llmConfig: LLMConfig | null = null;
    if (stored) {
      try {
        llmConfig = JSON.parse(stored) as LLMConfig;
      } catch {
        llmConfig = null;
      }
    }

    const metadata =
      llmConfig === null
        ? input.metadata
        : { ...(input.metadata || {}), llm_config: llmConfig };

    return this.request<AnalysisResult>('/analyze', {
      method: 'POST',
      body: JSON.stringify({ ...input, metadata }),
    });
  }

  // 获取用户画像
  async getProfile(
    userId: string,
    includeMemories: boolean = false
  ): Promise<PatientProfile> {
    return this.request<PatientProfile>(
      `/profiles/${encodeURIComponent(userId)}?include_memories=${includeMemories}`
    );
  }

  // 更新画像
  async updateProfile(
    userId: string,
    tags: TagInfo[],
    sourceConversationId?: string
  ): Promise<ApiResponse<PatientProfile>> {
    return this.request<ApiResponse<PatientProfile>>('/profiles/update', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        tags,
        source_conversation_id: sourceConversationId,
      }),
    });
  }

  // 获取用户标签
  async getProfileTags(
    userId: string,
    category?: string
  ): Promise<{ user_id: string; tags: TagInfo[] }> {
    const params = category ? `?category=${category}` : '';
    return this.request<{ user_id: string; tags: TagInfo[] }>(
      `/profiles/${encodeURIComponent(userId)}/tags${params}`
    );
  }

  // 获取相似患者
  async getSimilarPatients(
    userId: string,
    limit: number = 5
  ): Promise<{ user_id: string; similar_patients: unknown[] }> {
    return this.request<{ user_id: string; similar_patients: unknown[] }>(
      `/profiles/${encodeURIComponent(userId)}/similar?limit=${limit}`
    );
  }

  // 删除标签
  async deleteTag(userId: string, tagId: string): Promise<ApiResponse<void>> {
    return this.request<ApiResponse<void>>(
      `/profiles/${encodeURIComponent(userId)}/tags/${tagId}`,
      { method: 'DELETE' }
    );
  }

  // 健康检查
  async healthCheck(): Promise<{ status: 'healthy' | 'unavailable' }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal,
      });
      return { status: response.ok ? 'healthy' : 'unavailable' };
    } catch {
      return { status: 'unavailable' };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getStats(): Promise<{
    totalUsers: number;
    totalTags: number;
    totalMemories: number;
    analyzedToday: number;
  }> {
    return this.request<{
      totalUsers: number;
      totalTags: number;
      totalMemories: number;
      analyzedToday: number;
    }>('/stats');
  }

  async getTagCategories(): Promise<{
    categories: Record<
      string,
      {
        name: string;
        icon: string;
        tags: string[];
      }
    >;
  }> {
    return this.request<{
      categories: Record<
        string,
        {
          name: string;
          icon: string;
          tags: string[];
        }
      >;
    }>('/tags/categories');
  }

  async updateTagCategories(categories: Record<string, {
    name: string;
    icon: string;
    tags: string[];
  }>): Promise<void> {
    await this.request('/tags/categories', {
      method: 'PUT',
      body: JSON.stringify({ categories }),
    });
  }
}

export const apiService = new ApiService();
export default apiService;
