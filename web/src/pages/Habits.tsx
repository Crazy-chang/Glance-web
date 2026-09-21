import { Card, Empty, Button, Input, Popconfirm, Modal, ColorPicker, message } from 'antd'
import { PlusOutlined, DeleteOutlined, CheckOutlined, CalendarOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { habits as habitsApi } from '@/api/endpoints'
import type { Habit, HabitCheck } from '@/types'

/* ============================================================
 *  习惯打卡
 *  - 数据通过后端接口持久化（/api/habits），每次打卡记录存 habit_checks 表
 *  - 卡片式：每个习惯一张卡，核心是一个大的「今日打卡」按钮
 *  - 显示连续天数（streak）与累计打卡次数
 * ============================================================ */

// 沿用项目深色主题的配色
const borderColor = '#2a2e3d'
const cardBg = '#1f2330'
const hoverBg = '#252937'
const descColor = 'rgba(255,255,255,0.45)'
const titleColor = 'rgba(255,255,255,0.85)'

/** 习惯颜色预设 */
const COLOR_PRESETS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899']

/** 本地时区日期 YYYY-MM-DD */
function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 计算连续打卡天数：今天未打卡则从昨天往前数（还没断） */
function calcStreak(checks: HabitCheck[] = []): number {
  const dates = new Set(checks.map((c) => c.date))
  const d = new Date()
  if (!dates.has(formatDate(d))) d.setDate(d.getDate() - 1)
  let streak = 0
  while (dates.has(formatDate(d))) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

/** 累计打卡次数 */
function calcTotal(checks: HabitCheck[] = []): number {
  return checks.length
}

/** 当月天数（month 为 1-12） */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * 生成月历格子：返回 42 个（6 周 × 7 天）元素，
 * null 表示空白占位，字符串为 YYYY-MM-DD 日期。
 * 首日按 getDay() 对齐（0=周日）。
 */
function buildCalendar(year: number, month: number): (string | null)[] {
  const cells: (string | null)[] = []
  const firstDay = new Date(year, month - 1, 1).getDay()
  for (let i = 0; i < firstDay; i++) cells.push(null)
  const total = daysInMonth(year, month)
  for (let d = 1; d <= total; d++) {
    cells.push(formatDate(new Date(year, month - 1, d)))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function Habits() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLOR_PRESETS[0])
  // 月历弹窗：calendarHabitId 非 null 表示打开；viewYear/viewMonth 为当前查看的月份
  // 用 id 而非 habit 对象：保证 useQuery 刷新后弹窗内显示的是最新数据
  const [calendarHabitId, setCalendarHabitId] = useState<number | null>(null)
  const [viewYear, setViewYear] = useState(0)
  const [viewMonth, setViewMonth] = useState(0)

  // 加载习惯列表（后端 Preload 一次性带出 checks，前端无需再单独查打卡记录）
  const { data: habits, isLoading } = useQuery({
    queryKey: ['habits'],
    queryFn: habitsApi.getAll,
    retry: false,
  })
  const list = habits ?? []

  const todayStr = formatDate(new Date())

  // 由 habits 派生"习惯+日期"集合，用于判断某天是否已打卡
  // checks 兜底空数组：后端新建习惯可能不带 checks 字段
  const checkedSet = useMemo(
    () => new Set(list.flatMap((h) => (h.checks ?? []).map((c) => `${h.id}_${c.date}`))),
    [list],
  )

  /** 新增习惯 */
  const addMutation = useMutation({
    mutationFn: (payload: { name: string; color: string }) => habitsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] })
      setName('')
    },
    onError: (err: Error) => message.error(err.message),
  })

  const handleAdd = () => {
    const n = name.trim()
    if (!n) {
      message.warning('请输入习惯名称')
      return
    }
    if (list.some((h) => h.name === n)) {
      message.warning('已存在同名习惯')
      return
    }
    addMutation.mutate({ name: n, color })
  }

  /** 打卡 / 取消打卡（date 为 YYYY-MM-DD，可用于任意日期补录/修改） */
  const toggleMutation = useMutation({
    mutationFn: ({ habitId, date }: { habitId: number; date: string }) =>
      habitsApi.toggle(habitId, date),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['habits'] }),
    onError: (err: Error) => message.error(err.message),
  })

  const toggleCheck = (habitId: number, date: string) => {
    toggleMutation.mutate({ habitId, date })
  }

  /** 打开月历（默认定位到当前月） */
  const openCalendar = (habit: Habit) => {
    const now = new Date()
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth() + 1)
    setCalendarHabitId(habit.id)
  }

  /** 切换月份（delta 为 ±1） */
  const shiftMonth = (delta: number) => {
    let m = viewMonth + delta
    let y = viewYear
    if (m < 1) {
      m = 12
      y -= 1
    } else if (m > 12) {
      m = 1
      y += 1
    }
    setViewMonth(m)
    setViewYear(y)
  }

  /** 删除习惯（后端级联删除其打卡记录） */
  const deleteMutation = useMutation({
    mutationFn: (id: number) => habitsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] })
      message.success('已删除')
    },
    onError: (err: Error) => message.error(err.message),
  })

  // 弹窗对应的习惯对象（从最新数据里取，保证打卡状态实时）
  const calendarHabit = useMemo(
    () => list.find((h) => h.id === calendarHabitId) ?? null,
    [list, calendarHabitId],
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          习惯打卡
        </h1>
      </div>

      {/* 新增习惯 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="新习惯名称，如：早起 / 运动 / 阅读"
          onPressEnter={handleAdd}
          style={{ maxWidth: 280 }}
        />
        {/* 拾色器：面板内可拖动选任意颜色，常用色在 presets 里 */}
        <ColorPicker
          value={color}
          onChange={(c) => setColor(c.toHexString())}
          presets={[{ label: '常用色', colors: COLOR_PRESETS }]}
          showText
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} loading={addMutation.isPending}>
          添加
        </Button>
      </div>

      <Card
        styles={{ body: { padding: 12, overflowY: 'auto', flex: 1, minHeight: 0 } }}
        style={{
          marginTop: 12,
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {isLoading ? null : list.length === 0 ? (
          <Empty description="暂无习惯，添加第一个开始打卡吧" />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
              gap: 8,
            }}
          >
            {list.map((habit) => {
              const doneToday = checkedSet.has(`${habit.id}_${todayStr}`)
              const streak = calcStreak(habit.checks)
              const total = calcTotal(habit.checks)
              return (
                <div
                  key={habit.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    padding: 14,
                    borderRadius: 8,
                    border: `1px solid ${borderColor}`,
                    background: cardBg,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `${habit.color}66`
                    e.currentTarget.style.background = hoverBg
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = borderColor
                    e.currentTarget.style.background = cardBg
                  }}
                >
                  {/* 名称 + 删除 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: habit.color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: titleColor,
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {habit.name}
                    </span>
                    <Popconfirm title="确定删除？" onConfirm={() => deleteMutation.mutate(habit.id)} okText="删除" cancelText="取消">
                      <button
                        type="button"
                        title="删除"
                        style={{
                          border: 'none',
                          borderRadius: 4,
                          padding: '2px 6px',
                          cursor: 'pointer',
                          background: 'transparent',
                          color: descColor,
                        }}
                      >
                        <DeleteOutlined style={{ fontSize: 12 }} />
                      </button>
                    </Popconfirm>
                  </div>

                  {/* 连续天数 */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color: habit.color, lineHeight: 1 }}>
                      {streak}
                    </span>
                    <span style={{ fontSize: 12, color: descColor }}>连续打卡</span>
                  </div>
                  <div style={{ fontSize: 12, color: descColor, marginTop: -8 }}>
                    累计 {total} 天
                  </div>

                  {/* 底部操作：打卡主按钮 + 日历按钮 */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => toggleCheck(habit.id, todayStr)}
                      style={{
                        flex: 1,
                        height: 40,
                        borderRadius: 6,
                        border: doneToday ? 'none' : `1px solid ${borderColor}`,
                        background: doneToday ? habit.color : 'transparent',
                        color: doneToday ? '#fff' : descColor,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        transition: 'all 0.2s',
                      }}
                    >
                      {doneToday ? (
                        <>
                          <CheckOutlined /> 今日已打卡
                        </>
                      ) : (
                        '打卡'
                      )}
                    </button>
                    <button
                      type="button"
                      title="查看/补录打卡日历"
                      onClick={() => openCalendar(habit)}
                      style={{
                        width: 40,
                        height: 40,
                        flexShrink: 0,
                        borderRadius: 6,
                        border: `1px solid ${borderColor}`,
                        background: 'transparent',
                        color: titleColor,
                        fontSize: 16,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                      }}
                    >
                      <CalendarOutlined />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* 月历弹窗：查看/补录任意日期的打卡 */}
      <Modal
        title={calendarHabit ? `${calendarHabit.name} · 打卡日历` : '打卡日历'}
        open={calendarHabitId !== null}
        onCancel={() => setCalendarHabitId(null)}
        footer={null}
        width={320}
      >
        {calendarHabit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* 月份切换 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                style={{
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: descColor,
                }}
              >
                <LeftOutlined style={{ fontSize: 12 }} />
              </button>
              <span style={{ fontSize: 14, fontWeight: 600, color: titleColor }}>
                {viewYear} 年 {viewMonth} 月
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                style={{
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: descColor,
                }}
              >
                <RightOutlined style={{ fontSize: 12 }} />
              </button>
            </div>

            {/* 星期表头（周日开头） */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 30px)', gap: 4 }}>
              {['日', '一', '二', '三', '四', '五', '六'].map((w) => (
                <span
                  key={w}
                  style={{ fontSize: 11, color: descColor, textAlign: 'center', lineHeight: '20px' }}
                >
                  {w}
                </span>
              ))}
            </div>

            {/* 日期格子：按当月实际天数动态生成 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 30px)', gap: 4 }}>
              {buildCalendar(viewYear, viewMonth).map((dateStr, i) => {
                if (dateStr === null) return <div key={i} />
                const isFuture = dateStr > todayStr
                const isToday = dateStr === todayStr
                const checked = checkedSet.has(`${calendarHabit.id}_${dateStr}`)
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isFuture}
                    title={dateStr}
                    onClick={() => toggleCheck(calendarHabit.id, dateStr)}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 4,
                      border: checked
                        ? 'none'
                        : isToday
                          ? `1px solid ${calendarHabit.color}`
                          : `1px solid ${borderColor}`,
                      background: checked ? calendarHabit.color : 'transparent',
                      color: checked ? '#fff' : descColor,
                      fontSize: 12,
                      cursor: isFuture ? 'default' : 'pointer',
                      padding: 0,
                      opacity: isFuture ? 0.3 : 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    {Number(dateStr.slice(8))}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
