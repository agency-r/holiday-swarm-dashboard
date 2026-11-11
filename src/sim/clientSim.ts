/**
 * Built-in client-side simulator. Mirrors the Python swarm (backend/swarm) closely enough that the
 * dashboard is fully alive with no backend: same agents, workflow graph, promos and market model.
 */
import type {
  AgentId, AgentState, AgentStatus, Campaign, ContentAsset, ControlAction, Listing, Product, Snapshot,
  SwarmEvent, Task,
} from '../types'
import { AGENTS } from '../theme'

const START = new Date('2026-11-10T08:00:00')
const END = new Date('2026-11-30T23:59:00')
const GOAL = 5000
const MIN_PER_SEC = 16
const SPIKES: Record<number, number> = { 15: 1.2, 16: 1.35, 17: 2.7, 18: 1.9, 19: 1.7, 20: 3.0 }
const PROMOS: [number, number, string, number][] = [
  [8, 12, 'Early-Bird Holiday Week', 15],
  [17, 19, 'Black Friday Weekend', 30],
  [20, 20, 'Cyber Monday Mega Drop', 35],
]
const NICHES: [string, string, number, number, number][] = [
  ['Christmas Gift Tracker', 'spreadsheet', 0.92, 4, 9],
  ['Holiday Meal Planner', 'planner', 0.86, 5, 12],
  ['Advent Activity Calendar', 'printable', 0.81, 4, 8],
  ['Holiday Notion Dashboard', 'notion', 0.74, 9, 19],
  ['Black Friday Budget Sheet', 'spreadsheet', 0.79, 5, 10],
  ['Secret Santa Kit', 'printable', 0.83, 3, 7],
  ['Holiday Card Address Book', 'planner', 0.66, 4, 8],
  ['AI Gift Idea Prompt Pack', 'prompt_pack', 0.62, 7, 15],
  ['Holiday Social Canva Kit', 'canva_kit', 0.77, 12, 29],
  ['New Year Reset Planner', 'planner', 0.71, 6, 14],
  ['Cozy Winter Reading Log', 'printable', 0.55, 3, 6],
  ['Small Biz Holiday Sales Kit', 'canva_kit', 0.69, 15, 35],
]
const FLOURISH = ['Ultimate', 'Minimalist', 'Cozy', 'Stress-Free', 'All-in-One', 'Editable', '2026']
const HOOKS = ['Save this for Dec 1st', 'The calm-Christmas system', 'Stop forgetting gifts', 'Your Black Friday game plan']
const FUNNEL = ['order bump', 'bundle upsell', 'abandoned-cart email', 'thank-you cross-sell', 'review request']
const STATE_FOR: Record<AgentId, AgentState> = {
  aether: 'optimizing', scout: 'researching', forge: 'building', vitrine: 'building',
  echo: 'marketing', amplifier: 'marketing', closer: 'optimizing', pulse: 'optimizing',
}
const DURATION: Record<AgentId, [number, number]> = {
  aether: [1.5, 2.5], scout: [4, 7], forge: [6, 10], vitrine: [3, 5],
  echo: [3, 6], amplifier: [3, 5], closer: [3, 5], pulse: [2.5, 4],
}

const AMBIENT: Partial<Record<AgentId, [string, number]>> = {
  scout: ['Monitor trend signals', 5], echo: ['Schedule evergreen pin', 6], closer: ['Sweep support inbox', 7],
  vitrine: ['Audit listings & SEO', 8], amplifier: ['Tune bids & schedules', 8], forge: ['QA sweep on catalog', 9],
}
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
let uid = 0
const id = (p: string) => `${p}_${(++uid).toString(36)}${Math.random().toString(36).slice(2, 6)}`
function poisson(l: number) {
  if (l <= 0) return 0
  if (l > 30) return Math.max(0, Math.round(l + Math.sqrt(l) * gauss()))
  const L = Math.exp(-l)
  let k = 0, p = 1
  for (;;) { p *= Math.random(); if (p <= L) return k; k++ }
}
function gauss() { return Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random()) }

interface SimTask extends Task { payload: Record<string, any>; total: number; elapsed: number }
interface Opp { niche: string; type: string; demand: number; lo: number; hi: number }

