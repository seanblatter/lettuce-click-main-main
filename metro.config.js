const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const appRoot = path.join(projectRoot, 'lettuce-clicker');

const config = getDefaultConfig(appRoot);

// Ensure Metro treats .bin files as assets
config.resolver = {
  ...config.resolver,
  assetExts: [...config.resolver.assetExts, 'bin'],
};

module.exports = config;
