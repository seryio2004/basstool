const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { SHOW_HARMONY_COURSE } = require('./src/content/flags.json');

const config = getDefaultConfig(__dirname);
const harmonyContent = path.join(__dirname, 'src/content/harmony') + path.sep;
const harmonyScreen = path.join(__dirname, 'src/screens/HarmonyCourse.tsx');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const result = context.resolveRequest(context, moduleName, platform);
  // Keep the source in the repository without distributing the course in this build.
  if (
    !SHOW_HARMONY_COURSE &&
    result.type === 'sourceFile' &&
    (result.filePath === harmonyScreen || result.filePath.startsWith(harmonyContent))
  ) {
    return { type: 'empty' };
  }
  return result;
};

module.exports = config;
