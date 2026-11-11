/**
 * Live Gumroad sales overlay. Fetches the public aggregate-only sales.json
 * published by the GitHub Actions sync (never a token, never buyer PII).
 */
import type { Listing, Product, Snapshot, SwarmEvent } from '../types'

export const GOAL = 5000
export const DEADLINE = '2026-11-30'
export const SEASON_START = '2026-11-10'
export const TZ = 'America/Chicago'
export const POLL_MS = 60_000

export interface LiveSale {
  id: string
  product: string
  amount: number
  net?: number
  ts: string | null
  source: string
}

export interface LiveProduct {
  permalink: string
  name: string
  url?: string | null
  price: number
  product_type?: string
  niche?: string
  sales: number
  gross_revenue: number
  net_revenue: number
  published?: boolean
}

export interface LiveSource {
  orders: number
  revenue: number
}

export interface LiveSnapshot {
  updated_at: string
  timezone?: string
  currency?: string
  goal: number
  deadline: string
  season_start?: string
  gross_revenue: number
  net_revenue: number
  net_after_fees?: boolean
  orders: number
  refunds?: number
  products: LiveProduct[]
  daily: { date: string; gross: number; net: number; orders: number }[]
  revenue_series: number[]
  recent_sales: LiveSale[]
  sources: Record<string, LiveSource>
}

const FALLBACK_PRODUCTS: LiveProduct[] = [
  { permalink: 'holiday-meal-planner', name: 'Holiday Meal Planner', url: 'https://agencyr.gumroad.com/l/holiday-meal-planner', price: 6, product_type: 'planner', niche: 'Holiday meals', sales: 0, gross_revenue: 0, net_revenue: 0, published: true },
  { permalink: 'black-friday-budget-tracker', name: 'Black Friday Budget Tracker', url: 'https://agencyr.gumroad.com/l/black-friday-budget-tracker', price: 5, product_type: 'spreadsheet', niche: 'Holiday budgeting', sales: 0, gross_revenue: 0, net_revenue: 0, published: true },
  { permalink: 'advent-activity-calendar', name: 'Advent Activity Calendar', url: 'https://agencyr.gumroad.com/l/advent-activity-calendar', price: 7, product_type: 'printable', niche: 'Family advent', sales: 0, gross_revenue: 0, net_revenue: 0, published: true },
  { permalink: 'christmas-gift-tracker', name: 'Christmas Gift Tracker', url: 'https://agencyr.gumroad.com/l/christmas-gift-tracker', price: 7, product_type: 'spreadsheet', niche: 'Gift planning', sales: 0, gross_revenue: 0, net_revenue: 0, published: true },
  { permalink: 'secret-santa-printable-kit', name: 'Secret Santa Printable Kit', url: 'https://agencyr.gumroad.com/l/secret-santa-printable-kit', price: 6, product_type: 'printable', niche: 'Secret Santa', sales: 0, gross_revenue: 0, net_revenue: 0, published: true },
  { permalink: 'holiday-planner-bundle', name: 'Holiday Planner Bundle', url: 'https://agencyr.gumroad.com/l/holiday-planner-bundle', price: 13.95, product_type: 'bundle', niche: 'Holiday planning', sales: 0, gross_revenue: 0, net_revenue: 0, published: true },
]

export const EMPTY_LIVE: LiveSnapshot = {
  updated_at: '',
  timezone: TZ,
  currency: 'usd',
  goal: GOAL,
  deadline: DEADLINE,
  season_start: SEASON_START,
  gross_revenue: 0,
  net_revenue: 0,
  net_after_fees: true,
  orders: 0,
  refunds: 0,
  products: FALLBACK_PRODUCTS,
  daily: [],
  revenue_series: [0, 0],
  recent_sales: [],
  sources: {},
}

export const LIVE_TRAFFIC: [string, string][] = [
  ['discover', '#27C46B'],
  ['direct', '#151515'],
  ['pinterest', '#2F6BFF'],
  ['organic', '#8E8A82'],
  ['social', '#FF6A13'],
  ['email', '#FFC800'],
  ['paid', '#A9A49A'],
]

export function salesUrl(): string {
  return `${import.meta.env.BASE_URL}data/sales.json?t=${Date.now()}`
}

export async function fetchLiveSales(signal?: AbortSignal): Promise<LiveSnapshot> {
  const res = await fetch(salesUrl(), { cache: 'no-store', signal })
  if (!res.ok) throw new Error(`sales.json HTTP ${res.status}`)
  const data = (await res.json()) as LiveSnapshot
  if (typeof data.gross_revenue !== 'number' || !Array.isArray(data.products)) {
    throw new Error('sales.json was missing expected fields')
  }
  return data
}

