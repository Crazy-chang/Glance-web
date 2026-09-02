# Glance

面向个人投资者的轻量数据看板：一屏快速阅读 A 股每日行情记录与财经 RSS 资讯，并内置常用网站导航。

## 技术栈

- **前端**: React 18 + Vite 5 + TailwindCSS + TypeScript + Ant Design + TanStack Query
- **后端**: Go 1.22 + Gin + GORM
- **数据库**: SQLite (WAL 模式)
- **部署**: Docker Compose

> SQLite 默认的 journal 模式在写入时会锁住整个数据库，读请求也被阻塞。WAL（Write-Ahead Logging）模式让写入先记到日志文件，不阻塞读，对"定时写 + 随时读"的场景非常关键。

## 功能模块

| 模块 | 说明 |
|------|------|
| 大盘总览 | 手动录入每日行情：指数点位/涨跌、成交额、涨跌家数、涨跌停、炸板率、连板梯队（一/二/三/高度板）、情绪温度（0-100）、复盘笔记与次日计划；支持趋势图查看 |
| RSS 资讯 | 财经 RSS 订阅管理；桌面端三栏可拖拽布局（订阅源 / 文章列表 / 正文阅读），移动端单栏切换；支持置顶、收藏、已读过滤、定时刷新 |
| 网站导航 | 常用财经站点快捷入口（东方财富、同花顺、雪球、财联社等），支持关键词搜索 |

## 快速开始

### 前置要求

- Go 1.22+
- Node.js 20+
- (可选) Docker

### 本地开发

1. 复制环境配置

```bash
cp .env.example .env
```

2. 启动后端（默认在 :8080）

```bash
make dev-backend
# 或直接
go run cmd/server/main.go
```

3. 另开终端，启动前端（默认在 :5173）

```bash
make dev-frontend
# 或直接
cd web && npm install && npm run dev
```

4. 打开 http://localhost:5173

### Docker 部署

```bash
docker-compose up -d --build
```

访问 http://localhost:8080

## 配置项

通过环境变量配置（见 `.env.example`）：

| 变量 | 默认值 | 说明 |
|------|------|------|
| `PORT` | `8080` | 后端 HTTP 端口 |
| `GIN_MODE` | `debug` | Gin 模式：`debug` / `release` |
| `DB_PATH` | `./data/dashboard.db` | SQLite 数据库文件路径 |
| `AUTH_USER` | (空) | BasicAuth 用户名，与 `AUTH_PASS` 同时设置时启用认证 |
| `AUTH_PASS` | (空) | BasicAuth 密码 |

## 项目结构

```
glance/
├── cmd/server/           # Go 入口
├── internal/
│   ├── config/           # 配置加载（环境变量）
│   ├── database/         # DB 初始化（连接、迁移、开启 WAL）
│   ├── models/           # GORM 数据模型（market_record / rss / web_link / system）
│   ├── handlers/         # HTTP 处理器
│   ├── services/         # 业务逻辑（RSS 抓取）
│   ├── scheduler/        # Cron 定时任务（每 10 分钟刷新 RSS）
│   ├── middleware/        # CORS / BasicAuth 中间件
│   └── router/           # 路由注册
├── web/                  # React 前端
│   ├── src/
│   │   ├── api/          # API 请求封装
│   │   ├── components/   # 通用组件（Layout / TopNav / ThemeProvider）
│   │   ├── pages/        # 3 个页面（MarketOverview / RSSReader / WebLinks）
│   │   ├── types/        # TS 类型
│   │   └── App.tsx       # 路由配置
│   └── ...
├── docker/               # Dockerfile
├── docker-compose.yml
├── Makefile
└── .env.example
```

## API 一览

| 分组 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 行情记录 | GET | `/api/market/records` | 获取记录列表 |
| 行情记录 | POST | `/api/market/records` | 新增一条记录 |
| 行情记录 | PUT | `/api/market/records/:id` | 更新记录 |
| 行情记录 | DELETE | `/api/market/records/:id` | 删除记录 |
| RSS | GET/POST | `/api/rss/feeds` | 获取/新增订阅源 |
| RSS | POST | `/api/rss/feeds/:id/refresh` | 刷新单个订阅源 |
| RSS | POST | `/api/rss/feeds/refresh` | 刷新全部订阅源 |
| RSS | GET | `/api/rss/articles` | 获取文章列表 |
| RSS | PUT | `/api/rss/articles/:id/read` | 标记已读 |
| RSS | PUT | `/api/rss/articles/:id/star` | 切换收藏 |
| RSS | PUT | `/api/rss/feeds/:id/pin` | 切换置顶 |
| 系统 | GET | `/api/system/status` | 系统状态 |
| 系统 | GET/PUT | `/api/system/settings` | 获取/更新设置 |
