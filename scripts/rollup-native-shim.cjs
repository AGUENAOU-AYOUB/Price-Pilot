const crypto = require('crypto');
const parser = require('@babel/parser');

const defaultPlugins = [
  'jsx',
  'importAssertions',
  'importAttributes',
  ['decorators', { decoratorsBeforeExport: true }],
  'classProperties',
  'classPrivateProperties',
  'classPrivateMethods',
  'topLevelAwait',
  'dynamicImport',
  'numericSeparator',
  'optionalChaining',
  'nullishCoalescingOperator',
  'objectRestSpread',
  'asyncGenerators',
  'bigInt',
  'throwExpressions',
  'exportDefaultFrom',
  'exportNamespaceFrom',
  'logicalAssignment',
  'privateIn',
];

function toParserOptions(options = {}) {
  const {
    sourceType = 'module',
    ecmaVersion,
    allowAwaitOutsideFunction,
    allowImportExportEverywhere,
    allowReturnOutsideFunction,
  } = options || {};

  return {
    sourceType: sourceType === 'module' ? 'module' : 'script',
    allowAwaitOutsideFunction: Boolean(allowAwaitOutsideFunction),
    allowImportExportEverywhere: Boolean(allowImportExportEverywhere),
    allowReturnOutsideFunction: Boolean(allowReturnOutsideFunction),
    ranges: true,
    tokens: true,
    plugins: defaultPlugins,
    ecmaVersion: ecmaVersion || 'latest',
  };
}

function parse(source, options) {
  const ast = parser.parse(source, toParserOptions(options));
  const program = ast.program || ast;

  if (ast.comments && !program.comments) {
    program.comments = ast.comments;
  }

  if (ast.tokens && !program.tokens) {
    program.tokens = ast.tokens;
  }

  return program;
}

async function parseAsync(source, options) {
  return parse(source, options);
}

function toBuffer(input) {
  if (Buffer.isBuffer(input)) {
    return input;
  }

  if (typeof input === 'string') {
    return Buffer.from(input);
  }

  if (input instanceof Uint8Array) {
    return Buffer.from(input);
  }

  throw new TypeError('Unsupported input type for hashing');
}

function createDigest(input) {
  return crypto.createHash('sha256').update(toBuffer(input)).digest();
}

function xxhashBase64Url(input) {
  return createDigest(input).toString('base64url');
}

function xxhashBase36(input) {
  const hex = createDigest(input).toString('hex');
  return BigInt('0x' + hex).toString(36);
}

function xxhashBase16(input) {
  return createDigest(input).toString('hex');
}

const nativeExports = {
  parse,
  parseAsync,
  xxhashBase64Url,
  xxhashBase36,
  xxhashBase16,
};

const nativePath = require.resolve('rollup/dist/native.js');
require.cache[nativePath] = {
  id: nativePath,
  filename: nativePath,
  loaded: true,
  exports: nativeExports,
};

module.exports = nativeExports;
