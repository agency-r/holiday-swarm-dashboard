import { useSwarm } from '../store'
import { AGENT_BY_ID, STATE_COLOR } from '../theme'
import { Led } from './primitives'

export function Tooltip() {
  const hovered = useSwarm((s) => s.hovered)
  const pointer = useSwarm((s) => s.pointer)
  const agent = useSwarm((s) => s.snap?.agents.find((a) => a.id === s.hovered))
  if (!hovered || !agent) return null
  const m = AGENT_BY_ID[hovered]
  return (
    <div className="tooltip" style={{ left: pointer.x + 16, top: pointer.y + 16 }}>
      <div className="tt-h"><span className="sq" style={{ background: m.color }} /> {m.code} {m.name.toUpperCase()} <Led color={STATE_COLOR[agent.state]} size={6} /></div>
      <div className="tt-b">{agent.current_task ?? agent.role}</div>
      <div className="lbl">click to open module</div>
    </div>
  )
}
