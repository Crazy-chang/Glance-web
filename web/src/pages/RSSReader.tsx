import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { message } from 'antd'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels'
import {
  Rss, ExternalLink, Plus, RefreshCw, ChevronLeft,
  Trash2, X, Loader2, CheckCircle2, AlertCircle, Pin,
  Search, Edit3, Copy, Settings, ArrowDown, ArrowUp,
  PauseCircle, PlayCircle, MoreVertical,
} from 'lucide-react'
import { rss as rssApi, system as systemApi } from '@/api/endpoints'
import type { Feed, Article, SystemSettings } from '@/types'

type ReadFilter = 'unread' | 'today' | 'read' | 'all'
type MobileView = 'feeds' | 'articles' | 'reader'

/* -------------------- useIsMobile -------------------- */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

/* -------------------- 新增订阅弹窗 -------------------- */
function AddFeedModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (name: string, url: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleCheck = useCallback(async () => {
    // 清理 URL：去掉首尾空格、反引号、引号、换行
    const cleanUrl = url.trim().replace(/^[\s`"'<>]+|[\s`"'<>]+$/g, '').trim()
    if (!cleanUrl) {
      setErrorMsg('请输入 RSS 链接')
      setStatus('error')
      return
    }

    setStatus('checking')
    setErrorMsg('')

    try {
      const result = await rssApi.validateFeed(cleanUrl)
      const finalName = name.trim() || result.title || cleanUrl.match(/\/\/([^/]+)/)?.[1] || '未命名订阅'
      setStatus('success')
      await onAdd(finalName, cleanUrl)
      setTimeout(() => {
        setName('')
        setUrl('')
        setStatus('idle')
        onClose()
      }, 500)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : '链接校验失败')
    }
  }, [url, name, onAdd, onClose])

  const handleClose = () => {
    setName('')
    setUrl('')
    setStatus('idle')
    setErrorMsg('')
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-bg-secondary p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-fg-primary">
            <Plus className="h-4 w-4 text-stock-up" />
            新增 RSS 订阅
          </h2>
          <button onClick={handleClose} className="text-fg-muted hover:text-fg-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-fg-secondary">订阅名称（可选）</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：财联社电报"
              disabled={status === 'checking'}
              className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-fg-primary placeholder:text-fg-muted focus:border-stock-up focus:outline-none disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-fg-secondary">RSS 链接</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/rss"
              disabled={status === 'checking'}
              onKeyDown={(e) => e.key === 'Enter' && status !== 'checking' && handleCheck()}
              className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-fg-primary placeholder:text-fg-muted focus:border-stock-up focus:outline-none disabled:opacity-50"
            />
          </div>

          {status === 'checking' && (
            <div className="flex items-center gap-2 rounded-lg bg-bg-tertiary px-3 py-2 text-xs text-fg-secondary">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-stock-up" />
              正在校验 RSS 链接...
            </div>
          )}
          {status === 'success' && (
            <div className="flex items-center gap-2 rounded-lg bg-stock-up/10 px-3 py-2 text-xs text-stock-up">
              <CheckCircle2 className="h-3.5 w-3.5" />
              链接有效，正在抓取首批文章...
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2 rounded-lg bg-stock-down/10 px-3 py-2 text-xs text-stock-down">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {errorMsg}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={handleClose}
            disabled={status === 'checking'}
            className="rounded-lg px-4 py-2 text-sm text-fg-secondary transition-colors hover:bg-bg-tertiary hover:text-fg-primary disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleCheck}
            disabled={status === 'checking' || status === 'success'}
            className="flex items-center gap-1.5 rounded-lg bg-stock-up px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stock-up/90 disabled:opacity-50"
          >
            {status === 'checking' ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 校验中</>
            ) : status === 'success' ? (
              <><CheckCircle2 className="h-3.5 w-3.5" /> 成功</>
            ) : (
              '确定'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/* -------------------- 菜单项（桌面右键菜单 / 移动端操作面板共用） -------------------- */
function FeedMenuItems({
  feedName,
  isActive,
  onTogglePin,
  onRename,
  onCopyLink,
  onSetMax,
  onToggleActive,
  onDelete,
  onRefresh,
  onClose,
  touch,
}: {
  feedName: string
  isActive: boolean
  onTogglePin: () => void
  onRename: () => void
  onCopyLink: () => void
  onSetMax: () => void
  onToggleActive: () => void
  onDelete: () => void
  /** 立即刷新该订阅源（不影响定时器节奏） */
  onRefresh: () => void
  onClose: () => void
  /** 触屏模式：加大行高，保证点击区域足够大 */
  touch: boolean
}) {
  const itemPad = touch ? 'px-4 py-3' : 'px-3 py-2'
  const itemClass = `flex w-full items-center gap-2 text-sm text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary ${itemPad}`
  const dangerClass = `flex w-full items-center gap-2 text-sm text-stock-down transition-colors hover:bg-bg-hover ${itemPad}`

  return (
    <>
      <button
        onClick={() => { onTogglePin(); onClose() }}
        className={itemClass}
      >
        <Pin className="h-3.5 w-3.5" />
        置顶
      </button>
      <button
        onClick={() => { onRename(); onClose() }}
        className={itemClass}
      >
        <Edit3 className="h-3.5 w-3.5" />
        重命名
      </button>
      <button
        onClick={() => { onCopyLink(); onClose() }}
        className={itemClass}
      >
        <Copy className="h-3.5 w-3.5" />
        复制源链接
      </button>
      <button
        onClick={() => { onSetMax(); onClose() }}
        className={itemClass}
      >
        <Settings className="h-3.5 w-3.5" />
        文章上限
      </button>
      <button
        onClick={() => { onRefresh(); onClose() }}
        className={itemClass}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        刷新此订阅
      </button>
      <button
        onClick={() => { onToggleActive(); onClose() }}
        className={itemClass}
      >
        {isActive ? <PauseCircle className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}
        {isActive ? '暂停更新' : '恢复更新'}
      </button>
      <div className="my-1 border-t border-border" />
      <button
        onClick={() => {
          if (confirm(`确定删除「${feedName}」吗？`)) onDelete()
          onClose()
        }}
        className={dangerClass}
      >
        <Trash2 className="h-3.5 w-3.5" />
        删除订阅
      </button>
    </>
  )
}

/* -------------------- 订阅源操作菜单：桌面跟随坐标浮层，移动端底部操作面板 -------------------- */
function ContextMenu({
  x, y, feedName, isActive, mobile, onTogglePin, onRename, onCopyLink, onSetMax, onToggleActive, onDelete, onRefresh, onClose,
}: {
  x: number; y: number; feedName: string
  isActive: boolean
  mobile: boolean
  onTogglePin: () => void
  onRename: () => void
  onCopyLink: () => void
  onSetMax: () => void
  onToggleActive: () => void
  onDelete: () => void
  onRefresh: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 点击菜单外部关闭。触屏 tap 会先合成 mousedown 再触发 click，
    // 打开菜单的那次点击完成于监听器挂载之前，不会被误关
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  const items = (
    <FeedMenuItems
      feedName={feedName}
      isActive={isActive}
      onTogglePin={onTogglePin}
      onRename={onRename}
      onCopyLink={onCopyLink}
      onSetMax={onSetMax}
      onToggleActive={onToggleActive}
      onDelete={onDelete}
      onRefresh={onRefresh}
      onClose={onClose}
      touch={mobile}
    />
  )

  // 移动端：底部操作面板（action sheet），不依赖 x/y 坐标
  // 触屏标准交互：拇指易触达、点击区域大、点遮罩关闭
  if (mobile) {
    return (
      <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
        <div
          ref={ref}
          className="w-full rounded-t-xl border-t border-border bg-bg-secondary px-2 pt-2 shadow-2xl"
          // 底部留出 iPhone 安全区（Home 条）的高度
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 顶部把手 + 订阅源名称：面板盖住了列表，标题让用户知道操作的是哪个源 */}
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
          <div className="mb-1 truncate px-4 text-xs text-fg-muted">{feedName}</div>
          {items}
        </div>
      </div>
    )
  }

  // 桌面端：跟随右键位置 / ⋯ 图标位置的浮层 -- 若是再加按钮，这个270需要根据按钮数量手动调整
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 270),
    top: Math.min(y, window.innerHeight - 270),
    zIndex: 50,
  }

  return (
    <div ref={ref} style={style} className="w-40 rounded-lg border border-border bg-bg-secondary py-1 shadow-2xl">
      {items}
    </div>
  )
}

/* -------------------- 第一栏：订阅源列表 -------------------- */
function FeedList({
  feeds,
  selectedFeedId,
  isMobile,
  lastUpdate,
  onSelect,
  onAddClick,
  onDeleteFeed,
  onTogglePin,
  onRenameFeed,
  onSetMaxFeed,
  onToggleActiveFeed,
  onRefreshAll,
  onRefreshFeed,
  onOpenSettings,
  refreshing,
  searchQuery,
  onSearchChange,
}: {
  feeds: Feed[]
  selectedFeedId: number | null
  isMobile: boolean
  /** 上次数据更新时间戳（来自 React Query dataUpdatedAt，含自动轮询） */
  lastUpdate: number
  onSelect: (id: number | null) => void
  onAddClick: () => void
  onDeleteFeed: (id: number) => void
  onTogglePin: (id: number) => void
  onRenameFeed: (id: number, name: string) => void
  onSetMaxFeed: (id: number, max: number) => void
  onToggleActiveFeed: (id: number) => void
  onRefreshAll: () => void
  /** 立即刷新单个订阅源（不影响定时器节奏） */
  onRefreshFeed: (id: number) => void
  onOpenSettings: () => void
  refreshing: boolean
  searchQuery: string
  onSearchChange: (q: string) => void
}) {
  const totalUnread = feeds.reduce((sum, f) => sum + (f.unreadCount || 0), 0)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; feed: Feed } | null>(null)
  const [renamingFeed, setRenamingFeed] = useState<Feed | null>(null)
  const [maxFeed, setMaxFeed] = useState<Feed | null>(null)

  // 每分钟刷新一次"x分钟前"的相对时间文案
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const lastUpdateText = formatRefreshTime(new Date(lastUpdate), now)

  const handleContextMenu = (e: React.MouseEvent, feed: Feed) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, feed })
  }

  // 点击 ⋯ 图标打开操作菜单：移动端没有右键，这是主要入口；桌面端作为补充入口
  const handleMoreClick = (e: React.MouseEvent, feed: Feed) => {
    e.stopPropagation()
    // 桌面端：菜单（宽 160px）右对齐显示在图标正下方；移动端渲染为底部面板，坐标不使用
    const rect = e.currentTarget.getBoundingClientRect()
    setCtxMenu({ x: Math.max(rect.right - 160, 8), y: rect.bottom + 4, feed })
  }

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      // 可加 toast 提示，暂用 console
      console.log('已复制:', url)
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5 sm:px-2 sm:py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fg-primary">
          订阅源
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenSettings}
            className="group relative flex h-6 w-6 items-center justify-center rounded bg-bg-tertiary text-fg-secondary transition-colors hover:text-stock-up"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="pointer-events-none absolute right-0 top-7 z-50 whitespace-nowrap rounded bg-bg-primary px-2 py-1 text-xs text-fg-primary opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              文章上限设置
            </span>
          </button>
          <button
            onClick={onAddClick}
            className="group relative flex h-6 w-6 items-center justify-center rounded bg-bg-tertiary text-fg-secondary transition-colors hover:text-stock-up"
          >
            <Plus className="h-4 w-4" />
            <span className="pointer-events-none absolute right-0 top-7 z-50 whitespace-nowrap rounded bg-bg-primary px-2 py-1 text-xs text-fg-primary opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              新增订阅
            </span>
          </button>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="border-b border-border px-2 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索全部文章..."
            className="w-full rounded-lg border border-border bg-bg-tertiary py-1.5 pl-8 pr-3 text-xs text-fg-primary placeholder:text-fg-muted focus:border-stock-up focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <button
          onClick={() => onSelect(null)}
          className={[
            'mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
            selectedFeedId === null
              ? 'bg-bg-tertiary text-fg-primary'
              : 'text-fg-secondary hover:bg-bg-hover',
          ].join(' ')}
        >
          <span>全部文章</span>
          <span className="text-xs tabular-nums text-stock-up">{totalUnread}</span>
        </button>

        <div className="my-2 border-t border-border" />

        {feeds.length === 0 && (
          <div className="p-4 text-center text-xs text-fg-muted">
            暂无订阅源，点击 + 添加
          </div>
        )}

        {feeds.map((feed) => (
          <div key={feed.id} className="group relative">
            <button
              onClick={() => onSelect(feed.id)}
              onContextMenu={(e) => handleContextMenu(e, feed)}
              className={[
                'flex w-full items-center rounded-lg py-2 pl-3 pr-2 text-sm transition-colors',
                selectedFeedId === feed.id
                  ? 'bg-bg-tertiary text-fg-primary'
                  : 'text-fg-secondary hover:bg-bg-hover',
                feed.active === false ? 'opacity-50' : '',
              ].join(' ')}
            >
              <span className="flex items-center gap-2 truncate">
                <span className="truncate">{feed.title}</span>
                {feed.active === false && (
                  <PauseCircle className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
                )}
                {feed.lastError && feed.active !== false && (
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                )}
              </span>
              {/* 未读数：纯数字，无背景块；移动端右侧 mr-6 给常驻的 ⋯ 按钮让位，桌面 hover 时淡出 */}
              <span
                className={[
                  'ml-auto shrink-0 pl-2 text-xs tabular-nums transition-opacity',
                  isMobile ? 'mr-6 text-stock-up' : 'text-stock-up group-hover:opacity-0',
                ].join(' ')}
              >
                {(feed.unreadCount || 0) > 0 ? feed.unreadCount : ''}
              </span>
            </button>
            {/* ⋯ 按钮：行按钮的兄弟节点（不能嵌套在 button 里） */}
            {/* 桌面 hover 时在数字原位淡入；触屏常驻显示在右侧 */}
            <button
              onClick={(e) => handleMoreClick(e, feed)}
              onContextMenu={(e) => { e.preventDefault(); handleContextMenu(e, feed) }}
              aria-label="订阅源操作"
              className={[
                'flex h-5 w-5 items-center justify-center rounded text-fg-muted transition-opacity hover:bg-bg-hover hover:text-fg-primary',
                isMobile
                  ? 'absolute right-1.5 top-1/2 -translate-y-1/2 opacity-100'
                  : 'absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100',
              ].join(' ')}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-fg-muted sm:px-4">
        <span className="truncate">{refreshing ? '更新中...' : `上次更新 ${lastUpdateText}`}</span>
        <button
          onClick={onRefreshAll}
          disabled={refreshing}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:text-fg-primary disabled:opacity-50"
          title="刷新全部订阅"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          feedName={ctxMenu.feed.title}
          isActive={ctxMenu.feed.active !== false}
          mobile={isMobile}
          onTogglePin={() => onTogglePin(ctxMenu.feed.id)}
          onRename={() => setRenamingFeed(ctxMenu.feed)}
          onCopyLink={() => handleCopyLink(ctxMenu.feed.url)}
          onSetMax={() => setMaxFeed(ctxMenu.feed)}
          onToggleActive={() => onToggleActiveFeed(ctxMenu.feed.id)}
          onDelete={() => onDeleteFeed(ctxMenu.feed.id)}
          onRefresh={() => onRefreshFeed(ctxMenu.feed.id)}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* 重命名弹窗 */}
      {renamingFeed && (
        <RenameModal
          feed={renamingFeed}
          onConfirm={(name) => {
            onRenameFeed(renamingFeed.id, name)
            setRenamingFeed(null)
          }}
          onClose={() => setRenamingFeed(null)}
        />
      )}

      {/* 文章上限弹窗 */}
      {maxFeed && (
        <SetMaxModal
          feed={maxFeed}
          onConfirm={(max) => {
            onSetMaxFeed(maxFeed.id, max)
            setMaxFeed(null)
          }}
          onClose={() => setMaxFeed(null)}
        />
      )}
    </div>
  )
}