export class ClientSim {
  private simMs = 0
  private paused = false
  private agents: Record<AgentId, AgentStatus>
  private queues: Record<AgentId, SimTask[]>
  private running: Partial<Record<AgentId, SimTask>> = {}
  private products: Product[] = []
  private listings: Listing[] = []
  private content: ContentAsset[] = []
  private campaigns: Campaign[] = []
  private opps: Record<string, Opp> = {}
  private events: SwarmEvent[] = []
  private series: number[] = []
  private m = { revenue: 0, orders: 0, visitors: 0, conversion_rate: 0, aov: 0, ad_spend: 0,
    traffic: { pinterest: 0, organic: 0, social: 0, email: 0, paid: 0 } as Record<string, number>, sim_time: '' }
  private k = { subscribers: 0, funnel: 1, insights: [] as string[], weights: {} as Record<string, number> }
  private done = new Set<string>()
  private cool: Record<string, number> = {}
  private listedAt: Record<string, number> = {}
  private scaled: Record<string, number> = {}
  private lastSeriesSec = 0
  private timer: number | undefined
  private wall = 0
  private silent = false

  constructor(private onSnapshot: (s: Snapshot) => void, private speed = 1) {
    this.agents = Object.fromEntries(AGENTS.map((a) => [a.id, {
      id: a.id, name: a.name, role: a.role, state: 'idle', current_task: null, progress: 0, queue: 0,
      completed: 0, level: 1, paused: false, boost: false, logs: [], outputs: [],
    } satisfies AgentStatus])) as unknown as Record<AgentId, AgentStatus>
    this.queues = Object.fromEntries(AGENTS.map((a) => [a.id, []])) as unknown as Record<AgentId, SimTask[]>
    this.emit('system', 'aether', 'Swarm online (local simulator) — mission: hit goal by Cyber Monday')
  }

  start() {
    let last = performance.now()
    this.timer = window.setInterval(() => {
      const now = performance.now()
      const dt = Math.min(0.5, (now - last) / 1000) * this.speed
      last = now
      this.step(dt)
    }, 200)
  }
  stop() { window.clearInterval(this.timer) }

  // ------------------------------------------------------------------ helpers
  private now() { return new Date(Math.min(END.getTime(), START.getTime() + this.simMs)) }
  private day() { return Math.floor((this.now().getTime() - new Date('2026-11-10T00:00:00').getTime()) / 864e5) }
  private label() {
    const d = this.now()
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' }) + ' ' +
      d.toTimeString().slice(0, 5)
  }
  private stamp() { const d = this.now(); return `${d.getMonth() + 1}/${d.getDate()} ${d.toTimeString().slice(0, 5)}` }
  private log(a: AgentId, s: string) { const x = this.agents[a]; x.logs = [...x.logs, `[${this.stamp()}] ${s}`].slice(-40) }
  private out(a: AgentId, s: string) { const x = this.agents[a]; x.outputs = [...x.outputs, s].slice(-20) }
  private emit(kind: SwarmEvent['kind'], source: AgentId, message: string, target?: AgentId, amount?: number) {
    this.events.push({ id: id('evt'), ts: Date.now() / 1000, sim_time: this.label(), kind, source, target, message, amount })
    if (this.events.length > 250) this.events.splice(0, this.events.length - 250)
  }
  private dispatch(src: AgentId, dst: AgentId, kind: string, title: string, payload: Record<string, any> = {}, priority = 5) {
    const [lo, hi] = DURATION[dst]
    this.queues[dst].push({ id: id('tsk'), kind, assignee: dst, created_by: src, title, priority, status: 'queued',
      progress: 0, payload, total: rand(lo, hi), elapsed: 0 })
    this.emit('handoff', src, title, dst)
  }
  private cooled(key: string, secs: number) {
    if (this.wall - (this.cool[key] ?? -1e9) >= secs) { this.cool[key] = this.wall; return true }
    return false
  }

  // ------------------------------------------------------------------ main step
  private step(dt: number) {
    if (this.paused || this.now() >= END) { this.publish(); return }
    this.wall += dt
    this.simMs += dt * MIN_PER_SEC * 60_000
    this.plan()
    for (const a of AGENTS) this.work(a.id, dt)
    this.market(dt * MIN_PER_SEC / 60)
    if (this.wall - this.lastSeriesSec >= 1) { this.lastSeriesSec = this.wall; this.series = [...this.series, this.m.revenue].slice(-120) }
    this.publish()
  }

