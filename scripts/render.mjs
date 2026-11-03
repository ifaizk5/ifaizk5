// Renders every SVG plate in assets/ for the profile README, in light and dark.
// Static plates come from the data below; the build log and the "back of the box" label are rebuilt from
// live GitHub data (GITHUB_TOKEN). The daily workflow runs this, so if a run fails the last SVGs stay up.
//
//   GITHUB_TOKEN=... node scripts/render.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import subsetFont from 'subset-font'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'assets')
const LOGIN = 'ifaizk5'
const NOW = new Date()

// ------------------------------------------------------------------ design system
// Four voices, used deliberately: Grotesk for names, Serif italic for asides, Pixel for labels, Mono for data.
const FONT_FILES = {
  G: 'space-grotesk/files/space-grotesk-latin-700-normal.woff2',
  g: 'space-grotesk/files/space-grotesk-latin-500-normal.woff2',
  S: 'instrument-serif/files/instrument-serif-latin-400-italic.woff2',
  P: 'silkscreen/files/silkscreen-latin-400-normal.woff2',
  M: 'space-mono/files/space-mono-latin-400-normal.woff2',
}
const FAMILY = { G: 'G', g: 'g', S: 'S', P: 'P', M: 'M' }
const fontBuf = Object.fromEntries(Object.entries(FONT_FILES).map(([k, f]) => [k, fs.readFileSync(path.join(ROOT, 'node_modules/@fontsource', f))]))

const ACCENT = { blue: '#2E5BFF', lime: '#C5F04A', pink: '#FF6BA6', amber: '#FFB21A' }
const THEMES = {
  light: { bg: '#F6F5F1', ink: '#141414', soft: '#6B6A66', line: 'rgba(20,20,20,0.13)', panel: '#ECEAE3', blue: ACCENT.blue },
  dark: { bg: '#111216', ink: '#ECEBE7', soft: '#9C9B97', line: 'rgba(236,235,231,0.15)', panel: '#1A1B20', blue: '#5B7CFF' },
}
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

// Records which glyphs each font draws so every SVG embeds only what it uses.
function collector() {
  const used = { G: '', g: '', S: '', P: '', M: '' }
  const t = (f, s) => ((used[f] += s), esc(s))
  return { used, t }
}

async function writeSvg(name, w, h, label, draw) {
  for (const [theme, c] of Object.entries(THEMES)) {
    const { used, t } = collector()
    const body = draw(c, t, theme)
    let faces = ''
    for (const [k, text] of Object.entries(used)) {
      if (!text) continue
      const sub = await subsetFont(fontBuf[k], text + ' ', { targetFormat: 'woff2' })
      faces += `@font-face{font-family:${FAMILY[k]};src:url(data:font/woff2;base64,${sub.toString('base64')}) format('woff2')}`
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><style>${faces}
.G{font-family:G,'Space Grotesk',Arial,sans-serif;font-weight:700}.g{font-family:g,'Space Grotesk',Arial,sans-serif;font-weight:500}
.S{font-family:S,'Instrument Serif',Georgia,serif;font-style:italic}.P{font-family:P,'Silkscreen',monospace}.M{font-family:M,'Space Mono',monospace}
.a{animation:.9s cubic-bezier(.22,1,.36,1) both}.tb{transform-box:fill-box;transform-origin:center}.tl{transform-box:fill-box;transform-origin:left center}
@keyframes up{from{opacity:0;transform:translateY(24px)}}@keyframes in{from{opacity:0}}@keyframes pop{from{opacity:0;transform:scale(.2)}}
@keyframes grow{from{transform:scaleX(0)}}@keyframes draw{from{stroke-dashoffset:1}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>
${body}</svg>`
    fs.writeFileSync(path.join(OUT, `${name}-${theme}.svg`), svg.replace(/\n\s*\n/g, '\n'))
    console.log(`${name}-${theme}.svg ${(svg.length / 1024).toFixed(1)} KB`)
  }
}
const d = (s) => `animation-delay:${s}s`

// ------------------------------------------------------------------ live data
async function gh(pathOrQuery, graphql) {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN is required')
  const res = graphql
    ? await fetch('https://api.github.com/graphql', { method: 'POST', headers: { Authorization: `bearer ${token}` }, body: JSON.stringify({ query: pathOrQuery }) })
    : await fetch(`https://api.github.com${pathOrQuery}`, { headers: { Authorization: `bearer ${token}`, Accept: 'application/vnd.github+json' } })
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${pathOrQuery.slice(0, 60)}`)
  const json = await res.json()
  if (json.errors) throw new Error(JSON.stringify(json.errors))
  return graphql ? json.data : json
}

const live = await gh(`{ user(login: "${LOGIN}") {
  recent: repositories(first: 8, ownerAffiliations: OWNER, isFork: false, orderBy: { field: PUSHED_AT, direction: DESC }) {
    nodes { name defaultBranchRef { target { ... on Commit { history(first: 6) { nodes { messageHeadline committedDate author { user { login } } } } } } } }
  }
  contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount weekday } } } }
  repositories(first: 100, ownerAffiliations: OWNER, isFork: false) { totalCount nodes { name languages(first: 12) { edges { size node { name } } } } }
} }`, true)

const ago = (iso) => {
  const days = Math.floor((NOW - new Date(iso)) / 864e5)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`
}

