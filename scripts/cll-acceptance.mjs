// Dev harness — verifies the CLL parser + evaluation engine against the real
// reference files (§8 acceptance). Run: node frontend/scripts/cll-acceptance.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const LDT_FILE = path.join(root, 'Documents/Piping/Critical Line List/Phase 3 - Onshore/Process Line List Onshore.xlsx');
const CRIT_FILE = path.join(root, 'Documents/Piping/Critical Line List/Phase 3 - Onshore/Stress_Critical_Onshore.xlsx');

const cllFiles = await import(pathToFileURL(path.join(here, '../src/pages/Engineering/Piping/cll/cllFiles.js')));
const engine = await import(pathToFileURL(path.join(here, '../src/pages/Engineering/Piping/cll/criticalityEngine.js')));

let pass = 0, fail = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
  ok ? pass++ : fail++;
};

// --- criteria: built-in grid vs reference sheet, cell for cell --------------
const wbC = cllFiles.readWorkbookBuffer(readFileSync(CRIT_FILE));
console.log('criteria sheets:', wbC.sheetNames);
const cSheet = cllFiles.detectCriteriaSheet(wbC);
check('criteria sheet auto-selected', cSheet, 'TABLE 2 ONSHORE');
check('ignored sheets', cllFiles.ignoredSheetNotes(wbC, cSheet).map(n => n.message), ['README sheet ignored']);
const crit = cllFiles.parseCriteriaSheet(wbC.sheets[cSheet], 'onshore');
check('criteria errors', crit.errors.length, 0);
check('grid size', `${crit.table.grid.length}x${crit.table.grid[0].length}`, '13x15');
check('standard', crit.table.standard, 'AGPS-SP-PI-004');
check('revision', crit.table.revision, '01');
check('built-in grid equals reference', engine.BUILTIN_ONSHORE.grid, crit.table.grid);
check('built-in temp limits equal reference', engine.BUILTIN_ONSHORE.tempLimits, crit.table.tempLimits);
check('built-in NPS rows equal reference', engine.BUILTIN_ONSHORE.npsRows, crit.table.npsRows);
check('definitions', crit.table.definitions, {
  L1: 'A comprehensive computer stress analysis and stress report is required.',
  L2: 'A simplified analysis method should be used.',
  L3: 'Neither manual nor computer analysis is generally required. A visual review of the piping drawing or sketch should be made to ensure that the piping system has flexibility.',
});

// --- LDT parsing -------------------------------------------------------------
const wbL = cllFiles.readWorkbookBuffer(readFileSync(LDT_FILE));
const lSheet = cllFiles.detectLdtSheet(wbL);
check('LDT sheet auto-selected', lSheet, 'Line Designation Table');
const grid = wbL.sheets[lSheet];
const hr = cllFiles.detectLdtHeaderRow(grid);
check('header row', hr + 1, 8);
const { headers } = { headers: (grid[hr] || []).map(h => String(h).trim()) };
const mapping = cllFiles.guessLdtMapping(headers);
const mappedRequired = cllFiles.LDT_FIELDS.filter(f => f.required && mapping[f.key] != null).length;
check('required mapped', `${mappedRequired} of ${cllFiles.LDT_REQUIRED_COUNT}`, '10 of 10');
const mappedAll = cllFiles.LDT_FIELDS.filter(f => mapping[f.key] != null).length;
check('all 27 mapped', mappedAll, 27);

const parsed = cllFiles.parseLdtSheet(grid, hr, mapping);
check('line count', parsed.records.length, 4253);
const errs = parsed.issues.filter(i => i.severity === 'error');
const warns = parsed.issues.filter(i => i.severity === 'warning');
check('errors', errs.length, 0);
check('class-mismatch warnings', warns.filter(w => w.type === 'class-mismatch').length, 7);
check('duplicate-key warnings', warns.filter(w => w.type === 'duplicate-line-key').length, 1);
check('multiple-size warnings', warns.filter(w => w.type === 'multiple-sizes').length, 2);
check('lower-case warnings', warns.filter(w => w.type === 'lower-case').length, 2);
check('total warnings', warns.length, 12);
if (warns.length !== 12) {
  const byType = {};
  warns.forEach(w => { byType[w.type] = (byType[w.type] || 0) + 1; });
  console.log('  warning breakdown:', byType);
}

// --- evaluation totals --------------------------------------------------------
const { evaluations, results, flagCheck } = engine.evaluateAll(parsed.records, engine.BUILTIN_ONSHORE);
check('L1', results.L1, 1113);
check('L2', results.L2, 3140);
check('L3', results.L3, 0);
check('Cannot evaluate', results.cannotEvaluate, 0);
check('Agrees', flagCheck.agrees, 3476);
check('Not flagged but L1', flagCheck.notFlaggedL1, 335);
check('Flagged Y but L2', flagCheck.flaggedConservative, 442);

// --- spot checks ---------------------------------------------------------------
const spot = (ln) => evaluations.find(e => e.lineNumber === ln);
const s1 = spot('2600-AY-037-17091R-V');
check('spot 2600-AY-037 category', s1?.finalCategory, 'L1');
check('spot 2600-AY-037 flagCheck', s1?.flagCheck, 'not-flagged-L1');
check('spot 2600-AY-037 row/col', [s1?.tableRow, s1?.tableCol], [8, 6]); // 14" row, 120 col
const s2 = spot('2600-AY-005-17091R-V');
check('spot 2600-AY-005 category', s2?.finalCategory, 'L2');
check('spot 2600-AY-005 flagCheck', s2?.flagCheck, 'agrees');
check('spot 2600-AY-005 row/col', [s2?.tableRow, s2?.tableCol], [4, 6]); // 6" row, 120 col
const s3 = spot('2600-BD-305-31051YR-I');
check('spot 2600-BD-305 category', s3?.finalCategory, 'L1');
check('spot 2600-BD-305 flagCheck', s3?.flagCheck, 'agrees');
check('spot 2600-BD-305 row/col', [s3?.tableRow, s3?.tableCol], [1, 14]); // 2" row, 345+ col
const s4 = spot('2600-P-1034-3025P1-E');
check('spot 2600-P-1034 category', s4?.finalCategory, 'L1');
check('spot 2600-P-1034 multiple sizes', s4?.warnings.some(w => w.type === 'multiple-sizes'), true);
const s5 = spot('2600-P-301-11055MR-PP');
check('spot 2600-P-301 category', s5?.finalCategory, 'L1');
check('spot 2600-P-301 class mismatch', parsed.records.find(r => r.lineNumber === '2600-P-301-11055MR-PP')?.ldtWarnings.some(w => w.type === 'class-mismatch'), true);

// --- review items ----------------------------------------------------------------
const items = engine.buildReviewItems(evaluations);
const critCount = items.filter(i => i.severity === 'critical').length;
const warnCount = items.filter(i => i.severity === 'warning').length;
check('review critical items', critCount, 335);
check('review warning items', warnCount, 12);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
