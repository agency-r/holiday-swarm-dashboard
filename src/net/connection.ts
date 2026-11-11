/**
 * Connects to the Python swarm over WebSocket when a backend is configured.
 * Production/public builds default to live Gumroad sales (sales.json) plus
 * ambient agent animation. The built-in ClientSim is used for ?sim=1 / ?local=1
 * / ?warp, or as a fallback when a backend URL is set but unreachable.
 *
 * URL resolution: ?ws=<url>  >  VITE_SWARM_WS  >  same-origin /ws (port 8899)  >  ws://<host>:8899/ws (dev only)
 * ?live=1 forces live Gumroad mode (useful in local dev).
 * ?sim=1 or ?local=1 forces the full local simulator. ?warp=<hours> fast-forwards it.
 */
import { applyLiveSales, EMPTY_LIVE, fetchLiveSales, POLL_MS, type LiveSnapshot } from './liveSales'
import { ClientSim } from '../sim/clientSim'
import { useSwarm } from '../store'
import type { ServerMessage, Snapshot } from '../types'

function hasExplicitBackend(): boolean {
  const params = new URLSearchParams(location.search)
  return Boolean(params.get('ws') || (import.meta.env.VITE_SWARM_WS as string | undefined))
}

function preferSim(): boolean {
  const params = new URLSearchParams(location.search)
  if (params.get('sim') === '1' || params.get('local') === '1') return true
  if (params.get('warp') && params.get('live') !== '1') return true
  return false
}

function preferLive(): boolean {
  const params = new URLSearchParams(location.search)
  if (params.get('live') === '1') return true
  if (preferSim()) return false
  if (hasExplicitBackend()) return false
  // Public/production hosts have no swarm backend — show real Gumroad totals.
  if (import.meta.env.PROD) return true
  return false
}

function wsUrl(): string {
  const q = new URLSearchParams(location.search).get('ws')
  if (q) return q
  const env = import.meta.env.VITE_SWARM_WS as string | undefined
  if (env) return env
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  if (location.port === '8899') return `${proto}://${location.host}/ws`
  return `${proto}://${location.hostname || 'localhost'}:8899/ws`
}

export function startConnection(): () => void {
  const params = new URLSearchParams(location.search)
  const store = useSwarm.getState()
  let sim: ClientSim | null = null
  let ws: WebSocket | null = null
  let retry: number | undefined
  let poll: number | undefined
  let disposed = false
  let live: LiveSnapshot | null = null

  const startSim = (ambient = false) => {
    if (sim) return
    const publish = (s: Snapshot) => {
      const overlay = live ?? (ambient ? EMPTY_LIVE : null)
      useSwarm.getState().setSnapshot(overlay ? applyLiveSales(s, overlay) : s)
    }
    sim = new ClientSim(publish, Number(params.get('speed') ?? 1), ambient)
    const warp = Number(params.get('warp') ?? 0)
    if (warp > 0 && !ambient) sim.warp(warp)
    sim.start()
    useSwarm.getState().setLink(ambient ? 'live' : 'local')
    store.setControlHandler((a, agent) => sim?.control(a, agent))
  }
  const stopSim = () => { sim?.stop(); sim = null }

  const startLive = () => {
    startSim(true)
    const load = async () => {
      if (disposed) return
      try {
        live = await fetchLiveSales()
        if (disposed) return
        useSwarm.getState().setDataError(null)
        const cur = useSwarm.getState().snap
        if (cur) useSwarm.getState().setSnapshot(applyLiveSales(cur, live))
        else {
          // Sim publishes immediately; if a snapshot isn't in yet, the next tick will apply.
        }
      } catch {
        if (disposed) return
        useSwarm.getState().setDataError('unavailable')
        if (!live) {
          live = EMPTY_LIVE
          const cur = useSwarm.getState().snap
          if (cur) useSwarm.getState().setSnapshot(applyLiveSales(cur, live))
        }
      }
    }
    void load()
    poll = window.setInterval(() => { void load() }, POLL_MS)
  }

  const connect = () => {
    if (disposed) return
    let opened = false
    try {
      ws = new WebSocket(wsUrl())
    } catch {
      startSim(); retry = window.setTimeout(connect, 10000); return
    }
    const failTimer = window.setTimeout(() => { if (!opened) { ws?.close(); } }, 2500)
    ws.onopen = () => {
      opened = true
      window.clearTimeout(failTimer)
      stopSim()
      useSwarm.setState({ snap: null })
      useSwarm.getState().setLink('backend')
      useSwarm.getState().setControlHandler((action, agent) => ws?.send(JSON.stringify({ type: 'control', action, agent })))
    }
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data) as ServerMessage
      if (msg.type === 'snapshot') useSwarm.getState().setSnapshot(msg)
      else if (msg.type === 'event') useSwarm.getState().pushEvent(msg.event)
    }
    ws.onclose = () => {
      window.clearTimeout(failTimer)
      if (disposed) return
      startSim()
      retry = window.setTimeout(connect, 10000)
    }
    ws.onerror = () => ws?.close()
  }

  if (preferLive()) {
    startLive()
    return () => {
      disposed = true
      window.clearInterval(poll)
      stopSim()
    }
  }

  if (preferSim()) {
    startSim()
    return () => {
      disposed = true
      stopSim()
    }
  }

  connect()

  return () => {
    disposed = true
    window.clearTimeout(retry)
    window.clearInterval(poll)
    ws?.close()
    stopSim()
  }
}