export function formatChicago(d = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${g('weekday')} ${g('month')} ${g('day')} ${g('hour')}:${g('minute')}`
}

export function formatUpdated(iso: string | null | undefined): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000))
  if (sec < 45) return 'just now'
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`
  return formatChicago(new Date(t))
}

export function seasonProgress(now = new Date()): { dayIndex: number; daysTotal: number; finished: boolean } {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
  const noon = (iso: string) => Date.parse(`${iso}T12:00:00Z`)
  const daysTotal = Math.round((noon(DEADLINE) - noon(SEASON_START)) / 86400000)
  const raw = Math.round((noon(today) - noon(SEASON_START)) / 86400000)
  const dayIndex = Math.max(0, Math.min(daysTotal, raw))
  return { dayIndex, daysTotal, finished: today > DEADLINE }
}

function saleEvents(live: LiveSnapshot): SwarmEvent[] {
  return (live.recent_sales ?? []).map((s) => {
    const when = s.ts ? formatChicago(new Date(s.ts)) : ''
    const src = s.source ? ` · ${s.source}` : ''
    return {
      id: `gr-${s.id}`,
      ts: s.ts ? Date.parse(s.ts) / 1000 : 0,
      sim_time: when,
      kind: 'sale' as const,
      source: 'closer' as const,
      message: `${s.product} · $${Number(s.amount).toFixed(2)}${src}`,
      amount: s.amount,
      simulated: false,
    }
  })
}

function insights(live: LiveSnapshot, dayIndex: number, daysTotal: number): string[] {
  const daysLeft = Math.max(0, daysTotal - dayIndex)
  const pace = live.gross_revenue / Math.max(1, dayIndex + 1)
  const need = Math.max(0, (live.goal ?? GOAL) - live.gross_revenue) / Math.max(1, daysLeft)
  const lines = [
    `Pace $${pace.toFixed(0)}/day · need $${need.toFixed(0)}/day · ${daysLeft} days to Cyber Monday`,
  ]
  if (live.orders === 0) lines.push('No Gumroad orders yet — totals are live zeros, not a simulator.')
  return lines
}

export function applyLiveSales(snap: Snapshot, live: LiveSnapshot): Snapshot {
  const { dayIndex, daysTotal, finished } = seasonProgress()
  const clock = formatChicago()
  const products: Product[] = (live.products ?? []).map((p) => ({
    id: p.permalink,
    title: p.name,
    niche: p.niche || '',
    product_type: p.product_type || 'digital',
    price: p.price,
    status: p.published === false ? 'draft' : 'listed',
    quality: 1,
    pages: 0,
    sales: p.sales,
    revenue: p.gross_revenue,
    views: 0,
    bundle_of: p.product_type === 'bundle' ? ['*'] : [],
  }))
  const listings: Listing[] = (live.products ?? []).map((p) => ({
    id: `gr-${p.permalink}`,
    product_id: p.permalink,
    platform: 'gumroad' as const,
    title: p.name,
    price: p.price,
    status: p.published === false ? 'draft' as const : 'live' as const,
    url: p.url ?? null,
    mode: 'live' as const,
  }))
  const traffic: Record<string, number> = {
    discover: 0, direct: 0, pinterest: 0, organic: 0, social: 0, email: 0, paid: 0,
  }
  for (const [k, v] of Object.entries(live.sources ?? {})) {
    traffic[k] = (traffic[k] ?? 0) + (v?.orders ?? 0)
  }
  const sales = saleEvents(live)
  const ambient = snap.events
    .filter((e) => e.kind !== 'sale')
    .map((e) => ({ ...e, simulated: e.simulated ?? true }))
  const events = [...sales, ...ambient].sort((a, b) => a.ts - b.ts).slice(-80)
  const series = live.revenue_series?.length ? live.revenue_series : [0, 0]

  return {
    ...snap,
    type: 'snapshot',
    mode: 'live',
    integrations: { ...snap.integrations, gumroad: 'live', ads: 'off' },
    goal: live.goal ?? GOAL,
    deadline: live.deadline ?? DEADLINE,
    sim_time: clock,
    day_index: dayIndex,
    days_total: daysTotal,
    finished,
    metrics: {
      revenue: live.gross_revenue,
      net_revenue: live.net_revenue,
      net_after_fees: live.net_after_fees ?? false,
      orders: live.orders,
      visitors: null,
      conversion_rate: null,
      aov: live.orders ? live.gross_revenue / live.orders : 0,
      ad_spend: 0,
      traffic,
      sim_time: clock,
    },
    revenue_series: series,
    products,
    listings,
    content: [],
    campaigns: [],
    events,
    knowledge: {
      subscribers: null,
      insights: insights(live, dayIndex, daysTotal),
      niche_weights: {},
    },
    escalations: [],
    data_updated_at: live.updated_at || null,
  }
}
