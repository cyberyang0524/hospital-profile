# 医院客户画像分析系统 - 后端

对应前端 [hospital-profile-system](../hospital-profile-system)，提供与前端 `src/services/api.ts` 100% 对齐的 `/api/v1/*` 接口。

## 技术栈
- Python 3.10+
- FastAPI + Uvicorn
- httpx（调用任意 OpenAI 兼容的 /chat/completions 端点）
- 数据：本地 JSON 文件持久化（`data/profiles.json`），单进程足够

## 快速启动

```powershell
cd d:\hospital-profile\hospital-profile-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env       # Windows
# cp .env.example .env       # macOS/Linux
# 编辑 .env 填入 LLM_BASE_URL / LLM_MODEL / LLM_API_KEY

python run.py
```

启动后：
- 服务根：`http://localhost:8000/`
- 接口文档（Swagger UI）：`http://localhost:8000/docs`
- 健康检查：`http://localhost:8000/api/v1/health`

## 与前端配合
1. 启动后端（默认端口 8000）
2. 启动前端 `hospital-profile-system`，前端默认请求 `http://localhost:8000/api/v1`
3. 进入前端 “LLM 配置” 页，填写：
   - API 地址（必须含 `/v1`，如 `https://api.openai.com/v1`）
   - 模型（如 `gpt-4o-mini`）
   - API Key（无鉴权可留空）
4. 点 “测试连接” 验证；点 “保存配置” 后到 “对话分析” 即可开始解析

> 前端每次调用 `/analyze` 时，会把 LLM 配置以 `metadata.llm_config` 的形式带上；后端会优先使用这份配置，未提供时再回退到 `.env` 中的默认值。

## 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET  | `/api/v1/health` | 健康检查 |
| POST | `/api/v1/analyze` | 分析对话，返回标签/摘要/洞察 |
| GET  | `/api/v1/profiles/{user_id}` | 获取用户画像 |
| POST | `/api/v1/profiles/update` | 手动更新/合并标签 |
| GET  | `/api/v1/profiles/{user_id}/tags?category=personality` | 查询某分类标签 |
| GET  | `/api/v1/profiles/{user_id}/similar?limit=5` | 相似患者（基于共有标签） |
| DELETE | `/api/v1/profiles/{user_id}/tags/{tag_id}` | 删除单个标签 |

## 备注 / 可扩展点
- `app/store.py` 里的 `ProfileStore` 是文件持久化版本，后续可换成 Postgres + 向量库（如 pgvector / Milvus）。
- 提示词在 `app/llm.py` 的 `SYSTEM_PROMPT_ZH`，可根据实际医院场景继续扩写。
- CORS 当前全开，生产环境建议收敛。
