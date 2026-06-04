import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  Users,
  Tag,
  Sparkles,
  ArrowRight,
  Activity,
  Brain,
  Clock,
  Edit3,
  Plus,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import { useTagCategories } from '@/hooks/useTagCategories';

const DashboardPage = () => {
  const [isApiAvailable, setIsApiAvailable] = useState<boolean | null>(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTags: 0,
    totalMemories: 0,
    analyzedToday: 0,
  });
  const [showTagEditor, setShowTagEditor] = useState(false);
  const { categories, loading: catLoading, updateCategories } = useTagCategories();
  const [editCategories, setEditCategories] = useState<Record<string, { name: string; icon: string; tags: string[] }>>({});
  const [recentActivities, setRecentActivities] = useState<
    Array<{
      id: string;
      type: string;
      user: string;
      action: string;
      time: string;
      tags: number;
    }>
  >([]);

  useEffect(() => {
    checkApiStatus();
    loadStats();

    const onProfileUpdated = () => loadStats();
    window.addEventListener('profile-updated', onProfileUpdated);
    return () => window.removeEventListener('profile-updated', onProfileUpdated);
  }, []);

  const checkApiStatus = async () => {
    const available = await apiService.healthCheck();
    setIsApiAvailable(available.status === 'healthy');
  };

  const loadStats = async () => {
    try {
      const data = await apiService.getStats();
      setStats({
        totalUsers: data.totalUsers,
        totalTags: data.totalTags,
        totalMemories: data.totalMemories,
        analyzedToday: data.analyzedToday,
      });
    } catch {
      // 后端未启动时不更新，保持 0
    }
  };

  const features = [
    {
      title: '智能对话分析',
      description: '自动分析医患对话，提取患者特征标签',
      icon: MessageSquare,
      color: 'bg-blue-500',
      link: '/analyze',
    },
    {
      title: '画像管理',
      description: '查看和管理用户画像，支持手动调整',
      icon: Users,
      color: 'bg-purple-500',
      link: '/profile',
    },
    {
      title: '标签体系',
      description: '管理四大维度标签：性格、消费、健康、偏好',
      icon: Tag,
      color: 'bg-green-500',
      action: () => setShowTagEditor(true),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* 欢迎区域 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          医院客户画像分析系统
        </h1>
        <p className="text-gray-600">
          基于 Mem0 智能记忆层设计，自动分析医患对话，构建精准用户画像
        </p>
      </div>

      {/* 状态指示 */}
      <div
        className={`mb-8 p-4 rounded-lg flex items-center gap-3 ${
          isApiAvailable
            ? 'bg-green-50 text-green-800'
            : isApiAvailable === false
            ? 'bg-red-50 text-red-800'
            : 'bg-gray-50 text-gray-800'
        }`}
      >
        <div
          className={`w-3 h-3 rounded-full ${
            isApiAvailable
              ? 'bg-green-500 animate-pulse'
              : isApiAvailable === false
              ? 'bg-red-500'
              : 'bg-gray-400'
          }`}
        />
        <span className="font-medium">
          {isApiAvailable === null
            ? '正在检查服务状态...'
            : isApiAvailable
            ? '后端服务连接正常'
            : '后端服务未连接，请检查服务是否启动'}
        </span>
        {!isApiAvailable && (
          <Link
            to="/settings"
            className="ml-auto text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            去配置
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          {
            title: '用户总数',
            value: stats.totalUsers.toLocaleString(),
            icon: Users,
            color: 'text-blue-600 bg-blue-100',
          },
          {
            title: '今日分析',
            value: stats.analyzedToday,
            icon: MessageSquare,
            color: 'text-green-600 bg-green-100',
          },
          {
            title: '标签总数',
            value: stats.totalTags.toLocaleString(),
            icon: Tag,
            color: 'text-purple-600 bg-purple-100',
          },
          {
            title: '记忆总数',
            value: stats.totalMemories.toLocaleString(),
            icon: Brain,
            color: 'text-orange-600 bg-orange-100',
          },
        ].map((stat, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {stat.value}
            </p>
            <p className="text-gray-500 text-sm">{stat.title}</p>
          </div>
        ))}
      </div>

      {/* 功能入口 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          快速入口
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Card = feature.action
              ? (props: { children: React.ReactNode }) => (
                  <button
                    type="button"
                    onClick={feature.action}
                    className="text-left bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-blue-300 transition-all group w-full"
                  >
                    {props.children}
                  </button>
                )
              : (props: { children: React.ReactNode }) => (
                  <Link
                    to={feature.link || '#'}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-blue-300 transition-all group"
                  >
                    {props.children}
                  </Link>
                );
            return (
              <Card key={index}>
                <div
                  className={`${feature.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  {feature.title}
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 标签分类概览 */}
        <div id="tag-categories" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 scroll-mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Brain className="w-5 h-5 text-blue-600" />
              标签分类体系
            </h3>
            <button
              onClick={() => setShowTagEditor(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              管理
            </button>
          </div>
          <div className="space-y-3">
            {Object.entries(categories).map(([key, info]) => (
              <div
                key={key}
                className="p-4 bg-gray-50 rounded-lg flex items-center gap-4"
              >
                <span className="text-3xl">{info?.icon ?? '📂'}</span>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{info?.name ?? key}</h4>
                  <p className="text-sm text-gray-500">
                    {info?.tags?.length ?? 0} 个标签
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {(info?.tags ?? []).slice(0, 4).map((tag: string) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600"
                    >
                      {tag}
                    </span>
                  ))}
                  {(info?.tags?.length ?? 0) > 4 && (
                    <span className="px-2 py-0.5 text-xs text-gray-400">
                      +{(info?.tags?.length ?? 0) - 4}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 最近活动 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-600" />
            最近活动
          </h3>
          <div className="space-y-4">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      activity.type === 'analysis'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-purple-100 text-purple-600'
                    }`}
                  >
                    {activity.type === 'analysis' ? (
                      <Sparkles className="w-5 h-5" />
                    ) : (
                      <Tag className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {activity.action}
                    </p>
                    <p className="text-sm text-gray-500">
                      用户: {activity.user} · +{activity.tags} 标签
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-400">
                    <Clock className="w-4 h-4" />
                    {activity.time}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-sm text-center py-8">
                暂无活动记录，开始一次对话分析后将在此显示
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 标签分类管理弹窗 */}
      {showTagEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">标签分类管理</h3>
              <button
                onClick={() => setShowTagEditor(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {Object.entries(categories).map(([key, info]) => (
                <div key={key} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      value={editCategories[key]?.icon ?? info.icon}
                      onChange={(e) =>
                        setEditCategories((prev) => ({
                          ...prev,
                          [key]: { ...prev[key] || info, icon: e.target.value },
                        }))
                      }
                      className="w-12 text-center text-xl border border-gray-300 rounded-lg px-2 py-1"
                      placeholder="图标"
                    />
                    <input
                      value={editCategories[key]?.name ?? info.name}
                      onChange={(e) =>
                        setEditCategories((prev) => ({
                          ...prev,
                          [key]: { ...prev[key] || info, name: e.target.value },
                        }))
                      }
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="分类名称"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(editCategories[key]?.tags ?? info.tags ?? []).map((tag, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-sm"
                      >
                        {tag}
                        <button
                          onClick={() => {
                            const updated = [...((editCategories[key]?.tags ?? info?.tags ?? []) as string[])];
                            updated.splice(i, 1);
                            setEditCategories((prev) => ({
                              ...prev,
                              [key]: { ...(prev[key] || info), tags: updated },
                            }));
                          }}
                          className="hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id={`new-tag-${key}`}
                      placeholder="输入新标签后按回车添加"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) {
                            setEditCategories((prev) => ({
                              ...prev,
                              [key]: {
                                ...(prev[key] || info),
                                tags: [...((prev[key]?.tags ?? info?.tags ?? []) as string[]), val],
                              },
                            }));
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setEditCategories({});
                  setShowTagEditor(false);
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  const merged = { ...categories, ...editCategories };
                  try {
                    await updateCategories(merged as Record<string, {
                      name: string;
                      icon: string;
                      tags: string[];
                    }>);
                    setEditCategories({});
                    setShowTagEditor(false);
                    toast.success('保存成功');
                  } catch {
                    toast.error('保存失败');
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 技术特性 */}
      <div className="mt-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
              <Brain className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-semibold mb-2">LLM 驱动</h4>
            <p className="text-white/80 text-sm">
              基于大语言模型自动分析和理解对话内容，提取精准的用户特征
            </p>
          </div>
          <div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
              <Activity className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-semibold mb-2">持续学习</h4>
            <p className="text-white/80 text-sm">
              支持画像的增量更新，随着对话积累不断优化用户特征标签
            </p>
          </div>
          <div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-semibold mb-2">多层次存储</h4>
            <p className="text-white/80 text-sm">
              整合向量数据库、Redis缓存、PostgreSQL结构化存储，参考Mem0架构
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
