# 医院客户画像分析系统

一个面向医院客服 / 咨询场景的 **客户画像系统**：基于医患 / 客户对话，通过大语言模型自动提取患者在 **性格特征、消费能力，健康状况，服务偏好** 四个维度的特征标签，并提供画像查看、标签管理、相似患者检索、仪表盘统计等能力。

- 前端：Vite 5 + React 18 + TypeScript + Tailwind CSS + React Router v6
- 后端：FastAPI + Pydantic v2 + httpx，支持 JSON / SQLite / PostgreSQL 多种持久化
- LLM：任意 **OpenAI 兼容** `/chat/completions` 服务，自带解析容错与标签归一化

---

## 效果截图

### 仪表盘

![仪表盘](./image1.png)

### 对话分析

![对话分析](./image2.png)

### 标签分类体系管理

![标签分类体系](./image3.png)

---

## 目录结构

```
hospital-profile/
├── hospital-profile-system/    # 前端（主开发）
├── hospital-profile-backend/   # 后端（FastAPI）
├── hospital-profile-frontend/  # 早期静态原型（仅参考）
├── image1.png / image2.png / image3.png   # 截图
└── README.md                   # 你正在看的这个文件
```

详细子项目说明：
- [前端 README](./hospital-profile-system/README.md)
- [后端 README](./hospital-profile-backend/README.md)

## 功能特性

- **智能对话分析**：粘贴一段客服 / 客户对话，自动解析为结构化消息，再调用 LLM 提取标签
- **可自定义标签体系**：内置 4 大类 50+ 候选标签，支持在前端仪表盘中**增删分类、改名、换图标、增删标签**
- **画像管理**：按 `userId` 持久化，相同 `(category, name)` 标签自动合并
- **记忆层**：保留历史对话原文，便于回溯
- **相似患者检索**：基于共有标签的 Jaccard 相似度
- **多存储后端**：内置 JSON / SQLite / PostgreSQL，`STORAGE_TYPE` 切换
- **任意 OpenAI 兼容 LLM**：在前端“LLM 配置”页填 `baseUrl / model / apiKey` 即可

## 快速开始

> 推荐使用 **Python 3.10+** 和 **Node 18+**。

### 1. 启动后端

```powershell
cd hospital-profile-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env

# 编辑 .env，至少填 LLM_BASE_URL / LLM_MODEL（API Key 可选）
python run.py
```

启动后可访问：
- 服务根：`http://localhost:8000/`
- Swagger UI：`http://localhost:8000/docs`
- 健康检查：`http://localhost:8000/api/v1/health`

### 2. 启动前端

```powershell
cd hospital-profile-system
npm install
npm run dev
```

打开 `http://localhost:5173/`，前端默认请求 `http://localhost:8000/api/v1`。

### 3. 在前端配置 LLM

进入 **LLM 配置** 页：

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| API 地址 | 必须含 `/v1` | `https://api.openai.com/v1` |
| 模型 | 任意 OpenAI 兼容模型名 | `gpt-4o-mini` |
| API Key | 无鉴权可留空 | `sk-...` |

点 **测试连接** 验证 → **保存配置**。之后到 **对话分析** 页：
1. 输入用户 ID（如 `test_001`）
2. 在“整段对话”框粘贴或手动录入客服 / 客户对话
3. 点 **解析为消息** → **开始分析**

完成后回到仪表盘可看到统计数据（用户数 / 标签数 / 记忆数 / 今日分析数）已更新。

## 存储切换

修改 `hospital-profile-backend/.env`：

```env
# 可选：json（默认）| sqlite | postgres
STORAGE_TYPE=sqlite

# JSON 存储路径（STORAGE_TYPE=json 时生效）
DATA_PATH=./data/profiles.json

# SQLite 存储路径（STORAGE_TYPE=sqlite 时生效）
STORAGE_SQLITE_PATH=./data/profiles.db

# Postgres 连接字符串（STORAGE_TYPE=postgres 时生效；需安装 psycopg2-binary）
STORAGE_DATABASE_URL=postgresql://user:pass@host:5432/hospital_profile
```

## 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET    | `/api/v1/health` | 健康检查 |
| GET    | `/api/v1/stats` | 仪表盘统计 |
| POST   | `/api/v1/analyze` | 分析对话 |
| GET    | `/api/v1/profiles/{user_id}` | 获取画像 |
| POST   | `/api/v1/profiles/update` | 手动更新 / 合并标签 |
| GET    | `/api/v1/profiles/{user_id}/tags?category=...` | 按分类查询标签 |
| GET    | `/api/v1/profiles/{user_id}/similar?limit=5` | 相似患者 |
| DELETE | `/api/v1/profiles/{user_id}/tags/{tag_id}` | 删除单个标签 |
| GET    | `/api/v1/tags/categories` | 读取标签分类配置 |
| PUT    | `/api/v1/tags/categories` | 修改标签分类配置 |

## 常见问题

**Q: `pnpm: command not found`**
A: 本项目脚本已改为 `npm`，无需 pnpm。如需：`npm i -g pnpm` 或 `corepack enable && corepack prepare pnpm@latest --activate`。

**Q: 前端无法连接后端（ERR_CONNECTION_REFUSED）**
A: 确认后端 `python run.py` 正常运行在 8000；自定义端口后请同步改前端 `.env` 的 `VITE_API_URL`。

**Q: 后端 `/analyze` 一直转圈，最终“signal is aborted without reason”**
A: 前端默认请求 20s 超时；分析接口已自动放宽到 120s。仍超时说明 LLM 服务响应慢，请检查 `LLM_BASE_URL` 可达性与模型大小。

**Q: 仪表盘统计全是 0**
A: 确认后端有启动、`/analyze` 调用成功、`STORAGE_TYPE` 对应目录可写。

**Q: 标签分类显示“categories 0 个标签”**
A: 首次访问会回退到 [schemas_tag.py](./hospital-profile-backend/app/schemas_tag.py) 的 4 大类默认值；如仍为空，删除 `hospital-profile-backend/data/tag_categories.json` 后重启后端。

**Q: 标签提取不准确**
A: 后端提示词在 `hospital-profile-backend/app/llm.py`，已做 JSON 鲁棒解析、分类归一化、置信度裁剪；可在仪表盘 → 标签分类管理里把候选标签收窄，引导 LLM 输出更准的 `tagName`。

## 安全提醒

- 仓库已确认 **未提交任何真实 LLM API Key / Token**（`.env`、`data/` 已在 `.gitignore` 中）。
- `.env` 切勿提交；本地调试时填入的 Key 仅保存在你自己的 `.env` 中。
- 截图（`image1.png / image2.png / image3.png`）已放在仓库根目录，可直接被 README 引用。

## License

MIT
