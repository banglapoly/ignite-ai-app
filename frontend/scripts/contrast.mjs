// Colour-contrast check for every route in light and dark.
// Uses the installed Edge browser and axe-core. Screenshots land in contrast-report/.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import AxeBuilder from '@axe-core/playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'contrast-report')
const base = process.env.CONTRAST_BASE || 'http://127.0.0.1:4173'
const routes = ['/', '/dashboard', '/how-it-works', '/simulator', '/learn', '/predict', '/sources', '/data', '/workspace', '/ask', '/safety']
const themes = ['light', 'dark']

mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const report = []
let violations = 0

for (const theme of themes) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme })
  const page = await context.newPage()
  await page.addInitScript(choice => { localStorage.setItem('ignite-theme', choice) }, theme)
  for (const route of routes) {
    const name = `${theme}-${route === '/' ? 'home' : route.slice(1).replace(/\//g, '-')}`
    const url = base + route
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })
    await page.evaluate(choice => {
      document.documentElement.dataset.theme = choice
    }, theme)
    await page.waitForTimeout(400)
    const shot = join(outDir, `${name}.png`)
    await page.screenshot({ path: shot, fullPage: true })
    const axe = await new AxeBuilder({ page }).options({ runOnly: { type: 'rule', values: ['color-contrast'] } }).analyze()
    const items = axe.violations.flatMap(v => v.nodes.map(n => ({
      route, theme, impact: n.impact, target: n.target, summary: n.failureSummary, html: (n.html || '').slice(0, 240),
    })))
    violations += items.length
    report.push({ route, theme, screenshot: shot, violationCount: items.length, violations: items })
    console.log(`${theme} ${route}: ${items.length} contrast violation(s)`)
  }
  await context.close()
}

writeFileSync(join(outDir, 'report.json'), JSON.stringify({ base, violations, pages: report }, null, 2))
await browser.close()
console.log(`total contrast violations: ${violations}`)
process.exit(violations === 0 ? 0 : 1)