// ================================================================== 01 · hero
const phrases = [
  ['builds interfaces.', 'G', ACCENT.pink],
  ['designs backends.', 'M', 'blue'],
  ['trains models.', 'S', ACCENT.amber],
  ['ships to the cloud.', 'P', ACCENT.lime],
]
await writeSvg('hero', 1200, 500, 'Faiz Khan, a software engineer who builds interfaces, designs backends, trains models and ships to the cloud. Pakistan. Open to software engineering roles.', (c, t, theme) => {
  const cycle = phrases.length * 3 // seconds per full rotation
  const css = phrases.map((_, i) => `@keyframes ph${i}{0%{opacity:0;transform:translateY(18px)}${(i * 100) / phrases.length + 2}%,${((i + 1) * 100) / phrases.length - 2}%{opacity:1;transform:none}${((i + 1) * 100) / phrases.length}%,100%{opacity:0;transform:translateY(-18px)}}`).join('')
  return `<style>${css}</style>
<rect width="1200" height="500" fill="${c.bg}"/>
<text x="60" y="66" class="P" font-size="16" fill="${c.soft}">${t('P', 'PLATE 00 · IFAIZK5')}</text>
<text x="1140" y="66" class="M" font-size="16" fill="${c.soft}" text-anchor="end">${t('M', 'pakistan · open to roles')}</text>
<circle cx="${1140 - 252}" cy="60" r="5" fill="${ACCENT.lime}" stroke="${c.ink}" stroke-width="1.5"/>
<rect x="372" y="168" width="384" height="56" fill="${ACCENT.lime}" opacity="${theme === 'dark' ? 0.85 : 1}" class="a tl" style="animation-name:grow;${d(0.7)}"/>
<text x="52" y="236" class="G a" font-size="168" letter-spacing="-8" fill="${c.ink}" style="animation-name:up;${d(0.1)}">${t('G', 'Faiz Khan')}</text>
<text x="60" y="318" class="S a" font-size="54" fill="${c.soft}" style="animation-name:in;${d(0.5)}">${t('S', 'a software engineer who')}</text>
${phrases.map(([p, f, col], i) => `<text x="60" y="404" class="${f} tl" font-size="${f === 'P' ? 50 : f === 'S' ? 76 : 64}" fill="${col === 'blue' ? c.blue : col}" style="opacity:${i === 0 ? 1 : 0};animation:ph${i} ${cycle}s ${0.9}s ease-in-out infinite">${t(f, p)}</text>`).join('')}
<path d="M1000 300 C1060 296 1092 330 1080 372 C1068 414 980 430 930 412" fill="none" stroke="${ACCENT.pink}" stroke-width="3" stroke-linecap="round" pathLength="1" stroke-dasharray="1" class="a" style="animation-name:draw;animation-duration:1.2s;${d(1.4)}"/>
<path d="M930 412 l14 -12 M930 412 l18 6" stroke="${ACCENT.pink}" stroke-width="3" stroke-linecap="round" class="a" style="animation-name:in;${d(2.4)}"/>
<text x="960" y="282" class="P a" font-size="15" fill="${c.soft}" style="animation-name:in;${d(1.6)}">${t('P', 'CHANGES WEEKLY')}</text>
<line x1="60" y1="452" x2="1140" y2="452" stroke="${c.line}" stroke-width="1.5"/>
<text x="60" y="482" class="M" font-size="16" fill="${c.soft}">${t('M', "BS Software Engineering, SZABIST '26 · ex ZETSOL, 10Pearls, Grands Digital")}</text>`
})

