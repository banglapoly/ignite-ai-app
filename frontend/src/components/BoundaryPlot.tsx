import { useMemo, useState, type ReactElement } from 'react'
import type { Boundary, Experiment, Outcome } from '../lib/api'
import { OUTCOME_COLOR, OUTCOME_LABEL, OUTCOMES } from '../lib/api'

const AX_LABEL: Record<string, string> = { oxygen_pct: 'Oxygen (% by volume)', pressure_kpa: 'Pressure (kPa)', flow_cm_s: 'Flow velocity (cm/s, √ scale)' }

interface Props {
  data: Boundary | null
  current: { oxygen_pct: number; pressure_kpa: number; flow_cm_s: number; flow_direction: string }
  inRange: boolean
}

export default function BoundaryPlot({ data, current, inRange }: Props) {
  const [hover, setHover] = useState<Experiment | null>(null)
  const W = 640, H = 400, m = { l: 58, r: 16, t: 14, b: 46 }
  const iw = W - m.l - m.r, ih = H - m.t - m.b

  const scales = useMemo(() => {
    if (!data) return null
    const tf = (a: string) => (a === 'flow_cm_s' ? Math.sqrt : (v: number) => v)
    const fx = tf(data.x), fy = tf(data.y)
    const pad = (lo: number, hi: number) => (hi > lo ? [lo, hi] : [lo - 1, hi + 1])
    const [x0, x1] = pad(fx(data.xs[0]), fx(data.xs[data.xs.length - 1]))
    const [y0, y1] = pad(fy(data.ys[0]), fy(data.ys[data.ys.length - 1]))
    const sx = (v: number) => m.l + ((fx(v) - x0) / (x1 - x0)) * iw
    const sy = (v: number) => m.t + ih - ((fy(v) - y0) / (y1 - y0)) * ih
    return { sx, sy, fx, fy, x0, x1, y0, y1 }
  }, [data])

  if (!data || !scales) return <div className="plot-empty">Loading decision boundary…</div>
  const { sx, sy } = scales
  const xs = data.xs, ys = data.ys
  const edges = (arr: number[], s: (v: number) => number) => arr.map((v, i) => {
    const prev = i === 0 ? s(v) - (s(arr[1] ?? v + 1) - s(v)) / 2 : (s(arr[i - 1]) + s(v)) / 2
    const next = i === arr.length - 1 ? s(v) + (s(v) - s(arr[i - 1] ?? v - 1)) / 2 : (s(arr[i + 1]) + s(v)) / 2
    return [Math.min(prev, next), Math.abs(next - prev)]
  })
  const ex = edges(xs, sx), ey = edges(ys, sy)
  const cells: ReactElement[] = []
  for (let j = 0; j < ys.length; j++) for (let i = 0; i < xs.length; i++) {
    const c = data.z[j][i]
    if (!c) continue
    cells.push(<rect key={`${i}-${j}`} x={ex[i][0]} y={ey[j][0]} width={ex[i][1] + 0.6} height={ey[j][1] + 0.6}
      fill={OUTCOME_COLOR[c as Outcome]} opacity={0.12 + 0.3 * (data.confidence[j][i] - 0.33) / 0.67} />)
  }
  const ticks = (lo: number, hi: number, isFlow: boolean) => {
    if (isFlow) return [0, 1, 2, 3, 5, 10, 20, 30, 50].filter(t => t >= lo - 1e-9 && t <= hi + 1e-9)
    const n = 6, step = (hi - lo) / n || 1
    const nice = Math.pow(10, Math.floor(Math.log10(step)))
    const st = [1, 2, 2.5, 5, 10].map(k => k * nice).find(k => k >= step) || step
    const out = []
    for (let t = Math.ceil(lo / st) * st; t <= hi + 1e-9; t += st) out.push(+t.toFixed(6))
    return out
  }
  const xt = ticks(xs[0], xs[xs.length - 1], data.x === 'flow_cm_s')
  const yt = ticks(ys[0], ys[ys.length - 1], data.y === 'flow_cm_s')
  const thirdKey = data.third as keyof Experiment
  const cx = (current as any)[data.x], cy = (current as any)[data.y]

  return (
    <div className="plot-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="plot" role="img" aria-label="Decision boundary plot">
        <defs>
          <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#1c2544" strokeWidth="3" />
          </pattern>
        </defs>
        <rect x={m.l} y={m.t} width={iw} height={ih} fill="url(#hatch)" />
        {cells}
        {xt.map(t => <g key={'x' + t}><line x1={sx(t)} x2={sx(t)} y1={m.t + ih} y2={m.t + ih + 5} stroke="#6b7aa8" /><text x={sx(t)} y={m.t + ih + 18} className="tick" textAnchor="middle">{t}</text></g>)}
        {yt.map(t => <g key={'y' + t}><line x1={m.l - 5} x2={m.l} y1={sy(t)} y2={sy(t)} stroke="#6b7aa8" /><text x={m.l - 8} y={sy(t) + 4} className="tick" textAnchor="end">{t}</text></g>)}
        <rect x={m.l} y={m.t} width={iw} height={ih} fill="none" stroke="#2c3864" />
        <text x={m.l + iw / 2} y={H - 8} className="axlabel" textAnchor="middle">{AX_LABEL[data.x]}</text>
        <text transform={`translate(14 ${m.t + ih / 2}) rotate(-90)`} className="axlabel" textAnchor="middle">{AX_LABEL[data.y]}</text>
        {data.points.map(p => {
          const sameThird = Math.abs((p[thirdKey] as number) - data.third_value) < 1e-6
          const sameDir = p.flow_direction === current.flow_direction
          const faded = !(sameThird && sameDir)
          const X = sx(p[data.x as keyof Experiment] as number), Y = sy(p[data.y as keyof Experiment] as number)
          const col = OUTCOME_COLOR[p.outcome]
          return (
            <a key={p.row_id} href={p.source_url} target="_blank" rel="noreferrer">
              <g opacity={faded ? 0.3 : 1} onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }}>
                {p.outcome === 'no_spread' ? <path d={`M${X - 5},${Y - 5}L${X + 5},${Y + 5}M${X + 5},${Y - 5}L${X - 5},${Y + 5}`} stroke={col} strokeWidth={2.6} />
                  : p.outcome === 'marginal_spread' ? <rect x={X - 4.5} y={Y - 4.5} width={9} height={9} fill={col} stroke="#0b1020" transform={`rotate(45 ${X} ${Y})`} />
                    : <circle cx={X} cy={Y} r={5} fill={col} stroke="#0b1020" strokeWidth={1.2} />}
              </g>
            </a>
          )
        })}
        {cx !== undefined && cy !== undefined && (
          <g pointerEvents="none">
            <circle cx={sx(cx)} cy={sy(cy)} r={11} fill="none" stroke={inRange ? '#fff' : '#ff4d6d'} strokeWidth={2} strokeDasharray={inRange ? '' : '3 3'} />
            <line x1={sx(cx) - 16} x2={sx(cx) + 16} y1={sy(cy)} y2={sy(cy)} stroke="#fff" strokeOpacity={0.6} />
            <line y1={sy(cy) - 16} y2={sy(cy) + 16} x1={sx(cx)} x2={sx(cx)} stroke="#fff" strokeOpacity={0.6} />
          </g>
        )}
      </svg>
      <div className="plot-legend">
        {OUTCOMES.map(o => <span key={o}><i style={{ background: OUTCOME_COLOR[o] }} />{OUTCOME_LABEL[o]}</span>)}
        <span><i className="hatch" />outside tested envelope (no prediction)</span>
        <span className="muted">● spread · ◆ marginal · ✕ no spread · faded = different {data.third === 'pressure_kpa' ? 'pressure' : data.third === 'flow_cm_s' ? 'flow' : 'O₂'} or flow direction than the slice</span>
      </div>
      {hover && (
        <div className="plot-tip">
          <b>{hover.report_id}</b> · {hover.row_id}<br />
          {hover.oxygen_pct}% O₂ · {hover.pressure_kpa} kPa · {hover.flow_cm_s} cm/s {hover.flow_direction}<br />
          <span style={{ color: OUTCOME_COLOR[hover.outcome] }}>{OUTCOME_LABEL[hover.outcome]}</span> — {hover.outcome_detail}
        </div>
      )}
      <p className="plot-note">Slice shown at {data.third.replace('_', ' ').replace('pct', '%').replace('kpa', 'kPa').replace('cm s', 'cm/s')} = {data.third_value}. Shading = model class (stronger = higher probability). Markers are the real published experiments for this material; click one to open its NTRS record.</p>
    </div>
  )
}
