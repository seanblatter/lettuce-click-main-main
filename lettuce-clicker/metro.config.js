const { getDefaultConfig } = require('expo/metro-config');

// Minimal CommonJS Metro config compatible with Expo CLI/Node
const config = getDefaultConfig(__dirname);

// Ensure Metro treats .bin files as assets
config.resolver = {
  ...config.resolver,
  assetExts: [...config.resolver.assetExts, 'bin'],
};

module.exports = config;