  private plan() {
    const d = this.day()
    const listed = this.products.filter((p) => p.status === 'listed')
    const target = Math.min(26, 5 + Math.floor(d * 1.15))
    const inflight = [...this.queues.scout, ...this.queues.forge, this.running.scout, this.running.forge]
      .filter((t) => t && (t.kind === 'research_niche' || t.kind === 'build_product')).length
    if (d <= 16 && this.products.length + inflight < target && inflight < 3 && this.cooled('research', 1.5))
      this.dispatch('aether', 'scout', 'research_niche', 'Find next high-intent niche', {}, 4)
    const once = (k: string, fn: () => void) => { if (!this.done.has(k)) { this.done.add(k); fn() } }
    once('lead', () => this.dispatch('aether', 'echo', 'lead_magnet', 'Build email lead magnet', {}, 3))
    if (d >= 1) once('outreach', () => this.dispatch('aether', 'amplifier', 'outreach', 'Gift-guide creator outreach', {}, 5))
    for (const n of [4, 10, 16]) if (listed.length >= n) once('bundle' + n, () => {
      const top = [...listed].filter((p) => !p.bundle_of.length).sort((a, b) => b.revenue - a.revenue).slice(0, 4)
      this.dispatch('aether', 'forge', 'build_bundle', 'Assemble top-seller bundle', { ids: top.map((p) => p.id) }, 2)
    })
    for (const [s, e, name, disc] of PROMOS) if (d >= s && d <= e) once(name, () =>
      this.dispatch('aether', 'amplifier', 'promo', `Launch ${name}`, { name, disc }, 1))
    if (listed.length && this.cooled('pulse', 12)) this.dispatch('aether', 'pulse', 'analyze', 'Analyze performance', {}, 3)
    if (listed.length >= 2 && this.cooled('funnel', 22)) this.dispatch('aether', 'closer', 'optimize_funnel', 'Optimize funnel step', {}, 5)
    if (this.cooled('plan', 25)) this.queues.aether.push({ id: id('tsk'), kind: 'plan', assignee: 'aether', created_by: 'aether',
      title: 'Re-plan against goal', priority: 6, status: 'queued', progress: 0, payload: {}, total: 2, elapsed: 0 })
  }

  private work(a: AgentId, dt: number) {
    const st = this.agents[a]
    st.queue = this.queues[a].length
    if (st.paused) { st.state = 'paused'; return }
    let t = this.running[a]
    if (!t) {
      const q = this.queues[a].sort((x, y) => x.priority - y.priority)
      t = q.shift()
      if (!t && AMBIENT[a] && this.cooled('amb-' + a, AMBIENT[a]![1] * rand(0.7, 1.3))) {
        t = { id: id('tsk'), kind: 'ambient', assignee: a, created_by: a, title: AMBIENT[a]![0], priority: 9, status: 'queued',
          progress: 0, payload: {}, total: rand(2.5, 4.5), elapsed: 0 }
      }
      if (!t) { st.state = 'idle'; st.current_task = null; st.progress = 0; return }
      t.status = 'running'
      this.running[a] = t
      if (t.kind !== 'ambient') this.log(a, `▶ ${t.title}`)
    }
    t.elapsed += dt * (st.boost ? 2.2 : 1)
    t.progress = Math.min(1, t.elapsed / t.total)
    st.state = STATE_FOR[a]
    st.current_task = t.title
    st.progress = t.progress
    if (t.progress >= 1) {
      t.status = 'done'
      this.running[a] = undefined
      if (t.kind !== 'ambient') {
        st.completed++
        st.level = 1 + Math.min(4, Math.floor(st.completed / 6))
        this.log(a, `✔ ${t.title}`)
      }
      this.complete(a, t)
    }
  }

