# Glance

面向个人投资者的轻量数据看板：一屏快速阅读 A 股每日行情记录与财经 RSS 资讯，并内置常用网站导航。

仓库地址：https://github.com/Crazy-chang/Glance-web

## 功能模块

| 模块 | 说明 |
|------|------|
| 大盘总览 | 手动录入每日行情：指数点位/涨跌、成交额、涨跌家数、涨跌停、炸板率、连板梯队（一/二/三/高度板）、情绪温度（0-100）、复盘笔记与次日计划；支持趋势图查看 |
| RSS 资讯 | 财经 RSS 订阅管理；桌面端三栏可拖拽布局（订阅源 / 文章列表 / 正文阅读），移动端单栏切换；支持置顶、收藏、已读过滤、全文搜索；刷新间隔可在设置中自定义（5-360 分钟），前后端同步生效 |
| 网站导航 | 常用财经站点快捷入口（东方财富、同花顺、雪球、财联社等），支持关键词搜索 |

## 技术栈

- **前端**: React 18 + Vite 5 + TailwindCSS + TypeScript + Ant Design + TanStack Query + react-resizable-panels
- **后端**: Go 1.22 + Gin + GORM
- **数据库**: SQLite（WAL 模式 + busy_timeout，单文件免部署）
- **部署**: Docker Compose（多阶段构建，前端产物打包进后端镜像）

> **为什么用 SQLite**：默认 journal 模式写入时锁整库、阻塞读；WAL（Write-Ahead Logging）让写入先记日志不阻塞读。配合 `busy_timeout=5000`，写锁冲突时排队等待而非立即报错——对"定时批量写 RSS + 随时读"的场景很关键。

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

3. 另开终端，启动前端（默认在 :5173，已配置 /api 代理到 :8080）

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

> 镜像已通过多阶段构建把前端 `dist` 打包进去；后端托管静态资源的接入完成后，可直接访问 http://localhost:8080 。当前版本请以本地开发模式（:5173）为准。

## 配置项

### 环境变量（见 `.env.example`，启动时读取）

| 变量 | 默认值 | 说明 |
|------|------|------|
| `PORT` | `8080` | 后端 HTTP 端口 |
| `GIN_MODE` | `debug` | Gin 模式：`debug` / `release` |
| `DB_PATH` | `./data/dashboard.db` | SQLite 数据库文件路径（容器内挂载 `./data` 持久化） |
| `AUTH_USER` | (空) | BasicAuth 用户名，与 `AUTH_PASS` 同时设置时启用认证 |
| `AUTH_PASS` | (空) | BasicAuth 密码 |

### 应用内设置（存数据库，在 RSS 页设置弹窗修改，即时生效）

| 设置项 | 默认值 | 范围 | 说明 |
|------|------|------|------|
| `refreshInterval` | 15 分钟 | 5-360 | RSS 自动刷新间隔；后端调度器每轮读取，前端轮询同步跟随，改完无需重启 |
| `maxArticlesPerFeed` | 500 | 50-500 | 每个订阅源保留文章上限，超出自动清理最旧文章（已读优先删除） |

## 项目结构

```
glance/
├── cmd/server/           # Go 入口
├── internal/
│   ├── config/           # 配置加载（环境变量）
│   ├── database/         # DB 初始化（连接、迁移、WAL + busy_timeout）
│   ├── models/           # GORM 数据模型（market_record / rss / web_link / system）
│   ├── handlers/         # HTTP 处理器
│   ├── services/         # 业务逻辑（RSS 抓取、解析、懒加载图片修正）
│   ├── scheduler/        # 定时刷新 RSS（goroutine 循环，间隔动态读 DB，默认 15 分钟）
│   ├── middleware/       # CORS / BasicAuth 中间件
│   └── router/           # 路由注册
├── web/                  # React 前端
│   ├── public/           # 静态资源（favicon）
│   └── src/
│       ├── api/          # API 请求封装（axios + React Query）
│       ├── components/   # 通用组件（Layout / TopNav / ThemeProvider）
│       ├── pages/        # 3 个页面（MarketOverview / RSSReader / WebLinks）
│       ├── types/        # TS 类型
│       └── App.tsx       # 路由配置
├── docker/               # Dockerfile（三阶段构建）
├── docker-compose.yml
├── Makefile
└── .env.example
```

## API 一览

| 分组 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 行情记录 | GET | `/api/market/records` | 获取记录列表（支持 `?date=` 筛选） |
| 行情记录 | POST | `/api/market/records` | 新增一条记录 |
| 行情记录 | PUT | `/api/market/records/:id` | 更新记录 |
| 行情记录 | DELETE | `/api/market/records/:id` | 删除记录 |
| RSS | GET | `/api/rss/feeds` | 获取订阅源列表（含未读数） |
| RSS | POST | `/api/rss/feeds` | 新增订阅源（创建后立即抓取一次） |
| RSS | PUT | `/api/rss/feeds/:id` | 更新订阅源（名称/暂停/文章上限） |
| RSS | DELETE | `/api/rss/feeds/:id` | 删除订阅源及其文章 |
| RSS | POST | `/api/rss/validate` | 校验 RSS 地址是否可用 |
| RSS | POST | `/api/rss/feeds/refresh` | 刷新全部订阅源 |
| RSS | POST | `/api/rss/feeds/:id/refresh` | 刷新单个订阅源 |
| RSS | PUT | `/api/rss/feeds/:id/pin` | 切换置顶 |
| RSS | GET | `/api/rss/unread-counts` | 各源未读数（轻量 GROUP BY） |
| RSS | GET | `/api/rss/articles` | 文章列表（支持 `feedId` / `readFilter` / `q` 搜索） |
| RSS | GET | `/api/rss/articles/:id` | 文章详情（含完整正文） |
| RSS | PUT | `/api/rss/articles/:id/read` | 标记已读 |
| RSS | PUT | `/api/rss/articles/:id/star` | 切换收藏 |
| 系统 | GET | `/api/system/status` | 系统状态（DB 健康、Go 版本、协程数） |
| 系统 | GET/PUT | `/api/system/settings` | 获取/更新应用设置 |
