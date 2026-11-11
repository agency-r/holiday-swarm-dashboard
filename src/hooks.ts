import { useEffect, useState } from 'react'

/** Phones and short landscape viewports share the compact (non-overlay) HUD. */
export const COMPACT_MQ = '(max-width: 900px), (max-height: 620px)'

export function useCompactUi() {
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(COMPACT_MQ).matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia(COMPACT_MQ)
    const sync = () => setCompact(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return compact
}
