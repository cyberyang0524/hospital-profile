# 医院客户画像分析系统 - 后端

对应前端 [`hospital-profile-system`](../hospital-profile-system)，提供与前端 `src/services/api.ts` 100% 对齐的 `/api/v1/*` 接口。

## 技术栈

- Python 3.10+
- FastAPI + Uvicorn
- httpx（调用任意 OpenAI 兼容的 `/chat/completions` 端点）
- Pydantic v2
- 持久化：JSON / SQLite / PostgreSQL 三选一

## 快速启动

```powershell
cd hospital-profile-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env          # Windows
# cp .env.example .env          # macOS / Linux

# 编辑 .env，填入 LLM_BASE_URL / LLM_MODEL / LLM_API_KEY（Key 可选）
python run.py
```

启动后可访问：
- 服务根：`http://localhost:8000/`
- Swagger UI：`http://localhost:8000/docs`
- 健康检查：`http://localhost:8000/api/v1/health`

> 默认端口 8000，可用 `set PORT=8001`（Windows）或环境变量覆盖。

## 存储后端

通过 `STORAGE_TYPE` 切换，默认 `json`：

| 取值 | 说明 | 额外配置 |
| --- | --- | --- |
| `json` | 单文件持久化（`./data/profiles.json`） | `DATA_PATH` |
| `sqlite` | 本地 SQLite（推荐，零配置） | `STORAGE_SQLITE_PATH` |
| `postgres` | PostgreSQL（需 `psycopg2-binary`） | `STORAGE_DATABASE_URL` |

切换后直接重启后端即可，存储层会自动初始化。

## 与前端配合

1. 启动后端（默认 8000）
2. 启动前端 `hospital-profile-system`（默认请求 `http://localhost:8000/api/v1`）
3. 进入前端 **LLM 配置** 页：
   - **API 地址**（必须含 `/v1`，例如 `https://api.openai.com/v1`）
   - **模型**（例如 `gpt-4o-mini`）
   - **API Key**（无鉴权可留空）
4. 点 **测试连接** 验证；点 **保存配置** 后到 **对话分析** 即可开始解析

> 前端调用 `/analyze` 时，会把 LLM 配置以 `metadata.llm_config` 的形式带上；
> 后端会优先使用这份配置，未提供时再回退到 `.env` 中的默认值。

## 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET    | `/api/v1/health` | 健康检查 |
| GET    | `/api/v1/stats` | 仪表盘统计（用户 / 标签 / 记忆 / 今日分析） |
| POST   | `/api/v1/analyze` | 分析对话，返回标签 / 摘要 / 洞察 |
| GET    | `/api/v1/profiles/{user_id}` | 获取用户画像 |
| POST   | `/api/v1/profiles/update` | 手动更新 / 合并标签 |
| GET    | `/api/v1/profiles/{user_id}/tags?category=...` | 按分类查询标签 |
| GET    | `/api/v1/profiles/{user_id}/similar?limit=5` | 相似患者（Jaccard 相似度） |
| DELETE | `/api/v1/profiles/{user_id}/tags/{tag_id}` | 删除单个标签 |
| GET    | `/api/v1/tags/categories` | 读取标签分类配置 |
| PUT    | `/api/v1/tags/categories` | 修改标签分类配置 |

## 目录

```
hospital-profile-backend/
├── app/
│   ├── main.py          # FastAPI 入口 / 路由
│   ├── llm.py           # OpenAI 兼容 LLM 客户端 + 提示词 + 标签归一化
│   ├── store.py         # 存储抽象层（BaseStore + JSON / SQLite / Postgres）
│   ├── schemas.py       # 业务 Pydantic 模型
│   └── schemas_tag.py   # 标签分类默认值（4 大类 + 候选标签）
├── data/                # 运行时数据（已被 .gitignore 忽略）
├── .env.example
├── requirements.txt
├── run.py
└── README.md
```

## 关键设计

- **JSON 鲁棒解析**：`llm.py` 在解析 LLM 输出时，先剥离 `<think>...</think>` 等思考块，再栈式匹配第一个完整 JSON 对象，避免 `tags` 被吞。
- **分类归一化**：所有提取出的 `tagCategory` 通过 `_CATEGORY_ALIASES` 映射到 `personality / consumption / health / preference` 四个稳定 Key，丢弃未知分类。
- **配置驱动提示词**：每次分析前都会读最新的 `tag_categories.json`，候选标签随之更新；用户在前端管理弹窗里改的分类会立即生效。
- **置信度裁剪**：`confidence` 强制限制在 `[0, 1]`，避免 LLM 给出 `>1` 的伪分数影响排序。

## 可扩展点

- `app/store.py` 中 `BaseStore` 是抽象基类，可加入 `MySQLStore`、`MilvusStore` 等。
- `app/llm.py` 的 `SYSTEM_PROMPT_ZH` 可继续按医院细分场景扩写（VIP、体检、儿科、慢病等）。
- 当前 CORS 全开，生产环境建议收敛到前端域名。
