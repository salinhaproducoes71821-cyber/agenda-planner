require('./build/image-size-policy.cjs');
const {getDefaultConfig} = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.transformer.babelTransformerPath = require.resolve('./build/transformer.cjs');
module.exports = config;
