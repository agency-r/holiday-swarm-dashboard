import { useEffect } from 'react'
import { useCompactUi } from './hooks'
import { startConnection } from './net/connection'
import { Office } from './scene/Office'
import { useSwarm } from './store'
import { fmt$ } from './theme'
import { AgentDock } from './ui/AgentDock'
import { DetailPanel } from './ui/DetailPanel'
import { LeftPanels } from './ui/LeftPanels'
import { MobileSheet } from './ui/MobileSheet'
import { RightPanels } from './ui/RightPanels'
import { Tooltip } from './ui/Tooltip'
import { TopBar } from './ui/TopBar'

export default function App() {
  useEffect(() => startConnection(), [])
  const compact = useCompactUi()
  const selected = useSwarm((s) => s.selected)
  const finished = useSwarm((s) => s.snap?.finished)
  const revenue = useSwarm((s) => s.snap?.metrics.revenue ?? 0)
  const goal = useSwarm((s) => s.snap?.goal ?? 5000)
  return (
    <div className={`app ${compact ? 'is-compact' : ''}`} onMouseMove={(e) => useSwarm.getState().setPointer(e.clientX, e.clientY)}>
      <TopBar />
      <div className="stage">
        <Office compact={compact} />
        <div className="hint lbl">{compact ? 'drag · orbit  /  pinch · zoom  /  tap a module' : 'drag · orbit  /  scroll · zoom  /  click a module'}</div>
        {finished && (
          <div className="finale">
            <div className="lbl">season complete · cyber monday</div>
            <div className="big-num">{fmt$(revenue)}</div>
            <div className="lbl">{revenue >= goal ? 'mission accomplished' : 'goal missed — review pulse insights'}</div>
          </div>
        )}
      </div>
      {compact ? <MobileSheet /> : <>
        <LeftPanels />
        {selected ? <DetailPanel /> : <RightPanels />}
      </>}
      <AgentDock />
      {!compact && <Tooltip />}
    </div>
  )
}
