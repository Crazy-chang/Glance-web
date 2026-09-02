import { Outlet } from 'react-router-dom'
import TopNav from './TopNav'

/**
 * 布局组件
 * 顶部导航栏 + 下方内容区（通过 Outlet 渲染子路由）
 */
export default function Layout() {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-bg-primary">
      {/* 顶部导航栏 */}
      <TopNav />

      {/* 下方内容区 */}
      <main className="flex-1 overflow-y-auto p-2 sm:p-4">
        <Outlet />
      </main>
    </div>
  )
}