// ================================================================== 02 · map of experiments
const AREA = { ai: ['AI / ML', 'blue'], full: ['full-stack', ACCENT.lime], front: ['frontend craft', ACCENT.pink], back: ['backend', ACCENT.amber] }
// x: interface (0) → infrastructure (1); y: practice (0) → product & research (1)
const projects = [
  { n: 'HealthLens', c: 'ML · FastAPI · React', a: 'ai', x: 0.74, y: 0.92, r: 26 },
  { n: 'FairVision', c: 'fairness research', a: 'ai', x: 0.56, y: 0.7, r: 19 },
  { n: 'SafeZone', c: 'NestJS · PostgreSQL', a: 'back', x: 0.93, y: 0.5, r: 21 },
  { n: 'btbt store', c: 'MERN · neo-brutalist · live', a: 'full', x: 0.43, y: 0.86, r: 20 },
  { n: 'Noteify', c: 'MERN · Lexical · Vitest', a: 'full', x: 0.52, y: 0.42, r: 17 },
  { n: 'faizkhan.tech', c: 'React · GSAP · CI', a: 'front', x: 0.18, y: 0.78, r: 18 },
  { n: 'Figma → code', c: 'NFT · Rappi · neoFi', a: 'front', x: 0.1, y: 0.38, r: 16 },
  { n: 'chat UI', c: 'vanilla JS', a: 'front', x: 0.3, y: 0.2, r: 11 },
  { n: 'weather app', c: 'AccuWeather API', a: 'full', x: 0.62, y: 0.12, r: 11 },
  { n: 'UI patterns', c: 'uploader · forms', a: 'front', x: 0.13, y: 0.08, r: 10 },
]
await writeSvg('map', 1200, 680, 'A map of experiments: projects plotted from interface to infrastructure and from practice to product and research. HealthLens and FairVision (AI/ML), SafeZone (backend), the btbt store and Noteify (full-stack), faizkhan.tech and Figma-to-code builds (frontend), plus small tools.', (c, t) => {
  const X = (v) => 140 + v * 900, Y = (v) => 560 - v * 400
  const col = (a) => (AREA[a][1] === 'blue' ? c.blue : AREA[a][1])
  return `<rect width="1200" height="680" rx="28" fill="${c.panel}"/>
<text x="60" y="84" class="S a" font-size="58" fill="${c.ink}" style="animation-name:up">${t('S', 'A map of experiments')}</text>
<text x="1140" y="80" class="P" font-size="15" fill="${c.soft}" text-anchor="end">${t('P', 'PLATE 01')}</text>
<line x1="${X(0)}" y1="${Y(0.5)}" x2="${X(1)}" y2="${Y(0.5)}" stroke="${c.line}" stroke-width="1.5" stroke-dasharray="4 7"/>
<line x1="${X(0.5)}" y1="${Y(1)}" x2="${X(0.5)}" y2="${Y(0)}" stroke="${c.line}" stroke-width="1.5" stroke-dasharray="4 7"/>
<text x="${X(0)}" y="${Y(0) + 46}" class="M" font-size="15" fill="${c.soft}">${t('M', '← interface')}</text>
<text x="${X(1)}" y="${Y(0) + 46}" class="M" font-size="15" fill="${c.soft}" text-anchor="end">${t('M', 'infrastructure →')}</text>
<text x="${X(0.5) + 10}" y="${Y(1) - 8}" class="M" font-size="15" fill="${c.soft}">${t('M', '↑ product & research')}</text>
<text x="${X(0.5) + 10}" y="${Y(0) + 22}" class="M" font-size="15" fill="${c.soft}">${t('M', '↓ practice')}</text>
${projects.map((p, i) => {
  const right = p.x > 0.8
  const lx = right ? X(p.x) - p.r - 12 : X(p.x) + p.r + 12
  return `<g class="a" style="animation-name:in;${d(0.3 + i * 0.09)}"><circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.r}" fill="${col(p.a)}" class="a tb" style="animation-name:pop;animation-timing-function:cubic-bezier(.34,1.56,.64,1);${d(0.3 + i * 0.09)}"/>
<text x="${lx}" y="${Y(p.y) - 2}" class="g" font-size="${p.r > 15 ? 22 : 18}" fill="${c.ink}" ${right ? 'text-anchor="end"' : ''}>${t('g', p.n)}</text>
<text x="${lx}" y="${Y(p.y) + 18}" class="M" font-size="13" fill="${c.soft}" ${right ? 'text-anchor="end"' : ''}>${t('M', p.c)}</text></g>`
}).join('\n')}
${Object.values(AREA).map(([l, cl], i) => `<circle cx="${60 + i * 190}" cy="648" r="7" fill="${cl === 'blue' ? c.blue : cl}"/><text x="${76 + i * 190}" y="653" class="M" font-size="15" fill="${c.soft}">${t('M', l)}</text>`).join('')}`
})

