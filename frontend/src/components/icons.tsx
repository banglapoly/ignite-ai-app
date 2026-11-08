/** Line icons, 1.6px square stroke, adapted from the Engzy handmade set. */
type P = { size?: number; className?: string }
const base = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.6, strokeLinecap: 'square' as const, strokeLinejoin: 'miter' as const, 'aria-hidden': true as const,
})

export const IconBook = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4z" /><path d="M20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" /></svg>
)
export const IconPage = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}><path d="M6 3h9l3 3v15H6z" /><path d="M9 10h6M9 14h6M9 18h4" /></svg>
)
export const IconPen = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 20l1-4L16 5l3 3L8 19z" /><path d="M14 7l3 3" /></svg>
)
export const IconChart = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 20h16" /><path d="M7 16v-5M12 16V7M17 16v-8" /></svg>
)
export const IconGrid = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}><rect x="4" y="4" width="7" height="7" /><rect x="13" y="4" width="7" height="7" /><rect x="4" y="13" width="7" height="7" /><rect x="13" y="13" width="7" height="7" /></svg>
)
