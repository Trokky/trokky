/**
 * Studio Asset Serving Utilities
 *
 * These utilities allow other packages (like @trokky/routes) to serve
 * Studio HTML and assets without needing to resolve package paths.
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'

/**
 * Escape a string for safe embedding in HTML content.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Safely serialize an object for embedding inside a <script> tag.
 * Prevents breaking out via </script> or similar sequences.
 */
function escapeJsonForScript(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/'/g, '\\u0027')
}

// Get the Studio package root directory (assuming we're in dist/server/ when compiled)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const studioDir = join(__dirname, '../..')
const distDir = join(studioDir, 'dist')

export interface StudioConfig {
  mode: 'production'
  apiBasePath: string
  basePath?: string // Base path for routing (e.g., '/studio')
  backendUrl?: string // Full backend URL for integrated deployments
  schemas: any[]
  branding?: {
    title?: string
    theme?: 'light' | 'dark' | 'system'
  }
  structure?: any
  config?: any
  customFields?: any[]
}

/**
 * Get Studio HTML with injected configuration
 */
export function getStudioHTML(
  config: StudioConfig,
  studioPath: string
): string {
  try {
    const htmlPath = join(distDir, 'index.html')

    if (!existsSync(htmlPath)) {
      throw new Error(
        `Studio HTML not found at ${htmlPath}. Please build @trokky/studio package.`
      )
    }

    let html = readFileSync(htmlPath, 'utf-8')

    // Replace any existing config with our config (handle multi-line objects)
    html = html.replace(
      /window\.TROKKY_CONFIG\s*=\s*{[\s\S]*?};/,
      `window.TROKKY_CONFIG = ${escapeJsonForScript(config)};

      // TEMPORARY FIX: Override API client path building for dynamic API paths
      window.TROKKY_API_PATH_FIX = function() {


        // Wait for the API client to be available
        const checkApiClient = setInterval(() => {
          if (window.TrokkyApiClient) {

            clearInterval(checkApiClient);

            // Store original post method
            const originalPost = window.TrokkyApiClient.post;

            // Override post method to handle dynamic API paths
            window.TrokkyApiClient.post = function(endpoint, data) {


              // Replace /api with the correct API base path
              if (endpoint.startsWith('/api')) {
                const newEndpoint = endpoint.replace('/api', '${escapeHtml(config.apiBasePath)}');

                endpoint = newEndpoint;
              }

              return originalPost.call(this, endpoint, data);
            };


          }
        }, 100);

        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkApiClient);

        }, 5000);
      };

      // Apply the fix after DOM loads
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.TROKKY_API_PATH_FIX);
      } else {
        window.TROKKY_API_PATH_FIX();
      }`
    )

    // Update asset paths to use our Studio route
    html = html.replace(/src="\/assets\//g, `src="${studioPath}/assets/`)
    html = html.replace(/href="\/assets\//g, `href="${studioPath}/assets/`)

    // Remove favicon reference since we don't have the icon
    html = html.replace(/<link rel="icon"[^>]*>/g, '')

    // Update title if provided
    if (config.branding?.title) {
      html = html.replace(
        /<title>.*?<\/title>/,
        `<title>${escapeHtml(config.branding.title)}</title>`
      )
    }

    return html
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Fallback HTML if built assets are not available
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(config.branding?.title || 'Trokky Studio')}</title>
    <script>
      window.TROKKY_CONFIG = ${escapeJsonForScript(config)};
    </script>
</head>
<body>
    <div id="root">
        <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui, sans-serif;">
            <div style="text-align: center;">
                <h1>${escapeHtml(config.branding?.title || 'Trokky Studio')}</h1>
                <p>Studio not built. Please run: npm run build in @trokky/studio package.</p>
                <p style="font-size: 12px; color: #666; margin-top: 16px;">Error: ${escapeHtml(errorMessage)}</p>
            </div>
        </div>
    </div>
</body>
</html>`
  }
}

/**
 * Get Studio asset content
 */
export function getStudioAsset(
  assetPath: string
): { content: Buffer; contentType: string } | null {
  try {
    const safePath = assetPath.replace(/\.\.\//g, '') // Prevent directory traversal
    const fullAssetPath = join(distDir, 'assets', safePath)

    if (!existsSync(fullAssetPath)) {
      return null
    }

    const content = readFileSync(fullAssetPath)

    // Determine content type based on file extension
    const ext = extname(assetPath).toLowerCase()
    let contentType = 'application/octet-stream'

    if (ext === '.js') {
      contentType = 'application/javascript'
    } else if (ext === '.css') {
      contentType = 'text/css'
    } else if (ext === '.map') {
      contentType = 'application/json'
    } else if (ext === '.svg') {
      contentType = 'image/svg+xml'
    } else if (ext === '.png') {
      contentType = 'image/png'
    } else if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg'
    }

    return { content, contentType }
  } catch (error) {
    return null
  }
}
