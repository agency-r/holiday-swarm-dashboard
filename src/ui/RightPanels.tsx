import { useSwarm } from '../store'
import { AGENT_BY_ID, C, fmt$ } from '../theme'
import type { SwarmEvent } from '../types'
import { Led, Panel } from './primitives'

const GLYPH: Record<SwarmEvent['kind'], [string, string]> = {
  handoff: ['→', C.blue], sale: ['$', C.yellow], compliance: ['!', C.orange], insight: ['◆', C.green],
  publish: ['▲', C.ink], escalation: ['⚑', '#E5484D'], log: ['·', C.grey], system: ['■', C.greyDark],
}

export function RightPanels({ only }: { only?: '04' | '05' | '06' } = {}) {
  const snap = useSwarm((s) => s.snap)
  const feed = useSwarm((s) => s.feed)
  const select = useSwarm((s) => s.select)
  if (!snap) return <div className="col right" />
  const live = snap.mode === 'live'
  const tasks = snap.tasks.slice(0, 7)
  const sales = feed.filter((e) => e.kind === 'sale' && !e.simulated)
  return (
    <div className="col right">
      {(!only || only === '04') && <Panel code="04" title="TASK QUEUE" right={<span className="mono dim">{live ? 'sim · ' : ''}{snap.tasks.length} open</span>}>
        <div className="tasks">
          {tasks.length === 0 && <div className="empty">{live ? 'no simulated tasks right now' : 'queue clear'}</div>}
          {tasks.map((t) => {
            const a = AGENT_BY_ID[t.assignee]
            return (
              <div key={t.id} className="task" onClick={() => select(t.assignee)}>
                <Led color={t.status === 'running' ? C.green : C.grey} blink={t.status === 'running'} size={6} />
                <span className="tag" style={{ background: a.color, color: a.color === C.yellow ? C.ink : C.white }}>{a.code}</span>
                <span className="task-title">{t.title}</span>
                <span className="task-bar"><i style={{ width: `${t.progress * 100}%` }} /></span>
              </div>
            )
          })}
        </div>
      </Panel>}
      {(!only || only === '05') && <Panel code="05" title="LIVE FEED" className="grow">
        <div className="feed">
          {live && sales.length === 0 && <div className="empty">no sales yet</div>}
          {feed.slice(0, 22).map((e) => {
            const [g, c] = GLYPH[e.kind]
            const simulated = Boolean(e.simulated) || (live && e.kind !== 'sale')
            const who = simulated
              ? 'SIM'
              : `${AGENT_BY_ID[e.source]?.name.slice(0, 3).toUpperCase()}${e.target ? '›' + AGENT_BY_ID[e.target]?.name.slice(0, 3).toUpperCase() : ''}`
            return (
              <div key={e.id} className={`feed-row k-${e.kind}${simulated ? ' sim' : ''}`}>
                <span className="glyph" style={{ color: c === C.yellow ? '#C99A00' : c }}>{g}</span>
                <span className="feed-who">{who}</span>
                <span className="feed-msg">{e.message}</span>
              </div>
            )
          })}
        </div>
      </Panel>}
      {(!only || only === '06') && <Panel code="06" title="TOP PRODUCTS" right={<span className="mono dim">{live ? 'gumroad' : 'by revenue'}</span>}>
        <div className="products">
          {snap.products.slice(0, 6).map((p, i) => (
            <div key={p.id} className="product">
              <span className="rank">{String(i + 1).padStart(2, '0')}</span>
              <span className="thumb" style={{ background: [C.yellow, C.blue, C.orange, C.ink][i % 4] }}>{p.product_type.slice(0, 2).toUpperCase()}</span>
              <span className="p-title">{p.title}<em>{p.sales} sold · ${p.price.toFixed(2)}</em></span>
              <b className="mono">{fmt$(p.revenue)}</b>
            </div>
          ))}
          {snap.products.length === 0 && <div className="empty">{live ? 'no products in the sales snapshot yet' : 'forge is building the first product…'}</div>}
        </div>
      </Panel>}
    </div>
  )
}