  private complete(a: AgentId, t: SimTask) {
    const d = this.day()
    switch (t.kind) {
      case 'research_niche': {
        const taken = new Set(Object.values(this.opps).map((o) => o.niche))
        const pool = NICHES.filter((n) => !taken.has(n[0]))
        const [niche, type, demand, lo, hi] = pick(pool.length ? pool : NICHES)
        const oid = id('opp')
        this.opps[oid] = { niche, type, demand: Math.min(1, demand * (1 + 0.015 * d) * rand(0.9, 1.08)), lo, hi }
        const msg = `${niche} · demand ${this.opps[oid].demand.toFixed(2)} · $${lo}-${hi}`
        this.out(a, msg); this.log(a, 'opportunity: ' + msg)
        this.dispatch('scout', 'forge', 'build_product', `Build: ${niche}`, { oid }, 3)
        break
      }
      case 'build_product':
      case 'build_bundle': {
        let p: Product
        if (t.kind === 'build_bundle') {
          const items = this.products.filter((x) => (t.payload.ids as string[]).includes(x.id))
          p = { id: id('prd'), title: `Holiday Command Center Bundle (${items.length} in 1)`, niche: 'Bundle', product_type: 'bundle',
            price: Math.round(items.reduce((s, x) => s + x.price, 0) * 0.6) - 0.01, status: 'ready', quality: 0.95,
            pages: items.length * 7, sales: 0, revenue: 0, views: 0, bundle_of: items.map((x) => x.id) }
        } else {
          const o = this.opps[t.payload.oid]
          let title = `${pick(FLOURISH)} ${o.niche} ${pick(['Kit', 'Bundle', 'Pack', 'System'])}`
          if (Math.random() < 0.12) {
            this.emit('compliance', 'forge', `Blocked term 'Grinch' in draft title → renamed`)
            title = title.replace('Ultimate', 'Holiday')
          }
          const q = Math.min(0.99, rand(0.8, 0.97))
          p = { id: id('prd'), title, niche: o.niche, product_type: o.type, price: Math.max(2.99, Math.round(rand(o.lo, o.hi) * (0.9 + q * 0.2)) - 0.01),
            status: 'ready', quality: q, pages: 7 + Math.floor(Math.random() * 6), sales: 0, revenue: 0, views: 0, bundle_of: [] }
        }
        this.products.push(p)
        this.out(a, `${p.title} · ${p.pages}p · QA ${p.quality.toFixed(2)}`)
        this.dispatch('forge', 'vitrine', 'create_listing', `List: ${p.title.slice(0, 28)}`, { pid: p.id }, 2)
        break
      }
      case 'create_listing': {
        const p = this.products.find((x) => x.id === t.payload.pid)!
        const plats: Listing['platform'][] = ['etsy', 'gumroad', ...(p.price >= 12 || p.bundle_of.length ? ['shopify' as const] : [])]
        for (const pl of plats) this.listings.push({ id: id('lst'), product_id: p.id, platform: pl, title: p.title, price: p.price, status: 'live', mode: 'simulated' })
        p.status = 'listed'
        this.listedAt[p.id] = this.simMs
        this.out(a, `LIVE ${p.title} on ${plats.join(', ')} @ $${p.price}`)
        this.emit('publish', 'vitrine', `Listed '${p.title}' on ${plats.length} storefronts @ $${p.price}`)
        this.dispatch('vitrine', 'echo', 'promote_content', `Content: ${p.title.slice(0, 26)}`, { pid: p.id }, 3)
        if (p.bundle_of.length || Math.random() < 0.5) this.dispatch('vitrine', 'amplifier', 'paid_boost', `Traffic: ${p.title.slice(0, 26)}`, { pid: p.id }, 4)
        break
      }
      case 'promote_content': {
        const p = this.products.find((x) => x.id === t.payload.pid)!
        for (let i = 0; i < 3; i++) this.content.push({ id: id('cnt'), product_id: p.id, channel: 'pinterest', kind: 'pin', title: `${pick(HOOKS)}: ${p.title}`, status: 'published', reach: 0 })
        this.content.push({ id: id('cnt'), product_id: p.id, channel: 'blog', kind: 'seo_post', title: `How to plan ${p.niche.toLowerCase()} in 2026`, status: 'published', reach: 0 })
        this.content.push({ id: id('cnt'), product_id: p.id, channel: pick(['tiktok', 'instagram', 'x']), kind: 'short', title: `POV: ${p.niche.toLowerCase()}`, status: 'published', reach: 0 })
        this.out(a, `5 assets → ${p.title.slice(0, 30)}`)
        this.emit('publish', 'echo', `Published 3 pins + SEO post + short for '${p.title.slice(0, 32)}'`)
        break
      }
      case 'lead_magnet':
        this.content.push({ id: id('cnt'), channel: 'email', kind: 'lead_magnet', title: 'Free: 1-page Holiday Countdown Checklist', status: 'published', reach: 0 })
        this.k.subscribers += 40
        this.out(a, 'Free: 1-page Holiday Countdown Checklist')
        break
      case 'outreach':
        this.campaigns.push({ id: id('cmp'), name: 'Gift-guide outreach (12 creators)', channel: 'outreach', daily_budget: 0, spend: 0, clicks: 0, conversions: 0, discount_pct: 0, status: 'active' })
        this.out(a, 'Gift-guide outreach (12 creators)')
        break
      case 'promo':
        this.campaigns.push({ id: id('cmp'), name: t.payload.name, channel: 'promo', daily_budget: 0, spend: 0, clicks: 0, conversions: 0, discount_pct: t.payload.disc, status: 'active' })
        this.emit('publish', 'amplifier', `🚀 ${t.payload.name}: ${t.payload.disc}% off sitewide is LIVE`)
        this.out(a, `${t.payload.name} −${t.payload.disc}%`)
        break
      case 'paid_boost': {
        const p = this.products.find((x) => x.id === t.payload.pid)!
        const active = this.campaigns.filter((c) => c.status === 'active').reduce((s, c) => s + c.daily_budget, 0)
        if (this.m.ad_spend < 300 && active < 22) {
          const c: Campaign = { id: id('cmp'), name: `Pinterest Ads · ${p.title.slice(0, 22)}`, channel: 'pinterest_ads', daily_budget: t.payload.winner ? 12 : 8, spend: 0, clicks: 0, conversions: 0, discount_pct: 0, status: 'active' }
        ;(c as any).pid = p.id
          this.campaigns.push(c)
          this.out(a, `${c.name} $${c.daily_budget}/day`)
        }
        break
      }
      case 'optimize_funnel': {
        const s = pick(FUNNEL)
        this.k.funnel = Math.min(1.3, this.k.funnel + rand(0.02, 0.05))
        this.out(a, `+ ${s} (funnel ×${this.k.funnel.toFixed(2)})`)
        break
      }
      case 'support':
        this.out(a, `Q: ${pick(['Editable in Canva?', 'Missing download link', 'Works on iPad?', 'A4 size?'])} → replied`)
        break
      case 'reprice': {
        const p = this.products.find((x) => x.id === t.payload.pid)
        if (p) { const old = p.price; p.price = Math.max(2.99, Math.round(p.price * 0.85) - 0.01); this.out(a, `A/B price ${p.title.slice(0, 24)}: $${old} → $${p.price}`) }
        break
      }
      case 'analyze': this.analyze(); break
      case 'ambient':
        if (a === 'scout') this.log(a, `trend watch: '${pick(['gift tracker', 'advent printable', 'notion holiday', 'secret santa'])}' interest ${pick(['↑', '↑↑', '→'])}`)
        if (a === 'echo') { const l = this.products.filter((p) => p.status === 'listed'); if (l.length && Math.random() < 0.5) { const p = pick(l); this.content.push({ id: id('cnt'), product_id: p.id, channel: 'pinterest', kind: 'pin', title: `${pick(HOOKS)}: ${p.title}`, status: 'scheduled', reach: 0 }) } }
        break
      case 'plan': this.out(a, `Plan: ${'$' + Math.max(0, GOAL - this.m.revenue).toFixed(0)} to goal · ${this.products.filter((p) => p.status === 'listed').length} live products`); break
    }
  }

