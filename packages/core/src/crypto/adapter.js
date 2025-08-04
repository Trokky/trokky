"use strict";
/**
 * Crypto adapter interface for different deployment environments
 * Supports both Node.js and edge runtime environments
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectCryptoAdapter = detectCryptoAdapter;
/**
 * Detect the best crypto adapter for the current environment
 */
function detectCryptoAdapter(options = {}) {
    const { adapterType = 'auto' } = options;
    if (adapterType === 'node' || (adapterType === 'auto' && isNodeEnvironment())) {
        return new node_adapter_js_1.NodeCryptoAdapter(options);
    }
    if (adapterType === 'webcrypto' || (adapterType === 'auto' && hasWebCrypto())) {
        return new webcrypto_adapter_js_1.WebCryptoAdapter(options);
    }
    // Fallback to basic adapter (less secure but universal)
    console.warn('⚠️ Using fallback crypto adapter. This is not recommended for production.');
    return new fallback_adapter_js_1.FallbackCryptoAdapter(options);
}
function isNodeEnvironment() {
    return typeof process !== 'undefined' &&
        process.versions !== undefined &&
        typeof process.versions.node === 'string' &&
        typeof require === 'function';
}
function hasWebCrypto() {
    return typeof crypto !== 'undefined' &&
        typeof crypto.subtle !== 'undefined';
}
// Import adapters
const node_adapter_js_1 = require("./node-adapter.js");
const webcrypto_adapter_js_1 = require("./webcrypto-adapter.js");
const fallback_adapter_js_1 = require("./fallback-adapter.js");
