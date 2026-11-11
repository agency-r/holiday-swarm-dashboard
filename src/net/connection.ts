/**
 * Connects to the Python swarm over WebSocket when a backend is configured.
 * Production/public builds default to the built-in ClientSim and do not probe
 * localhost or :8899, so a static deploy does not spin on failed reconnects.
 *
 * URL resolution: ?ws=<url>  >  VITE_SWARM_WS  >  same-origin /ws (port 8899)  >  ws://<host>:8899/ws (dev only)
 * ?local=1 forces the local simulator. ?warp=<hours> fast-forwards the local simulator.
 */
import { ClientSim } from '../sim/clientSim'
import { useSwarm } from '../store'
import type { ServerMessage } from '../types'

function hasExplicitBackend(): boolean {
  const params = new URLSearchParams(location.search)
  return Boolean(params.get('ws') || (import.meta.env.VITE_SWARM_WS as string | undefined))
}

function preferLocalSim(): boolean {
  const params = new URLSearchParams(location.search)
  if (params.get('local') === '1') return true
  if (hasExplicitBackend()) return false
  // Public/production hosts have no swarm backend.
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
  let disposed = false

  const startSim = () => {
    if (sim) return
    sim = new ClientSim((s) => useSwarm.getState().setSnapshot(s), Number(params.get('speed') ?? 1))
    const warp = Number(params.get('warp') ?? 0)
    if (warp > 0) sim.warp(warp)
    sim.start()
    useSwarm.getState().setLink('local')
    store.setControlHandler((a, agent) => sim?.control(a, agent))
  }
  const stopSim = () => { sim?.stop(); sim = null }

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

  if (preferLocalSim()) {
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
    ws?.close()
    stopSim()
  }
}
