import { useState } from 'react';
import { toast } from 'sonner';
import {
  Search,
  User,
  Phone,
  Clock,
  RefreshCw,
  Trash2,
  Edit3,
  Plus,
  X,
  Tag,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { apiService } from '@/services/api';
import type { PatientProfile, TagInfo } from '@/types';
import { TAG_CATEGORIES } from '@/types';

const ProfilePage = () => {
  const [userId, setUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [showAddTag, setShowAddTag] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const handleSearch = async () => {
    if (!userId.trim()) {
      toast.error('请输入用户ID');
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiService.getProfile(userId, true);
      setProfile(data);
      toast.success('画像加载成功');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载失败');
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!profile) return;
    
    try {
      await apiService.deleteTag(profile.userId, tagId);
      toast.success('标签已删除');
      // 刷新画像
      handleSearch();
    } catch (error) {
      toast.error('删除失败');
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories({
      ...expandedCategories,
      [category]: !expandedCategories[category],
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getCategoryIcon = (category: string) => {
    return TAG_CATEGORIES[category as keyof typeof TAG_CATEGORIES]?.icon || '🏷️';
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* 页面标题 */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">用户画像</h2>
        <p className="mt-2 text-gray-600">
          查询和管理用户的画像标签信息
        </p>
      </div>

      {/* 搜索栏 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="输入用户ID进行查询"
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
            查询
          </button>
        </div>
      </div>

      {/* 画像展示 */}
      {profile ? (
        <div className="space-y-6">
          {/* 基本信息 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {profile.userName || profile.userId}
                  </h3>
                  <p className="text-gray-500">{profile.userId}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Tag className="w-4 h-4" />
                  <span>版本 {profile.profileVersion}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>最后交互: {formatDate(profile.lastInteraction)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">手机号码</p>
                <p className="font-medium text-gray-900">
                  {profile.phone || '未设置'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">更新时间</p>
                <p className="font-medium text-gray-900">
                  {formatDate(profile.updatedAt)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">标签总数</p>
                <p className="font-medium text-gray-900">{profile.tags.length}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">记忆数量</p>
                <p className="font-medium text-gray-900">
                  {profile.memories?.length || 0}
                </p>
              </div>
            </div>
          </div>

          {/* 标签列表 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                画像标签
              </h3>
              <button
                onClick={() => setShowAddTag(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                手动添加标签
              </button>
            </div>

            {profile.tags.length > 0 ? (
              <div className="space-y-4">
                {Object.entries(profile.tagsByCategory).map(
                  ([category, tags]) => {
                    const categoryInfo =
                      TAG_CATEGORIES[category as keyof typeof TAG_CATEGORIES];
                    const isExpanded = expandedCategories[category] !== false;

                    return (
                      <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleCategory(category)}
                          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{getCategoryIcon(category)}</span>
                            <div className="text-left">
                              <p className="font-medium text-gray-900">
                                {categoryInfo?.name || category}
                              </p>
                              <p className="text-sm text-gray-500">
                                {tags.length} 个标签
                              </p>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {tags.map((tag) => (
                                <div
                                  key={tag.id}
                                  className="p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors group"
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <span className="font-medium text-gray-900">
                                      {tag.tagValue}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <span
                                        className={`px-2 py-0.5 rounded text-xs font-medium ${getConfidenceColor(
                                          tag.confidence
                                        )}`}
                                      >
                                        {Math.round(tag.confidence * 100)}%
                                      </span>
                                      <button
                                        onClick={() =>
                                          tag.id && handleDeleteTag(tag.id)
                                        }
                                        className="p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                  {tag.evidence && (
                                    <p className="text-xs text-gray-500 line-clamp-2">
                                      {tag.evidence}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <Tag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">暂无标签</p>
                <p className="text-sm text-gray-400 mt-1">
                  通过对话分析或手动添加来创建标签
                </p>
              </div>
            )}
          </div>

          {/* 记忆列表 */}
          {profile.memories && profile.memories.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                最近记忆
              </h3>
              <div className="space-y-3">
                {profile.memories.slice(0, 10).map((memory) => (
                  <div
                    key={memory.memoryId}
                    className="p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {memory.category && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                          {memory.category}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        重要性: {memory.importance}/10
                      </span>
                    </div>
                    <p className="text-gray-700">{memory.content}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {formatDate(memory.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16">
          <div className="text-center">
            <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">输入用户ID查询画像</p>
            <p className="text-gray-400 text-sm mt-2">
              支持用户ID或用户名查询
            </p>
          </div>
        </div>
      )}

      {/* 添加标签弹窗 */}
      {showAddTag && (
        <AddTagModal
          onClose={() => setShowAddTag(false)}
          onSuccess={() => {
            setShowAddTag(false);
            handleSearch();
          }}
          userId={profile?.userId || ''}
        />
      )}
    </div>
  );
};

// 添加标签弹窗组件
const AddTagModal = ({
  onClose,
  onSuccess,
  userId,
}: {
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
}) => {
  const [category, setCategory] = useState('personality');
  const [tagValue, setTagValue] = useState('');
  const [confidence, setConfidence] = useState(0.8);
  const [evidence, setEvidence] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categoryInfo = TAG_CATEGORIES[category as keyof typeof TAG_CATEGORIES];
  const availableTags = categoryInfo?.tags || [];

  const handleSubmit = async () => {
    if (!tagValue) {
      toast.error('请选择标签值');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiService.updateProfile(userId, [
        {
          tagCategory: category,
          tagName: categoryInfo?.name || category,
          tagValue,
          confidence,
          evidence: evidence || `手动添加于 ${new Date().toLocaleString()}`,
        },
      ]);
      toast.success('标签添加成功');
      onSuccess();
    } catch (error) {
      toast.error('添加失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">添加标签</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 分类选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              标签分类
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setTagValue('');
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(TAG_CATEGORIES).map(([key, info]) => (
                <option key={key} value={key}>
                  {info.icon} {info.name}
                </option>
              ))}
            </select>
          </div>

          {/* 标签值选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              标签值
            </label>
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagValue(tag)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    tagValue === tag
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* 置信度 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              置信度: {Math.round(confidence * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={confidence}
              onChange={(e) => setConfidence(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* 证据说明 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              证据说明（可选）
            </label>
            <textarea
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="输入添加此标签的依据..."
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            添加
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