// ================================================================== 03 · specimen: HealthLens
const spec = [
  ['data', 'pandas · Polars'],
  ['models', 'scikit-learn · XGBoost · PyTorch'],
  ['explain', 'SHAP'],
  ['language', 'Hugging Face NER'],
  ['serve', 'FastAPI · PostgreSQL · React'],
  ['track', 'MLflow · Docker Compose'],
]
await writeSvg('specimen', 1200, 470, 'Specimen 01, currently building: HealthLens, an end-to-end healthcare ML playground. Data with pandas and Polars, models with scikit-learn, XGBoost and PyTorch, SHAP explanations, Hugging Face NER, served with FastAPI, PostgreSQL and React, tracked with MLflow and Docker Compose.', (c, t, theme) => {
  const fg = '#FFFFFF', sub = 'rgba(255,255,255,0.72)', bg = theme === 'dark' ? '#2440C7' : ACCENT.blue
  const ecg = 'M60 330 H300 l12 -30 l14 60 l12 -80 l16 100 l12 -50 H560' // stays between the subtitle and the disclaimer
  return `<rect width="1200" height="470" rx="28" fill="${bg}"/>
<text x="60" y="74" class="P" font-size="16" fill="${ACCENT.lime}">${t('P', 'SPECIMEN 01 · CURRENTLY BUILDING')}</text>
<text x="54" y="196" class="G a" font-size="112" letter-spacing="-5" fill="${fg}" style="animation-name:up">${t('G', 'HealthLens')}</text>
<text x="60" y="250" class="S a" font-size="40" fill="${sub}" style="animation-name:in;${d(0.3)}">${t('S', 'an end-to-end healthcare ML playground')}</text>
<path d="${ecg}" fill="none" stroke="${ACCENT.lime}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" pathLength="1" stroke-dasharray="1" class="a" style="animation-name:draw;animation-duration:1.6s;${d(0.6)}" />
<text x="60" y="436" class="M" font-size="14" fill="${sub}">${t('M', 'educational research demo · not a diagnostic tool')}</text>
<line x1="680" y1="110" x2="680" y2="420" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
${spec.map(([k, v], i) => `<g class="a" style="animation-name:up;${d(0.5 + i * 0.1)}"><text x="720" y="${150 + i * 46}" class="M" font-size="15" fill="${ACCENT.lime}">${t('M', k)}</text><text x="830" y="${150 + i * 46}" class="g" font-size="21" fill="${fg}">${t('g', v)}</text></g>`).join('\n')}`
})

