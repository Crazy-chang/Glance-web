import client from './client'
import type {
  Feed,
  Article,
  FeedPayload,
  Habit,
  MarketRecord,
  MarketRecordPayload,
  Note,
  SystemSettings,
  WebLink,
} from '@/types'

/* ============================================================
 *  API 请求函数 - 按模块组织
 * ============================================================ */

/* -------------------- 行情记录 -------------------- */
export const marketRecord = {
  /** 获取行情记录列表（可选日期过滤） */
  getRecords(date?: string): Promise<MarketRecord[]> {
    return client
      .get('/market/records', { params: date ? { date } : {} })
      .then((r) => r.data)
  },

  /** 创建行情记录 */
  create(payload: MarketRecordPayload): Promise<MarketRecord> {
    return client.post('/market/records', payload).then((r) => r.data)
  },

  /** 更新行情记录 */
  update(id: number, payload: MarketRecordPayload): Promise<MarketRecord> {
    return client.put('/market/records/' + id, payload).then((r) => r.data)
  },

  /** 删除行情记录 */
  remove(id: number): Promise<void> {
    return client.delete('/market/records/' + id).then((r) => r.data)
  },
}

/* -------------------- RSS -------------------- */
export const rss = {
  /** 获取订阅源列表 */
  getFeeds(): Promise<Feed[]> {
    return client.get('/rss/feeds').then((r) => r.data)
  },

  /** 校验 RSS 链接 */
  validateFeed(url: string): Promise<{ title: string; description: string; itemCount: number }> {
    return client.post('/rss/validate', { url }).then((r) => r.data)
  },

  /** 创建订阅源（同步抓取首批文章，返回真实未读数；抓取较慢，单独放宽超时） */
  createFeed(payload: FeedPayload): Promise<{
    feed: Feed
    articleCount: number
    unreadCount: number
  }> {
    return client
      .post('/rss/feeds', payload, { timeout: 30000 })
      .then((r) => r.data)
  },

  /** 获取所有订阅源的未读数（轻量接口） */
  getUnreadCounts(): Promise<Record<string, number>> {
    return client.get('/rss/unread-counts').then((r) => r.data)
  },

  /** 刷新单个订阅源 */
  refreshFeed(id: number): Promise<{ feedId: number; newCount: number; feedName: string }> {
    return client.post(`/rss/feeds/${id}/refresh`).then((r) => r.data)
  },

  /** 刷新全部订阅源 */
  refreshAllFeeds(): Promise<{ newCount: number }> {
    return client.post('/rss/feeds/refresh').then((r) => r.data)
  },

  /** 更新订阅源 */
  updateFeed(id: number, payload: Partial<FeedPayload>): Promise<Feed> {
    return client.put('/rss/feeds/' + id, payload).then((r) => r.data)
  },

  /** 删除订阅源 */
  deleteFeed(id: number): Promise<void> {
    return client.delete('/rss/feeds/' + id).then((r) => r.data)
  },

  /** 置顶订阅源 */
  togglePinFeed(id: number): Promise<{ id: number; pinnedAt: string | null }> {
    return client.put('/rss/feeds/' + id + '/pin').then((r) => r.data)
  },

  /** 获取文章列表（不含正文，点击时单独拉详情） */
  getArticles(
    feedId?: number,
    readFilter?: 'unread' | 'read' | 'today' | 'all',
    q?: string,
  ): Promise<{ list: Article[]; unreadCount: number; readCount: number; totalCount: number; todayCount: number }> {
    return client
      .get('/rss/articles', { params: { feedId, readFilter, q } })
      .then((r) => r.data)
  },

  /** 获取单篇文章详情（含完整正文） */
  getArticle(id: number): Promise<Article> {
    return client.get(`/rss/articles/${id}`).then((r) => r.data)
  },

  /** 标记文章已读 */
  markRead(id: number): Promise<void> {
    return client.put('/rss/articles/' + id + '/read').then((r) => r.data)
  },
}

/* -------------------- 系统设置 -------------------- */
export const system = {
  /** 获取系统设置 */
  getSettings(): Promise<SystemSettings> {
    return client.get('/system/settings').then((r) => r.data)
  },

  /** 更新系统设置 */
  updateSettings(payload: Partial<SystemSettings>): Promise<SystemSettings> {
    return client.put('/system/settings', payload).then((r) => r.data)
  },
}

/* -------------------- 网站导航 -------------------- */
export const webLinks = {
  /** 获取导航链接列表 */
  getLinks(): Promise<WebLink[]> {
    return client.get('/web-links').then((r) => r.data)
  },

  /** 新增导航链接（名称、URL 必填，描述非必填） */
  createLink(payload: { title: string; link: string; description?: string }): Promise<WebLink> {
    return client.post('/web-links', payload).then((r) => r.data)
  },

  /** 更新导航链接（后端路由 PUT /web-links/update，id 放在请求体里） */
  updateLink(payload: { id: number; title: string; link: string; description?: string }): Promise<{ msg: string }> {
    return client.put('/web-links/update', payload).then((r) => r.data)
  },

  /** 删除导航链接 */
  deleteLink(id: number): Promise<{ id: string }> {
    return client.delete('/web-links/' + id).then((r) => r.data)
  },
}

/* -------------------- 便签 -------------------- */
export const notes = {
  /** 获取便签列表（后端已按置顶优先、更新时间倒序排好） */
  getAll(): Promise<Note[]> {
    return client.get('/notes').then((r) => r.data)
  },

  /** 新建便签 */
  create(content: string): Promise<Note> {
    return client.post('/notes', { content }).then((r) => r.data)
  },

  /** 更新便签（内容或置顶状态，按需传字段） */
  update(id: number, payload: { content?: string; pinned?: boolean }): Promise<Note> {
    return client.put('/notes/' + id, payload).then((r) => r.data)
  },

  /** 删除便签 */
  remove(id: number): Promise<void> {
    return client.delete('/notes/' + id).then((r) => r.data)
  },
}

/* -------------------- 习惯打卡 -------------------- */
export const habits = {
  /** 获取全部习惯（含各自打卡记录 checks，后端 Preload 一次性带出） */
  getAll(): Promise<Habit[]> {
    return client.get('/habits').then((r) => r.data)
  },

  /** 新建习惯 */
  create(payload: { name: string; color: string }): Promise<Habit> {
    return client.post('/habits', payload).then((r) => r.data)
  },

  /** 删除习惯（级联删除其全部打卡记录） */
  remove(id: number): Promise<void> {
    return client.delete('/habits/' + id).then((r) => r.data)
  },

  /** 切换某天打卡状态：已打卡→取消，未打卡→新增。返回切换后的最新状态 */
  toggle(id: number, date: string): Promise<{ checked: boolean }> {
    return client.put(`/habits/${id}/toggle`, { date }).then((r) => r.data)
  },
}

