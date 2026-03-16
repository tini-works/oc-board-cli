// Dev server using Bun.build() + Bun.serve()
// Bun.serve()'s HTML import bundler doesn't respect Bun.plugin() registrations,
// so we pre-build entry.tsx with Bun.build() (which supports explicit plugins)
// and serve the result from the fetch handler with SSE live reload.
import path from 'path'
import { existsSync, readFileSync, statSync } from 'fs'
import { fileURLToPath } from 'url'
import { virtualModulesPlugin } from './plugins/virtual-modules'
import { mdxPlugin } from './plugins/mdx'
import { aliasesPlugin } from './plugins/aliases'
import { createPreviewBundleHandler } from './routes/preview-bundle'
import { createPreviewConfigHandler } from './routes/preview-config'
import { createJsxBundleHandler } from './routes/jsx-bundle'
import { createComponentBundleHandler } from './routes/component-bundle'
import { createTokensHandler } from './routes/tokens'
import { handleOgImageRequest } from './routes/og-image'
import { createApprovalHandler } from './routes/approval'
import { createBoardHandler, registerBoardWsClient, broadcast } from './routes/board'
import { createSotHandler } from './routes/sot'
import { BoardQueueProcessor } from './board-queue'
import { loadConfig, updateOrder } from '../config'
import type { PrevConfig } from '../config'

// Find CLI root by locating package.json
function findCliRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 10; i++) {
    const pkgPath = path.join(dir, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        if (pkg.name === 'prev-cli') return dir
      } catch {}
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return path.dirname(path.dirname(fileURLToPath(import.meta.url)))
}

const cliRoot = findCliRoot()
const srcRoot = path.join(cliRoot, 'src')

export interface DevServerOptions {
  rootDir: string
  port: number
  include?: string[]
  config?: PrevConfig
}

