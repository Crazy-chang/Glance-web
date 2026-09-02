import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Rss, TrendingUp, Globe } from 'lucide-react'

const navItems = [
  { to: '/', label: '大盘总览', icon: LayoutDashboard },
  { to: '/rss', label: 'RSS 资讯', icon: Rss },
  { to: '/links', label: '网站导航', icon: Globe },
] as const

const VERSION = 'v0.1.0'
const COLOR_PRIMARY = '#ef4444'

export default function TopNav() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-bg-secondary px-3 sm:h-14 sm:px-6">
      {/* Logo */}
      <div className="flex items-center gap-1.5">
        <TrendingUp className="h-5 w-5" style={{ color: COLOR_PRIMARY }} />
        <span className="text-base font-bold text-fg-primary sm:text-lg">Glance</span>
      </div>

      {/* 导航菜单 */}
      <nav className="flex items-center gap-0.5 sm:gap-1">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              style={({ isActive }) => (isActive ? { color: COLOR_PRIMARY } : undefined)}
              className={({ isActive }) =>
                [
                  'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors sm:px-4 sm:py-2',
                  isActive
                    ? 'bg-bg-tertiary'
                    : 'text-fg-secondary hover:bg-bg-hover hover:text-fg-primary',
                ].join(' ')
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* 版本号（移动端隐藏） */}
      <div className="flex w-20 justify-end">
        <span className="hidden text-xs text-fg-muted sm:inline">{VERSION}</span>
      </div>
    </header>
  )
}
