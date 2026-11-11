import { useSwarm } from '../store'
import { AGENTS, C, STATE_COLOR, STATE_LABEL } from '../theme'
import { Led } from './primitives'

export function AgentDock() {
  const agents = useSwarm((s) => s.snap?.agents)
  const selected = useSwarm((s) => s.selected)
  const hovered = useSwarm((s) => s.hovered)
  const select = useSwarm((s) => s.select)
  return (
    <div className="dock">
      {AGENTS.map((m) => {
        const a = agents?.find((x) => x.id === m.id)
        const st = a?.state ?? 'idle'
        return (
          <button key={m.id} className={`dock-key ${selected === m.id ? 'sel' : ''} ${hovered === m.id ? 'hov' : ''}`}
            onClick={() => select(selected === m.id ? null : m.id)}>
            <div className="dk-top">
              <span className="dk-code">{m.code}</span>
              <Led color={STATE_COLOR[st]} blink={st !== 'idle' && st !== 'paused'} size={7} />
            </div>
            <div className="dk-name">{m.name}</div>
            <div className="dk-state" style={{ color: st === 'idle' ? '#9A968E' : C.ink }}>
              {STATE_LABEL[st]}{a?.boost ? ' ⚡' : ''}{a && a.queue > 0 ? ` · ${a.queue}` : ''}
            </div>
            <div className="dk-bar"><i style={{ width: `${(a?.progress ?? 0) * 100}%`, background: m.color === C.ink ? C.ink : m.color }} /></div>
            <div className="dk-pips">{[0, 1, 2, 3, 4].map((i) => <span key={i} className={i < (a?.level ?? 1) ? 'on' : ''} />)}</div>
            <span className="dk-cap" style={{ background: m.color }} />
          </button>
        )
      })}
    </div>
  )
}
