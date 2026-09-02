import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Button,
  Card,
  Row,
  Col,
  Space,
  Slider,
  Empty,
  message,
  Popconfirm,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  FireOutlined,
} from '@ant-design/icons'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import dayjs from 'dayjs'
import { marketRecord } from '@/api/endpoints'
import type { MarketRecord, MarketRecordPayload } from '@/types'

/* ============================================================
 *  常量 / 工具函数
 * ============================================================ */
const RED = '#ef4444'
const GREEN = '#22c55e'

/** 情绪温度对应色值 */
function sentimentHex(value: number): string {
  if (value > 70) return '#ef4444'
  if (value > 55) return '#f97316'
  if (value > 45) return '#eab308'
  if (value > 30) return '#3b82f6'
  return '#2563eb'
}

/** 情绪温度标签 */
function sentimentLabel(value: number): string {
  if (value > 70) return '过热'
  if (value > 55) return '偏热'
  if (value > 45) return '中性'
  if (value > 30) return '偏冷'
  return '冰点'
}

/** 指数涨跌颜色 */
function indexChangeColor(n: number): string {
  if (n > 0) return RED
  if (n < 0) return GREEN
  return 'rgba(255,255,255,0.65)'
}

/** 指数涨跌格式化 */
function fmtIndexChange(n: number): string {
  return (n > 0 ? '+' : '') + n.toFixed(2) + '%'
}

/** 空 payload（用于新增） */
function emptyForm(): MarketRecordPayload {
  return {
    date: dayjs().format('YYYY-MM-DD'),
    indexValue: 0,
    indexChange: 0,
    amount: 0,
    volumeChange: '0',
    upCount: 0,
    downCount: 0,
    limitUp: 0,
    limitDown: 0,
    brokenRate: 0,
    firstBoard: 0,
    secondBoard: 0,
    thirdBoard: 0,
    multiBoard: 0,
    sentiment: 50,
    review: '',
    tomorrowPlan: '',
    remark: '',
  }
}

/* ============================================================
 *  情绪温度趋势图（recharts）
 * ============================================================ */
