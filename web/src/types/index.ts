/* ============================================================
 *   TypeScript 类型定义
 * ============================================================ */

/* -------------------- 通用响应包装 -------------------- */
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

/* -------------------- 行情记录 -------------------- */
/** 每日行情记录（含情绪温度、复盘） */
export interface MarketRecord {
  id?: number
  /** 日期 YYYY-MM-DD */
  date: string
  /** 指数点位 */
  indexValue: number
  /** 指数涨跌（%） */
  indexChange: number
  /** 成交额（亿） */
  amount: number
  /** 缩/放量 */
  volumeChange: string
  /** 上涨数 */
  upCount: number
  /** 下跌数 */
  downCount: number
  /** 涨停数 */
  limitUp: number
  /** 跌停数 */
  limitDown: number
  /** 炸板率（%） */
  brokenRate: number
  /** 一板数 */
  firstBoard: number
  /** 二板数 */
  secondBoard: number
  /** 三板数 */
  thirdBoard: number
  /** 高度板数 */
  multiBoard: number
  /** 情绪温度 0-100 */
  sentiment: number
  /** 当天复盘 */
  review: string
  /** 第二天操作记录 */
  tomorrowPlan: string
  /** 备注 */
  remark: string
  createdAt?: string
  updatedAt?: string
}

/** 创建/更新行情记录 payload */
export type MarketRecordPayload = Omit<MarketRecord, 'id' | 'createdAt' | 'updatedAt'>

/* -------------------- RSS -------------------- */
/** RSS 订阅源 */
export interface Feed {
  id: number
  /** 订阅源名称 */
  title: string
  /** RSS 地址 */
  url: string
  /** 分类 */
  category?: string
  /** 是否启用 */
  active: boolean
  /** 置顶时间（用于排序，最近置顶的排最前） */
  pinnedAt?: string | null
  /** 未读文章数 */
  unreadCount?: number
  /** 文章上限（单独设置，未设过则跟随全局） */
  maxArticles?: number
  /** 最近一次抓取错误（空=正常） */
  lastError?: string
  /** 创建时间 */
  createdAt: string
}

/** RSS 文章 */
export interface Article {
  id: number
  feedId: number
  /** 订阅源名称 */
  feedTitle?: string
  title: string
  /** 文章链接 */
  link: string
  /** 摘要（前端用） */
  summary?: string
  /** 正文摘要（后端字段，纯文本≤500字） */
  description?: string
  /** 完整 HTML 正文（阅读区渲染用） */
  content?: string
  /** 发布时间 */
  publishedAt: string
  /** 是否已读 */
  read: boolean
  /** 是否收藏 */
  starred?: boolean
}

/** 创建/更新订阅源 payload */
export interface FeedPayload {
  title?: string
  url?: string
  category?: string
  active?: boolean
  maxArticles?: number
}

/* -------------------- 系统设置 -------------------- */
/** 系统设置（key-value） */
export interface SystemSettings {
  /** 每源文章总数上限（超出后已读优先清理） */
  maxArticlesPerFeed: number
  /** RSS 刷新间隔（分钟），后端调度器每轮从 DB 读取 */
  refreshInterval: number
}

/* -------------------- 网站导航 -------------------- */
/** 网站导航链接 */
export interface WebLink {
  id: number
  /** 名称 */
  title: string
  /** 链接地址 */
  link: string
  /** 描述（非必填） */
  description?: string
  createdAt?: string
  updatedAt?: string
}

