import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Focused, read-only visual regression. Reuses each real-page harness's bundle and
// strict API interception; its business workflow runner is deliberately not run.
// --before reconstructs the immutable local snapshot, --after uses current source.
// This review mode intentionally requires its snapshot; portable functional checks
// remain the corresponding check-*-ui.mjs commands.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = path.resolve(frontend, '../artifacts/table-typography');
const before = process.argv.includes('--before');
const phase = before ? 'before' : 'after';
const reportOnly = process.argv.includes('--report');
const filter = process.argv.find(arg => arg.startsWith('--routes='))?.slice(9).split(',');
const selectedTabs = process.argv.find(arg => arg.startsWith('--tabs='))?.slice(7).split(',');
const selectedWidths = process.argv.find(arg => arg.startsWith('--widths='))?.slice(9).split(',').map(Number);
let baseline;
try { baseline = JSON.parse((await readFile(path.join(artifacts, 'source-before-sha256.json'), 'utf8')).replace(/^\uFEFF/, '')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  throw new Error('This local typography comparison requires artifacts/table-typography/source-before/src and source-before-sha256.json from before the change. Use the normal per-page check-*-ui.mjs commands for checks without historical snapshots.', { cause: error });
}
const suites = [
  { id: 'goods', file: 'goods-receipts', root: '.goods-receipts-workspace' },
  { id: 'approvals', file: 'approvals', root: '.apc-page' },
  { id: 'enquiries', file: 'enquiries', root: '.eop-page' },
  { id: 'workhub', file: 'my-work-hub', root: '.wh-page' },
  { id: 'finance', file: 'finance-command-center', root: '.finance-command-center' },
  { id: 'incoming', file: 'incoming-invoices', root: '.incoming-invoices' },
  { id: 'outgoing', file: 'outgoing-invoices', root: '.outgoing-collections' },
  { id: 'executive', file: 'executive', root: '.cc-command-center', tabs: ['overview', 'financial', 'portfolio', 'commercial', 'workforce', 'risk'] },
  { id: 'reusable', file: 'goods-receipts', root: '.typography-data-table-fixture' },
].filter(suite => !filter || filter.includes(suite.id));
assert.ok(suites.length, 'At least one recognized route is selected');

const snapshotShim = `
const typographyFrontend = ${JSON.stringify(frontend)};
const typographySnapshot = ${JSON.stringify(path.join(artifacts, 'source-before'))};
async function readFile(file, ...args) {
  const relative = path.relative(typographyFrontend, String(file)).replaceAll('\\\\', '/');
  return sourceReadFile(relative.startsWith('src/') ? path.join(typographySnapshot, relative) : file, ...args);
}
const build = options => sourceBuild({...options,plugins:[...(options.plugins||[]),{name:'immutable-table-typography-baseline',setup(builder){
  builder.onLoad({filter:/\\.(css|jsx?|tsx?)$/},async ({path:file})=>{
    const relative=path.relative(typographyFrontend,file).replaceAll('\\\\','/');
    if(!relative.startsWith('src/'))return;
    const contents=await sourceReadFile(path.join(typographySnapshot,relative),'utf8');
    const extension=path.extname(file).slice(1);
    if(extension==='css'&&options.loader?.['.css']==='empty')return {contents:'',loader:'empty'};
    return {contents,loader:extension==='js'?'jsx':extension};
  });
}}]});
`;

const inspectFunction = `async function typographyMeasure(page, rootSelector) {
  return page.evaluate(rootSelector => {
    const root=document.querySelector(rootSelector);if(!root)throw new Error('Missing table workspace '+rootSelector);
    const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const visible=node=>node.getClientRects().length>0&&getComputedStyle(node).visibility!=='hidden';
    const style=node=>{const s=getComputedStyle(node);return {size:s.fontSize,weight:s.fontWeight,lineHeight:s.lineHeight,color:s.color,padding:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft],height:s.height,whiteSpace:s.whiteSpace};};
    const textNodes=node=>[node,...node.querySelectorAll('*')].filter(child=>visible(child)&&[...child.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(child=>({tag:child.tagName,class:typeof child.className==='string'?child.className:'',role:child.dataset.tableText||null,text:child.textContent.trim().slice(0,90),...style(child),rect:rect(child)}));
    const tables=[...root.querySelectorAll('table')].filter(visible).map((table,index)=>({index,class:table.className,rect:rect(table),headers:[...table.querySelectorAll('thead th')].filter(visible).map(th=>({text:th.textContent.trim(),...style(th),rect:rect(th),children:textNodes(th)})),rows:[...table.querySelectorAll('tbody > tr')].filter(visible).slice(0,8).map(tr=>({rect:rect(tr),cells:[...tr.children].map(td=>({text:td.textContent.trim().slice(0,160),...style(td),rect:rect(td),children:textNodes(td)}))}))}));
    const cardSelector='.grw-kpi,.apc-kpi,.eop-kpi,.wh-kpi,.finance-command-kpi,.cc-outcome,.cc-reference-kpi';
    const cards=[...root.querySelectorAll(cardSelector)].filter(visible).map(card=>({class:card.className,rect:rect(card),children:textNodes(card)}));
    const main=document.querySelector('main.main-content');
    const overflowContainers=[...root.querySelectorAll('.cc-table-wrap')].map(node=>({rect:rect(node),overflowX:getComputedStyle(node).overflowX,scrollWidth:node.scrollWidth,clientWidth:node.clientWidth,parent:node.parentElement.className,parentRect:rect(node.parentElement)}));
    const overflowCandidates=document.documentElement.scrollWidth>innerWidth?[...document.querySelectorAll('body *')].filter(visible).map(node=>{const r=rect(node);let clip=Infinity;for(let p=node.parentElement;p&&p!==document.body;p=p.parentElement)if(['auto','scroll','hidden','clip'].includes(getComputedStyle(p).overflowX))clip=Math.min(clip,p.getBoundingClientRect().right);return {tag:node.tagName,class:typeof node.className==='string'?node.className:'',text:node.textContent.trim().slice(0,65),rect:r,clipRight:clip,position:getComputedStyle(node).position};}).filter(node=>Math.min(node.rect.right,node.clipRight)>innerWidth+.5).slice(-20):[];
    return {viewport:{width:innerWidth,height:innerHeight},overflow:document.documentElement.scrollWidth-innerWidth,root:rect(root),main:main?rect(main):null,sidebar:rect(document.querySelector('#application-sidebar')),tables,cards,overflowContainers,overflowCandidates};
  },rootSelector);
}`;

function runner(suite) {
  const hasEarlyBrowser = ['approvals', 'enquiries', 'workhub', 'incoming', 'executive'].includes(suite.id);
  const openCode = suite.id === 'executive'
    ? `const state=await newPage({...options,route:tab==='overview'?'/executive':'/executive?tab='+tab});const {page}=state;await page.locator('${suite.root} table').first().waitFor();await page.waitForTimeout(100);`
    : suite.id === 'reusable'
      ? `const state=await newPage(options);const {page}=state;await page.locator('${suite.root} table').first().waitFor();`
      : `const state=await open(options);const {page}=state;${suite.id === 'workhub' ? 'await loaded(page);' : ''}`;
  return `
${inspectFunction}
let typographyResults=[];
try {typographyResults=JSON.parse(await readFile(path.join(artifacts,'measurements.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
try {
  ${hasEarlyBrowser ? '' : 'browser=await launchBrowser();'}
  for(const tab of ${JSON.stringify(suite.tabs ? suite.tabs.filter(tab => !selectedTabs || selectedTabs.includes(tab)) : [suite.id])}) {
    for(const options of ${JSON.stringify([{width:1672},{width:1440},{width:1024},{width:390},{width:1672,dark:true}].filter(options => !selectedWidths || selectedWidths.includes(options.width)))}) {
      ${openCode}
      try {
        ${!before ? `const centralStyles=process.env.TABLE_TYPOGRAPHY_CSS;if(centralStyles)await page.addStyleTag({content:await readFile(path.join(frontend,centralStyles),'utf8')});` : ''}
        await page.evaluate(()=>document.fonts.ready);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const name=tab+'-'+options.width+(options.dark?'-dark':'');
        const measurement=await typographyMeasure(page,${JSON.stringify(suite.root)});
        if(measurement.overflow>0){const diagnostics=await page.evaluate(()=>{const rows=[];for(const selector of ['.cc-risk-table','.cc-pulse-table','.cc-risk-panel','.cc-pulse-panel','.cc-right-column','.cc-table-wrap']){const nodes=[...document.querySelectorAll(selector)];const prior=nodes.map(n=>n.style.cssText);for(const n of nodes)n.style.display='none';rows.push({selector,mode:'hidden',width:document.documentElement.scrollWidth});nodes.forEach((n,i)=>n.style.cssText=prior[i]);for(const n of nodes)n.style.position='relative';rows.push({selector,mode:'relative',width:document.documentElement.scrollWidth});nodes.forEach((n,i)=>n.style.cssText=prior[i]);}return {rows,body:document.body.scrollWidth,html:document.documentElement.scrollWidth,bodyChildren:[...document.body.children].map(n=>({tag:n.tagName,class:n.className,id:n.id,scrollWidth:n.scrollWidth,width:n.getBoundingClientRect().width}))};});await writeFile(path.join(artifacts,name+'-overflow-diagnostics.json'),JSON.stringify(diagnostics,null,2));}
        assert.ok(measurement.tables.some(table=>table.rows.length),'Fixture renders actual table rows: '+name);
        ${suite.id === 'reusable' && !before ? `const legacy=await page.locator('[data-testid="legacy-cascade"]').evaluate(table=>{const props=node=>({size:getComputedStyle(node).fontSize,weight:getComputedStyle(node).fontWeight,color:getComputedStyle(node).color});return {action:props(table.querySelector('button')),primary:props(table.querySelector('[data-table-text="primary"]')),header:props(table.querySelector('th'))};});assert.deepEqual([legacy.action.size,legacy.action.weight],['11px','600']);assert.deepEqual([legacy.primary.size,legacy.primary.weight],['13px','600']);assert.equal(legacy.header.color,'rgb(255, 255, 255)');await writeFile(path.join(artifacts,'legacy-cascade-'+name+'.json'),JSON.stringify(legacy,null,2));` : ''}
        const actions=page.locator(${JSON.stringify(suite.root + ' table tbody a[href]:visible, ' + suite.root + ' table tbody button:not([disabled]):visible')});
        const keyboardAction=[];
        if(await actions.count()){for(const action of [actions.first(),actions.last()]){await action.focus();const result=await action.evaluate(node=>({text:node.textContent.trim(),focused:document.activeElement===node,rect:{left:node.getBoundingClientRect().left,right:node.getBoundingClientRect().right}}));assert.equal(result.focused,true);keyboardAction.push(result);}}
        await page.evaluate(()=>{document.activeElement?.blur();for(const node of document.querySelectorAll('main,main *')){if(node.scrollTop)node.scrollTop=0;if(node.scrollLeft)node.scrollLeft=0;}});
        await page.screenshot({path:path.join(artifacts,name+'.png')});
        let axe=[];
        ${!before ? `if(options.width===1672||options.width===390){const scan=await new AxeBuilder({page}).include(${JSON.stringify(suite.root)}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();axe=scan.violations.map(({id,impact,description,nodes})=>({id,impact,description,nodes:nodes.map(n=>({target:n.target,failureSummary:n.failureSummary}))}));}` : ''}
        const result={name,...measurement,keyboardAction,axe};const existing=typographyResults.findIndex(row=>row.name===name);if(existing>=0)typographyResults[existing]=result;else typographyResults.push(result);
        await writeFile(path.join(artifacts,'measurements.json'),JSON.stringify(typographyResults,null,2));
        ${suite.id === 'goods' ? `if(options.width===1672&&!options.dark){
          await detailReady(page,301);
          await page.getByTestId('goods-receipt-review').getByRole('button',{name:'Print receipt',exact:true}).click();
          await page.getByRole('dialog',{name:/Print Preview.*Goods Receipt Note/}).waitFor();
          const preview=await typographyMeasure(page,'.gr-paper');
          await page.screenshot({path:path.join(artifacts,'receipt-print-preview.png')});
          await page.emulateMedia({media:'print'});
          const print=await typographyMeasure(page,'.gr-print-document');
          await page.pdf({path:path.join(artifacts,'receipt-print.pdf'),preferCSSPageSize:true,printBackground:true});
          await writeFile(path.join(artifacts,'print-measurements.json'),JSON.stringify({preview,print},null,2));
          assert.equal(state.control.mutations.length,0,'Print sample is read-only');
        }` : ''}
        console.log('MEASURED ${phase} '+name+' tables='+measurement.tables.length+' overflow='+measurement.overflow+' axe='+axe.length);
      } finally {await page.context().close();}
    }
  }
  const observedErrors=typeof runtimeErrors!=='undefined'?runtimeErrors:typeof errors!=='undefined'?errors:[];
  assert.deepEqual(observedErrors,[],'No browser runtime errors');
  assert.deepEqual(unexpectedRequests,[],'No unexpected API calls');
} finally {await browser?.close();}
`;
}

await mkdir(path.join(artifacts, phase), { recursive: true });
for (const suite of reportOnly ? [] : suites) {
  let source = await readFile(path.join(frontend, 'scripts', `check-${suite.file}-ui.mjs`), 'utf8');
  const cut = source.lastIndexOf('\ntry {');
  assert.ok(cut > 1000, `Recognized isolated harness runner: ${suite.file}`);
  source = source.slice(0, cut);
  source = source.replace(/^const artifacts = .*;$/m, `const artifacts = ${JSON.stringify(path.join(artifacts, phase, suite.id))};`);
  // The focused runner owns its immutable-source checks, not old redesign guards.
  source = source.replace(/^await (guards|checkProtectedSources|assertSidebarUnchanged)\(\);$/gm, '');
  if (suite.id === 'reusable') {
    source = source.replace("import ReceiptManagement from './src/pages/Procurement/ReceiptManagement.jsx';", `import DataTable from './src/components/ui/DataTable.jsx';
function ReceiptManagement(){return <section className='typography-data-table-fixture p-4'><h1 style={{color:'var(--app-text)'}}>Reusable table</h1><DataTable caption='Representative request register' columns={[{key:'reference',label:'Reference',render:r=><a href='/projects'>{r.reference}</a>},{key:'name',label:'Request',render:r=><strong>{r.name}</strong>},{key:'source',label:'Source',render:r=><small>{r.source}</small>},{key:'status',label:'Status',render:r=><span className='badge'>{r.status}</span>},{key:'action',label:'Action',render:()=> <button type='button'>View details</button>}]} rows={[{id:1,reference:'PR-2026-1047',name:'Mechanical equipment inspection',source:'Procurement · Delivery evidence',status:'Pending'},{id:2,reference:'PR-2026-1048',name:'Electrical material certification',source:'Procurement · Project documents',status:'Recorded'}]}/></section>}`);
    source = source.replace("status:'Recorded'}]}/></section>}", "status:'Recorded'}]}/><table data-testid='legacy-cascade' className='min-w-full'><caption className='sr-only'>Legacy table styles</caption><thead className='bg-slate-900 text-white'><tr><th scope='col'>Reference</th><th scope='col'>Action</th></tr></thead><tbody><tr><td data-table-text='primary'>PR-1049</td><td><button type='button' className='font-semibold'>Review item</button></td></tr></tbody></table></section>}");
  }
  if (before) {
    source = source.replace(/\bmkdir, readFile, readdir, writeFile\b/, 'mkdir, readFile as sourceReadFile, readdir, writeFile');
    assert.ok(source.includes('readFile as sourceReadFile'), `Expected fs import: ${suite.file}`);
    source = source.replace("import { build } from 'esbuild';", "import { build as sourceBuild } from 'esbuild';");
    source = source.replace('// Real', `${snapshotShim}\n// Real`);
    if (!source.includes('const typographyFrontend')) {
      const marker = source.indexOf('const frontend =');
      source = source.slice(0, marker) + snapshotShim + source.slice(marker);
    }
  } else {
    source = source.replace(/\bmkdir, readFile, readdir, writeFile\b/, 'mkdir, readFile as sourceReadFile, readdir, writeFile');
    const marker = source.indexOf('const frontend =');
    const inlineImport = `async function readFile(file,...args){
      const content=await sourceReadFile(file,...args);
      if(String(file).replaceAll('\\\\','/').endsWith('/src/index.css')&&typeof content==='string'){
        const shared=await sourceReadFile(path.join(path.dirname(file),'table-typography.css'),'utf8');
        return content.replace(/@import ['"]\\.\\/table-typography\\.css['"];?/,shared);
      }
      return content;
    }\n`;
    source = source.slice(0, marker) + inlineImport + source.slice(marker);
  }
  const temporary = path.join(frontend, 'scripts', `.table-typography-${suite.id}.mjs`);
  await writeFile(temporary, source + runner(suite));
  try {
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [temporary], { cwd: frontend, stdio: 'inherit', env: process.env });
      child.on('error', reject); child.on('exit', resolve);
    });
    assert.equal(code, 0, `Focused ${phase} ${suite.id} harness completed`);
  } finally { await unlink(temporary); }
}