function SentimentChartCard({ records }: { records: MarketRecord[] }) {
  // 按日期升序（左旧右新）用于绘图
  const chartData = useMemo(
    () =>
      [...records]
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((r) => ({ date: r.date, sentiment: r.sentiment })),
    [records],
  )

  // 最新一条（日期最大）
  const latest = useMemo(() => {
    if (records.length === 0) return null
    return [...records].sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  }, [records])

  return (
    <Card
      title={
        <Space>
          <FireOutlined style={{ color: '#f59e0b' }} />
          <span>市场情绪热度</span>
        </Space>
      }
      extra={
        latest ? (
          <Space align="baseline" size={6}>
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: sentimentHex(latest.sentiment),
                lineHeight: 1,
              }}
            >
              {latest.sentiment}
            </span>
            <span style={{ fontSize: 12, color: sentimentHex(latest.sentiment) }}>
              {sentimentLabel(latest.sentiment)}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              ({latest.date})
            </span>
          </Space>
        ) : null
      }
    >
      {chartData.length === 0 ? (
        <Empty description="暂无温度数据，请在下方表格中填写" />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
            >
              <defs>
                <linearGradient id="sentimentLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="50%" stopColor="#eab308" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3d" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(v: string) => v.slice(5)}
                axisLine={{ stroke: '#2a2e3d' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#1f2330',
                  border: '1px solid #2a2e3d',
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: '#e2e8f0' }}
                formatter={(value) => [value, '情绪温度']}
                labelFormatter={(label) => `日期: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="sentiment"
                stroke="url(#sentimentLine)"
                strokeWidth={2}
                dot={{ r: 3, fill: '#e2e8f0', stroke: '#0f1117', strokeWidth: 0.5 }}
                activeDot={{ r: 5, stroke: '#facc15', strokeWidth: 1 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 10,
              color: 'rgba(255,255,255,0.35)',
              marginTop: 4,
            }}
          >
            <span>冰点</span>
            <span>中性</span>
            <span>过热</span>
          </div>
        </>
      )}
    </Card>
  )
}

/* ============================================================
 *  当日复盘输入区（绑定最新记录，失焦保存）
 * ============================================================ */
function ReviewPanel({
  latest,
  onSave,
}: {
  latest: MarketRecord | null
  onSave: (field: 'review' | 'tomorrowPlan', value: string) => void
}) {
  const [reviewDraft, setReviewDraft] = useState(latest?.review ?? '')
  const [planDraft, setPlanDraft] = useState(latest?.tomorrowPlan ?? '')

  useEffect(() => {
    setReviewDraft(latest?.review ?? '')
    setPlanDraft(latest?.tomorrowPlan ?? '')
  }, [latest?.id, latest?.review, latest?.tomorrowPlan])

  const labelStyle: React.CSSProperties = {
    marginBottom: 4,
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
  }

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <div style={labelStyle}>当日复盘</div>
        <Input.TextArea
          rows={4}
          value={reviewDraft}
          onChange={(e) => setReviewDraft(e.target.value)}
          onBlur={() => {
            if (reviewDraft !== (latest?.review ?? '')) onSave('review', reviewDraft)
          }}
          placeholder="输入当日复盘..."
        />
      </div>
      <div>
        <div style={labelStyle}>第二天操作</div>
        <Input.TextArea
          rows={4}
          value={planDraft}
          onChange={(e) => setPlanDraft(e.target.value)}
          onBlur={() => {
            if (planDraft !== (latest?.tomorrowPlan ?? '')) onSave('tomorrowPlan', planDraft)
          }}
          placeholder="输入第二天操作计划..."
        />
      </div>
      <div hidden={!latest?.date} style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
        {latest?.date} 记录
      </div>
    </>
  )
}

/* ============================================================
 *  表格内温度计内联编辑（失焦保存）
 * ============================================================ */
function SentimentCell({
  value,
  onSave,
}: {
  value: number
  onSave: (v: number) => void
}) {
  const [draft, setDraft] = useState<number>(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <Space size={4}>
      <InputNumber
        size="small"
        min={0}
        max={100}
        value={draft}
        onChange={(n) => setDraft(n ?? 0)}
        onBlur={() => {
          if (draft !== value) onSave(draft)
        }}
        style={{ width: 64 }}
      />
      <span style={{ color: sentimentHex(draft), fontSize: 11 }}>
        {sentimentLabel(draft)}
      </span>
    </Space>
  )
}

/* ============================================================
 *  弹窗内情绪温度滑块 + 数字输入组合
 * ============================================================ */
function SentimentSliderInput({
  value,
  onChange,
}: {
  value?: number
  onChange?: (v: number) => void
}) {
  const v = value ?? 0
  return (
    <Space align="center" style={{ width: '100%' }}>
      <Slider
        min={0}
        max={100}
        value={v}
        onChange={(n) => onChange?.(n)}
        style={{ minWidth: 240, flex: 1 }}
      />
      <InputNumber
        min={0}
        max={100}
        value={v}
        onChange={(n) => onChange?.(n ?? 0)}
        style={{ width: 80 }}
      />
      <span
        style={{
          color: sentimentHex(v),
          fontSize: 12,
          width: 36,
          textAlign: 'center',
        }}
      >
        {sentimentLabel(v)}
      </span>
    </Space>
  )
}

/* ============================================================
 *  新增 / 编辑弹窗
 * ============================================================ */
function RecordFormModal({
  open,
  initial,
  editingId,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean
  initial: MarketRecordPayload
  editingId: number | null
  submitting: boolean
  onClose: () => void
  onSubmit: (payload: MarketRecordPayload) => void
}) {
  const [form] = Form.useForm<MarketRecordPayload>()

  useEffect(() => {
    if (open) {
      form.setFieldsValue(initial)
    }
  }, [open, initial, form])

  const handleFinish = (values: MarketRecordPayload) => {
    onSubmit(values)
  }

  return (
    <Modal
      open={open}
      title={editingId ? '编辑行情记录' : '新增行情记录'}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={640}
      okText="保存"
      cancelText="取消"
      mask={{ closable: false }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={initial}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="date"
              label="日期"
              rules={[{ required: true, message: '请选择日期' }]}
              getValueProps={(val) => ({ value: val ? dayjs(val) : undefined })}
              normalize={(val) => (val ? dayjs(val).format('YYYY-MM-DD') : '')}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="indexValue" label="指数点位">
              <InputNumber step={0.01} min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="indexChange" label="指数涨跌 (%)">
              <InputNumber step={0.01} style={{ width: '100%' }} />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item name="amount" label="成交额 (亿)">
              <InputNumber step={0.01} min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="volumeChange" label="缩/放量（亿）">
              <Input placeholder="如 放量 / 缩量 / 持平" />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item name="upCount" label="上涨数">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="downCount" label="下跌数">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item name="limitUp" label="涨停数">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="limitDown" label="跌停数">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item name="brokenRate" label="炸板率 (%)">
              <InputNumber step={1} min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="firstBoard" label="一板数">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item name="secondBoard" label="二板数">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="thirdBoard" label="三板数">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item name="multiBoard" label="高度板数">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="remark" label="备注">
              <Input placeholder="可留空" />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item name="sentiment" label="情绪温度">
              <SentimentSliderInput />
            </Form.Item>
          </Col>
        </Row>

        <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
          当日复盘、第二天操作请在上方温度计区域编辑。
        </div>
      </Form>
    </Modal>
  )
}

/* ============================================================
 *  页面组件
 * ============================================================ */
export default function MarketOverview() {
  const queryClient = useQueryClient()
  const [messageApi, contextHolder] = message.useMessage()

  /* -------- 日期范围筛选 -------- */
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)

  /* -------- 分页状态 -------- */
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  /* -------- 弹窗状态 -------- */
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formInitial, setFormInitial] = useState<MarketRecordPayload>(emptyForm())

  /* -------- 数据查询（全量拉取，前端筛选+分页） -------- */
  const { data: records, isLoading: recordsLoading } = useQuery({
    queryKey: ['marketRecords'],
    queryFn: () => marketRecord.getRecords(),
  })

  // 表格按日期倒序
  const sortedRecords = useMemo(
    () => [...(records ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [records],
  )

  // 日期范围筛选
  const filteredRecords = useMemo(() => {
    if (!dateRange) return sortedRecords
    const [start, end] = dateRange
    return sortedRecords.filter((r) => r.date >= start && r.date <= end)
  }, [sortedRecords, dateRange])

  // 当前页数据（温度计跟随分页）
  const pageRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRecords.slice(start, start + pageSize)
  }, [filteredRecords, currentPage, pageSize])

  // 最新记录（日期最大）
  const latestRecord = useMemo(() => {
    if (!records || records.length === 0) return null
    return [...records].sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  }, [records])

  /* -------- 变更操作 -------- */
  const createMutation = useMutation({
    mutationFn: (payload: MarketRecordPayload) => marketRecord.create(payload),
    onSuccess: () => {
      messageApi.success('记录已创建')
      queryClient.invalidateQueries({ queryKey: ['marketRecords'] })
      closeModal()
    },
    onError: (err) => {
      messageApi.error(err instanceof Error ? err.message : '创建失败')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: MarketRecordPayload }) =>
      marketRecord.update(id, payload),
    onSuccess: () => {
      messageApi.success('记录已更新')
      queryClient.invalidateQueries({ queryKey: ['marketRecords'] })
    },
    onError: (err) => {
      messageApi.error(err instanceof Error ? err.message : '更新失败')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => marketRecord.remove(id),
    onSuccess: () => {
      messageApi.success('记录已删除')
      queryClient.invalidateQueries({ queryKey: ['marketRecords'] })
    },
    onError: (err) => {
      messageApi.error(err instanceof Error ? err.message : '删除失败')
    },
  })

  /* -------- 内联更新（单个字段） -------- */
  function inlineUpdate(
    record: MarketRecord,
    field: keyof MarketRecordPayload,
    value: string | number,
  ) {
    if (!record.id) return
    const { id, createdAt, updatedAt, ...rest } = record
    updateMutation.mutate({ id, payload: { ...rest, [field]: value } })
  }

  /* -------- 复盘区保存 -------- */
  function handleReviewSave(field: 'review' | 'tomorrowPlan', value: string) {
    if (!latestRecord?.id) return
    const { id, createdAt, updatedAt, ...rest } = latestRecord
    updateMutation.mutate({ id, payload: { ...rest, [field]: value } })
  }

  /* -------- 弹窗控制 -------- */
  function openCreate() {
    setFormInitial(emptyForm())
    setEditingId(null)
    setModalOpen(true)
  }

  function openEdit(record: MarketRecord) {
    const { id, createdAt, updatedAt, ...rest } = record
    setFormInitial(rest)
    setEditingId(record.id ?? null)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
  }

  function handleSubmit(payload: MarketRecordPayload) {
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function handleDelete(record: MarketRecord) {
    if (!record.id) return
    deleteMutation.mutate(record.id)
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  /* -------- 表格列定义 -------- */
  const columns: ColumnsType<MarketRecord> = [
    { title: '日期', dataIndex: 'date', key: 'date', width: 110, fixed: 'left' },
    {
      title: '指数',
      dataIndex: 'indexValue',
      key: 'indexValue',
      align: 'right',
      width: 90,
      render: (v: number) => `${v.toFixed(2)}`,
    },
    {
      title: '指数涨跌',
      dataIndex: 'indexChange',
      key: 'indexChange',
      align: 'right',
      width: 90,
      render: (v: number) => (
        <span style={{ color: indexChangeColor(v) }}>{fmtIndexChange(v)}</span>
      ),
    },
    {
      title: '成交额(亿)',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      width: 90,
      render: (v: number) => `${v.toFixed(2)}`,
    },
    {
      title: '缩/放量(亿)',
      dataIndex: 'volumeChange',
      key: 'volumeChange',
      align: 'center',
      width: 90,
      render: (v: string) => {
        const c = v.includes('+') ? RED : v.includes('-') ? GREEN : 'rgba(255,255,255,0.65)'
        return <span style={{ color: c }}>{v}</span>
      },
    },
    {
      title: '上涨',
      dataIndex: 'upCount',
      key: 'upCount',
      align: 'right',
      width: 70,
      render: (v: number) => <span style={{ color: RED }}>{v}</span>,
    },
    {
      title: '下跌',
      dataIndex: 'downCount',
      key: 'downCount',
      align: 'right',
      width: 70,
      render: (v: number) => <span style={{ color: GREEN }}>{v}</span>,
    },
    {
      title: '涨停',
      dataIndex: 'limitUp',
      key: 'limitUp',
      align: 'right',
      width: 70,
      render: (v: number) => <span style={{ color: RED }}>{v}</span>,
    },
    {
      title: '跌停',
      dataIndex: 'limitDown',
      key: 'limitDown',
      align: 'right',
      width: 70,
      render: (v: number) => <span style={{ color: GREEN }}>{v}</span>,
    },
    {
      title: '炸板率',
      dataIndex: 'brokenRate',
      key: 'brokenRate',
      align: 'right',
      width: 80,
      render: (v: number) => `${v}%`,
    },
    { title: '一板', dataIndex: 'firstBoard', key: 'firstBoard', align: 'right', width: 70 },
    { title: '二板', dataIndex: 'secondBoard', key: 'secondBoard', align: 'right', width: 70 },
    { title: '三板', dataIndex: 'thirdBoard', key: 'thirdBoard', align: 'right', width: 70 },
    { title: '高度板', dataIndex: 'multiBoard', key: 'multiBoard', align: 'right', width: 70 },
    {
      title: '温度计',
      dataIndex: 'sentiment',
      key: 'sentiment',
      align: 'center',
      width: 130,
      render: (v: number, r: MarketRecord) => (
        <SentimentCell value={v} onSave={(n) => inlineUpdate(r, 'sentiment', n)} />
      ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 150,
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '操作',
      key: 'action',
      align: 'center',
      width: 100,
      fixed: 'right',
      render: (_, r: MarketRecord) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(r)}
          />
          <Popconfirm
            title="确定删除该记录？"
            okText="删除"
            cancelText="取消"
            onConfirm={() => handleDelete(r)}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={deleteMutation.isPending}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {contextHolder}

      {/* ============ 1. 温度计区域 ============ */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={14}>
          <SentimentChartCard records={pageRecords} />
        </Col>
        <Col span={10}>
          <ReviewPanel latest={latestRecord} onSave={handleReviewSave} />
        </Col>
      </Row>

      {/* ============ 2. 行情记录表 ============ */}
      <Card styles={{ body: { padding: 12 } }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <DatePicker.RangePicker
            value={dateRange ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : undefined}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')])
                setCurrentPage(1)
              } else {
                setDateRange(null)
                setCurrentPage(1)
              }
            }}
            placeholder={['开始日期', '结束日期']}
            allowClear
          />
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 12,
              color: 'rgba(255,255,255,0.45)',
            }}
          >
            共 {filteredRecords.length} 条
          </span>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增记录
          </Button>
        </div>

        <Table<MarketRecord>
          size="small"
          columns={columns}
          dataSource={filteredRecords}
          rowKey={(r) => String(r.id ?? r.date)}
          loading={recordsLoading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            showSizeChanger: true,
            pageSizeOptions: ['5', '10', '20', '50'],
            onChange: (page, size) => {
              setCurrentPage(page)
              setPageSize(size)
            },
            showTotal: (total) => `共 ${total} 条`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* ============ 3. 新增 / 编辑弹窗 ============ */}
      <RecordFormModal
        open={modalOpen}
        initial={formInitial}
        editingId={editingId}
        submitting={submitting}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