// ================================================================== 04 · also on the bench (receipt)
const bench = [
  ['btbt / beanThere', 'MERN storefronts, neo-brutalist UI', 'live'],
  ['Noteify', 'MERN notes · Lexical editor · Vitest', '10Pearls'],
  ['faizkhan.tech', 'React · TypeScript · GSAP · CI', 'live'],
  ['Figma → code', 'NFT site · Rappi · neoFi', 'live'],
  ['Internee.pk clone', 'responsive landing page', 'internship'],
  ['little tools', 'chat UI · weather · uploader · forms', 'practice'],
]
await writeSvg('bench', 1200, 120 + bench.length * 52 + 70, 'Also on the bench: btbt and beanThere MERN storefronts with a neo-brutalist UI (live), Noteify (MERN notes app from 10Pearls), faizkhan.tech (live), Figma-to-code builds of an NFT site, Rappi and neoFi (live), an Internee.pk landing page clone, and small tools: chat UI, weather app, file uploader and multi-step forms.', (c, t) => {
  const H = 120 + bench.length * 52 + 70
  const dots = (x1, x2, y) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${c.soft}" stroke-width="2" stroke-dasharray="1 7" stroke-linecap="round"/>`
  return `<rect x="150" y="0" width="900" height="${H}" fill="${c.panel}"/>
<path d="M150 ${H} ${Array.from({ length: 30 }, (_, i) => `l15 -12 l15 12`).join(' ')}" fill="${c.bg}"/>
<text x="600" y="64" class="P" font-size="18" fill="${c.ink}" text-anchor="middle">${t('P', '*** ALSO ON THE BENCH ***')}</text>
<text x="600" y="92" class="M" font-size="14" fill="${c.soft}" text-anchor="middle">${t('M', `${bench.length} items · built ${2025}–${NOW.getFullYear()}`)}</text>
${bench.map(([n, what, tag], i) => {
  const y = 150 + i * 52
  return `<g class="a" style="animation-name:in;${d(0.2 + i * 0.12)}"><text x="200" y="${y}" class="g" font-size="22" fill="${c.ink}">${t('g', n)}</text>
${dots(200 + n.length * 12.5 + 16, 836, y - 6)}
<text x="1000" y="${y}" class="P" font-size="14" fill="${tag === 'live' ? c.blue : c.soft}" text-anchor="end">${t('P', tag.toUpperCase())}</text>
<text x="200" y="${y + 22}" class="M" font-size="13" fill="${c.soft}">${t('M', what)}</text></g>`
}).join('\n')}`
})

// ================================================================== 05 · build log (live)
// Latest commits by the user across the most recently pushed repos (no merges, no bot refreshes).
const commits = live.user.recent.nodes
  .flatMap((r) => (r.defaultBranchRef?.target?.history?.nodes ?? []).map((c) => ({ repo: r.name, msg: c.messageHeadline, at: c.committedDate, by: c.author?.user?.login })))
  .filter((c) => c.by === LOGIN && !/^Merge |^Refresh live plates/.test(c.msg))
  .sort((a, b) => new Date(b.at) - new Date(a.at))
  .filter((c, i, all) => all.findIndex((x) => x.msg === c.msg) === i)
  .slice(0, 6)
