/**
 * The Studio document, prepared for a mount point.
 *
 * Pure: takes the built `index.html` as a string and returns it with the bootstrap config
 * injected and asset paths rewritten. Nothing here touches the filesystem, so it runs
 * anywhere — the Workers handler feeds it HTML from the ASSETS binding.
 */

import type { StudioConfig } from './assets.js'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Serialize for a <script> body without letting `</script>` or friends break out. */
function escapeJsonForScript(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/'/g, '\\u0027')
}

export function transformStudioDocument(html: string, config: StudioConfig, basePath: string): string {
  const prefix = basePath.replace(/\/+$/, '')

  // The built document carries a development bootstrap; replace it wholesale.
  html = html.replace(/window\.TROKKY_CONFIG\s*=\s*{[\s\S]*?};/, `window.TROKKY_CONFIG = ${escapeJsonForScript(config)};`)

  // Vite emits absolute /assets/ URLs; Studio is rarely mounted at the origin root.
  html = html.replace(/src="\/assets\//g, `src="${prefix}/assets/`)
  html = html.replace(/href="\/assets\//g, `href="${prefix}/assets/`)

  // The favicon path assumes the root too, and nothing serves it there.
  html = html.replace(/<link rel="icon"[^>]*>/g, '')

  if (config.branding?.title) {
    html = html.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(config.branding.title)}</title>`)
  }

  return html
}