  private analyze() {
    const listed = this.products.filter((p) => p.status === 'listed')
    if (listed.length < 2) return
    const avg = listed.reduce((s, p) => s + p.sales / Math.max(1, p.views), 0) / listed.length
    const by: Record<string, number[]> = {}
    listed.forEach((p) => (by[p.product_type] ??= []).push(p.sales / Math.max(1, p.views)))
    this.k.weights = Object.fromEntries(Object.entries(by).map(([t, v]) => [t, +((v.reduce((a, b) => a + b, 0) / v.length) / Math.max(avg, 1e-6) - 1).toFixed(2)]))
    const ranked = [...listed].sort((a, b) => b.revenue - a.revenue)
    const w = ranked[0], l = ranked[ranked.length - 1]
    if (w.sales >= 3) {
      const txt = `Scale winner: ${w.title.slice(0, 30)} ($${w.revenue.toFixed(0)}, CVR ${(100 * w.sales / Math.max(1, w.views)).toFixed(1)}%)`
      this.k.insights.push(txt); this.emit('insight', 'pulse', txt, 'aether'); this.out('pulse', txt)
      if (this.wall - (this.scaled[w.id] ?? -1e9) > 45) {
        this.scaled[w.id] = this.wall
        this.dispatch('pulse', 'amplifier', 'paid_boost', `Scale winner ads: ${w.title.slice(0, 24)}`, { pid: w.id, winner: true }, 2)
        this.dispatch('pulse', 'echo', 'promote_content', `More pins for winner: ${w.title.slice(0, 22)}`, { pid: w.id }, 3)
        if (this.day() <= 16 && this.products.length < 28) this.dispatch('pulse', 'scout', 'research_niche', `Adjacent niche to ${w.title.slice(0, 20)}`, {}, 3)
      }
    }
    if (l.views > 120 && l.sales / l.views < 0.012 && this.wall - (this.scaled[l.id] ?? -1e9) > 60) {
      this.scaled[l.id] = this.wall
      const txt = `Reprice/refresh: ${l.title.slice(0, 30)} (${l.views} views, ${l.sales} sales)`
      this.k.insights.push(txt); this.emit('insight', 'pulse', txt, 'aether')
      this.dispatch('pulse', 'vitrine', 'reprice', `Price test: ${l.title.slice(0, 24)}`, { pid: l.id }, 3)
    }
    this.k.insights.push(`Pace $${(this.m.revenue / (this.day() + 1)).toFixed(0)}/day · CVR ${(100 * this.m.conversion_rate).toFixed(2)}%`)
    this.k.insights = this.k.insights.slice(-30)
  }