/* -------------------- 重命名弹窗 -------------------- */
function RenameModal({
  feed,
  onConfirm,
  onClose,
}: {
  feed: Feed
  onConfirm: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(feed.title)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-bg-secondary p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-fg-primary">
          <Edit3 className="h-4 w-4 text-stock-up" />
          重命名订阅源
        </h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onConfirm(name.trim())}
          className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-fg-primary focus:border-stock-up focus:outline-none"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-fg-secondary hover:bg-bg-tertiary hover:text-fg-primary"
          >
            取消
          </button>
          <button
            onClick={() => name.trim() && onConfirm(name.trim())}
            disabled={!name.trim()}
            className="rounded-lg bg-stock-up px-4 py-2 text-sm font-medium text-white hover:bg-stock-up/90 disabled:opacity-50"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}

/* -------------------- 文章上限弹窗 -------------------- */
function SetMaxModal({
  feed,
  onConfirm,
  onClose,
}: {
  feed: Feed
  onConfirm: (max: number) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(String(feed.maxArticles || 500))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-bg-secondary p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-fg-primary">
          <Settings className="h-4 w-4 text-stock-up" />
          文章上限 - {feed.title}
        </h2>
        <p className="mb-3 text-xs text-fg-secondary">
          该订阅源保留的最大文章数。超出后自动清理最旧的文章（已读优先删除）。
        </p>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          min="50"
          max="5000"
          onKeyDown={(e) => {
            const n = parseInt(value, 10)
            if (e.key === 'Enter' && n >= 50) onConfirm(n)
          }}
          className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-fg-primary focus:border-stock-up focus:outline-none"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-fg-secondary hover:bg-bg-tertiary hover:text-fg-primary"
          >
            取消
          </button>
          <button
            onClick={() => {
              const n = parseInt(value, 10)
              if (n >= 50) onConfirm(n)
            }}
            disabled={!value || parseInt(value, 10) < 50}
            className="rounded-lg bg-stock-up px-4 py-2 text-sm font-medium text-white hover:bg-stock-up/90 disabled:opacity-50"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}

/* -------------------- 第二栏：文章列表 -------------------- */
function ArticleList({
  articles,
  selectedArticleId,
  onSelect,
  readFilter,
  onReadFilterChange,
  onBack,
  showBack,
  counts,
}: {
  articles: Article[]
  selectedArticleId: number | null
  onSelect: (article: Article) => void
  readFilter: ReadFilter
  onReadFilterChange: (filter: ReadFilter) => void
  onBack?: () => void
  showBack?: boolean
  counts: { unread: number; today: number; read: number; all: number }
}) {
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const sortedArticles = sortOrder === 'desc' ? articles : [...articles].reverse()

  const tabs: { key: ReadFilter; label: string; count: number }[] = [
    { key: 'unread', label: '未读', count: counts.unread },
    { key: 'today', label: '今日', count: counts.today },
    { key: 'read', label: '已读', count: counts.read },
    { key: 'all', label: '全部', count: counts.all },
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="mt-2 flex items-center gap-1">
          {showBack && onBack && (
            <button onClick={onBack} className="flex items-center gap-1 mr-1 text-xs text-fg-secondary hover:text-fg-primary">
              <ChevronLeft className="h-4 w-4" />
              返回
            </button>
          )}
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onReadFilterChange(tab.key)}
              className={[
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                readFilter === tab.key
                  ? 'bg-stock-up/15 text-stock-up'
                  : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
              ].join(' ')}
            >
              {tab.label}
              <span className="ml-1 text-[10px] opacity-70">{tab.count}</span>
            </button>
          ))}
          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-secondary"
            title={sortOrder === 'desc' ? '当前：最新优先，点击切换为最旧优先' : '当前：最旧优先，点击切换为最新优先'}
          >
            {sortOrder === 'desc' ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sortedArticles.length === 0 && (
          <div className="p-8 text-center text-sm text-fg-muted">
            {readFilter === 'unread'
              ? '没有未读文章'
              : readFilter === 'today'
                ? '今日暂无文章'
                : readFilter === 'read'
                  ? '没有已读文章'
                  : '暂无文章'}
          </div>
        )}

        {sortedArticles.map((article) => (
          <div
            key={article.id}
            onClick={() => onSelect(article)}
            className={[
              'cursor-pointer border-b border-border px-3 py-2.5 transition-colors sm:px-4 sm:py-3',
              selectedArticleId === article.id
                ? 'bg-bg-tertiary'
                : 'hover:bg-bg-hover',
            ].join(' ')}
          >
            <div className="mb-1 flex items-center gap-2">
              {!article.read && (
                <span className="h-2 w-2 rounded-full bg-stock-up" />
              )}
              <span className="rounded bg-bg-tertiary px-2 py-0.5 text-[10px] text-fg-secondary sm:text-xs">
                {article.feedTitle || article.feedId}
              </span>
              <span className="ml-auto text-[10px] text-slate-600 sm:text-xs">
                {formatTime(article.publishedAt)}
              </span>
            </div>

            <h4 className={[
              'text-sm leading-snug',
              article.read ? 'font-normal text-fg-secondary' : 'font-medium text-fg-primary',
            ].join(' ')}>
              {article.title}
            </h4>

            {article.summary && (
              <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{article.summary}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* -------------------- 第三栏：阅读面板 -------------------- */
function ReadingPane({
  article,
  onBack,
  onNext,
}: {
  article: Article | null
  onBack?: () => void
  onNext?: () => void
}) {
  // 点击文章时调详情接口拿正文
  const { data: articleDetail, isLoading: contentLoading } = useQuery({
    queryKey: ['rssArticle', article?.id],
    queryFn: () => rssApi.getArticle(article!.id),
    enabled: !!article,
    staleTime: Infinity, // 文章内容不会变，不重复请求
  })

  // 切换文章时正文滚回顶部
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [article?.id])

  if (!article) {
    return (
      <div className="flex h-full items-center justify-center text-fg-muted">
        <div className="text-center">
          <Rss className="mx-auto mb-3 h-12 w-12 opacity-20" />
          <p className="text-sm">从左侧选择一篇文章开始阅读</p>
        </div>
      </div>
    )
  }

  const content = articleDetail?.content || article.content

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <div className="mb-2 flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="flex items-center gap-1 text-xs text-fg-secondary hover:text-fg-primary">
              <ChevronLeft className="h-4 w-4" />
              返回
            </button>
          )}
          <span className="rounded bg-bg-tertiary px-2 py-0.5 text-xs text-fg-secondary">
            {article.feedTitle || article.feedId}
          </span>
          <span className="text-xs text-fg-muted">{formatTime(article.publishedAt)}</span>
          <a href={article.link} target="_blank" rel="noreferrer" className="ml-auto text-fg-muted hover:text-fg-primary" title="查看原文">
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <h1 className="text-lg font-bold text-fg-primary sm:text-xl">{article.title}</h1>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
        <div className="prose prose-invert max-w-none">
          {contentLoading && !content ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-fg-muted" />
            </div>
          ) : content ? (
            <div
              className="article-content text-sm leading-relaxed text-fg-secondary"
              dangerouslySetInnerHTML={{ __html: fixArticleContent(content) }}
            />
          ) : (
            <p className="text-sm leading-relaxed text-fg-secondary">
              {article.summary || article.description || '暂无内容'}
            </p>
          )}
        </div>
      </div>

      {onNext && (
        <div className="flex-shrink-0 border-t border-border px-4 py-2 sm:px-6">
          <button
            onClick={onNext}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-bg-tertiary px-3 py-2 text-xs text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary"
          >
            下一篇
            <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
          </button>
        </div>
      )}
    </div>
  )
}

