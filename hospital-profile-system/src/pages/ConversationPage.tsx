import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Send,
  Plus,
  Trash2,
  User,
  Bot,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';
import { apiService } from '@/services/api';
import type { Message, AnalysisResult, TagInfo } from '@/types';
import { TAG_CATEGORIES } from '@/types';

const ConversationPage = () => {
  const [userId, setUserId] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'user', content: '' },
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [expandedTags, setExpandedTags] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const addMessage = (role: Message['role']) => {
    setMessages((prev) => [...prev, { role, content: '' }]);
  };

  const splitConversationSegments = (raw: string) => {
    const text = raw.trim();
    if (!text) return [];

    const looksLikeQuotedCsv = text.includes('","') || text.includes("','");
    if (looksLikeQuotedCsv) {
      const normalized = text
        .replace(/^\s*["']/, '')
        .replace(/["']\s*$/, '');
      return normalized
        .split(/["']\s*,\s*["']/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    return text
      .split(/\r?\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const parseConversationText = (raw: string): Message[] => {
    const segments = splitConversationSegments(raw);
    const parsed: Message[] = [];

    const roleFromLabel = (label: string): Message['role'] => {
      if (label === '系统') return 'system';
      if (label === '客服' || label === '医生' || label === '助理' || label === '助手')
        return 'assistant';
      return 'user';
    };

    for (const seg of segments) {
      const cleaned = seg.replace(/^[，,]\s*/, '').trim();
      if (!cleaned) continue;

      const match = cleaned.match(
        /^(客服|客户|患者|用户|医生|助理|助手|系统)\s*[:：]\s*(.*)$/
      );

      if (match) {
        const role = roleFromLabel(match[1]);
        const content = (match[2] || '').trim();
        if (!content) continue;
        const last = parsed[parsed.length - 1];
        if (last && last.role === role) {
          last.content = `${last.content}\n${content}`;
        } else {
          parsed.push({ role, content });
        }
      } else {
        const last = parsed[parsed.length - 1];
        if (last) {
          last.content = `${last.content}\n${cleaned}`;
        } else {
          parsed.push({ role: 'user', content: cleaned });
        }
      }
    }

    return parsed.length ? parsed : [{ role: 'user', content: '' }];
  };

  const handleParseBulkText = () => {
    const parsed = parseConversationText(bulkText);
    setMessages(parsed);
    toast.success(`已解析 ${parsed.filter((m) => m.content.trim()).length} 条消息`);
  };

  const updateMessage = (index: number, content: string) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === index ? { ...m, content } : m))
    );
  };

  const removeMessage = (index: number) => {
    setMessages((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : prev
    );
  };

  const handleAnalyze = async () => {
    if (!userId.trim()) {
      toast.error('请输入用户ID');
      return;
    }

    const validMessages = messages.filter((m) => m.content.trim());
    if (validMessages.length === 0) {
      toast.error('请至少输入一条对话消息');
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      const analysisResult = await apiService.analyzeConversation({
        userId,
        conversationId: conversationId || undefined,
        messages: validMessages,
      });
      setResult(analysisResult);
      toast.success('分析完成！');
      // 通知仪表盘刷新 stats（通过 localStorage 事件）
      window.dispatchEvent(new Event('profile-updated'));
    } catch (error) {
      if (error instanceof Error) {
        const msg = error.message || '分析失败';
        const anyError = error as Error & { name?: string };
        if (
          anyError.name === 'AbortError' ||
          msg.toLowerCase().includes('aborted') ||
          msg.toLowerCase().includes('abort')
        ) {
          toast.error('分析超时，请稍后重试（模型响应较慢时可等待更久或换更快模型）');
          return;
        }
        if (msg === 'Failed to fetch' || msg.toLowerCase().includes('network')) {
          toast.error(
            '无法连接后端服务，请确认后端已启动且 VITE_API_URL 配置正确'
          );
          return;
        }
        toast.error(msg);
        return;
      }
      toast.error('分析失败');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleTagExpand = (tagKey: string) => {
    setExpandedTags((prev) => ({ ...prev, [tagKey]: !prev[tagKey] }));
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('复制失败');
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getCategoryIcon = (category: string) => {
    return TAG_CATEGORIES[category as keyof typeof TAG_CATEGORIES]?.icon || '🏷️';
  };

  // 按分类组织标签
  const tagsByCategory = useMemo(() => {
    if (!result) return {};
    return result.extractedTags.reduce(
      (acc, tag) => {
        const category = tag.tagCategory;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(tag);
        return acc;
      },
      {} as Record<string, TagInfo[]>
    );
  }, [result]);

  return (
    <div className="max-w-6xl mx-auto">
      {/* 页面标题 */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">对话分析</h2>
        <p className="mt-2 text-gray-600">
          输入用户ID和对话内容，系统将自动分析并提取用户特征标签
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：对话输入 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            对话输入
          </h3>

          {/* 用户信息 */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                用户ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="如：patient_001"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                对话ID（可选）
              </label>
              <input
                type="text"
                value={conversationId}
                onChange={(e) => setConversationId(e.target.value)}
                placeholder="如：conv_12345"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* 消息列表 */}
          <div className="space-y-3 mb-4">
            {messages.map((message, index) => (
              <div key={index} className="flex gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    message.role === 'user'
                      ? 'bg-blue-100 text-blue-600'
                      : message.role === 'system'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {message.role === 'user' && <User className="w-5 h-5" />}
                  {message.role === 'assistant' && <Bot className="w-5 h-5" />}
                  {message.role === 'system' && <Sparkles className="w-5 h-5" />}
                </div>
                <div className="flex-1 relative">
                  <textarea
                    value={message.content}
                    onChange={(e) => updateMessage(index, e.target.value)}
                    placeholder={
                      message.role === 'user'
                        ? '输入用户说的话...'
                        : message.role === 'system'
                        ? '输入系统提示...'
                        : '输入客服的回复...'
                    }
                    rows={2}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                  {messages.length > 1 && (
                    <button
                      onClick={() => removeMessage(index)}
                      className="absolute right-2 top-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 添加消息按钮 */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => addMessage('user')}
              className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加用户消息
            </button>
            <button
              onClick={() => addMessage('assistant')}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加客服回复
            </button>
            <button
              onClick={() => addMessage('system')}
              className="flex items-center gap-2 px-4 py-2 text-sm text-yellow-700 border border-yellow-300 rounded-lg hover:bg-yellow-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加系统消息
            </button>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              整段对话（可一次性粘贴解析）
            </label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={6}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder={`客服：您好，弘爱医院。\n客户：喂，你好，想问一下。\n客户：打疫苗的那边有电话吗？\n客服：打疫苗的是那个二八二五。`}
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleParseBulkText}
                className="px-4 py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
              >
                解析为消息
              </button>
              <button
                onClick={() => setBulkText('')}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                清空
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              支持每行一条（客服：/客户：），也支持类似 “&quot;客服：...&quot;,&quot;客户：...&quot;”
              这种逗号分隔文本
            </p>
          </div>

          {/* 分析按钮 */}
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <svg
                  className="animate-spin w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                分析中...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                开始分析
              </>
            )}
          </button>
        </div>

        {/* 右侧：分析结果 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            分析结果
          </h3>

          {!result ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Sparkles className="w-16 h-16 mb-4" />
              <p>输入对话内容并点击分析按钮</p>
              <p className="text-sm">分析结果将显示在这里</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 摘要 */}
              {result.summary && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">对话摘要</h4>
                  <p className="text-blue-800 text-sm">{result.summary}</p>
                </div>
              )}

              {/* 关键洞察 */}
              {result.keyInsights && result.keyInsights.length > 0 && (
                <div className="bg-purple-50 rounded-lg p-4">
                  <h4 className="font-medium text-purple-900 mb-2">
                    关键洞察
                  </h4>
                  <ul className="space-y-1">
                    {result.keyInsights.map((insight, i) => (
                      <li
                        key={i}
                        className="text-purple-800 text-sm flex items-start gap-2"
                      >
                        <span className="text-purple-500">•</span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 提取的标签 */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">
                  提取的标签 ({result.extractedTags.length})
                </h4>

                {Object.entries(tagsByCategory).map(([category, tags]) => {
                  const categoryInfo =
                    TAG_CATEGORIES[category as keyof typeof TAG_CATEGORIES];
                  const isExpanded = expandedTags[category] !== false;

                  return (
                    <div key={category} className="mb-4">
                      <button
                        onClick={() => toggleTagExpand(category)}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">
                            {getCategoryIcon(category)}
                          </span>
                          <span className="font-medium text-gray-900">
                            {categoryInfo?.name || category}
                          </span>
                          <span className="text-sm text-gray-500">
                            ({tags.length})
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 space-y-2 pl-2">
                          {tags.map((tag, i) => (
                            <div
                              key={`${category}-${i}`}
                              className="p-3 bg-white border border-gray-200 rounded-lg"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-gray-900">
                                      {tag.tagValue}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded text-xs font-medium ${getConfidenceColor(
                                        tag.confidence
                                      )}`}
                                    >
                                      {Math.round(tag.confidence * 100)}%
                                    </span>
                                  </div>
                                  {tag.evidence && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      证据：{tag.evidence}
                                    </p>
                                  )}
                                </div>
                                <button
                                  onClick={() =>
                                    copyToClipboard(
                                      `${tag.tagValue} (${Math.round(
                                        tag.confidence * 100
                                      )}%)`,
                                      `${category}-${i}`
                                    )
                                  }
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                >
                                  {copiedId === `${category}-${i}` ? (
                                    <Check className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {result.extractedTags.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    未提取到标签
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 示例对话 */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
        <h4 className="font-medium text-gray-900 mb-3">💡 示例对话</h4>
        <p className="text-sm text-gray-600 mb-4">
          您可以尝试输入以下示例对话来体验分析功能：
        </p>
        <div className="bg-white rounded-lg p-4 text-sm space-y-2">
          <p>
            <span className="text-blue-600 font-medium">用户：</span>
            我腿脚不太好，上下楼很困难，能不能帮我安排一个方便一点的诊室？
          </p>
          <p>
            <span className="text-green-600 font-medium">客服：</span>
            好的王先生，我帮您安排一楼诊室，并且安排轮椅接送服务。
          </p>
          <p>
            <span className="text-blue-600 font-medium">用户：</span>
            还有，我想问问那个VIP病房什么价格？我不差钱，只要服务好就行。
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConversationPage;
