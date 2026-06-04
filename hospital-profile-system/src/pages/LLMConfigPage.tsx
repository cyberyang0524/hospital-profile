import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Save,
  CheckCircle,
  AlertCircle,
  Key,
} from 'lucide-react';
import { apiService } from '@/services/api';
import type { LLMConfig } from '@/types';

const LLMConfigPage = () => {
  const [config, setConfig] = useState<LLMConfig>({
    apiKey: '',
    baseUrl: '',
    model: '',
    temperature: 0.1,
    maxTokens: 2000,
  });
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const normalizeConfig = (value: unknown): LLMConfig | null => {
    if (!value || typeof value !== 'object') return null;
    const anyValue = value as Record<string, unknown>;
    const baseUrlRaw = anyValue.baseUrl;
    const modelRaw = anyValue.model;
    const apiKeyRaw = anyValue.apiKey;
    const temperatureRaw = anyValue.temperature;
    const maxTokensRaw = anyValue.maxTokens;

    const baseUrl = typeof baseUrlRaw === 'string' ? baseUrlRaw : '';
    const model = typeof modelRaw === 'string' ? modelRaw : '';
    const apiKey = typeof apiKeyRaw === 'string' ? apiKeyRaw : '';
    const temperature =
      typeof temperatureRaw === 'number' && Number.isFinite(temperatureRaw)
        ? temperatureRaw
        : 0.1;
    const maxTokens =
      typeof maxTokensRaw === 'number' && Number.isFinite(maxTokensRaw)
        ? maxTokensRaw
        : 2000;

    return {
      apiKey,
      baseUrl,
      model,
      temperature,
      maxTokens,
    };
  };

  const loadConfig = async () => {
    try {
      const savedConfig = await apiService.getLLMConfig();
      if (savedConfig) {
        const normalized = normalizeConfig(savedConfig);
        if (normalized) {
          setConfig(normalized);
        }
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!config.baseUrl.trim()) {
        toast.error('请输入 API 地址');
        return;
      }
      if (!config.model.trim()) {
        toast.error('请输入模型名称');
        return;
      }
      await apiService.saveLLMConfig(config);
      toast.success('配置保存成功');
    } catch (error) {
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfig({
      apiKey: '',
      baseUrl: '',
      model: '',
      temperature: 0.1,
      maxTokens: 2000,
    });
    setTestResult(null);
    toast.info('配置已重置');
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    const baseUrl = config.baseUrl.trim().replace(/\/+$/, '');
    if (!baseUrl) {
      setTestResult({ success: false, message: '请输入 API 地址' });
      toast.error('请输入 API 地址');
      setIsTesting(false);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        signal: controller.signal,
        headers: config.apiKey
          ? { Authorization: `Bearer ${config.apiKey}` }
          : undefined,
      }).finally(() => clearTimeout(timeoutId));

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      setTestResult({
        success: true,
        message: 'API 连接测试成功！服务可访问。',
      });
      toast.success('API 连接测试成功');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '连接失败（可能是地址错误、鉴权失败或跨域限制）';
      setTestResult({
        success: false,
        message: `连接失败：${message}`,
      });
      toast.error('API 连接测试失败');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* 页面标题 */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">LLM 配置</h2>
        <p className="mt-2 text-gray-600">
          配置自定义大模型服务以驱动客户画像分析功能（兼容 OpenAI API 格式）。
        </p>
      </div>

      {/* 配置表单 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">配置参数</h3>
        
        <div className="space-y-6">
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Key className="w-4 h-4 inline mr-1" />
              API Key
            </label>
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) =>
                setConfig({ ...config, apiKey: e.target.value })
              }
              placeholder="输入您的 API Key"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            <p className="mt-1 text-xs text-gray-500">
              没有鉴权可留空；如需鉴权则填入 Bearer Token
            </p>
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API 地址
            </label>
            <input
              type="text"
              value={config.baseUrl}
              onChange={(e) =>
                setConfig({ ...config, baseUrl: e.target.value })
              }
              placeholder="https://api.example.com/v1"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            <p className="mt-1 text-xs text-gray-500">
              需包含 /v1（例如 https://xxx/v1）；测试连接会请求 /models
            </p>
          </div>

          {/* 模型 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              模型
            </label>
            <input
              value={config.model}
              onChange={(e) =>
                setConfig({ ...config, model: e.target.value })
              }
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="例如：qwen2.5-72b-instruct / gpt-4o-mini / deepseek-chat"
            />
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Temperature（创造性）: {config.temperature}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.temperature}
              onChange={(e) =>
                setConfig({ ...config, temperature: parseFloat(e.target.value) })
              }
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>精确（0）</span>
              <span>平衡（0.5）</span>
              <span>创造（1）</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              最大 Token 数
            </label>
            <input
              type="number"
              value={config.maxTokens}
              onChange={(e) =>
                setConfig({ ...config, maxTokens: parseInt(e.target.value) || 2000 })
              }
              min="100"
              max="100000"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            <p className="mt-1 text-xs text-gray-500">
              控制单次响应的最大长度，建议 2000-4000
            </p>
          </div>
        </div>
      </div>

      {/* 测试结果 */}
      {testResult && (
        <div
          className={`mt-6 p-4 rounded-lg border flex items-start gap-3 ${
            testResult.success
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          {testResult.success ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p
              className={`font-medium ${
                testResult.success ? 'text-green-800' : 'text-red-800'
              }`}
            >
              {testResult.success ? '测试通过' : '测试失败'}
            </p>
            <p
              className={`text-sm ${
                testResult.success ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {testResult.message}
            </p>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="mt-6 flex gap-4">
        <button
          onClick={handleTest}
          disabled={isTesting}
          className="flex-1 py-3 px-6 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {isTesting ? '测试中...' : '测试连接'}
        </button>
        <button
          onClick={handleReset}
          className="py-3 px-6 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          清空
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 py-3 px-6 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          {isSaving ? '保存中...' : '保存配置'}
        </button>
      </div>
    </div>
  );
};

export default LLMConfigPage;