  private market(hours: number) {
    const now = this.now(), d = this.day(), m = this.m
    const h = now.getHours() + now.getMinutes() / 60
    const diurnal = h >= 6 ? 0.35 + 0.65 * Math.max(0, Math.sin((Math.PI * (h - 6)) / 18)) : 0.3
    const season = (1 + 0.045 * d) * (SPIKES[d] ?? 1) * diurnal
    let promo = 0
    for (const c of this.campaigns) if (c.channel === 'promo' && c.status === 'active') {
      const end = PROMOS.find((p) => p[2] === c.name)?.[1] ?? 99
      if (d > end) c.status = 'ended'; else promo = Math.max(promo, c.discount_pct)
    }
    const pins = this.content.filter((c) => c.kind === 'pin')
    if (this.content.some((c) => c.kind === 'lead_magnet')) this.k.subscribers += poisson((2 + 0.06 * pins.length) * hours * season)
    const listed = this.products.filter((p) => p.status === 'listed')
    for (const p of listed) {
      const plats = this.listings.filter((l) => l.product_id === p.id && l.status === 'live').length
      const demand = Object.values(this.opps).find((o) => o.niche === p.niche)?.demand ?? 0.8
      const ramp = Math.min(1, 0.25 + (this.simMs - (this.listedAt[p.id] ?? this.simMs)) / 36e5 / 60)
      const myPins = pins.filter((c) => c.product_id === p.id)
      const shorts = this.content.filter((c) => c.product_id === p.id && (c.kind === 'short' || c.kind === 'seo_post')).length
      const ch: Record<string, number> = {
        organic: poisson(0.42 * demand * (0.7 + 0.3 * plats) * ramp * season * hours),
        pinterest: poisson(0.065 * myPins.length * ramp * season * hours),
        social: poisson(0.05 * shorts * season * hours),
        email: poisson((this.k.subscribers * 0.0005 * season * hours) / Math.max(1, listed.length) * (promo ? 3 : 1)),
        paid: 0,
      }
      for (const c of this.campaigns) {
        if (c.status === 'active' && c.daily_budget && m.ad_spend >= 300) c.status = 'ended'
        if (c.status === 'active' && c.daily_budget && (c as any).pid === p.id) {
          const spend = (c.daily_budget * hours / 24) * season
          const clicks = poisson(spend / 0.3)
          c.spend += spend; c.clicks += clicks; ch.paid += clicks; m.ad_spend += spend
        }
      }
      myPins.forEach((c) => (c.reach += poisson(9 * season * hours)))
      const visitors = Object.values(ch).reduce((a, b) => a + b, 0)
      if (!visitors) continue
      const priceEff = p.price * (1 - promo / 100)
      const cvr = 0.026 * p.quality * Math.pow(10 / Math.max(priceEff, 2), 0.35) * this.k.funnel * (1 + promo / 60) * (1 + 0.15 * (this.k.weights[p.product_type] ?? 0))
      let orders = 0
      for (let i = 0; i < visitors; i++) if (Math.random() < cvr) orders++
      p.views += visitors
      for (const [key, v] of Object.entries(ch)) m.traffic[key] = (m.traffic[key] ?? 0) + v
      m.visitors += visitors
      if (orders) {
        let ups = 0
        for (let i = 0; i < orders; i++) if (Math.random() < 0.08 * this.k.funnel) ups++
        const amount = +(orders * priceEff + ups * 4).toFixed(2)
        p.sales += orders; p.revenue = +(p.revenue + amount).toFixed(2)
        m.orders += orders; m.revenue = +(m.revenue + amount).toFixed(2)
        this.emit('sale', 'closer', `${orders}× ${p.title.slice(0, 34)} · $${amount.toFixed(2)}`, undefined, amount)
        if (Math.random() < 0.05 * orders && this.queues.closer.length < 3) this.dispatch('closer', 'closer', 'support', 'Customer inquiry', {}, 2)
      }
    }
    m.conversion_rate = m.visitors ? m.orders / m.visitors : 0
    m.aov = m.orders ? m.revenue / m.orders : 0
    m.sim_time = this.label()
  }

