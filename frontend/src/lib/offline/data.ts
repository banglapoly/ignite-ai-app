/* Static copies of the API, exported by backend/scripts/export_static.py into public/static-api/.
   They let every page work on a static host (e.g. Netlify) with no backend running. */
const cache = new Map<string, Promise<any>>()
export function staticJSON<T>(name: string): Promise<T> {
  let p = cache.get(name)
  if (!p) {
    p = fetch(`/static-api/${name}.json`).then(r => {
      if (!r.ok) throw new Error(`${r.status} static-api/${name}.json`)
      return r.json()
    })
    p.catch(() => cache.delete(name))
    cache.set(name, p)
  }
  return p as Promise<T>
}

/** Python's format(x, 'g') for the values used here (6 significant digits, no trailing zeros). */
export function fmtG(x: number): string {
  if (!isFinite(x)) return String(x)
  if (x === 0) return '0'
  const e = Math.floor(Math.log10(Math.abs(x)))
  if (e < -4 || e >= 6) {
    const [m, ex] = x.toExponential(5).split('e')
    const mm = m.includes('.') ? m.replace(/0+$/, '').replace(/\.$/, '') : m
    const n = parseInt(ex, 10)
    return `${mm}e${n < 0 ? '-' : '+'}${String(Math.abs(n)).padStart(2, '0')}`
  }
  return String(parseFloat(x.toPrecision(6)))
}

/** Python round(x, n) for display values (half-to-even differences only at exact ties). */
export const round = (x: number, n: number) => { const f = 10 ** n; return Math.round(x * f) / f }
/** numpy.isclose with default tolerances. */
export const isClose = (a: number, b: number) => Math.abs(a - b) <= 1e-8 + 1e-5 * Math.abs(b)
