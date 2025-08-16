/* eslint-disable */
// Note: this startup script is a plain JS file and is not included in tsconfig.json;
// disabling ESLint here prevents the typescript-eslint parser from requiring it to be
// part of the TypeScript project configured in parserOptions.project.

const path = require('path');
const fs = require('fs');

// Startup shim: register tsconfig-paths programmatically then start the compiled app
function loadTsConfig() {
  const cfgPath = path.resolve(__dirname, 'tsconfig.json');
  try {
    const raw = fs.readFileSync(cfgPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

const tsconfig = loadTsConfig();
let baseUrl = './';
let paths = { 'src/*': ['dist/*'] };
if (tsconfig && tsconfig.compilerOptions) {
  baseUrl = tsconfig.compilerOptions.baseUrl || baseUrl;
  paths = tsconfig.compilerOptions.paths || paths;
}

try {
  // Register path mappings so imports like 'src/...' resolve to 'dist/...'
  require('tsconfig-paths').register({
    baseUrl: path.resolve(__dirname, baseUrl),
    paths,
  });
} catch (err) {
  // If tsconfig-paths isn't present, continue — consumer should ensure dependency is installed
  // Log minimal info for debugging in production
  // eslint-disable-next-line no-console
  console.warn(
    'tsconfig-paths registration failed:',
    err && err.message ? err.message : err,
  );
}

// Finally require the compiled app entry
require(path.resolve(__dirname, 'dist', 'main'));

// "start": "node -r tsconfig-paths/register dist/main"