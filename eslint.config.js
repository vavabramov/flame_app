// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // tools/ holds separate Node packages (e.g. the MCP server) with their own config.
    ignores: ['dist/*', 'tools/**'],
  },
]);
