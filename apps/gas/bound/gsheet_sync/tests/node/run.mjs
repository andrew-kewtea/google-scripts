/**
 * GAS 소스(.js)를 VM에 올려 순수 로직 3가지 검증.
 * 실행: pnpm test  또는  node tests/node/run.mjs
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var root = path.resolve(__dirname, '../..');

function loadGasFile(relPath) {
  return fs.readFileSync(path.join(root, 'src', relPath), 'utf8');
}

function runInGasContext(code, sandbox) {
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
}

var failed = 0;

function check(name, cond) {
  if (cond) {
    console.log('ok  ' + name);
  } else {
    console.error('FAIL ' + name);
    failed++;
  }
}

// --- 1) pick_ + formatSheetDateTimeWithTz_ (mock Utilities) ---
var apiObjectCode = loadGasFile('utils/api_object.js');
var apiSandbox = {
  Utilities: {
    formatDate: function (d, tz, fmt) {
      if (fmt !== 'yyyy-MM-dd HH:mm:ss') return '';
      return d.getUTCFullYear() + '-01-01 00:00:00';
    },
  },
  SpreadsheetApp: {
    getActiveSpreadsheet: function () {
      return { getSpreadsheetTimeZone: function () { return 'UTC'; } };
    },
  },
};
runInGasContext(apiObjectCode, apiSandbox);

check(
  'pick_ first non-empty key',
  apiSandbox.pick_({ a: '', b: 2 }, ['a', 'b']) === 2
);
check(
  'pick_ missing',
  apiSandbox.pick_({ c: 1 }, ['a', 'b']) === ''
);
var ms = new Date('2020-06-15T12:00:00.000Z').getTime();
check(
  'formatSheetDateTimeWithTz_ uses Utilities.formatDate',
  apiSandbox.formatSheetDateTimeWithTz_(ms, 'Asia/Seoul').indexOf('2020') === 0
);

// --- 2) makeListSortParamNormalizer_ ---
var sortCode = loadGasFile('utils/list_query_sort.js');
var sortSandbox = {};
runInGasContext(sortCode, sortSandbox);
var norm = sortSandbox.makeListSortParamNormalizer_({ lastupdatedat: 'last_updated_at' });
check(
  'sort param LastUpdatedAt → last_updated_at',
  norm('sort', 'LastUpdatedAt') === 'last_updated_at'
);
check(
  'non-sort passthrough',
  norm('page', '3') === '3'
);

// --- 3) parseListEnvelope_ ---
var envCode = loadGasFile('list_envelope.js');
var envSandbox = {};
runInGasContext(envCode, envSandbox);
var env = envSandbox.parseListEnvelope_({ items: [{ id: 1 }], total: 42 });
check('parseListEnvelope total', env.total === 42 && env.items.length === 1);
var env2 = envSandbox.parseListEnvelope_({ data: { items: [{ x: 1 }] }, total: 0 });
check('parseListEnvelope nested data.items', env2.items.length === 1);

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nall tests passed');