/* -------------------- 工具函数 -------------------- */
/**
 * 修正懒加载图片：将 data-src / data-original 等属性写入 src，
 * 并添加 referrerpolicy="no-referrer" 防止图片被防盗链拦截。
 */
function fixArticleContent(html: string): string {
  return html.replace(/<img\b([^>]*?)>/gi, (_match, attrs: string) => {
    const lazySrc = attrs.match(/data-(?:original|src|lazy-src|lazy)\s*=\s*["']([^"']+)["']/i)
    let fixed = attrs
    if (lazySrc) {
      fixed = fixed.replace(/\s+src\s*=\s*["'][^"']*["']/gi, '')
      fixed = fixed.replace(/\s+data-(?:original|src|lazy-src|lazy)\s*=\s*["'][^"']*["']/gi, '')
      fixed += ` src="${lazySrc[1]}"`
    }
    if (!/\breferrerpolicy\s*=/i.test(fixed)) {
      fixed += ' referrerpolicy="no-referrer"'
    }
    return `<img${fixed}>`
  })
}

function formatTime(t: string): string {
  const d = new Date(t)
  if (isNaN(d.getTime())) return t
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${min}`
}

/** 底部刷新时间文案：1小时内显示"x分钟前"，否则显示具体时间 */
function formatRefreshTime(refresh: Date, now: Date): string {
  const diff = now.getTime() - refresh.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  const hour = String(refresh.getHours()).padStart(2, '0')
  const min = String(refresh.getMinutes()).padStart(2, '0')
  return `${hour}:${min}`
}

/* -------------------- 拖拽手柄 -------------------- */
function ResizeHandle() {
  return <PanelResizeHandle className="w-1 bg-border transition-colors hover:bg-stock-up" />
}

/* -------------------- 页面组件 -------------------- */
/** 前端轮询默认间隔（毫秒）：settings 还没加载到时的兜底值。
 *  实际间隔由系统设置 refreshInterval 控制（设置弹窗可改，保存后立即生效） */
const DEFAULT_REFRESH_INTERVAL = 15 * 60 * 1000

export default function RSSReader() {
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [mobileView, setMobileView] = useState<MobileView>('feeds')
  const [readFilter, setReadFilter] = useState<ReadFilter>('unread')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  // 搜索状态 + 防抖
  const [searchInput, setSearchInput] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // 搜索模式下不按 feed 筛选
  const isSearching = debouncedQuery.length > 0

  // 拉取系统设置（仅取 refreshInterval 用于前端轮询间隔）
  // 设置弹窗保存后会 invalidate 这个 key，refetchInterval 会自动跟着变
  const { data: settings } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: () => systemApi.getSettings(),
  })
  const refreshInterval = settings?.refreshInterval
    ? settings.refreshInterval * 60 * 1000
    : DEFAULT_REFRESH_INTERVAL

  // 拉取订阅源列表（基本信息，未读数由独立轻量接口提供）
  // dataUpdatedAt：每次成功 fetch 的时间戳（含自动轮询），用于底部"上次更新"文案
  const { data: feeds, dataUpdatedAt: feedsUpdatedAt } = useQuery({
    queryKey: ['rssFeeds'],
    queryFn: () => rssApi.getFeeds(),
    refetchInterval: refreshInterval,
  })

  // 拉取各订阅源未读数（轻量，一条 GROUP BY）
  const { data: unreadCounts } = useQuery({
    queryKey: ['rssUnreadCounts'],
    queryFn: () => rssApi.getUnreadCounts(),
    refetchInterval: refreshInterval,
  })

  // 拉取文章列表（搜索模式下传 q，不按 feed 筛选）
  const { data: articlesData, isLoading: articlesLoading } = useQuery({
    queryKey: ['rssArticles', isSearching ? null : selectedFeedId, readFilter, debouncedQuery],
    queryFn: () =>
      rssApi.getArticles(
        isSearching ? undefined : selectedFeedId ?? undefined,
        readFilter,
        isSearching ? debouncedQuery : undefined,
      ),
    refetchInterval: refreshInterval,
  })

  // 刷新全部订阅
  const refreshAllMutation = useMutation({
    mutationFn: () => rssApi.refreshAllFeeds(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rssArticles'] })
      queryClient.invalidateQueries({ queryKey: ['rssFeeds'] })
      queryClient.invalidateQueries({ queryKey: ['rssUnreadCounts'] })
    },
  })

  // 立即刷新单个订阅源（独立 HTTP 请求，不影响后端定时调度器的节奏）
  const refreshFeedMutation = useMutation({
    mutationFn: (id: number) => rssApi.refreshFeed(id),
    onSuccess: (data) => {
      message.success(`「${data.feedName}」刷新完成，新增 ${data.newCount} 篇`)
      queryClient.invalidateQueries({ queryKey: ['rssArticles'] })
      queryClient.invalidateQueries({ queryKey: ['rssFeeds'] })
      queryClient.invalidateQueries({ queryKey: ['rssUnreadCounts'] })
    },
    onError: () => message.error('刷新失败，请稍后重试'),
  })

  // 删除订阅
  const deleteFeedMutation = useMutation({
    mutationFn: (id: number) => rssApi.deleteFeed(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rssFeeds'] })
      queryClient.invalidateQueries({ queryKey: ['rssArticles'] })
      queryClient.invalidateQueries({ queryKey: ['rssUnreadCounts'] })
    },
  })

  // 置顶
  const pinFeedMutation = useMutation({
    mutationFn: (id: number) => rssApi.togglePinFeed(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rssFeeds'] })
    },
  })

  // 重命名
  const renameFeedMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      rssApi.updateFeed(id, { title: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rssFeeds'] })
    },
  })

  // 设置单个源文章上限
  const setMaxFeedMutation = useMutation({
    mutationFn: ({ id, max }: { id: number; max: number }) =>
      rssApi.updateFeed(id, { maxArticles: max }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rssFeeds'] })
    },
  })

  // 暂停/恢复更新
  const toggleActiveMutation = useMutation({
    mutationFn: (feed: Feed) =>
      rssApi.updateFeed(feed.id, { active: !feed.active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rssFeeds'] })
    },
  })

  // 标记已读
  const markReadMutation = useMutation({
    mutationFn: (id: number) => rssApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rssArticles'] })
      queryClient.invalidateQueries({ queryKey: ['rssUnreadCounts'] })
    },
  })

  // 创建订阅
  const createFeedMutation = useMutation({
    mutationFn: ({ name, url }: { name: string; url: string }) =>
      rssApi.createFeed({ title: name, url, category: '自定义' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rssFeeds'] })
      queryClient.invalidateQueries({ queryKey: ['rssArticles'] })
      queryClient.invalidateQueries({ queryKey: ['rssUnreadCounts'] })
    },
  })

  const handleAddFeed = async (name: string, url: string) => {
    await createFeedMutation.mutateAsync({ name, url })
  }

  const handleSelectArticle = (article: Article) => {
    setSelectedArticle(article)
    if (!article.read) {
      markReadMutation.mutate(article.id)
    }
    if (isMobile) setMobileView('reader')
  }

  const handleSelectFeed = (id: number | null) => {
    setSelectedFeedId(id)
    // 选中 feed 时立即清除搜索（debouncedQuery 也要同步清，否则要等 300ms 防抖）
    if (searchInput || debouncedQuery) {
      setSearchInput('')
      setDebouncedQuery('')
    }
    if (isMobile) setMobileView('articles')
  }

  // 合并未读数：列表接口返回的 unreadCount 作兜底，轻量接口优先
  const feedList = (feeds ?? [])
    .map((f) => ({
      ...f,
      unreadCount: unreadCounts?.[String(f.id)] ?? f.unreadCount ?? 0,
    }))
    .sort((a, b) => {
      if (a.pinnedAt && b.pinnedAt) {
        return new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime()
      }
      if (a.pinnedAt) return -1
      if (b.pinnedAt) return 1
      return 0
    })

  // 合并文章的 feedTitle
  const articleList = (articlesData?.list ?? []).map((a) => {
    const feed = feedList.find((f) => f.id === a.feedId)
    return {
      ...a,
      feedTitle: feed?.title || '',
      summary: a.summary || a.description || '',
    }
  })

  // 跳转到下一篇，列表无限循环（保持当前排序与筛选）。
  // 注意：未读筛选下当前文章标记已读后会从列表消失（findIndex 返回 -1），
  // 此时它原来的下一篇已占据列表前部，直接取第一篇即可。
  const handleNextArticle = useCallback(() => {
    if (articleList.length === 0) return
    const idx = selectedArticle
      ? articleList.findIndex((a) => a.id === selectedArticle.id)
      : -1
    const next = idx < 0 ? articleList[0] : articleList[(idx + 1) % articleList.length]
    setSelectedArticle(next)
    if (!next.read) markReadMutation.mutate(next.id)
  }, [selectedArticle, articleList])

  // 文章计数（来自后端，不受 readFilter 影响）
  const articleCounts = {
    unread: articlesData?.unreadCount ?? 0,
    today: articlesData?.todayCount ?? 0,
    read: articlesData?.readCount ?? 0,
    all: articlesData?.totalCount ?? 0,
  }

  /* -------------------- 移动端 -------------------- */
  if (isMobile) {
    return (
      <>
        {/* 高度 = 动态视口 - 顶栏(3rem) - 内容区上下内边距(1rem) - 底部安全区，与 main 内容盒精确对齐 */}
        <div className="flex h-[calc(100dvh-4rem-env(safe-area-inset-bottom))] flex-col">
          {/* <div className="mb-2 flex items-center justify-between">
            <h1 className="page-title mb-0">RSS 资讯</h1>
            <button
              onClick={() => refreshAllMutation.mutate()}
              disabled={refreshAllMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-bg-tertiary px-3 py-1.5 text-xs text-fg-secondary hover:text-fg-primary"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshAllMutation.isPending ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div> */}

          <div className="flex-1 overflow-hidden rounded-card border border-border bg-bg-secondary">
            {mobileView === 'feeds' && (
              <FeedList
                feeds={feedList}
                selectedFeedId={selectedFeedId}
                isMobile={isMobile}
                lastUpdate={feedsUpdatedAt}
                onSelect={handleSelectFeed}
                onAddClick={() => setShowAddModal(true)}
                onDeleteFeed={(id) => deleteFeedMutation.mutate(id)}
                onTogglePin={(id) => pinFeedMutation.mutate(id)}
                onRenameFeed={(id, name) => renameFeedMutation.mutate({ id, name })}
                onSetMaxFeed={(id, max) => setMaxFeedMutation.mutate({ id, max })}
                onToggleActiveFeed={(id) => {
                  const feed = feedList.find((f) => f.id === id)
                  if (feed) toggleActiveMutation.mutate(feed)
                }}
                onRefreshAll={() => refreshAllMutation.mutate()}
                onRefreshFeed={(id) => refreshFeedMutation.mutate(id)}
                onOpenSettings={() => setShowSettingsModal(true)}
                refreshing={refreshAllMutation.isPending}
                searchQuery={searchInput}
                onSearchChange={setSearchInput}
              />
            )}
            {mobileView === 'articles' && (
              <ArticleList
                articles={articleList}
                selectedArticleId={selectedArticle?.id ?? null}
                onSelect={handleSelectArticle}
                readFilter={readFilter}
                onReadFilterChange={setReadFilter}
                onBack={() => setMobileView('feeds')}
                showBack
                counts={articleCounts}
              />
            )}
            {mobileView === 'reader' && (
              <ReadingPane
                article={selectedArticle}
                onBack={() => setMobileView('articles')}
                onNext={articleList.length > 0 ? handleNextArticle : undefined}
              />
            )}
          </div>
        </div>
        <AddFeedModal open={showAddModal} onClose={() => setShowAddModal(false)} onAdd={handleAddFeed} />
        <SettingsModal open={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
      </>
    )
  }

  /* -------------------- 桌面端 -------------------- */
  return (
    <>
      <div className="flex h-[calc(100dvh-5.5rem)] flex-col">
        {/* <div className="mb-3 flex items-center justify-between">
          <h1 className="page-title mb-0">RSS 资讯</h1>
          <button
            onClick={() => refreshAllMutation.mutate()}
            disabled={refreshAllMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-bg-tertiary px-3 py-1.5 text-xs text-fg-secondary hover:text-fg-primary"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshAllMutation.isPending ? 'animate-spin' : ''}`} />
            刷新全部
          </button>
        </div> */}

        <div className="flex-1 overflow-hidden rounded-card border border-border bg-bg-secondary">
          <PanelGroup orientation="horizontal">
            <Panel defaultSize={18} minSize={12}>
              <FeedList
                feeds={feedList}
                selectedFeedId={selectedFeedId}
                isMobile={isMobile}
                lastUpdate={feedsUpdatedAt}
                onSelect={handleSelectFeed}
                onAddClick={() => setShowAddModal(true)}
                onDeleteFeed={(id) => deleteFeedMutation.mutate(id)}
                onTogglePin={(id) => pinFeedMutation.mutate(id)}
                onRenameFeed={(id, name) => renameFeedMutation.mutate({ id, name })}
                onSetMaxFeed={(id, max) => setMaxFeedMutation.mutate({ id, max })}
                onToggleActiveFeed={(id) => {
                  const feed = feedList.find((f) => f.id === id)
                  if (feed) toggleActiveMutation.mutate(feed)
                }}
                onRefreshAll={() => refreshAllMutation.mutate()}
                onRefreshFeed={(id) => refreshFeedMutation.mutate(id)}
                onOpenSettings={() => setShowSettingsModal(true)}
                refreshing={refreshAllMutation.isPending}
                searchQuery={searchInput}
                onSearchChange={setSearchInput}
              />
            </Panel>

            <ResizeHandle />

            <Panel defaultSize={32} minSize={20}>
              {articlesLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-fg-muted" />
                </div>
              ) : (
                <ArticleList
                  articles={articleList}
                  selectedArticleId={selectedArticle?.id ?? null}
                  onSelect={handleSelectArticle}
                  readFilter={readFilter}
                  onReadFilterChange={setReadFilter}
                  counts={articleCounts}
                />
              )}
            </Panel>

            <ResizeHandle />

            <Panel defaultSize={50} minSize={25}>
              <ReadingPane article={selectedArticle} />
            </Panel>
          </PanelGroup>
        </div>
      </div>
      <AddFeedModal open={showAddModal} onClose={() => setShowAddModal(false)} onAdd={handleAddFeed} />
      <SettingsModal open={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
    </>
  )
}