  // ------------------------------------------------------------------ io
  control(action: ControlAction, agent?: AgentId) {
    if (action === 'reset') { this.stop(); Object.assign(this, new ClientSim(this.onSnapshot, this.speed)); this.start(); return }
    if (agent) {
      const a = this.agents[agent]
      if (action === 'pause') a.paused = true
      if (action === 'resume') a.paused = false
      if (action === 'boost') a.boost = !a.boost
      if (action === 'kick') {
        const k: Partial<Record<AgentId, string>> = { scout: 'research_niche', pulse: 'analyze', closer: 'optimize_funnel' }
        if (k[agent]) this.dispatch('aether', agent, k[agent]!, 'Manual kick from operator', {}, 1)
      }
    } else if (action === 'pause') this.paused = true
    else if (action === 'resume') this.paused = false
    this.emit('system', 'aether', `operator: ${action} ${agent ?? 'swarm'}`)
    this.publish()
  }

  /** Jump the simulated clock forward (used for demos / screenshots: ?warp=hours). */
  warp(hours: number) {
    const steps = Math.ceil(hours * 60 / MIN_PER_SEC / 0.5)
    this.silent = true
    for (let i = 0; i < steps; i++) this.step(0.5)
    this.silent = false
    this.publish()
  }

  private publish() {
    if (this.silent) return
    const tasks = AGENTS.flatMap((a) => [this.running[a.id], ...this.queues[a.id]].filter(Boolean) as SimTask[])
      .sort((x, y) => (x.status === 'running' ? 0 : 1) - (y.status === 'running' ? 0 : 1) || x.priority - y.priority)
      .slice(0, 20).map(({ payload: _p, total: _t, elapsed: _e, ...t }) => t)
    this.onSnapshot({
      type: 'snapshot', mode: 'simulation',
      integrations: { llm: 'simulated', search: 'simulated', pdf: 'simulated', gumroad: 'simulated', etsy: 'simulated', shopify: 'simulated', pinterest: 'simulated', email: 'simulated', ads: 'simulated' },
      goal: GOAL, deadline: '2026-11-30', sim_time: this.label(), day_index: this.day(), days_total: 20,
      finished: this.now() >= END, paused: this.paused,
      metrics: { ...this.m, traffic: { ...this.m.traffic } },
      revenue_series: this.series,
      agents: AGENTS.map((a) => ({ ...this.agents[a.id] })),
      products: [...this.products].sort((a, b) => b.revenue - a.revenue).slice(0, 24).map((p) => ({ ...p })),
      listings: this.listings.slice(-24), content: this.content.slice(-16).map((c) => ({ ...c })),
      campaigns: this.campaigns.map((c) => ({ ...c })), tasks,
      events: this.events.slice(-40),
      knowledge: { subscribers: this.k.subscribers, insights: this.k.insights.slice(-8), niche_weights: this.k.weights },
      escalations: [],
    })
  }
}
