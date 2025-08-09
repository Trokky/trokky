/**
 * Crypto adapter interface for different deployment environments
 * Supports both Node.js and edge runtime environments
 */
/**
 * Detect the best crypto adapter for the current environment
 */
export function detectCryptoAdapter(options = {}) {
    const { adapterType = 'auto' } = options;
    // Prefer Web Crypto when available (Cloudflare Workers, modern Node, browsers)
    if (adapterType === 'webcrypto' || (adapterType === 'auto' && hasWebCrypto())) {
        return new WebCryptoAdapter(options);
    }
    // Node-specific adapter deliberately NOT statically imported to keep edge bundles clean.
    // Modern Node has WebCrypto; if not available, fall back to universal adapter.
    if (adapterType === 'node' || (adapterType === 'auto' && isNodeEnvironment())) {
        // In older Node environments without WebCrypto, use the fallback adapter.
        console.warn('WebCrypto not detected; using fallback crypto adapter in Node environment.');
        return new FallbackCryptoAdapter(options);
    }
    // Fallback to basic adapter (less secure but universal)
    console.warn('⚠️ Using fallback crypto adapter. This is not recommended for production.');
    return new FallbackCryptoAdapter(options);
}
function isNodeEnvironment() {
    return typeof process !== 'undefined' &&
        process.versions !== undefined &&
        typeof process.versions.node === 'string';
}
function hasWebCrypto() {
    const g = typeof globalThis !== 'undefined' ? globalThis : undefined;
    return !!(g && g.crypto && typeof g.crypto.subtle !== 'undefined');
}
// Import only edge-safe adapters statically
import { WebCryptoAdapter } from './webcrypto-adapter.js';
import { FallbackCryptoAdapter } from './fallback-adapter.js';