/* -------------------- 设置弹窗 -------------------- */
function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: settings, isLoading } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: () => systemApi.getSettings(),
    enabled: open,
  })
  const [maxArticles, setMaxArticles] = useState('500')
  const [refreshInterval, setRefreshInterval] = useState('15')

  useEffect(() => {
    if (settings) {
      setMaxArticles(String(settings.maxArticlesPerFeed))
      setRefreshInterval(String(settings.refreshInterval))
    }
  }, [settings])

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<SystemSettings>) =>
      systemApi.updateSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemSettings'] })
      onClose()
    },
  })

  if (!open) return null

  const handleSave = () => {
    const payload: Record<string, number> = {}
    const maxVal = parseInt(maxArticles, 10)
    const intervalVal = parseInt(refreshInterval, 10)
    if (maxVal >= 50) payload.maxArticlesPerFeed = maxVal
    if (intervalVal >= 5 && intervalVal <= 360) payload.refreshInterval = intervalVal
    if (Object.keys(payload).length > 0) updateMutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-bg-secondary p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-fg-primary">
          <Settings className="h-4 w-4 text-stock-up" />
          设置
        </h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-fg-muted" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-fg-secondary">刷新间隔（分钟）</label>
              <input
                type="number"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(e.target.value)}
                min="5"
                max="360"
                className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-fg-primary focus:border-stock-up focus:outline-none"
              />
              <p className="mt-1 text-xs text-fg-muted">后端定时抓取 RSS 的间隔，5-360 分钟，默认 15</p>
            </div>
            <div>
              <label className="mb-1 block text-xs text-fg-secondary">每源文章上限</label>
              <input
                type="number"
                value={maxArticles}
                onChange={(e) => setMaxArticles(e.target.value)}
                min="50"
                max="5000"
                className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-fg-primary focus:border-stock-up focus:outline-none"
              />
              <p className="mt-1 text-xs text-fg-muted">超出后自动清理最旧文章（已读优先），默认 500</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm text-fg-secondary hover:bg-bg-tertiary hover:text-fg-primary"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="rounded-lg bg-stock-up px-4 py-2 text-sm font-medium text-white hover:bg-stock-up/90 disabled:opacity-50"
              >
                {updateMutation.isPending ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
