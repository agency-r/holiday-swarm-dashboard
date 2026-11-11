import { useState } from 'react'
import { useSwarm } from '../store'
import { DetailPanel } from './DetailPanel'
import { LeftPanels } from './LeftPanels'
import { RightPanels } from './RightPanels'

const TABS = [
  { id: '01', name: 'REV' },
  { id: '02', name: 'FUNL' },
  { id: '03', name: 'SRC' },
  { id: '04', name: 'QUEUE' },
  { id: '05', name: 'FEED' },
  { id: '06', name: 'SHOP' },
] as const

type TabId = (typeof TABS)[number]['id']

export function MobileSheet() {
  const selected = useSwarm((s) => s.selected)
  const select = useSwarm((s) => s.select)
  const [tab, setTab] = useState<TabId>('01')
  const [open, setOpen] = useState(true)

  const pick = (id: TabId) => {
    if (selected) select(null)
    setTab(id)
    setOpen(true)
  }

  return (
    <div className={`sheet ${open ? 'open' : 'peek'} ${selected ? 'has-detail' : ''}`}>
      <div className="sheet-tabs" role="tablist" aria-label="Dashboard panels">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={!selected && tab === t.id}
            className={`sheet-tab ${!selected && tab === t.id ? 'on' : ''}`}
            onClick={() => pick(t.id)}
          >
            <span className="sheet-tab-code">{t.id}</span>
            <span className="sheet-tab-name">{t.name}</span>
          </button>
        ))}
        <button
          type="button"
          className="sheet-toggle"
          aria-label={open ? 'Collapse panels' : 'Expand panels'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? '▾' : '▴'}
        </button>
      </div>
      <div className="sheet-body">
        {selected ? (
          <DetailPanel />
        ) : tab === '01' || tab === '02' || tab === '03' ? (
          <LeftPanels only={tab} />
        ) : (
          <RightPanels only={tab} />
        )}
      </div>
    </div>
  )
}
