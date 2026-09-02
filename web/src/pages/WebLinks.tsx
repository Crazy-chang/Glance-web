import { Input, Card, Empty, Spin, Button, Modal, Form, Popconfirm, message } from 'antd'
import { SearchOutlined, LinkOutlined, PlusOutlined, DeleteOutlined, EditOutlined, ThunderboltOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { webLinks as webLinksApi } from '@/api/endpoints'
import type { WebLink } from '@/types'

/** 新增弹窗表单值 */
interface LinkFormValues {
  title: string
  link: string
  description?: string
}

/** 快速添加的预设网站 */
interface PresetLink {
  name: string
  url: string
  desc: string
}

/** 常用财经网站预设（快速添加弹窗的数据源） */
const PRESET_LINKS: PresetLink[] = [
  { name: '综合指标网站', url: 'https://quant.zizizaizai.com', desc: 'A股指综合标数据平台' },
  { name: '晋级梯队', url: 'https://quant.zizizaizai.com/review/uplimit/promotion', desc: '前一天涨停晋级梯队指标' },
  { name: '东方财富', url: 'https://www.eastmoney.com', desc: 'A股行情、数据、资讯综合平台' },
  { name: '同花顺', url: 'https://www.10jqka.com.cn', desc: '行情交易、选股工具' },
  { name: '雪球', url: 'https://xueqiu.com', desc: '投资者社交平台' },
  { name: '财联社', url: 'https://www.cls.cn', desc: '7x24小时财经电报' },
  { name: '华尔街见闻', url: 'https://wallstreetcn.com', desc: '全球财经资讯' },
  { name: '第一财经', url: 'https://www.yicai.com', desc: '第一财经新闻' },
  { name: '金十数据', url: 'https://www.jin10.com/', desc: '金十数据平台' },
]

/**
 * URL 归一化，用于快速添加时的去重判断。
 * 忽略协议(http/https)、www 前缀、末尾斜杠、大小写的差异，
 * 例如 https://www.EastMoney.com/ 和 http://eastmoney.com 视为同一个网站。
 */
function normalizeUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
}

const colorPrimary = '#ef4444'
const borderColor = '#2a2e3d'
const cardBg = '#1f2330'
const hoverBorder = `${colorPrimary}66`
const hoverBg = '#252937'
const iconBg = '#181b24'
const titleColor = 'rgba(255,255,255,0.85)'
const descColor = 'rgba(255,255,255,0.45)'
const linkIconColor = 'rgba(255,255,255,0.3)'
const searchIconColor = 'rgba(255,255,255,0.35)'

// 触屏设备检测：手机/平板没有 hover，"移入才出现"的按钮改为常驻显示
// matchMedia('(hover: none)') 为 true 表示设备不支持鼠标悬浮（主流浏览器均支持该查询）
// 注意：只在模块加载时算一次，运行中不会变（手机不会突然接鼠标）
const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches

