import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import type { MarketRecord, MarketRecordPayload } from '@/types'

/* ============================================================
 *  行情记录 xlsx 导入 / 导出纯函数（与 UI 解耦，可复用）
 * ============================================================ */

/** Excel 中文表头 <-> 数据字段映射（导出/导入共用，顺序即列顺序） */
const HEADER_MAP: Array<[string, keyof MarketRecordPayload]> = [
  ['日期', 'date'],
  ['指数点位', 'indexValue'],
  ['指数涨跌(%)', 'indexChange'],
  ['成交额(亿)', 'amount'],
  ['缩/放量(亿)', 'volumeChange'],
  ['上涨数', 'upCount'],
  ['下跌数', 'downCount'],
  ['涨停数', 'limitUp'],
  ['跌停数', 'limitDown'],
  ['炸板率(%)', 'brokenRate'],
  ['一板数', 'firstBoard'],
  ['二板数', 'secondBoard'],
  ['三板数', 'thirdBoard'],
  ['高度板数', 'multiBoard'],
  ['情绪温度', 'sentiment'],
  ['当日复盘', 'review'],
  ['第二天操作', 'tomorrowPlan'],
  ['备注', 'remark'],
]

/** 数值字段集合（导入时做数字强转） */
const NUMBER_KEYS = new Set<keyof MarketRecordPayload>([
  'indexValue',
  'indexChange',
  'amount',
  'upCount',
  'downCount',
  'limitUp',
  'limitDown',
  'brokenRate',
  'firstBoard',
  'secondBoard',
  'thirdBoard',
  'multiBoard',
  'sentiment',
])

/* -------------------- 导出 -------------------- */

/** 把行情记录导出为 xlsx 文件并触发浏览器下载 */
export function exportRecordsToXlsx(records: MarketRecord[], filename?: string): void {
  const header = HEADER_MAP.map(([title]) => title)
  const rows = records.map((r) => HEADER_MAP.map(([, key]) => r[key] ?? ''))

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  // 列宽给个基础值，避免默认太窄
  ws['!cols'] = HEADER_MAP.map(([title]) => ({ wch: Math.max(title.length * 2, 10) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '行情记录')

  const name = filename ?? `行情记录_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`
  XLSX.writeFile(wb, name)
}

/* -------------------- 导入 -------------------- */

export interface ParseResult {
  /** 解析成功的记录（日期不合法的行已被剔除） */
  records: MarketRecordPayload[]
  /** 因日期缺失/格式非法被跳过的行数 */
  skipped: number
}

/**
 * 解析 xlsx 文件为行情记录数组。
 * 要求首行表头包含「日期」列，其余列按表头名匹配，列顺序无关。
 * @throws 文件无法读取或缺少「日期」列时抛错
 */
export async function parseXlsxToRecords(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error('文件中没有工作表')

  const ws = wb.Sheets[sheetName]
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
  if (aoa.length < 2) throw new Error('文件为空或只有表头')

  // 表头列索引：Excel 列号 -> 字段 key（只保留能识别的列）
  const headerRow = aoa[0].map((c) => String(c).trim())
  const colKeys: Array<keyof MarketRecordPayload | null> = headerRow.map((title) => {
    const hit = HEADER_MAP.find(([t]) => t === title)
    return hit ? hit[1] : null
  })
  if (!colKeys.includes('date')) {
    throw new Error('缺少「日期」列，请使用本页面导出的文件作为模板')
  }

  const records: MarketRecordPayload[] = []
  let skipped = 0

  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i]
    // 整行空白则跳过且不计数
    if (row.every((c) => c === '' || c == null)) continue

    const rec = emptyPayload()
    for (let col = 0; col < colKeys.length; col++) {
      const key = colKeys[col]
      if (!key) continue
      assignField(rec, key, row[col])
    }

    if (!isValidDate(rec.date)) {
      skipped++
      continue
    }
    records.push(rec)
  }

  return { records, skipped }
}

/* -------------------- 内部工具 -------------------- */

function emptyPayload(): MarketRecordPayload {
  return {
    date: '',
    indexValue: 0,
    indexChange: 0,
    amount: 0,
    volumeChange: '',
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

function assignField(rec: MarketRecordPayload, key: keyof MarketRecordPayload, raw: unknown) {
  if (raw == null || raw === '') return

  if (key === 'date') {
    rec.date = normalizeDate(raw)
    return
  }
  const target = rec as Record<string, string | number>
  if (NUMBER_KEYS.has(key)) {
    const n = toNumber(raw)
    target[key] = key === 'sentiment' ? clamp(Math.round(n), 0, 100) : n
    return
  }
  // 字符串字段
  target[key] = String(raw).trim()
}

/** 数字强转：兼容 12.3% / +1.2 / 1,234 这类用户手编辑过的单元格 */
function toNumber(raw: unknown): number {
  if (typeof raw === 'number') return raw
  const s = String(raw).replace(/[%,+，\s]/g, '')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

/**
 * 日期归一化为 YYYY-MM-DD：
 * - 字符串：接受 2026-08-21 / 2026/8/21 / 2026.8.21
 * - 数字：按 Excel 日期序列号转换（用户在 Excel 里改过后单元格会变成日期格式）
 */
function normalizeDate(raw: unknown): string {
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw)
    if (!d) return ''
    return dayjs(new Date(d.y, d.m - 1, d.d)).format('YYYY-MM-DD')
  }
  const s = String(raw).trim()
  const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (!m) return s
  return dayjs(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`).format('YYYY-MM-DD')
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && dayjs(s).isValid()
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
