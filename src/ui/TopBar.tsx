import { useSwarm } from '../store'
import { C } from '../theme'
import { Led } from './primitives'

export function TopBar() {
  const snap = useSwarm((s) => s.snap)
  const link = useSwarm((s) => s.link)
  const control = useSwarm((s) => s.control)
  const orbit = useSwarm((s) => s.autoOrbit)
  const toggleOrbit = useSwarm((s) => s.toggleOrbit)
  const daysLeft = snap ? Math.max(0, snap.days_total - snap.day_index) : 20
  const promo = snap?.campaigns.find((c) => c.channel === 'promo' && c.status === 'active')
  const esc = snap?.escalations.length ?? 0
  const linkInfo = link === 'backend' ? { c: C.green, t: 'SWARM BACKEND' } : link === 'local' ? { c: C.yellow, t: 'LOCAL SIMULATOR' } : { c: C.grey, t: 'CONNECTING' }
  return (
    <div className="topbar">
      <div className="brand">
        <div className="logo"><span /></div>
        <div>
          <div className="brand-name">HRS-26 <b>HOLIDAY REVENUE SWARM</b></div>
          <div className="lbl">autonomous unit · 8 agents · {snap?.mode === 'live' ? 'live commerce' : 'simulation'}</div>
        </div>
      </div>
      <div className="clock">
        <div className="clock-time">{(snap?.sim_time ?? '— — —').toUpperCase()}</div>
        <div className="clock-sub">
          <span className="chip ink">D-{daysLeft}</span>
          <span className="lbl">TO CYBER MONDAY · NOV 30</span>
          {promo && <span className="chip orange pulse-chip">{promo.name.toUpperCase()} −{promo.discount_pct}%</span>}
        </div>
      </div>
      <div className="controls">
        {esc > 0 && <span className="chip warn">{esc} HUMAN STEP{esc > 1 ? 'S' : ''}</span>}
        <div className="linkbox"><Led color={linkInfo.c} blink={link !== 'backend'} /> <span className="lbl dark">{linkInfo.t}</span></div>
        <button className={`key ${orbit ? 'on' : ''}`} onClick={toggleOrbit} title="Auto-orbit camera">ORBIT</button>
        <button className={`key ${snap?.paused ? 'on' : ''}`} onClick={() => control(snap?.paused ? 'resume' : 'pause')}>
          {snap?.paused ? '▶ RUN' : '❚❚ HOLD'}
        </button>
        <button className="key" onClick={() => control('reset')} title="Restart the season">↺</button>
      </div>
    </div>
  )
}
