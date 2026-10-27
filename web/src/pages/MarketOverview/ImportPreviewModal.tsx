import { useEffect, useMemo, useState } from 'react'
import { Modal, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { MarketRecordPayload } from '@/types'

/* ============================================================
 *  导入预览弹窗：解析结果列表 + 行勾选 + 冲突标记
 *  - 与现有记录日期冲突的行默认不勾选，勾选即表示覆盖导入
 * ============================================================ */

interface Row extends MarketRecordPayload {
  /** 行序号（原始解析顺序），用作 rowKey */
  _idx: number
  /** 是否与已有记录日期冲突 */
  _conflict: boolean
}

export default function ImportPreviewModal({
  open,
  records,
  existingDates,
  submitting,
  onClose,
  onConfirm,
}: {
  open: boolean
  records: MarketRecordPayload[]
  /** 当前已有记录的日期集合，用于冲突标记 */
  existingDates: Set<string>
  submitting: boolean
  onClose: () => void
  onConfirm: (selected: MarketRecordPayload[]) => void
}) {
  const [selectedKeys, setSelectedKeys] = useState<number[]>([])

  // 按日期升序展示，标记冲突
  const rows = useMemo<Row[]>(
    () =>
      records
        .map((r, i) => ({ ...r, _idx: i, _conflict: existingDates.has(r.date) }))
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    [records, existingDates],
  )

  const conflictCount = useMemo(() => rows.filter((r) => r._conflict).length, [rows])

  // 弹窗每次打开时重置选择：默认勾选所有非冲突行
  useEffect(() => {
    if (open) {
      setSelectedKeys(rows.filter((r) => !r._conflict).map((r) => r._idx))
    }
  }, [open, rows])

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedKeys.includes(r._idx)),
    [rows, selectedKeys],
  )
  const selectedConflictCount = selectedRows.filter((r) => r._conflict).length

  const columns: ColumnsType<Row> = [
    {
      title: '日期',
      dataIndex: 'date',
      width: 105,
      fixed: 'left',
      render: (v: string, r) => (
        <span style={r._conflict ? { color: '#f59e0b', fontWeight: 600 } : undefined}>
          {v}
        </span>
      ),
    },
    { title: '指数点位', dataIndex: 'indexValue', align: 'right', width: 90 },
    {
      title: '涨跌(%)',
      dataIndex: 'indexChange',
      align: 'right',
      width: 80,
      render: (v: number) => (
        <span style={{ color: v > 0 ? '#ef4444' : v < 0 ? '#22c55e' : undefined }}>
          {v > 0 ? `+${v}` : v}
        </span>
      ),
    },
    { title: '成交额(亿)', dataIndex: 'amount', align: 'right', width: 90 },
    { title: '缩/放量', dataIndex: 'volumeChange', align: 'center', width: 85 },
    { title: '上涨', dataIndex: 'upCount', align: 'right', width: 65 },
    { title: '下跌', dataIndex: 'downCount', align: 'right', width: 65 },
    { title: '涨停', dataIndex: 'limitUp', align: 'right', width: 65 },
    { title: '跌停', dataIndex: 'limitDown', align: 'right', width: 65 },
    { title: '炸板率', dataIndex: 'brokenRate', align: 'right', width: 75, render: (v: number) => `${v}%` },
    { title: '情绪', dataIndex: 'sentiment', align: 'center', width: 60 },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 120,
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '状态',
      key: 'status',
      align: 'center',
      width: 90,
      fixed: 'right',
      render: (_, r) =>
        r._conflict ? <Tag color="warning">日期已存在</Tag> : <Tag color="success">新增</Tag>,
    },
  ]

  return (
    <Modal
      open={open}
      title="导入预览"
      width={1000}
      onCancel={onClose}
      onOk={() => onConfirm(selectedRows.map(({ _idx, _conflict, ...rest }) => rest))}
      okText={`确认导入 (${selectedRows.length})`}
      cancelText="取消"
      confirmLoading={submitting}
      okButtonProps={{ disabled: selectedRows.length === 0 }}
      mask={{ closable: false }}
    >
      <div style={{ marginBottom: 8, fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
        共解析出 {rows.length} 条
        {conflictCount > 0 && (
          <span style={{ color: '#f59e0b' }}>
            ，其中 {conflictCount} 条日期已存在（默认未勾选，勾选后将覆盖已有记录）
          </span>
        )}
        {selectedConflictCount > 0 && (
          <span style={{ color: '#f59e0b' }}>；本次将覆盖 {selectedConflictCount} 条</span>
        )}
      </div>

      <Table<Row>
        size="small"
        columns={columns}
        dataSource={rows}
        rowKey="_idx"
        pagination={false}
        scroll={{ x: 1200, y: 420 }}
        rowSelection={{
          selectedRowKeys: selectedKeys,
          onChange: (keys) => setSelectedKeys(keys as number[]),
          columnWidth: 40,
        }}
      />
    </Modal>
  )
}
