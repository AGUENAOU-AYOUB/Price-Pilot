#!/usr/bin/env node
const path = require('path');

require('./rollup-native-shim.cjs');

const viteCli = path.resolve(__dirname, '../node_modules/vite/bin/vite.js');

process.argv = [process.argv[0], viteCli, ...process.argv.slice(2)];

import(viteCli).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
