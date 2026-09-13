const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite on web loads SQLite through a WebAssembly worker.
// Android does not need this configuration, but it prevents web's
// "Worker chunk not found" error when running `npx expo start --web`.
config.resolver.assetExts.push('wasm');

// Required by SharedArrayBuffer, which expo-sqlite's web worker uses.
config.server.enhanceMiddleware = (middleware) => (request, response, next) => {
  response.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(request, response, next);
};

module.exports = config;
