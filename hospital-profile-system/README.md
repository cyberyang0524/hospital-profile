# 医院客户画像分析系统 - 前端

> 对应后端：[`hospital-profile-backend`](../hospital-profile-backend)
> 详细架构与启动说明见 [根 README](../README.md)

## 技术栈

- Vite 5 + React 18 + TypeScript
- Tailwind CSS（结合 shadcn/ui 风格组件）
- React Router v6
- Sonner（toast）、Lucide Icons
- 任意 OpenAI 兼容 LLM（通过 LLM 配置页 + `metadata.llm_config` 注入）

## 快速启动

```powershell
cd hospital-profile-system
npm install
npm run dev
```

打开 `http://localhost:5173/`。

如果后端不是默认 8000 端口，在项目根目录建一个 `.env`：

```env
VITE_API_URL=http://localhost:8001/api/v1
```

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器（Vite + HMR） |
| `npm run build` | 生产构建（`tsc -b && vite build`） |
| `npm run build:prod` | 同上，显式 `BUILD_MODE=prod` |
| `npm run preview` | 预览构建产物 |
| `npm run lint` | 运行 ESLint |

> 历史上脚本中曾强制依赖 `pnpm`，已统一改为 `npm`，避免 Windows 上 `pnpm: command not found`。

## 主要页面

| 路由 | 文件 | 说明 |
| --- | --- | --- |
| `/`         | `src/pages/DashboardPage.tsx`   | 仪表盘（真实数据 + 标签分类管理弹窗 + 快速入口） |
| `/analyze`  | `src/pages/ConversationPage.tsx` | 对话分析（支持整段粘贴 → 解析为消息 → LLM 提取） |
| `/profiles` | `src/pages/ProfilePage.tsx`      | 画像管理（查询 / 增删标签） |
| `/llm`      | `src/pages/LLMConfigPage.tsx`    | LLM 配置（自定义 baseUrl / model / apiKey，已去除过时 provider 选项） |

## 关键文件

- `src/services/api.ts` — 前端 API 客户端，统一超时（普通 20s，分析 120s）、错误解析
- `src/hooks/useTagCategories.tsx` — 标签分类全局状态（context + hook）
- `src/components/ErrorBoundary.tsx` — 渲染兜底
- `src/types/index.ts` — 业务类型定义

## 与后端交互要点

- 每次 `/analyze` 会把 `localStorage.llm_config` 注入到 `metadata.llm_config`；后端优先使用。
- `/analyze` 完成后，前端 `dispatchEvent('profile-updated')`，仪表盘监听后刷新 `/stats`。
- `/tags/categories` 返回 `{ categories: { ... } }`；前端 hook 会从 `data.categories` 取值。

## 常见问题

**Q: `Failed to fetch dynamically imported module`**
A: 早期版本曾用 `React.lazy` 拆包 + 动态导入；HMR / 缓存异常时容易出现。已统一改为静态 import，刷新或重启 `npm run dev` 即可。

**Q: `pnpm: command not found`**
A: 改用 `npm install` 即可（见上文脚本）。

**Q: LLM 测试连接失败**
A: 填的 `baseUrl` 必须含 `/v1`；浏览器可能因 CORS 失败，必要时直接在终端用 `curl <baseUrl>/models` 验证。