const changes = [];
for (const row of baseline) {
  const expected = row.Hash.toUpperCase();
  const immutable = createHash('sha256').update(await readFile(path.join(artifacts, 'source-before', row.RelativePath))).digest('hex').toUpperCase();
  assert.equal(immutable, expected, `Immutable snapshot preserved: ${row.RelativePath}`);
  const actual = createHash('sha256').update(await readFile(path.join(frontend, row.RelativePath))).digest('hex').toUpperCase();
  if (actual !== expected) changes.push(row.RelativePath);
}
const protectedChanges = changes.filter(file => /^src\/(components\/Layout\/|hooks\/useSidebar|config\/(layout|navigationLabels)|pages\/UserDetail)/.test(file));
assert.deepEqual(protectedChanges, [], 'Sidebar, shell and user details stay byte-identical');
await writeFile(path.join(artifacts, `${phase}-source-checks.json`), JSON.stringify({ immutableFiles: baseline.length, changes, protectedChanges }, null, 2));
if (!before) {
  const comparisons = [];
  for (const suite of suites) {
    let previous, current;
    try {
      previous = JSON.parse(await readFile(path.join(artifacts, 'before', suite.id, 'measurements.json'), 'utf8'));
      current = JSON.parse(await readFile(path.join(artifacts, 'after', suite.id, 'measurements.json'), 'utf8'));
    } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const next of current) {
      const prior = previous.find(row => row.name === next.name);
      if (!prior) continue;
      const changedRows = [], changedHeaders = [], headerTypography = [], changedPadding = [], changedCards = [];
      for (const [index, table] of next.tables.entries()) {
        const old = prior.tables[index];
        if (!old) continue;
        for (const [rowIndex, row] of table.rows.entries()) {
          if (old.rows[rowIndex] && Math.abs(row.rect.height - old.rows[rowIndex].rect.height) > 0.2) changedRows.push({ table: index, row: rowIndex, before: old.rows[rowIndex].rect.height, after: row.rect.height });
          for (const [cellIndex, cell] of row.cells.entries()) if (old.rows[rowIndex]?.cells[cellIndex] && JSON.stringify(cell.padding) !== JSON.stringify(old.rows[rowIndex].cells[cellIndex].padding)) changedPadding.push({ table: index, row: rowIndex, cell: cellIndex });
        }
        for (const [headerIndex, header] of table.headers.entries()) {
          if (old.headers[headerIndex] && Math.abs(header.rect.height - old.headers[headerIndex].rect.height) > 0.2) changedHeaders.push({ table: index, header: headerIndex, before: old.headers[headerIndex].rect.height, after: header.rect.height });
          if (!String(table.class).includes('wh-calendar-grid') && (header.size !== '13px' || header.weight !== '600')) headerTypography.push({ table: index, text: header.text, size: header.size, weight: header.weight });
        }
      }
      for (const [index, card] of next.cards.entries()) {
        const old = prior.cards[index];
        if (!old) continue;
        const geometry = ['width', 'height'].filter(key => Math.abs(card.rect[key] - old.rect[key]) > 0.2);
        const typography = card.children.some((child, i) => old.children[i] && ['size', 'weight', 'lineHeight', 'color'].some(key => child[key] !== old.children[i][key]));
        if (geometry.length || typography) changedCards.push({ index, geometry, typography });
      }
      const report = { suite: suite.id, name: next.name, overflow: next.overflow, changedRows, changedHeaders, changedPadding, changedCards, headerTypography, axe: next.axe, keyboardAction: next.keyboardAction };
      comparisons.push(report);
      console.log(`COMPARE ${next.name}: rows=${changedRows.length} headers=${changedHeaders.length} padding=${changedPadding.length} cards=${changedCards.length} type=${headerTypography.length} axe=${next.axe.length}`);
    }
  }
  await writeFile(path.join(artifacts, 'comparison.json'), JSON.stringify(comparisons, null, 2));
  const coreFailures = comparisons.filter(row => row.overflow > 0 || row.axe.length || row.headerTypography.length || row.changedPadding.length || row.changedCards.length);
  const summary = { cases: comparisons.length, coreFailures: coreFailures.map(row => row.name), noDocumentOverflow: comparisons.every(row => row.overflow === 0), noAccessibilityViolations: comparisons.every(row => !row.axe.length), cardsUnchanged: comparisons.every(row => !row.changedCards.length), tablePaddingUnchanged: comparisons.every(row => !row.changedPadding.length), shellUnchanged: !protectedChanges.length, note: 'Row/header changes are reported separately; some narrow tables now scroll horizontally to preserve readable text. Closed disclosure tables are also measured.' };
  await writeFile(path.join(artifacts, 'summary.json'), JSON.stringify(summary, null, 2));
  try {
    const original = JSON.parse(await readFile(path.join(artifacts, 'before/goods/print-measurements.json'), 'utf8'));
    const current = JSON.parse(await readFile(path.join(artifacts, 'after/goods/print-measurements.json'), 'utf8'));
    for (const mode of ['preview', 'print']) assert.deepEqual(current[mode].tables, original[mode].tables, `Receipt ${mode} table text, fonts, colors and geometry unchanged`);
    await writeFile(path.join(artifacts, 'print-checks.json'), JSON.stringify({ previewUnchanged: true, printUnchanged: true, actualPdf: 'after/goods/receipt-print.pdf' }, null, 2));
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (process.argv.includes('--assert')) assert.deepEqual(coreFailures, [], 'No typography, padding, card, overflow or accessibility regressions');
}
console.log(`Focused ${phase} typography checks complete. All browser contexts closed.`);