const days = live.user.contributionsCollection.contributionCalendar.weeks.flatMap((w) => w.contributionDays)
const total = live.user.contributionsCollection.contributionCalendar.totalContributions
const weeks = live.user.contributionsCollection.contributionCalendar.weeks.map((w) => w.contributionDays.reduce((s, x) => s + x.contributionCount, 0))
const byDay = [0, 0, 0, 0, 0, 0, 0]
days.forEach((x) => (byDay[x.weekday] += x.contributionCount))
const busiest = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][byDay.indexOf(Math.max(...byDay))]
const activeRepos = new Set(commits.map((x) => x.repo)).size
const LANE = [ACCENT.pink, 'blue', ACCENT.amber, ACCENT.lime]
await writeSvg('buildlog', 1200, 520, `Build log, updated ${NOW.toISOString().slice(0, 10)}: latest commits ${commits.map((x) => `${x.repo}: ${x.msg}`).join('; ')}. ${total} contributions in the last year, busiest on ${busiest}.`, (c, t) => {
  const repoLane = {}
  commits.forEach((x) => (repoLane[x.repo] ??= Object.keys(repoLane).length % LANE.length))
  const laneCol = (r) => (LANE[repoLane[r]] === 'blue' ? c.blue : LANE[repoLane[r]])
  const max = Math.max(1, ...weeks)
  const px = (i) => 760 + (i / (weeks.length - 1)) * 380
  const py = (v) => 400 - (v / max) * 170
  const area = `M${px(0)} 400 ` + weeks.map((v, i) => `L${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' ') + ` L${px(weeks.length - 1)} 400 Z`
  return `<rect width="1200" height="520" fill="${c.bg}"/>
<text x="60" y="70" class="P" font-size="22" fill="${c.ink}">${t('P', 'BUILD LOG')}</text>
<text x="60" y="98" class="M" font-size="14" fill="${c.soft}">${t('M', `git log, live · updated ${NOW.toISOString().slice(0, 10)}`)}</text>
<line x1="84" y1="150" x2="84" y2="${150 + (commits.length - 1) * 58}" stroke="${c.line}" stroke-width="3"/>
${commits.map((x, i) => {
  const y = 150 + i * 58
  const msg = x.msg.length > 46 ? x.msg.slice(0, 45) + '…' : x.msg
  return `<g class="a" style="animation-name:up;${d(0.15 + i * 0.1)}"><circle cx="84" cy="${y}" r="9" fill="${laneCol(x.repo)}" stroke="${c.bg}" stroke-width="3"/>
<text x="112" y="${y - 3}" class="g" font-size="19" fill="${c.ink}">${t('g', msg)}</text>
<text x="112" y="${y + 19}" class="M" font-size="13" fill="${c.soft}">${t('M', `${x.repo} · ${ago(x.at)}`)}</text></g>`
}).join('\n')}
<text x="760" y="160" class="S" font-size="44" fill="${c.ink}">${t('S', 'the last 52 weeks')}</text>
<path d="${area}" fill="${c.blue}" opacity=".16"/>
<path d="${area.replace(/ L[\d.]+ 400 Z$/, '').replace(/^M[\d.]+ 400 L/, 'M')}" fill="none" stroke="${c.blue}" stroke-width="2.5" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" class="a" style="animation-name:draw;animation-duration:1.8s;${d(0.4)}"/>
<line x1="760" y1="400" x2="1140" y2="400" stroke="${c.line}" stroke-width="1.5"/>
<text x="760" y="446" class="G" font-size="40" fill="${c.ink}">${t('G', String(total))}</text>
<text x="${760 + String(total).length * 26 + 12}" y="446" class="M" font-size="15" fill="${c.soft}">${t('M', 'contributions')}</text>
<text x="760" y="476" class="M" font-size="15" fill="${c.soft}">${t('M', `${activeRepos} repos in the latest commits`)}</text>
<text x="760" y="500" class="M" font-size="15" fill="${c.soft}">${t('M', `busiest on ${busiest}`)}</text>`
})

// ================================================================== 06 · back of the box (live languages + stickers)
const langBytes = {}
for (const r of live.user.repositories.nodes) {
  if (r.name === LOGIN) continue
  for (const e of r.languages.edges) langBytes[e.node.name] = (langBytes[e.node.name] ?? 0) + e.size
}
const totalBytes = Object.values(langBytes).reduce((a, b) => a + b, 0)
const sorted = Object.entries(langBytes).sort((a, b) => b[1] - a[1])
// Rows under 0.5% would read as 0%, so they fold into 'everything else'.
const top = sorted.slice(0, 6).map(([k, v]) => [k, v / totalBytes]).filter(([, p]) => p >= 0.005)
const rest = 1 - top.reduce((s, [, p]) => s + p, 0)
if (rest > 0.005) top.push(['everything else', rest])
const repoCount = live.user.repositories.nodes.filter((r) => r.name !== LOGIN).length
const stickers = [
  ['PUBLISHED', 'Mixed Reality', 'compositing · Meta Quest 3', 'blue', -5],
  ['IEEE SZABIST', 'IT Officer', '2024 – 2025', ACCENT.lime, 4],
  ['ASPIRE', 'Leaders Program', 'Aspire Institute', ACCENT.pink, -3],
  ['18 CERTS', 'Stanford ML +', 'Meta · Google · Linux Fdn.', ACCENT.amber, 5],
]
await writeSvg('box', 1200, 600, `Back of the box. Ingredients across ${repoCount} public repositories: ${top.map(([k, p]) => `${k} ${(p * 100).toFixed(0)}%`).join(', ')}. Also inside: published research on Mixed Reality Compositing on Meta Quest 3, IT Officer for IEEE SZABIST, the Aspire Leaders Program, and 18 certifications including Stanford Online machine learning.`, (c, t) => {
  const lx = 60, lw = 520
  return `<rect width="1200" height="600" fill="${c.bg}"/>
<rect x="${lx}" y="40" width="${lw}" height="520" fill="${c.bg}" stroke="${c.ink}" stroke-width="4"/>
<text x="${lx + 24}" y="100" class="G" font-size="46" letter-spacing="-1.5" fill="${c.ink}">${t('G', 'Ingredients')}</text>
<text x="${lx + 24}" y="132" class="M" font-size="15" fill="${c.ink}">${t('M', `Serving size: ${repoCount} public repos`)}</text>
<rect x="${lx + 24}" y="148" width="${lw - 48}" height="12" fill="${c.ink}"/>
<text x="${lx + 24}" y="190" class="g" font-size="15" fill="${c.ink}">${t('g', 'Language')}</text>
<text x="${lx + lw - 24}" y="190" class="g" font-size="15" fill="${c.ink}" text-anchor="end">${t('g', '% by bytes')}</text>
${top.map(([k, p], i) => {
  const y = 232 + i * 42
  return `<line x1="${lx + 24}" y1="${y - 30}" x2="${lx + lw - 24}" y2="${y - 30}" stroke="${c.ink}" stroke-width="1.5"/>
<text x="${lx + 24}" y="${y}" class="g" font-size="20" fill="${c.ink}">${t('g', k)}</text>
<rect x="${lx + 250}" y="${y - 15}" width="${Math.max(3, p * 180).toFixed(1)}" height="14" fill="${c.ink}" class="a tl" style="animation-name:grow;${d(0.2 + i * 0.08)}"/>
<text x="${lx + lw - 24}" y="${y}" class="G" font-size="20" fill="${c.ink}" text-anchor="end">${t('G', `${(p * 100).toFixed(0)}%`)}</text>`
}).join('\n')}
<rect x="${lx + 24}" y="${232 + top.length * 42 - 22}" width="${lw - 48}" height="6" fill="${c.ink}"/>
<text x="${lx + 24}" y="${232 + top.length * 42 + 12}" class="M" font-size="12" fill="${c.ink}">${t('M', `Recalculated daily from the GitHub API. ${NOW.toISOString().slice(0, 10)}`)}</text>
<text x="660" y="92" class="S" font-size="44" fill="${c.ink}">${t('S', 'also inside')}</text>
${stickers.map(([k, l1, l2, col, rot], i) => {
  const x = 660 + (i % 2) * 250, y = 140 + Math.floor(i / 2) * 210
  const fill = col === 'blue' ? c.blue : col, txt = col === 'blue' ? '#FFFFFF' : '#141414'
  return `<g transform="rotate(${rot} ${x + 110} ${y + 85})"><g class="a tb" style="animation-name:pop;animation-timing-function:cubic-bezier(.34,1.56,.64,1);${d(0.4 + i * 0.15)}">
<rect x="${x}" y="${y}" width="220" height="170" rx="18" fill="${fill}" stroke="${c.ink}" stroke-width="3"/>
<text x="${x + 20}" y="${y + 42}" class="P" font-size="15" fill="${txt}">${t('P', k)}</text>
<text x="${x + 20}" y="${y + 92}" class="g" font-size="${l1.length > 18 ? 18 : 22}" fill="${txt}">${t('g', l1)}</text>
<text x="${x + 20}" y="${y + 122}" class="M" font-size="12" fill="${txt}">${t('M', l2)}</text></g></g>`
}).join('\n')}`
})

// ================================================================== 07 · sign-off
await writeSvg('signoff', 1200, 300, 'Say hello: faizkhan.tech. Open to software engineering roles across frontend, backend and cloud.', (c, t, theme) => `<rect width="1200" height="300" fill="${c.bg}"/>
<text x="60" y="118" class="S a" font-size="88" fill="${c.ink}" style="animation-name:up">${t('S', 'say hello at')}</text>
<rect x="56" y="150" width="640" height="76" fill="${ACCENT.lime}" opacity="${theme === 'dark' ? 0.9 : 1}" class="a tl" style="animation-name:grow;${d(0.4)}"/>
<text x="68" y="212" class="G a" font-size="76" letter-spacing="-3" fill="#141414" style="animation-name:in;${d(0.6)}">${t('G', 'faizkhan.tech')}</text>
<text x="1140" y="200" class="M" font-size="16" fill="${c.soft}" text-anchor="end">${t('M', 'open to software engineering roles')}</text>
<text x="1140" y="226" class="M" font-size="16" fill="${c.soft}" text-anchor="end">${t('M', 'frontend · backend · cloud')}</text>
<text x="60" y="276" class="P" font-size="14" fill="${c.soft}">${t('P', 'END OF PLATES · THANKS FOR SCROLLING')}</text>`)