// ── A2UI renderer page ────────────────────────────────────────────────────────
// Serves a themed HTML page that loads the a2ui bundle, applies the docliq
// design token theme, fetches a .jsonl file from the SOT, and renders it.
//
// Theme strategy:
//  • CSS custom properties on <openclaw-a2ui-host> → palette vars (--p-*, --n-*, etc.)
//    These cascade into Lit shadow roots.
//  • host.themeProvider.setValue(docliqTheme) → injects class names + additionalStyles
//    into every component via Lit Context.
//
// Palette mapping (design tokens → Material3-style shades 0–100):
//  p  = teal   (brand primary)
//  s  = slate  (secondary)
//  t  = coral  (tertiary / accent)
//  n  = charcoal (neutral)
//  nv = slate  (neutral variant)
//  e  = coral  (error)
function buildA2UIRenderer(src: string, _rootDir: string): string {
  const encodedSrc = JSON.stringify(src)
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>A2UI</title>
  <style>
    :root { color-scheme: dark; }
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0; height: 100%;
      background: #0f1214;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      font-size: 13px; color: #e8eaeb;
    }
    #root { padding: 16px 18px 40px; }
    #loading { padding: 48px; text-align: center; color: rgba(255,255,255,.3); font-size: 13px; }
    #err { margin: 16px; padding: 12px 14px; border-radius: 8px;
      background: rgba(224,106,79,.12); border: 1px solid rgba(224,106,79,.35); color: #f0ad9e; font-size: 12px; }

    /* ── File badge ── */
    .file-badge {
      display: flex; align-items: center; gap: 10px; padding: 10px 14px;
      border-radius: 8px; border: 1px solid rgba(255,255,255,.07);
      background: rgba(255,255,255,.04); margin-bottom: 20px; }
    .file-badge-icon { font-size: 16px; }
    .file-badge-name { font-weight: 600; font-size: 14px; }
    .file-badge-src { margin-left: 8px; font-size: 11px; font-family: monospace; color: #748188; }
    .pills { margin-left: auto; display: flex; gap: 6px; }
    .pill { padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 500; }

    /* ── Section headers ── */
    .section { margin-bottom: 20px; }
    .section-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .section-head h3 { margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; }
    .section-line { flex: 1; height: 1px; background: rgba(255,255,255,.07); }

    /* ── Token cards ── */
    .token-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }
    .token-card { display: flex; align-items: center; gap: 12px; padding: 10px 14px;
      border-radius: 8px; border: 1px solid rgba(255,255,255,.07); background: rgba(255,255,255,.03); }
    .token-swatch { width: 32px; height: 32px; border-radius: 6px; border: 1px solid rgba(255,255,255,.1); flex-shrink: 0; }
    .token-id { font-size: 12px; font-family: monospace; color: #6ec6d0; background: rgba(110,198,208,.1);
      padding: 1px 6px; border-radius: 4px; }
    .token-value { font-size: 12px; font-family: monospace; color: #748188; margin-left: 6px; }
    .token-usage { font-size: 12px; color: #748188; margin-top: 3px; }

    /* ── Component cards ── */
    .comp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; }
    .comp-card { border-radius: 10px; border: 1px solid rgba(255,255,255,.07); overflow: hidden; background: rgba(255,255,255,.02); }
    .comp-header { padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,.07);
      background: rgba(255,255,255,.04); display: flex; align-items: center; gap: 8px; }
    .comp-name { font-weight: 600; font-size: 14px; flex: 1; }
    .comp-badge { font-size: 10px; padding: 2px 6px; background: rgba(110,198,208,.12); color: #6ec6d0;
      border-radius: 4px; font-weight: 500; }
    .comp-body { padding: 12px 14px; }
    .prop-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em;
      color: #748188; margin-bottom: 6px; }
    .prop-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 10px; }
    .prop-table td { padding: 4px 6px 4px 0; border-bottom: 1px solid rgba(255,255,255,.05); }
    .prop-table td:first-child { font-family: monospace; color: #6ec6d0; font-weight: 500; padding-right: 10px; white-space: nowrap; }
    .prop-table td:last-child { font-family: monospace; color: #748188; }
    .states-wrap { display: flex; flex-wrap: wrap; gap: 6px; }
    .state-chip { padding: 3px 9px; border-radius: 6px; font-size: 11px; font-weight: 500;
      background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); color: #e8eaeb; }
    .state-chip.default { background: rgba(255,255,255,.04); }
    .state-detail { font-weight: 400; color: #748188; margin-left: 4px; font-size: 10px; }

    /* ── Screen cards ── */
    .screen-list { display: flex; flex-direction: column; gap: 8px; }
    .screen-card { border-radius: 12px; border: 1px solid rgba(255,255,255,.07); overflow: hidden; background: rgba(255,255,255,.02); }
    .screen-header { padding: 12px 16px; background: rgba(255,255,255,.04);
      display: flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; }
    .screen-icon { width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0; display: flex; align-items: center;
      justify-content: center; font-size: 12px; color: #fff;
      background: linear-gradient(135deg, #0f8a99, #0b6f7c); }
    .screen-title { font-weight: 600; font-size: 14px; flex: 1; }
    .screen-route { font-size: 11px; font-family: monospace; color: #748188; }
    .screen-c3 { font-size: 10px; color: #748188; }
    .screen-chevron { color: #748188; font-size: 12px; margin-left: 4px; }
    .screen-body { padding: 16px; display: flex; flex-direction: column; gap: 14px; border-top: 1px solid rgba(255,255,255,.07); }

    /* Layout tree */
    .layout-tree { border-radius: 8px; border: 1px solid rgba(255,255,255,.07); overflow: hidden; font-family: monospace; font-size: 12px; }
    .layout-row { padding: 5px 12px; border-bottom: 1px solid rgba(255,255,255,.05); display: flex; align-items: center; gap: 8px; }
    .layout-row:last-child { border-bottom: none; }
    .layout-row:nth-child(even) { background: rgba(255,255,255,.02); }
    .layout-idx { color: #748188; font-size: 10px; width: 14px; flex-shrink: 0; }
    .layout-child { color: #6ec6d0; }

    /* AC list */
    .ac-list { display: flex; flex-direction: column; gap: 6px; }
    .ac-item { display: flex; align-items: flex-start; gap: 8px; padding: 7px 10px;
      border-radius: 6px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); font-size: 12px; }
    .ac-checkbox { width: 13px; height: 13px; border-radius: 3px; border: 1.5px solid rgba(255,255,255,.15);
      background: transparent; flex-shrink: 0; margin-top: 1px; }

    /* ── Flow cards ── */
    .flow-list { display: flex; flex-direction: column; gap: 10px; }
    .flow-card { border-radius: 12px; border: 1px solid rgba(255,255,255,.07); overflow: hidden; background: rgba(255,255,255,.02); }
    .flow-header { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,.07);
      background: rgba(255,255,255,.04); display: flex; align-items: center; gap: 10px; }
    .flow-icon { width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0; display: flex; align-items: center;
      justify-content: center; font-size: 14px; color: #fff; background: linear-gradient(135deg, #13a3b5, #0b6f7c); }
    .flow-name { font-weight: 600; font-size: 14px; flex: 1; }
    .flow-c3 { font-size: 11px; color: #748188; }
    .flow-trigger { margin: 3px 0 0; font-size: 12px; color: #748188; font-style: italic; }
    .flow-body { padding: 16px; display: flex; flex-direction: column; gap: 14px; }

    /* Step spine */
    .step-spine { display: flex; flex-direction: column; gap: 0; }
    .step-row { display: flex; gap: 12px; align-items: flex-start; }
    .spine-col { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
    .step-dot { width: 22px; height: 22px; border-radius: 50%; background: #0f8a99; color: #fff;
      font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .spine-line { width: 2px; flex: 1; min-height: 14px; background: rgba(255,255,255,.07); margin: 2px 0; }
    .step-content { flex: 1; padding-bottom: 12px; }
    .step-content:last-child { padding-bottom: 0; }
    .step-main { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; }
    .step-screen { font-family: monospace; font-size: 11px; background: rgba(110,198,208,.1); color: #6ec6d0;
      padding: 1px 6px; border-radius: 4px; }
    .step-action { color: #e8eaeb; }
    .step-cond { font-size: 11px; padding: 1px 6px; background: rgba(234,179,8,.1); color: #eab308; border-radius: 4px; }
    .step-sub { display: flex; gap: 6px; margin-top: 3px; font-size: 11px; flex-wrap: wrap; }
    .step-next { color: #748188; }
    .step-next-val { color: #22c55e; font-weight: 500; }
    .step-effect { color: #748188; font-style: italic; }

    /* Edge cases */
    .edge-list { display: flex; flex-direction: column; gap: 6px; }
    .edge-item { padding: 8px 12px; border-radius: 6px; background: rgba(234,179,8,.07);
      border: 1px solid rgba(234,179,8,.2); font-size: 12px; }
    .edge-scenario { font-weight: 600; color: #d4a017; }
    .edge-behavior { color: #748188; }

    .empty { padding: 40px; text-align: center; color: #748188; font-size: 13px;
      border-radius: 12px; border: 1px dashed rgba(255,255,255,.07); }
  </style>
</head>
<body>
  <div id="loading">Loading…</div>
  <div id="err" style="display:none"></div>
  <div id="root" style="display:none"></div>
  <script>
  (function() {
    const src = ${encodedSrc}
    const loadingEl = document.getElementById('loading')
    const errEl = document.getElementById('err')
    const root = document.getElementById('root')

    function showErr(msg) {
      if (loadingEl) loadingEl.style.display = 'none'
      errEl.style.display = 'block'; errEl.textContent = '⚠ ' + msg
    }

    function esc(s) {
      if (s == null) return ''
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    }

    function pillHtml(count, label, bg, color) {
      return '<span class="pill" style="background:'+bg+';color:'+color+'">'+count+' '+label+'</span>'
    }

    function renderToken(e) {
      const isColor = /^#|^oklch|^rgb|^hsl/.test((e.value||'').trim())
      return '<div class="token-card">'
        + (isColor ? '<div class="token-swatch" style="background:'+esc(e.value)+'"></div>' : '')
        + '<div>'
        + '<div><span class="token-id">'+esc(e.id)+'</span><span class="token-value">'+esc(e.value)+'</span></div>'
        + (e.usage ? '<div class="token-usage">'+esc(e.usage)+'</div>' : '')
        + '</div></div>'
    }

    function renderComponent(e) {
      const props = e.props ? Object.entries(e.props) : []
      const states = e.states ? Object.entries(e.states) : []
      return '<div class="comp-card">'
        + '<div class="comp-header"><span>⬡</span><span class="comp-name">'+esc(e.id)+'</span>'
        + '<span class="comp-badge">component</span></div>'
        + '<div class="comp-body">'
        + (props.length > 0 ? '<div class="prop-label">Props</div>'
          + '<table class="prop-table"><tbody>'
          + props.map(([k,v]) => '<tr><td>'+esc(k)+'</td><td>'+esc(v)+'</td></tr>').join('')
          + '</tbody></table>' : '')
        + (states.length > 0 ? '<div class="prop-label">States</div><div class="states-wrap">'
          + states.map(([s, b]) => {
              const bObj = typeof b === 'object' && b ? b : {}
              const details = Object.entries(bObj).map(([k,v]) => {
                if (Array.isArray(v)) return k+': ['+v.join(', ')+']'
                return k+': '+JSON.stringify(v)
              }).join('; ')
              return '<div class="state-chip'+(s==='default'?' default':'')+'">'+esc(s)
                + (details ? '<span class="state-detail">('+esc(details)+')</span>' : '')
                + '</div>'
            }).join('')
          + '</div>' : '')
        + '</div></div>'
    }

    function renderScreen(e) {
      const id = 'sc-'+Math.random().toString(36).slice(2)
      const children = e.layout && e.layout.children || []
      const states = e.states ? Object.entries(e.states) : []
      const ac = e.ac || []
      const headerHtml = '<div class="screen-header" onclick="document.getElementById(\\''+id+'\\').style.display=document.getElementById(\\''+id+'\\').style.display===\\'none\\'?\\'\\':\\'none\\'">'
        + '<div class="screen-icon">▣</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="display:flex;align-items:center;gap:8px">'
        + '<span class="screen-title">'+esc(e.title||e.id)+'</span>'
        + (e.platform && e.platform!=='both' ? '<span style="font-size:10px;padding:1px 6px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:4px;color:#748188">'+esc(e.platform)+'</span>' : '')
        + '</div>'
        + '<div style="display:flex;gap:6px;margin-top:2px">'
        + (e.route ? '<code class="screen-route">'+esc(e.route)+'</code>' : '')
        + (e.c3 ? '<span class="screen-c3">· '+esc(e.c3)+'</span>' : '')
        + '</div></div>'
        + '<span class="screen-chevron">▼</span>'
        + '</div>'
      let bodyHtml = '<div id="'+id+'" style="display:none" class="screen-body">'
      if (children.length > 0) {
        bodyHtml += '<div><div class="prop-label">Layout · '+(e.layout.type||'stack')+'</div>'
          + '<div class="layout-tree">'
          + children.map((c,i) => '<div class="layout-row"><span class="layout-idx">'+(i+1)+'</span><span class="layout-child">'+esc(c)+'</span></div>').join('')
          + '</div></div>'
      }
      if (states.length > 0) {
        bodyHtml += '<div><div class="prop-label">States</div><div class="states-wrap">'
          + states.map(([s, b]) => {
              const bObj = typeof b === 'object' && b ? b : {}
              const parts = []
              if (bObj.show) parts.push('show: '+bObj.show.join(', '))
              if (bObj.hide) parts.push('hide: '+bObj.hide.join(', '))
              if (bObj.disable) parts.push('disable: '+bObj.disable.join(', '))
              const stateBg = s==='idle'?'rgba(255,255,255,.05)':s==='loading'?'rgba(234,179,8,.1)':s==='error'?'rgba(239,68,68,.1)':s==='success'?'rgba(34,197,94,.1)':'rgba(255,255,255,.05)'
              const stateColor = s==='loading'?'#eab308':s==='error'?'#f87171':s==='success'?'#4ade80':'#e8eaeb'
              return '<div class="state-chip" style="background:'+stateBg+';color:'+stateColor+'">'+esc(s)+(parts.length?' <span class="state-detail">('+esc(parts.join('; '))+')</span>':'')+'</div>'
            }).join('')
          + '</div></div>'
      }
      if (ac.length > 0) {
        bodyHtml += '<div><div class="prop-label">Acceptance Criteria</div><div class="ac-list">'
          + ac.map(a => '<div class="ac-item"><div class="ac-checkbox"></div><span>'+esc(a)+'</span></div>').join('')
          + '</div></div>'
      }
      bodyHtml += '</div>'
      return '<div class="screen-card">'+headerHtml+bodyHtml+'</div>'
    }

    function renderFlow(e) {
      const steps = e.steps || []
      const edges = e.edge_cases || []
      return '<div class="flow-card">'
        + '<div class="flow-header">'
        + '<div class="flow-icon">⇢</div>'
        + '<div style="flex:1">'
        + '<div style="display:flex;align-items:center;gap:8px"><span class="flow-name">'+esc(e.id)+'</span>'
        + (e.c3 ? '<span class="flow-c3">· '+esc(e.c3)+'</span>' : '')+'</div>'
        + (e.trigger ? '<div class="flow-trigger">'+esc(e.trigger)+'</div>' : '')
        + '</div></div>'
        + '<div class="flow-body">'
        + (steps.length > 0
          ? '<div><div class="prop-label">Steps</div><div class="step-spine">'
            + steps.map((s,i) => '<div class="step-row">'
                + '<div class="spine-col"><div class="step-dot">'+(i+1)+'</div>'
                + (i<steps.length-1 ? '<div class="spine-line"></div>' : '')
                + '</div>'
                + '<div class="step-content'+( i<steps.length-1 ? '' : ' last' )+'">'
                + '<div class="step-main"><span class="step-screen">'+esc(s.screen)+'</span><span style="color:#748188">→</span><span class="step-action">'+esc(s.action)+'</span>'
                + (s.condition ? '<span class="step-cond">if: '+esc(s.condition)+'</span>' : '')
                + '</div>'
                + ((s.next||s.effect) ? '<div class="step-sub">'
                  +(s.next?'<span class="step-next">→ <span class="step-next-val">'+esc(s.next)+'</span></span>':'')
                  +(s.effect?'<span class="step-effect">· '+esc(s.effect)+'</span>':'')
                  +'</div>' : '')
                + '</div></div>'
              ).join('')
            + '</div></div>' : '')
        + (edges.length > 0
          ? '<div><div class="prop-label">Edge Cases</div><div class="edge-list">'
            + edges.map(ec => '<div class="edge-item"><span class="edge-scenario">'+esc(ec.scenario)+'</span><span class="edge-behavior"> → '+esc(ec.behavior)+'</span></div>').join('')
            + '</div></div>' : '')
        + '</div></div>'
    }

    fetch('/__prev/sot/content?path=' + encodeURIComponent(src))
      .then(r => { if (!r.ok) throw new Error(r.status + ' ' + r.statusText); return r.text() })
      .then(text => {
        const entries = text.split('\\n').map(l=>l.trim()).filter(Boolean)
          .flatMap(l => { try { return [JSON.parse(l)] } catch { return [] } })

        const tokens     = entries.filter(e=>e.type==='token')
        const components = entries.filter(e=>e.type==='component')
        const screens    = entries.filter(e=>e.type==='screen')
        const flows      = entries.filter(e=>e.type==='flow')

        const name = src.split('/').pop().replace('.jsonl','')
        let html = '<div class="file-badge"><span class="file-badge-icon">⬡</span>'
          + '<span class="file-badge-name">'+esc(name)+'</span>'
          + '<code class="file-badge-src">'+esc(src)+'</code>'
          + '<div class="pills">'
          + (tokens.length     ? pillHtml(tokens.length,     'tokens',     'rgba(139,92,246,.15)', '#a78bfa') : '')
          + (components.length ? pillHtml(components.length, 'components', 'rgba(110,198,208,.15)', '#6ec6d0') : '')
          + (screens.length    ? pillHtml(screens.length,    'screens',    'rgba(99,102,241,.15)', '#818cf8') : '')
          + (flows.length      ? pillHtml(flows.length,      'flows',      'rgba(34,197,94,.15)', '#4ade80') : '')
          + '</div></div>'

        if (tokens.length > 0) {
          html += '<div class="section"><div class="section-head"><h3 style="color:#a78bfa">🎨 Design Tokens</h3><div class="section-line"></div></div>'
            + '<div class="token-grid">'+tokens.map(renderToken).join('')+'</div></div>'
        }
        if (components.length > 0) {
          html += '<div class="section"><div class="section-head"><h3 style="color:#6ec6d0">⬡ Components</h3><div class="section-line"></div></div>'
            + '<div class="comp-grid">'+components.map(renderComponent).join('')+'</div></div>'
        }
        if (screens.length > 0) {
          html += '<div class="section"><div class="section-head"><h3 style="color:#818cf8">▣ Screens</h3><div class="section-line"></div></div>'
            + '<div class="screen-list">'+screens.map(renderScreen).join('')+'</div></div>'
        }
        if (flows.length > 0) {
          html += '<div class="section"><div class="section-head"><h3 style="color:#4ade80">⇢ Flows</h3><div class="section-line"></div></div>'
            + '<div class="flow-list">'+flows.map(renderFlow).join('')+'</div></div>'
        }
        if (entries.length === 0) {
          html += '<div class="empty">No entries found in '+esc(src)+'</div>'
        }

        loadingEl.style.display = 'none'
        root.innerHTML = html
        root.style.display = 'block'
      })
      .catch(e => showErr(String(e)))
  })()
  </script>
</body>
</html>`
}

// Build the theme app with Bun.build() — plugins are passed explicitly
async function buildThemeApp(rootDir: string, include?: string[], config?: PrevConfig) {
  const entryPath = path.join(srcRoot, 'theme/entry.tsx')
  const plugins = [
    virtualModulesPlugin({ rootDir, include, config }),
    mdxPlugin({ rootDir }),
    aliasesPlugin({ cliRoot }),
  ]

  const result = await Bun.build({
    entrypoints: [entryPath],
    // No outdir = in-memory build
    format: 'esm',
    target: 'browser',
    plugins,
    jsx: { runtime: 'automatic', importSource: 'react' },
    define: {
      'import.meta.env.DEV': 'true',
      'import.meta.env.BASE_URL': '"/"',
      'process.env.NODE_ENV': '"development"',
    },
  })

  if (!result.success) {
    const errors = result.logs.filter(l => l.level === 'error').map(l => l.message)
    return { js: '', css: '', success: false, errors }
  }

  const jsOutput = result.outputs.find(o => o.path.endsWith('.js'))
  const cssOutput = result.outputs.find(o => o.path.endsWith('.css'))

  return {
    js: jsOutput ? await jsOutput.text() : '',
    css: cssOutput ? await cssOutput.text() : '',
    success: true,
    errors: [] as string[],
  }
}

// HTML shell served for all page routes
const HTML_SHELL = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Documentation</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="preload" href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=IBM+Plex+Mono:wght@400;500&display=swap" as="style" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=IBM+Plex+Mono:wght@400;500&display=swap" />
  <link rel="stylesheet" href="/__prev/app.css" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/__prev/app.js"></script>
  <script>
    if (typeof EventSource !== 'undefined') {
      var es = new EventSource('/__prev/events');
      es.onmessage = function() { location.reload(); };
    }
  </script>
</body>
</html>`

export async function startDevServer(options: DevServerOptions) {
  const { rootDir, port, include } = options
  const config = options.config || loadConfig(rootDir)

  // Build theme app with explicit plugins
  console.log('  Building theme...')
  let appBundle = await buildThemeApp(rootDir, include, config)
  if (!appBundle.success) {
    console.error('  Build errors:', appBundle.errors.join('\n'))
  } else {
    console.log('  ✓ Theme built')
  }

  // SSE live reload controllers
  const sseControllers = new Set<ReadableStreamDefaultController>()
  const encoder = new TextEncoder()

  function notifyReload() {
    const msg = encoder.encode('data: reload\n\n')
    for (const ctrl of sseControllers) {
      try { ctrl.enqueue(msg) } catch { sseControllers.delete(ctrl) }
    }
  }

  // Create route handlers
  const previewBundleHandler = createPreviewBundleHandler(rootDir)
  const previewConfigHandler = createPreviewConfigHandler(rootDir)
  const jsxBundleHandler = createJsxBundleHandler(cliRoot)
  const componentBundleHandler = createComponentBundleHandler(rootDir)
  const tokensHandler = createTokensHandler(rootDir)
  const approvalHandler = createApprovalHandler(rootDir, config?.approval?.webhookUrl)
  const queueProcessor = new BoardQueueProcessor(rootDir, broadcast)
  const boardHandler = createBoardHandler(rootDir, { onTaskEnqueued: (id) => queueProcessor.notifyPending(id) })
  const sotHandler = createSotHandler(rootDir)
  queueProcessor.start()
  const previewRuntimePath = path.join(srcRoot, 'preview-runtime/fast-template.html')

  const server = Bun.serve({
    port,

    websocket: {
      open(ws: import('bun').ServerWebSocket<{ boardId: string; cleanup: () => void }>) {
        const { boardId } = ws.data
        const cleanup = registerBoardWsClient(rootDir, boardId, (data) => {
          try { ws.send(data) } catch { /* closed */ }
        })
        ws.data.cleanup = cleanup
      },
      message(_ws: import('bun').ServerWebSocket<{ boardId: string; cleanup: () => void }>, _msg: string | Buffer) {
        // clients are receive-only; ignore inbound WS messages
      },
      close(ws: import('bun').ServerWebSocket<{ boardId: string; cleanup: () => void }>) {
        ws.data.cleanup?.()
      },
    },

    async fetch(req, server) {
      const url = new URL(req.url)
      const pathname = url.pathname

      // WebSocket upgrade for board channel /__prev/board/:id/ws
      const wsMatch = pathname.match(/^\/__prev\/board\/([a-zA-Z0-9_-]+)\/ws$/)
      if (wsMatch) {
        const boardId = wsMatch[1]
        const upgraded = server.upgrade(req, { data: { boardId, cleanup: () => {} } })
        if (upgraded) return undefined as unknown as Response
        return new Response('WebSocket upgrade failed', { status: 426 })
      }

      // SSE live reload endpoint
      if (pathname === '/__prev/events') {
        let ctrl: ReadableStreamDefaultController
        const stream = new ReadableStream({
          start(controller) {
            ctrl = controller
            sseControllers.add(controller)
          },
          cancel() {
            sseControllers.delete(ctrl)
          },
        })
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        })
      }

      // Built app JS bundle
      if (pathname === '/__prev/app.js') {
        return new Response(appBundle.js, {
          headers: { 'Content-Type': 'application/javascript' },
        })
      }

      // Built app CSS
      if (pathname === '/__prev/app.css') {
        return new Response(appBundle.css, {
          headers: { 'Content-Type': 'text/css' },
        })
      }

      // API: Config updates (drag-and-drop reordering)
      if (pathname === '/__prev/config' && req.method === 'POST') {
        try {
          const body = await req.json() as { path: string; order: string[] }
          updateOrder(rootDir, body.path, body.order)
          return Response.json({ success: true })
        } catch (e) {
          return Response.json({ error: String(e) }, { status: 400 })
        }
      }

      // Approval status endpoint
      const approvalResponse = await approvalHandler(req)
      if (approvalResponse) return approvalResponse

      // Board state endpoint
      const boardResponse = await boardHandler(req)
      if (boardResponse) return boardResponse

      // SOT file listing + content
      const sotResponse = await sotHandler(req)
      if (sotResponse) return sotResponse

      // A2UI bundle served from OpenClaw
      if (pathname === '/__prev/a2ui-bundle.js') {
        const bundlePath = path.join(srcRoot, 'theme/a2ui.bundle.js')
        try {
          const js = readFileSync(bundlePath)
          return new Response(js, { headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'public,max-age=3600' } })
        } catch { return new Response('// bundle not found', { status: 404, headers: { 'Content-Type': 'application/javascript' } }) }
      }

      // A2UI renderer page — loads JSONL from SOT and renders via a2ui bundle
      if (pathname === '/__prev/a2ui-render') {
        const src = url.searchParams.get('src') ?? ''
        const a2uiHtml = buildA2UIRenderer(src, rootDir)
        return new Response(a2uiHtml, { headers: { 'Content-Type': 'text/html' } })
      }

      // Preview bundle endpoint
      const bundleResponse = await previewBundleHandler(req)
      if (bundleResponse) return bundleResponse

      // Preview config endpoint
      const configResponse = await previewConfigHandler(req)
      if (configResponse) return configResponse

      // JSX bundle endpoint
      const jsxResponse = await jsxBundleHandler(req)
      if (jsxResponse) return jsxResponse

      // Component bundle endpoint
      const componentResponse = await componentBundleHandler(req)
      if (componentResponse) return componentResponse

      // Tokens endpoint
      const tokensResponse = await tokensHandler(req)
      if (tokensResponse) return tokensResponse

      // OG image endpoint
      const ogResponse = handleOgImageRequest(req, [])
      if (ogResponse) return ogResponse

      // Region bridge script for flow interactivity
      if (pathname === '/_prev/region-bridge.js') {
        const { REGION_BRIDGE_SCRIPT } = await import('../preview-runtime/region-bridge')
        return new Response(REGION_BRIDGE_SCRIPT, {
          headers: { 'Content-Type': 'application/javascript' },
        })
      }

      // Preview runtime template
      if (pathname === '/_preview-runtime') {
        if (existsSync(previewRuntimePath)) {
          const html = readFileSync(previewRuntimePath, 'utf-8')
          return new Response(html, {
            headers: { 'Content-Type': 'text/html' },
          })
        }
      }

      // Serve static files from previews dir (for preview assets)
      if (pathname.startsWith('/_preview/')) {
        const relativePath = pathname.slice('/_preview/'.length)
        const previewsDir = path.join(rootDir, 'previews')
        const filePath = path.resolve(previewsDir, relativePath)

        // Security: prevent path traversal; only serve regular files (not directories)
        if (filePath.startsWith(previewsDir) && existsSync(filePath) && statSync(filePath).isFile()) {
          return new Response(Bun.file(filePath))
        }
      }

      // SPA fallback: serve HTML shell for all non-file, non-API routes
      if (!pathname.includes('.') &&
          !pathname.startsWith('/@') &&
          !pathname.startsWith('/__') &&
          !pathname.startsWith('/_preview') &&
          !pathname.startsWith('/_prev')) {
        // Inject OG meta tags for preview routes (deep links)
        if (pathname.startsWith('/previews/') && pathname !== '/previews') {
          const previewPath = pathname.slice('/previews/'.length)
          const searchParams = new URL(req.url).searchParams
          const ogState = searchParams.get('state')
          const ogStep = searchParams.get('step')
          const ogTitle = previewPath.split('/').pop() || 'Preview'
          const ogParams = [
            ogState ? `state=${ogState}` : '',
            ogStep ? `step=${ogStep}` : '',
          ].filter(Boolean).join('&')
          const ogImageUrl = `/_og/${previewPath}${ogParams ? `?${ogParams}` : ''}`

          const ogHtml = HTML_SHELL.replace(
            '<title>Documentation</title>',
            `<title>${ogTitle} - Preview</title>
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogState ? `State: ${ogState}` : ogStep ? `Step: ${ogStep}` : 'Preview'}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />`
          )
          return new Response(ogHtml, {
            headers: { 'Content-Type': 'text/html' },
          })
        }
        return new Response(HTML_SHELL, {
          headers: { 'Content-Type': 'text/html' },
        })
      }

      return new Response('Not Found', { status: 404 })
    },
  })

  // File watcher for live reload
  const { watch } = await import('fs')
  const watchers: ReturnType<typeof watch>[] = []
  let rebuildTimer: Timer | null = null

  async function rebuild() {
    appBundle = await buildThemeApp(rootDir, include, config)
    if (appBundle.success) {
      notifyReload()
    }
  }

  function scheduleRebuild() {
    if (rebuildTimer) clearTimeout(rebuildTimer)
    rebuildTimer = setTimeout(rebuild, 150)
  }

  // Watch previews directory for changes
  const previewsDir = path.join(rootDir, 'previews')
  if (existsSync(previewsDir)) {
    watchers.push(watch(previewsDir, { recursive: true }, (_, filename) => {
      if (filename && /\.(tsx|ts|jsx|js|css|yaml|yml|mdx|md|html)$/.test(filename)) {
        scheduleRebuild()
      }
    }))
  }

  return {
    server,
    port: server.port,
    url: `http://localhost:${server.port}/`,
    stop: () => {
      if (rebuildTimer) clearTimeout(rebuildTimer)
      watchers.forEach(w => w.close())
      queueProcessor.stop()
      server.stop()
    },
  }
}
