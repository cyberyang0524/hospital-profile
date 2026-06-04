import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Settings, MessageSquare, User, LayoutDashboard } from 'lucide-react';

import { apiService } from '@/services/api';

import LLMConfigPage from '@/pages/LLMConfigPage';
import ConversationPage from '@/pages/ConversationPage';
import ProfilePage from '@/pages/ProfilePage';
import DashboardPage from '@/pages/DashboardPage';
import { TagCategoriesProvider } from '@/hooks/useTagCategories';

import './index.css';

function App() {
  const [isApiAvailable, setIsApiAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    checkApiHealth();
  }, []);

  const checkApiHealth = async () => {
    const { status } = await apiService.healthCheck();
    setIsApiAvailable(status === 'healthy');
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        {/* 顶部导航 */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                    />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    医院客户画像分析系统
                  </h1>
                  <p className="text-xs text-gray-500">
                    基于 Mem0 智能记忆层设计
                  </p>
                </div>
              </div>

              {/* API 状态指示 */}
              <div className="flex items-center gap-4">
                {isApiAvailable !== null && (
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isApiAvailable ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <span className="text-gray-600">
                      {isApiAvailable ? '后端服务正常' : '后端服务未连接'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 导航标签 */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex gap-1">
              {[
                { to: '/', icon: LayoutDashboard, label: '仪表盘' },
                { to: '/analyze', icon: MessageSquare, label: '对话分析' },
                { to: '/profile', icon: User, label: '用户画像' },
                { to: '/settings', icon: Settings, label: 'LLM 配置' },
              ].map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      isActive
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>

        {/* 主内容区 */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <TagCategoriesProvider>
          <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/analyze" element={<ConversationPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<LLMConfigPage />} />
            </Routes>
          </TagCategoriesProvider>
        </main>

        <Toaster position="top-right" richColors />
      </div>
    </BrowserRouter>
  );
}

export default App;
