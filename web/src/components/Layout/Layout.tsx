import { Outlet } from 'react-router-dom'
import TopNav from './TopNav'

/**
 * 布局组件
 * 顶部导航栏 + 下方内容区（通过 Outlet 渲染子路由）
 */
export default function Layout() {
  return (
    // h-dvh：动态视口高度，iOS Safari 底部工具栏展开/收起时自动跟随，避免内容被挡住
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-bg-primary">
      {/* 顶部导航栏 */}
      <TopNav />

      {/* 下方内容区：底部预留 iPhone Home 指示条的安全距离 */}
      <main className="flex-1 overflow-y-auto px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:px-4 sm:pt-4 sm:pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
    </div>
  )
}
