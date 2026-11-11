// Mirrors backend/swarm/models.py + SharedState.snapshot()
export type AgentId = 'aether' | 'scout' | 'forge' | 'vitrine' | 'echo' | 'amplifier' | 'closer' | 'pulse'
export type AgentState = 'idle' | 'researching' | 'building' | 'marketing' | 'optimizing' | 'blocked' | 'paused'

export interface AgentStatus {
  id: AgentId
  name: string
  role: string
  state: AgentState
  current_task: string | null
  progress: number
  queue: number
  completed: number
  level: number
  paused: boolean
  boost: boolean
  logs: string[]
  outputs: string[]
}

export interface Product {
  id: string
  title: string
  niche: string
  product_type: string
  price: number
  status: string
  quality: number
  pages: number
  sales: number
  revenue: number
  views: number
  bundle_of: string[]
}

export interface Listing {
  id: string
  product_id: string
  platform: 'gumroad' | 'etsy' | 'shopify'
  title: string
  price: number
  status: 'draft' | 'live' | 'paused'
  url?: string | null
  mode: 'simulated' | 'live'
}

export interface ContentAsset {
  id: string
  product_id?: string | null
  channel: string
  kind: string
  title: string
  status: string
  reach: number
}

export interface Campaign {
  id: string
  name: string
  channel: string
  daily_budget: number
  spend: number
  clicks: number
  conversions: number
  discount_pct: number
  status: 'planned' | 'active' | 'ended'
}

export interface Task {
  id: string
  kind: string
  assignee: AgentId
  created_by: AgentId
  title: string
  priority: number
  status: 'queued' | 'running' | 'done' | 'failed' | 'blocked'
  progress: number
}

export type EventKind = 'handoff' | 'sale' | 'log' | 'compliance' | 'insight' | 'escalation' | 'publish' | 'system'

export interface SwarmEvent {
  id: string
  ts: number
  sim_time: string
  kind: EventKind
  source: AgentId
  target?: AgentId | null
  message: string
  amount?: number | null
  /** True when the row is ambient agent activity, not a real Gumroad event. */
  simulated?: boolean
}

export interface Metrics {
  revenue: number
  net_revenue?: number | null
  net_after_fees?: boolean
  orders: number
  visitors: number | null
  conversion_rate: number | null
  aov: number
  ad_spend: number
  traffic: Record<string, number>
  sim_time: string
}

export interface Snapshot {
  type: 'snapshot'
  mode: 'simulation' | 'live'
  integrations: Record<string, string>
  goal: number
  deadline: string
  sim_time: string
  day_index: number
  days_total: number
  finished: boolean
  paused: boolean
  metrics: Metrics
  revenue_series: number[]
  agents: AgentStatus[]
  products: Product[]
  listings: Listing[]
  content: ContentAsset[]
  campaigns: Campaign[]
  tasks: Task[]
  events: SwarmEvent[]
  knowledge: { subscribers: number | null; insights: string[]; niche_weights: Record<string, number> }
  escalations: { agent: string; action: string; note?: string }[]
  data_updated_at?: string | null
}

export type ServerMessage = Snapshot | { type: 'event'; event: SwarmEvent }
export type ControlAction = 'pause' | 'resume' | 'boost' | 'kick' | 'reset'
