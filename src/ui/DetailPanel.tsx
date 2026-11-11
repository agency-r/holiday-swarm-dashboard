import { useSwarm } from '../store'
import { AGENT_BY_ID, C, STATE_COLOR } from '../theme'
import { Knob, Led } from './primitives'

const KICKABLE = new Set(['scout', 'pulse', 'closer'])

export function DetailPanel() {
  const id = useSwarm((s) => s.selected)
  const agent = useSwarm((s) => s.snap?.agents.find((a) => a.id === s.selected))
  const allTasks = useSwarm((s) => s.snap?.tasks)
  const control = useSwarm((s) => s.control)
  const select = useSwarm((s) => s.select)
  if (!id || !agent) return null
  const m = AGENT_BY_ID[id]
  const tasks = (allTasks ?? []).filter((t) => t.assignee === id)
  const fg = m.color === C.yellow ? C.ink : C.white
  return (
    <aside className="detail" key={id}>
      <header className="detail-h" style={{ background: m.color, color: fg }}>
        <div>
          <div className="detail-code">MODULE {m.code}</div>
          <div className="detail-name">{m.name}</div>
          <div className="detail-role">{agent.role}</div>
        </div>
        <button className="close" style={{ color: fg, borderColor: fg }} onClick={() => select(null)}>✕</button>
      </header>
      <div className="detail-body">
        <div className="row-between">
          <div className="state-pill"><Led color={STATE_COLOR[agent.state]} blink={agent.state !== 'idle'} /> {agent.state.toUpperCase()}</div>
          <div className="lv">
            <span className="lbl">module lv</span>
            <span className="dk-pips big">{[0, 1, 2, 3, 4].map((i) => <span key={i} className={i < agent.level ? 'on' : ''} />)}</span>
          </div>
        </div>
        <div className="lbl">current task</div>
        <div className="cur-task">{agent.current_task ?? '— standby —'}</div>
        <div className="task-bar wide"><i style={{ width: `${agent.progress * 100}%` }} /></div>
        <div className="knobs three">
          <Knob value={Math.min(1, agent.completed / 60)} color={m.color === C.ink ? C.yellow : m.color} label="completed" readout={String(agent.completed)} size={42} />
          <Knob value={Math.min(1, agent.queue / 6)} color={C.blue} label="queued" readout={String(agent.queue)} size={42} />
          <Knob value={agent.progress} color={C.orange} label="progress" readout={`${Math.round(agent.progress * 100)}%`} size={42} />
        </div>
        <div className="ctl-row">
          <button className={`key wide ${agent.paused ? 'on' : ''}`} onClick={() => control(agent.paused ? 'resume' : 'pause', id)}>
            <Led color={agent.paused ? C.orange : C.green} size={6} /> {agent.paused ? 'RESUME' : 'PAUSE'}
          </button>
          <button className={`key wide ${agent.boost ? 'on-yellow' : ''}`} onClick={() => control('boost', id)}>⚡ BOOST</button>
          {KICKABLE.has(id) && <button className="key wide" onClick={() => control('kick', id)}>↯ KICK</button>}
        </div>
        {tasks.length > 0 && <>
          <div className="lbl">queue</div>
          <div className="mini-list">{tasks.slice(0, 4).map((t) => <div key={t.id}><span className="mono dim">{t.status === 'running' ? '▶' : 'P' + t.priority}</span> {t.title}</div>)}</div>
        </>}
        <div className="lbl">recent outputs</div>
        <div className="mini-list outputs">{[...agent.outputs].reverse().slice(0, 5).map((o, i) => <div key={i}>{o}</div>)}{agent.outputs.length === 0 && <div className="dim">nothing yet</div>}</div>
        <div className="lbl">log</div>
        <pre className="log">{[...agent.logs].reverse().slice(0, 14).join('\n')}</pre>
      </div>
    </aside>
  )
}
