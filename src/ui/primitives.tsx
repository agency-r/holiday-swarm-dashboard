import type { ReactNode } from 'react'
import { C } from '../theme'

export function Panel({ code, title, right, children, className = '' }: { code: string; title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-h">
        <span className="panel-code">{code}</span>
        <span className="panel-title">{title}</span>
        <span className="panel-right">{right}</span>
      </header>
      {children}
    </section>
  )
}

export function Led({ color, blink = false, size = 8 }: { color: string; blink?: boolean; size?: number }) {
  return <span className={`led ${blink ? 'blink' : ''}`} style={{ background: color, width: size, height: size, boxShadow: `0 0 ${size}px ${color}88` }} />
}

/** OP-1 style rotary knob. value 0..1 maps to −135°..+135°. */
export function Knob({ value, color, size = 46, label, readout }: { value: number; color: string; size?: number; label: string; readout: string }) {
  const v = Math.max(0, Math.min(1, value))
  const ang = -135 + v * 270
  const r = size / 2
  const arcR = r - 3
  const a0 = (-225 * Math.PI) / 180
  const a1 = ((-225 + v * 270) * Math.PI) / 180
  const large = v * 270 > 180 ? 1 : 0
  const p = (a: number) => `${r + arcR * Math.cos(a)} ${r + arcR * Math.sin(a)}`
  return (
    <div className="knob">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={r} cy={r} r={arcR} fill="none" stroke="#D6D2C9" strokeWidth={3} strokeDasharray="2 2.6" />
        {v > 0.002 && <path d={`M ${p(a0)} A ${arcR} ${arcR} 0 ${large} 1 ${p(a1)}`} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />}
        <circle cx={r} cy={r} r={r - 9} fill={C.white} stroke="#CFCAC0" />
        <g style={{ transform: `rotate(${ang}deg)`, transformOrigin: `${r}px ${r}px`, transition: 'transform .6s cubic-bezier(.2,.9,.3,1.3)' }}>
          <rect x={r - 1.5} y={10} width={3} height={r - 12} rx={1.5} fill={C.ink} />
        </g>
      </svg>
      <div className="knob-txt">
        <div className="knob-read">{readout}</div>
        <div className="lbl">{label}</div>
      </div>
    </div>
  )
}

export function Segments({ value, n = 20, color = C.yellow, marks = [] as number[] }: { value: number; n?: number; color?: string; marks?: number[] }) {
  const lit = Math.round(Math.max(0, Math.min(1, value)) * n)
  return (
    <div className="segments">
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} className="seg" style={{ background: i < lit ? (marks.includes(i) ? C.orange : color) : marks.includes(i) ? '#F1D3C0' : undefined }} />
      ))}
    </div>
  )
}

export function Spark({ data, w = 260, h = 44, color = C.ink }: { data: number[]; w?: number; h?: number; color?: string }) {
  if (data.length < 2) return <svg width={w} height={h} />
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 2 - (v / max) * (h - 6)}`)
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="spark">
      <polygon points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill={C.yellow} opacity={0.35} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
