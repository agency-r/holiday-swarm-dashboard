import { LIVE_TRAFFIC } from '../net/liveSales'
import { useSwarm } from '../store'
import { C, fmt$, fmtN } from '../theme'
import { Knob, Panel, Segments, Spark } from './primitives'

const SIM_TRAFFIC: [string, string][] = [['pinterest', C.blue], ['organic', C.ink], ['social', C.orange], ['email', C.yellow], ['paid', '#A9A49A']]

export function LeftPanels({ only }: { only?: '01' | '02' | '03' } = {}) {
  const snap = useSwarm((s) => s.snap)
  if (!snap) return <div className="col left" />
  const m = snap.metrics
  const p = snap.goal ? m.revenue / snap.goal : 0
  const daysLeft = Math.max(1, snap.days_total - snap.day_index)
  const pace = m.revenue / Math.max(1, snap.day_index + 1)
  const need = Math.max(0, snap.goal - m.revenue) / daysLeft
  const live = snap.mode === 'live'
  const sources = live ? LIVE_TRAFFIC : SIM_TRAFFIC
  const tTotal = sources.reduce((a, [k]) => a + (m.traffic[k] ?? 0), 0)
  const hasTraffic = tTotal > 0
  const pct = (n: number) => (hasTraffic ? `${Math.round((n / tTotal) * 100)}%` : '—')
  const visitorsKnown = m.visitors != null
  const cvrKnown = m.conversion_rate != null
  const subs = snap.knowledge.subscribers
  return (
    <div className="col left">
      {(!only || only === '01') && <Panel code="01" title="REVENUE" right={<span className={`chip ${p >= 1 ? 'yellow' : 'ghost'}`}>{p >= 1 ? 'GOAL HIT' : `${Math.floor(p * 100)}%`}</span>}>
        <div className="big-num">{fmt$(m.revenue)}<span className="cents">.{(m.revenue % 1).toFixed(2).slice(2)}</span></div>
        <div className="lbl">/ {fmt$(snap.goal)} goal by cyber monday{live ? ' · gumroad gross' : ''}</div>
        {live && <div className="lbl">net {fmt$(m.net_revenue ?? m.revenue, 2)}{m.net_after_fees ? ' after fees' : ' (fees not reported)'}</div>}
        <Segments value={p} n={20} />
        <Spark data={snap.revenue_series} />
        <div className="kv-row">
          <div><span className="lbl">pace/day</span><b>{fmt$(pace)}</b></div>
          <div><span className="lbl">need/day</span><b style={{ color: need > pace ? C.orange : C.ink }}>{fmt$(need)}</b></div>
          <div><span className="lbl">ad spend</span><b>{fmt$(m.ad_spend)}</b></div>
        </div>
      </Panel>}
      {(!only || only === '02') && <Panel code="02" title="FUNNEL">
        <div className="knobs">
          <Knob value={Math.min(1, m.orders / 800)} color={C.yellow} label="orders" readout={fmtN(m.orders)} />
          <Knob value={visitorsKnown ? Math.min(1, (m.visitors ?? 0) / 20000) : 0} color={C.blue} label="visitors" readout={visitorsKnown ? fmtN(m.visitors ?? 0) : '—'} />
          <Knob value={cvrKnown ? Math.min(1, (m.conversion_rate ?? 0) / 0.06) : 0} color={C.orange} label="conv. rate" readout={cvrKnown ? ((m.conversion_rate ?? 0) * 100).toFixed(2) + '%' : '—'} />
          <Knob value={Math.min(1, m.aov / 25)} color={C.ink} label="aov" readout={m.orders ? fmt$(m.aov, 2) : (live ? '—' : fmt$(m.aov, 2))} />
        </div>
        <div className="kv-row">
          <div><span className="lbl">subscribers</span><b>{subs == null ? '—' : fmtN(subs)}</b></div>
          <div><span className="lbl">products</span><b>{snap.products.length}</b></div>
          <div><span className="lbl">listings</span><b>{snap.listings.filter((l) => l.status === 'live').length}{!live && snap.listings.length >= 24 ? '+' : ''}</b></div>
        </div>
      </Panel>}
      {(!only || only === '03') && <Panel code="03" title="TRAFFIC SOURCES">
        {hasTraffic ? (
          <>
            <div className="stack">
              {sources.map(([k, c]) => <span key={k} style={{ width: `${((m.traffic[k] ?? 0) / tTotal) * 100}%`, background: c }} />)}
            </div>
            <div className="legend">
              {sources.map(([k, c]) => (
                <div key={k} className="legend-row">
                  <span className="sq" style={{ background: c }} />
                  <span className="lbl dark">{k}</span>
                  <span className="mono">{fmtN(m.traffic[k] ?? 0)}</span>
                  <span className="mono dim">{pct(m.traffic[k] ?? 0)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty">{live ? 'no source data yet — referrers appear on the first sale' : 'no traffic yet'}</div>
        )}
      </Panel>}
    </div>
  )
}
