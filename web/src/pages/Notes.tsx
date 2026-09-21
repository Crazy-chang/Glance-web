import { Card, Empty, Button, Input, Modal, Popconfirm, Spin, message } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, PushpinOutlined, PushpinFilled } from '@ant-design/icons'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notes as notesApi } from '@/api/endpoints'
import type { Note } from '@/types'

/* ============================================================
 *  速记便签
 *  - 数据通过后端接口持久化（/api/notes）
 *  - 顶部输入框回车/点击添加；卡片支持置顶、编辑、删除
 * ============================================================ */

// 沿用项目深色主题的配色
const colorPrimary = '#ef4444'
const borderColor = '#2a2e3d'
const cardBg = '#1f2330'
const titleColor = 'rgba(255,255,255,0.85)'
const descColor = 'rgba(255,255,255,0.45)'

/** 格式化时间 YYYY-MM-DD HH:mm */
function formatTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Notes() {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<Note | null>(null)
  const [editContent, setEditContent] = useState('')
  const queryClient = useQueryClient()

  // 加载失败不提示，notes 为 undefined 时 list 兜底为空数组，按空数据渲染
  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: notesApi.getAll,
    retry: false,
  })
  const list = notes ?? []

  /** 新增便签 */
  const addMutation = useMutation({
    mutationFn: (content: string) => notesApi.create(content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      setDraft('')
    },
    onError: (err: Error) => message.error(err.message),
  })

  const handleAdd = () => {
    const content = draft.trim()
    if (!content) {
      message.warning('内容不能为空')
      return
    }
    addMutation.mutate(content)
  }

  /** 置顶切换 */
  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: number; pinned: boolean }) =>
      notesApi.update(id, { pinned }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
    onError: (err: Error) => message.error(err.message),
  })

  /** 删除 */
  const deleteMutation = useMutation({
    mutationFn: (id: number) => notesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      message.success('已删除')
    },
    onError: (err: Error) => message.error(err.message),
  })

  /** 打开编辑弹窗 */
  const openEdit = (note: Note) => {
    setEditing(note)
    setEditContent(note.content)
  }

  /** 保存编辑 */
  const editMutation = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      notesApi.update(id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      setEditing(null)
      setEditContent('')
      message.success('已保存')
    },
    onError: (err: Error) => message.error(err.message),
  })

  const handleSaveEdit = () => {
    if (!editing) return
    const content = editContent.trim()
    if (!content) {
      message.warning('内容不能为空')
      return
    }
    editMutation.mutate({ id: editing.id, content })
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* 顶部固定区：标题 + 输入框，不随列表滚动 */}
      <div style={{ flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            速记便签
          </h1>
          <span style={{ fontSize: 12, color: descColor }}>{list.length} 条</span>
        </div>

        {/* 快速输入区 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <Input.TextArea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="记点什么…（Ctrl/⌘ + Enter 保存）"
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={(e) => {
              if (e.metaKey || e.ctrlKey) handleAdd()
            }}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            loading={addMutation.isPending}
          >
            添加
          </Button>
        </div>
      </div>

      {/* 列表区：占满剩余高度，内部独立滚动 */}
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
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : list.length === 0 ? (
          <Empty description="暂无便签，在上面输入框记录第一条" />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 8,
            }}
          >
            {list.map((note) => (
              <div
                key={note.id}
                className="note-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: 12,
                  borderRadius: 6,
                  border: `1px solid ${note.pinned ? `${colorPrimary}55` : borderColor}`,
                  background: cardBg,
                  transition: 'all 0.2s',
                }}
              >
                {/* 内容 */}
                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: titleColor,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    flex: 1,
                  }}
                >
                  {note.content}
                </div>

                {/* 底部：时间 + 操作 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: descColor }}>{formatTime(note.updatedAt)}</span>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button
                      type="button"
                      title={note.pinned ? '取消置顶' : '置顶'}
                      onClick={() => pinMutation.mutate({ id: note.id, pinned: !note.pinned })}
                      style={{
                        border: 'none',
                        borderRadius: 4,
                        padding: '2px 6px',
                        cursor: 'pointer',
                        background: 'transparent',
                        color: note.pinned ? colorPrimary : descColor,
                      }}
                    >
                      {note.pinned ? (
                        <PushpinFilled style={{ fontSize: 12 }} />
                      ) : (
                        <PushpinOutlined style={{ fontSize: 12 }} />
                      )}
                    </button>
                    <button
                      type="button"
                      title="编辑"
                      onClick={() => openEdit(note)}
                      style={{
                        border: 'none',
                        borderRadius: 4,
                        padding: '2px 6px',
                        cursor: 'pointer',
                        background: 'transparent',
                        color: descColor,
                      }}
                    >
                      <EditOutlined style={{ fontSize: 12 }} />
                    </button>
                    <Popconfirm
                      title="确定删除？"
                      onConfirm={() => deleteMutation.mutate(note.id)}
                      okText="删除"
                      cancelText="取消"
                    >
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
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑便签"
        open={editing !== null}
        onOk={handleSaveEdit}
        confirmLoading={editMutation.isPending}
        onCancel={() => {
          setEditing(null)
          setEditContent('')
        }}
        okText="保存"
        cancelText="取消"
      >
        <Input.TextArea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          autoSize={{ minRows: 3, maxRows: 10 }}
          style={{ marginTop: 16 }}
          placeholder="便签内容"
        />
      </Modal>
    </div>
  )
}
