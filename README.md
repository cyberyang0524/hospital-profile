# 医院客户画像分析系统

一个面向医院客服/咨询场景的客户画像系统：基于医患/客户对话，通过大语言模型自动提取患者在 **性格特征、消费能力，健康状况，服务偏好** 四个维度的特征标签，并提供画像查看、标签管理、相似患者检索等能力。

## 项目结构

```
hospital-profile/
├── hospital-profile-system/   # 前端（Vite + React + TypeScript + Tailwind）
├── hospital-profile-backend/  # 后端（FastAPI + Python 3.10+）
└── hospital-profile-frontend/ # 早期静态原型（Tailwind CDN 页面）
```

主开发目录为 `hospital-profile-system`（前端） + `hospital-profile-backend`（后端），二者通过 `/api/v1` 前后端分离协作。

## 功能特性

- **智能对话分析**：粘贴一段客服/客户对话，自动解析为结构化消息并调用 LLM 提取标签
- **多维度标签体系**：内置 4 大类 50+ 候选标签，**支持用户在仪表盘自定义修改**（增删分类、改名、换图标）
- **画像管理**：按 `userId` 持久化，相同 (category, name) 标签自动合并覆盖
- **记忆层**：保留历史对话原文，便于回溯
- **相似患者检索**：基于共有标签的 Jaccard 相似度
- **多存储后端**：内置 JSON / SQLite / PostgreSQL 三种存储，`.env` 切换
- **任意 OpenAI 兼容 LLM**：在前端 “LLM 配置” 填 `baseUrl / model / apiKey` 即可对接任何兼容服务

## 截图

![仪表盘](./image1.png)

![对话分析](./image2.png)

![标签分类体系](./image3.png)

## 技术栈

| 端 | 技术 |
| --- | --- |
| 前端 | Vite 5 · React 18 · TypeScript · Tailwind CSS · React Router v6 · Lucide Icons · Sonner |
| 后端 | FastAPI · Pydantic v2 · httpx · SQLite / Postgres |

## 快速开始

### 1. 启动后端

```powershell
cd hospital-profile-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# 编辑 .env 至少填 LLM_BASE_URL / LLM_MODEL（API Key 按需）
python run.py
```

后端启动后访问：
- 根路径：http://localhost:8000/
- Swagger 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/api/v1/health

### 2. 启动前端

```powershell
cd hospital-profile-system
npm install
npm run dev
```

打开 http://localhost:5173/

### 3. 在前端配置 LLM

进入 “LLM 配置” 页：
- **API 地址**：必须含 `/v1`，如 `https://api.openai.com/v1`
- **模型**：如 `gpt-4o-mini` 或自部署模型的名称
- **API Key**：如服务无需鉴权可留空
- 点 “测试连接” 验证 → 点 “保存配置”

之后到 “对话分析” 页：
1. 输入用户 ID（如 `test_001`）
2. 在 “整段对话” 框粘贴或手动录入客服/客户对话
3. 点 “解析为消息” → “开始分析”

分析完成后回到仪表盘可看到统计数据更新。

## 存储切换

修改 `hospital-profile-backend/.env`：

```env
STORAGE_TYPE=sqlite   # json | sqlite | postgres
STORAGE_SQLITE_PATH=./data/profiles.db

# Postgres 需要安装 psycopg2-binary（已加入 requirements.txt）
STORAGE_DATABASE_URL=postgresql://user:pass@host:5432/hospital_profile
```

## 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET    | `/api/v1/health` | 健康检查 |
| GET    | `/api/v1/stats` | 仪表盘统计 |
| POST   | `/api/v1/analyze` | 分析对话 |
| GET    | `/api/v1/profiles/{user_id}` | 获取画像 |
| POST   | `/api/v1/profiles/update` | 更新画像标签 |
| GET    | `/api/v1/profiles/{user_id}/tags?category=` | 按分类查询标签 |
| GET    | `/api/v1/profiles/{user_id}/similar` | 相似患者 |
| DELETE | `/api/v1/profiles/{user_id}/tags/{tag_id}` | 删除标签 |
| GET    | `/api/v1/tags/categories` | 读取标签分类配置 |
| PUT    | `/api/v1/tags/categories` | 修改标签分类配置 |

## 目录说明

- `hospital-profile-system/src/services/api.ts` — 前端 API 客户端
- `hospital-profile-system/src/hooks/useTagCategories.tsx` — 标签分类全局状态
- `hospital-profile-system/src/pages/DashboardPage.tsx` — 仪表盘 + 标签分类管理弹窗
- `hospital-profile-system/src/pages/ConversationPage.tsx` — 对话分析（支持整段粘贴解析）
- `hospital-profile-system/src/pages/ProfilePage.tsx` — 画像管理
- `hospital-profile-system/src/pages/LLMConfigPage.tsx` — LLM 配置（已去除过时的 provider 选项）
- `hospital-profile-backend/app/main.py` — FastAPI 入口
- `hospital-profile-backend/app/llm.py` — OpenAI 兼容 LLM 客户端 + 中文提示词
- `hospital-profile-backend/app/store.py` — 存储抽象层（BaseStore + JSON / SQLite / Postgres）
- `hospital-profile-backend/app/schemas*.py` — Pydantic 模型

## 常见问题

**Q: 提示 `pnpm: command not found`**
A: 本项目已改为 `npm` 脚本（`package.json` 中保留 `predev` 安装依赖），如一定要用 pnpm：`npm i -g pnpm` 或 `corepack enable && corepack prepare pnpm@latest --activate`。

**Q: 后端 `/analyze` 返回 422**
A: 检查请求体是否含 `userId` 与 `messages`；后端使用 Pydantic v2 严格校验。

**Q: 仪表盘统计全是 0**
A: 确认后端有启动、对话分析请求已成功返回、且 `STORAGE_TYPE` 指向的存储文件可写。

**Q: 标签分类体系显示 0 个标签**
A: 首次访问会自动加载 [schemas_tag.py](hospital-profile-backend/app/schemas_tag.py) 中的默认 4 大分类；若仍是 0，删除 `data/tag_categories.json` 后重启后端。

## License

MIT
