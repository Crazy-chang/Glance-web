import { useState } from 'react'
import { X, Target } from 'lucide-react'

export default function MarketBanner() {
  const [visible, setVisible] = useState(true)

  if (!visible) return null

  return (
    <div className="fixed top-14 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-orange-400/30 bg-orange-400/15 px-4 py-1.5 shadow-lg backdrop-blur-sm">
      <Target className="h-3.5 w-3.5 shrink-0 text-orange-400" />
      <p className="text-xs font-medium text-orange-300 sm:text-sm">
        严格执行计划，追跌杀涨，止损不犹豫，止盈不贪婪，别人恐惧我贪婪，别人贪婪我恐惧
      </p>
      <button
        onClick={() => setVisible(false)}
        className="shrink-0 rounded-full p-0.5 text-orange-400/70 transition-colors hover:bg-orange-400/20 hover:text-orange-300"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