export default function WebLinks() {
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  // 快速添加弹窗
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  // 当前正在编辑的链接：null = 新增模式，非 null = 编辑模式（新增/编辑复用同一个弹窗）
  const [editingLink, setEditingLink] = useState<WebLink | null>(null)
  const [form] = Form.useForm<LinkFormValues>()
  const queryClient = useQueryClient()

  // 加载失败不提示，sites 为 undefined 时 list 兜底为空数组，按空数据渲染
  const { data: sites, isLoading } = useQuery({
    queryKey: ['webLinks'],
    queryFn: webLinksApi.getLinks,
    retry: false,
  })

  // 已存在链接的归一化 URL 集合，用于快速添加时按 URL 去重
  const existingUrls = useMemo(
    () => new Set((sites ?? []).map((s) => normalizeUrl(s.link))),
    [sites],
  )

  const list = useMemo(() => {
    const all: WebLink[] = sites ?? []
    const q = search.trim().toLowerCase()
    if (!q) return all
    return all.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q),
    )
  }, [sites, search])

  const createMutation = useMutation({
    mutationFn: (values: LinkFormValues) => webLinksApi.createLink(values),
    onSuccess: () => {
      message.success('添加成功')
      queryClient.invalidateQueries({ queryKey: ['webLinks'] })
      setModalOpen(false)
      form.resetFields()
    },
    onError: (err: Error) => message.error(err.message || '添加失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => webLinksApi.deleteLink(id),
    onSuccess: () => {
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['webLinks'] })
    },
    onError: (err: Error) => message.error(err.message || '删除失败'),
  })

  // 编辑提交：后端约定 PUT /web-links/update，id 放在请求体里
  const updateMutation = useMutation({
    mutationFn: ({ id, ...values }: LinkFormValues & { id: number }) =>
      webLinksApi.updateLink({ id, ...values }),
    onSuccess: () => {
      message.success('更新成功')
      queryClient.invalidateQueries({ queryKey: ['webLinks'] })
      setModalOpen(false)
      setEditingLink(null)
      form.resetFields()
    },
    onError: (err: Error) => message.error(err.message || '更新失败'),
  })

  /** 快速添加单个预设网站 */
  const addPresetMutation = useMutation({
    mutationFn: (preset: PresetLink) =>
      webLinksApi.createLink({ title: preset.name, link: preset.url, description: preset.desc }),
    onSuccess: () => {
      message.success('添加成功')
      queryClient.invalidateQueries({ queryKey: ['webLinks'] })
    },
    onError: (err: Error) => message.error(err.message || '添加失败'),
  })

  /** 打开新增弹窗：先清空表单和编辑状态，防止带出上一次编辑的数据 */
  const openCreate = () => {
    setEditingLink(null)
    form.resetFields()
    setModalOpen(true)
  }

  /** 打开编辑弹窗：记录当前编辑对象 + 回填表单 */
  const openEdit = (site: WebLink) => {
    setEditingLink(site)
    form.setFieldsValue({
      title: site.title,
      link: site.link,
      description: site.description ?? '',
    })
    setModalOpen(true)
  }

  /** 弹窗确定：根据 editingLink 判断提交更新还是创建 */
  const handleSubmit = () => {
    form
      .validateFields()
      .then((values) => {
        if (editingLink) updateMutation.mutate({ ...values, id: editingLink.id })
        else createMutation.mutate(values)
      })
      .catch(() => {})
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>网站快速导航</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
          >
            新增
          </Button>
          <Button
            icon={<ThunderboltOutlined />}
            onClick={() => setQuickAddOpen(true)}
          >
            快速添加
          </Button>
          <Input
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索网站名称或描述..."
            prefix={<SearchOutlined style={{ color: searchIconColor }} />}
            style={{ maxWidth: 360 }}
          />
        </div>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin tip="加载中..." />
          </div>
        ) : list.length === 0 ? (
          <Empty description={search ? '未找到匹配的网站' : '暂无导航，点击右上角「新增」添加'} />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 8,
            }}
          >
            {list.map((site) => (
              <div
                key={site.id}
                style={{ position: 'relative' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = hoverBorder
                  e.currentTarget.style.background = hoverBg
                  // 触屏设备按钮常驻显示，不参与 mouseenter 控制
                  // （触屏浏览器 tap 时会合成 mouseenter 事件，必须跳过）
                  if (!isTouchDevice) {
                    const actions = e.currentTarget.querySelector('.card-actions') as HTMLElement | null
                    if (actions) actions.style.opacity = '1'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = borderColor
                  e.currentTarget.style.background = cardBg
                  if (!isTouchDevice) {
                    const actions = e.currentTarget.querySelector('.card-actions') as HTMLElement | null
                    if (actions) actions.style.opacity = '0'
                  }
                }}
              >
                <a
                  href={site.link}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px',
                    borderRadius: 6,
                    border: `1px solid ${borderColor}`,
                    background: cardBg,
                    transition: 'all 0.2s',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 6,
                      background: iconBg,
                      fontSize: 14,
                      fontWeight: 600,
                      color: colorPrimary,
                    }}
                  >
                    {site.title.charAt(0)}
                  </div>
                  {/* 触屏上按钮常驻显示，右侧留白避免文字被按钮盖住 */}
                  <div style={{ minWidth: 0, flex: 1, paddingRight: isTouchDevice ? 56 : 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 13,
                        fontWeight: 500,
                        color: titleColor,
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {site.title}
                      </span>
                      <LinkOutlined style={{ fontSize: 11, color: linkIconColor, flexShrink: 0 }} />
                    </div>
                    <p
                      style={{
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: 11,
                        color: descColor,
                      }}
                    >
                      {site.description ?? ''}
                    </p>
                  </div>
                </a>
                {/* 操作按钮组：桌面端 hover 显示，触屏设备常驻且加大点击区域 */}
                <div
                  className="card-actions"
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    display: 'flex',
                    gap: 4,
                    opacity: isTouchDevice ? 1 : 0,
                    transition: 'opacity 0.2s',
                    zIndex: 1,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => openEdit(site)}
                    style={{
                      border: 'none',
                      borderRadius: 4,
                      // 触屏加大 padding：手指点击区域比鼠标光标大得多
                      padding: isTouchDevice ? '5px 8px' : '2px 6px',
                      cursor: 'pointer',
                      background: 'rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.6)',
                    }}
                    title="编辑"
                  >
                    <EditOutlined style={{ fontSize: 12 }} />
                  </button>
                  <Popconfirm
                    title="确定删除？"
                    onConfirm={() => deleteMutation.mutate(site.id)}
                    okText="删除"
                    cancelText="取消"
                  >
                    <button
                      type="button"
                      className="del-btn"
                      style={{
                        border: 'none',
                        borderRadius: 4,
                        padding: isTouchDevice ? '5px 8px' : '2px 6px',
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.6)',
                      }}
                      title="删除"
                    >
                      <DeleteOutlined style={{ fontSize: 12 }} />
                    </button>
                  </Popconfirm>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        title={editingLink ? '编辑导航链接' : '新增导航链接'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditingLink(null); form.resetFields() }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="名称"
            rules={[{ required: true, message: '请输入网站名称' }]}
          >
            <Input placeholder="如：东方财富" />
          </Form.Item>
          <Form.Item
            name="link"
            label="URL"
            rules={[
              { required: true, message: '请输入网址' },
              { pattern: /^https?:\/\//, message: '需以 http:// 或 https:// 开头' },
            ]}
          >
            <Input placeholder="https://www.eastmoney.com" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="简要描述（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 快速添加：预设常用网站，按 URL 去重，已添加的显示"已添加"并禁用 */}
      <Modal
        title="快速添加常用网站"
        open={quickAddOpen}
        onCancel={() => setQuickAddOpen(false)}
        width={560}
        footer={[
          <Button key="close" onClick={() => setQuickAddOpen(false)}>
            关闭
          </Button>,
        ]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
          {PRESET_LINKS.map((preset) => {
            const added = existingUrls.has(normalizeUrl(preset.url))
            return (
              <div
                key={preset.url}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: `1px solid ${borderColor}`,
                  background: cardBg,
                  opacity: added ? 0.55 : 1,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 6,
                    background: iconBg,
                    fontSize: 14,
                    fontWeight: 600,
                    color: colorPrimary,
                  }}
                >
                  {preset.name.charAt(0)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: titleColor }}>
                    {preset.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: descColor,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={preset.url}
                  >
                    {preset.desc}
                  </div>
                </div>
                {added ? (
                  <Button size="small" disabled icon={<CheckCircleOutlined />}>
                    已添加
                  </Button>
                ) : (
                  <Button
                    size="small"
                    type="primary"
                    loading={addPresetMutation.isPending}
                    onClick={() => addPresetMutation.mutate(preset)}
                  >
                    添加
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}
