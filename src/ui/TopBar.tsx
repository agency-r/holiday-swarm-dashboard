import { formatUpdated } from '../net/liveSales'
import { useSwarm } from '../store'
import { C } from '../theme'
import { Led } from './primitives'

export function TopBar() {
  const snap = useSwarm((s) => s.snap)
  const link = useSwarm((s) => s.link)
  const dataError = useSwarm((s) => s.dataError)
  const control = useSwarm((s) => s.control)
  const orbit = useSwarm((s) => s.autoOrbit)
  const toggleOrbit = useSwarm((s) => s.toggleOrbit)
  const daysLeft = snap ? Math.max(0, snap.days_total - snap.day_index) : 20
  const promo = snap?.campaigns.find((c) => c.channel === 'promo' && c.status === 'active')
  const esc = snap?.escalations.length ?? 0
  const updated = formatUpdated(snap?.data_updated_at)
  const linkInfo =
    link === 'live'
      ? { c: dataError ? C.orange : C.green, t: dataError ? 'LIVE · GUMROAD · OFFLINE' : updated ? `LIVE · GUMROAD · ${updated}` : 'LIVE · GUMROAD', short: 'LIVE' }
      : link === 'backend'
        ? { c: C.green, t: 'SWARM BACKEND', short: 'LIVE' }
        : link === 'local'
          ? { c: C.yellow, t: 'LOCAL SIMULATOR', short: 'SIM' }
          : { c: C.grey, t: 'CONNECTING', short: '…' }
  const live = link === 'live' || snap?.mode === 'live'
  return (
    <div className="topbar">
      <div className="brand">
        <div className="logo"><span /></div>
        <div>
          <div className="brand-name">HRS-26 <b>HOLIDAY REVENUE SWARM</b></div>
          <div className="lbl brand-sub">{live ? 'live gumroad sales · agent activity simulated' : 'autonomous unit · 8 agents · simulation'}</div>
        </div>
      </div>
      <div className="clock">
        <div className="clock-time">{(snap?.sim_time ?? '— — —').toUpperCase()}</div>
        <div className="clock-sub">
          <span className="chip ink">D-{daysLeft}</span>
          <span className="lbl clock-caption">TO CYBER MONDAY · NOV 30</span>
          {promo && <span className="chip orange pulse-chip">{promo.name.toUpperCase()} −{promo.discount_pct}%</span>}
        </div>
      </div>
      <div className="controls">
        {esc > 0 && <span className="chip warn">{esc} HUMAN STEP{esc > 1 ? 'S' : ''}</span>}
        <div className="linkbox" title={snap?.data_updated_at ? `Sales snapshot ${snap.data_updated_at}` : undefined}>
          <Led color={linkInfo.c} blink={link === 'connecting' || Boolean(dataError)} />
          <span className="lbl dark link-full">{linkInfo.t}</span>
          <span className="lbl dark link-short">{linkInfo.short}</span>
        </div>
        <button className={`key ${orbit ? 'on' : ''}`} onClick={toggleOrbit} title="Auto-orbit camera">ORBIT</button>
        <button className={`key ${snap?.paused ? 'on' : ''}`} onClick={() => control(snap?.paused ? 'resume' : 'pause')} title={live ? 'Pause or resume simulated agent motion' : undefined}>
          {snap?.paused ? '▶ RUN' : '❚❚ HOLD'}
        </button>
        <button className="key" onClick={() => control('reset')} title={live ? 'Restart simulated agent motion (sales stay live)' : 'Restart the season'}>↺</button>
      </div>
    </div>
  )
}
