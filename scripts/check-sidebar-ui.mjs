import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { inlineLocalCssImports, checkArtifacts, launchBrowser, sidebarWidth } from './ui-check-support.mjs';
import AxeBuilder from '@axe-core/playwright';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import tailwindConfig from '../tailwind.config.js';

// Exercise the real Layout, Header, Sidebar, search, permission filtering and persistence hook.
// Unrelated shell services are stubbed; no API or external network is contacted.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = checkArtifacts(frontend, 'sidebar-redesign');
const origin = 'http://sidebar-check.test';
const preferenceKey = 'radai.sidebar.collapsed';
const source = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Layout from './src/components/Layout/Layout.jsx';

const params = new URLSearchParams(window.location.search);
const limited = params.get('fixture') === 'limited';
const emptyAdmin = params.get('fixture') === 'empty-admin';
const user = {
  id: 'sidebar-check', first_name: 'Review', last_name: 'User',
  email: 'review@example.test', is_superuser: !limited && !emptyAdmin,
  roles: limited ? [] : emptyAdmin ? [{code:'admin',name:'Administrator'}]
    : [{code:'super_admin',name:'Super Administrator'}],
};
const state = {auth:{user,isAuthenticated:true},theme:{mode:'light'},rbac:{currentUser:{modules:[]}}};
const store = {getState:()=>state,subscribe:()=>()=>{},dispatch:()=>{}};
window.sidebarRequests = [];
window.fetch = async (url, options = {}) => {
  window.sidebarRequests.push({url:String(url), method:options.method || 'GET'});
  if (!String(url).endsWith('/rbac/users/me/')) throw new Error('Unexpected fixture API: '+url);
  return {ok:true,json:async()=>({user,roles:user.roles,modules:limited?[{code:'finance_incoming'}]:[]})};
};
function Content() {
  const location = useLocation();
  window.sidebarRoute = useNavigate();
  return <section className="p-6 text-slate-900 dark:text-slate-100">
    <h1 className="text-2xl font-semibold">Workspace preview</h1>
    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sidebar interaction checks with fixture data</p>
    <output id="current-route" className="mt-4 block text-sm">{location.pathname + location.search}</output>
    <button id="page-control" className="mt-6 rounded border border-slate-300 p-2">Page control</button>
  </section>;
}
createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <MemoryRouter initialEntries={[params.get('route') || '/dashboard']}>
      <Routes><Route element={<Layout/>}><Route path="*" element={<Content/>}/></Route></Routes>
    </MemoryRouter>
  </Provider>
);
`;

const reminder = `import React from 'react';export default function Reminder(){return <aside id="fixture-reminder" className="fixed bottom-5 right-5 z-[70] h-[180px] w-[min(92vw,390px)] rounded-2xl border bg-white p-4 shadow-2xl" role="status">
  <p className="text-sm font-semibold">Approval waiting for you</p>
  <button id="fixture-reminder-action" className="mt-4 rounded bg-blue-600 px-3 py-2 text-white" onClick={()=>{window.reminderClicks=(window.reminderClicks||0)+1}}>Open full request</button>
</aside>}`;
const serviceButtons = `import React from 'react';import {BellIcon,ArrowDownTrayIcon} from '@heroicons/react/24/outline';
export function NotificationBell(){return <div className="relative z-50"><button aria-label="Notifications" className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg"><BellIcon className="h-5 w-5"/></button></div>}
export default function PWAHeaderInstall(){return <button aria-label="Install RADAI on this device" className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg"><ArrowDownTrayIcon className="h-5 w-5"/></button>}`;
const stubs = [
  [/store[\\/]slices[\\/]authSlice\.js$/, 'export const updateUser=()=>({type:"fixture"});export const logout=()=>({type:"fixture-logout"});'],
  [/store[\\/]slices[\\/]themeSlice\.js$/, 'export const toggleTheme=()=>({type:"fixture-theme"});'],
  [/components[\\/]Layout[\\/]Footer\.jsx$/, 'export default function Footer(){return null;}'],
  [/components[\\/]ProcurementApprovalReminder\.jsx$/, reminder],
  [/components[\\/]notifications[\\/]NotificationBell\.jsx$/, serviceButtons.replace('export function NotificationBell', 'export default function NotificationBell').replace('export default function PWAHeaderInstall', 'export function PWAHeaderInstall')],
  [/components[\\/]PWAHeaderInstall\.jsx$/, serviceButtons],
  [/hooks[\\/]useAuthenticatedPhoto\.js$/, 'export default function useAuthenticatedPhoto(){return null;}'],
  [/components[\\/]help[\\/]HelpContext\.jsx$/, 'export function HelpContextProvider({children}){return children;}export const useHelpContext=()=>({helpContext:{featureLabel:"Workspace"},isOpen:false,openHelp:()=>{}});'],
  [/components[\\/]help[\\/]ContextualHelpDrawer\.jsx$/, 'export default function ContextualHelpDrawer(){return null;}'],
];
const bundle = await build({
  stdin: { contents: source, loader: 'jsx', resolveDir: frontend },
  bundle: true, write: false, format: 'iife',
  loader: { '.css': 'empty' },
  define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'sidebar-fixture', setup(builder) {
    for (const [filter, contents] of stubs) {
      builder.onLoad({ filter }, () => ({ contents, loader: 'jsx' }));
    }
  } }],
});
const components = await Promise.all([
  'src/components/Layout/Sidebar.jsx',
  'src/components/Layout/Layout.jsx',
  'src/components/Layout/Header.jsx',
  'src/components/Layout/GlobalSearch.jsx',
  'src/components/help/ContextualHelpButton.jsx',
  'src/config/layout.config.js',
].map(file => readFile(path.join(frontend, file), 'utf8')));
const css = await postcss([tailwind({
  ...tailwindConfig,
  content: [{ raw: [source, reminder, serviceButtons, ...components].join('\n'), extension: 'jsx' }],
})]).process(await inlineLocalCssImports(await readFile(path.join(frontend, 'src/index.css'), 'utf8'), path.join(frontend, 'src/index.css'), file => readFile(file, 'utf8')), { from: undefined });
const sidebarCss = await readFile(path.join(frontend, 'src/components/Layout/Sidebar.css'), 'utf8');
const headerLogo = await readFile(path.join(frontend, 'public/assets/rejlers-header-logo.png'));
const industrialPhotoPath = '/assets/images/sidebar-industrial-dusk.png';
const industrialPhoto = await readFile(path.join(frontend, 'public' + industrialPhotoPath));
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sidebar checks</title><style>${css.css}\n${sidebarCss}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
await mkdir(artifacts, { recursive: true });
const expandedWidth = await sidebarWidth(frontend);
const browser = await launchBrowser();
const errors = [];
const unexpectedRequests = [];
const contrastResults = [];

async function newPage(query = '', { unavailableStorage = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  if (unavailableStorage) {
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new Error('Fixture: storage unavailable'); };
      Storage.prototype.setItem = () => { throw new Error('Fixture: storage unavailable'); };
    });
  }
  await page.route('**/*', route => {
    const request = route.request();
    if (request.isNavigationRequest() && request.url().startsWith(origin)) {
      return route.fulfill({ contentType: 'text/html', body: html });
    }
    if (request.url() === origin + '/assets/rejlers-header-logo.png') {
      return route.fulfill({ contentType: 'image/png', body: headerLogo });
    }
    if (request.url() === origin + industrialPhotoPath) {
      return route.fulfill({ contentType: 'image/png', body: industrialPhoto });
    }
    // Serve only repository artwork above; abort unrelated assets and all external network.
    unexpectedRequests.push(request.url());
    return route.abort();
  });
  await page.goto(origin + query);
  await page.locator('#application-sidebar').waitFor();
  return page;
}

async function widthIs(page, width) {
  await page.waitForFunction(expected => {
    const sidebar = document.getElementById('application-sidebar');
    return Math.abs(sidebar.getBoundingClientRect().width - expected) < 0.5;
  }, width);
  const sidebar = await page.locator('#application-sidebar').boundingBox();
  const content = await page.locator('#application-content').boundingBox();
  assert.ok(Math.abs(sidebar.x + sidebar.width - content.x) < 1, 'Desktop content abuts the sidebar without overlap or gap');
}

async function routeTo(page, route, activeHref) {
  await page.evaluate(route => window.sidebarRoute(route), route);
  await page.waitForFunction(route => document.getElementById('current-route').textContent === route, route);
  if (activeHref) {
    await page.waitForFunction(href => {
      const active = [...document.querySelectorAll('#application-sidebar a[aria-current="page"]')];
      return active.length === 1 && active[0].getAttribute('href') === href;
    }, activeHref);
  }
}

async function assertNavyTheme(page) {
  const theme = await page.locator('#application-sidebar').evaluate(async sidebar => {
    const base = getComputedStyle(sidebar);
    const photo = getComputedStyle(sidebar, '::before').backgroundImage;
    const imageUrl = photo.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
    const image = new Image();
    if (imageUrl) {
      image.src = imageUrl;
      await image.decode();
    }
    const label = sidebar.querySelector('.sidebar-row:not([aria-current]):not([data-active="true"])');
    return {
      background:base.backgroundColor,
      foreground:getComputedStyle(label).color,
      imageUrl, imageWidth:image.naturalWidth, imageHeight:image.naturalHeight,
    };
  });
  const background = theme.background.match(/[\d.]+/g).slice(0,3).map(Number);
  const foreground = theme.foreground.match(/[\d.]+/g).slice(0,3).map(Number);
  assert.ok(background.every(channel => channel < 90) && background[2] > background[0], 'Sidebar has a deep navy base');
  assert.ok(foreground.every(channel => channel > 190), 'Navigation labels stay light over the navy background');
  assert.equal(new URL(theme.imageUrl).pathname, industrialPhotoPath, 'Industrial artwork is present in the sidebar background');
  assert.ok(theme.imageWidth > 0 && theme.imageHeight > 0, 'Industrial artwork decodes successfully');
}

async function checkContrast(page, state) {
  const results = await new AxeBuilder({ page })
    .include('#application-sidebar')
    .withRules(['color-contrast'])
    .analyze();
  assert.deepEqual(results.violations, [], state + ' sidebar has no detected color-contrast violations');
  // Automated tools cannot prove contrast over every photograph pixel; retain
  // those incomplete results alongside screenshots for visual review.
  contrastResults.push({ state, incomplete:results.incomplete.flatMap(result => result.nodes).length });
}

try {
  const page = await newPage();
  const sidebar = page.locator('#application-sidebar');
  assert.equal(await page.getByRole('complementary', { name: 'Application navigation' }).count(), 1);
  await widthIs(page, expandedWidth);
  await assertNavyTheme(page);
  for (const width of [1024,1280,1440]) {
    await page.setViewportSize({ width, height: 900 });
    await widthIs(page, expandedWidth);
    const headerGeometry = await page.locator('header').evaluate(header => {
      const bounds = header.getBoundingClientRect();
      const nav = header.querySelector('nav');
      const columns = [...nav.children].map(node => node.getBoundingClientRect());
      const visibleControls = [...header.querySelectorAll('button, input, a, img')].filter(node => node.getClientRects().length);
      return {
        columnsFit:columns.every((rect,index) => rect.width > 0 && rect.left >= bounds.left && rect.right <= bounds.right && (!index || columns[index-1].right <= rect.left)),
        controlsFit:visibleControls.every(node => { const rect=node.getBoundingClientRect();return rect.left >= bounds.left && rect.right <= bounds.right; }),
        searchWidth:header.querySelector('input').getBoundingClientRect().width,
        documentFits:document.documentElement.scrollWidth <= window.innerWidth,
      };
    });
    assert.equal(headerGeometry.columnsFit, true, 'Header columns fit without overlap at ' + width + 'px');
    assert.equal(headerGeometry.controlsFit, true, 'All visible header controls fit at ' + width + 'px');
    assert.ok(headerGeometry.searchWidth >= 200, 'Search remains usable at ' + width + 'px');
    assert.equal(headerGeometry.documentFits, true, 'No horizontal page overflow at ' + width + 'px');
    if (width === 1024) await page.screenshot({ path: path.join(artifacts, 'desktop-1024.png') });
  }
  const topSections = await sidebar.getByRole('button', { name: /^[1-9]\.\s/ }).allTextContents();
  assert.deepEqual(topSections.map(label => Number(label.trim().match(/^(\d)\./)[1])), [1,2,3,4,5,6,7,8,9], 'Numbered modules preserve their order');
  for (const caption of ['Workspace', 'Modules', 'Administration']) {
    assert.equal(await sidebar.getByText(caption, { exact: true }).count(), 1, caption + ' group caption');
  }
  assert.equal(await sidebar.getByRole('button', { name: '4. Human Resources', exact: true }).count(), 1);
  assert.equal(await sidebar.getByRole('button', { name: '5. Sales', exact: true }).count(), 1);
  await sidebar.screenshot({ path: path.join(artifacts, 'desktop-expanded.png') });
  await page.screenshot({ path: path.join(artifacts, 'desktop-expanded-shell.png') });
  await checkContrast(page, 'desktop light');
  await sidebar.getByRole('button', { name: '1. Engineering', exact: true }).click();
  await sidebar.getByRole('button', { name: '1.1 Process', exact: true }).click();
  const indentation = await page.evaluate(() => {
    const primary = getComputedStyle(document.getElementById('sidebar-section-processEngineering'));
    const nested = getComputedStyle(document.querySelector('[id^="sidebar-subsection-"]'));
    return { primaryMargin:primary.marginLeft, primaryPadding:primary.paddingLeft, nestedMargin:nested.marginLeft, nestedPadding:nested.paddingLeft };
  });
  assert.deepEqual(indentation, { primaryMargin:'16px', primaryPadding:'16px', nestedMargin:'16px', nestedPadding:'12px' }, 'Both existing indentation levels are retained');
  const engineeringLink = sidebar.getByRole('link', { name: /PFD QC/ });
  const engineeringHref = await engineeringLink.getAttribute('href');
  assert.ok((await engineeringLink.getAttribute('title'))?.length, 'Descriptions remain available in link tooltips');
  await sidebar.screenshot({ path: path.join(artifacts, 'engineering-expanded.png') });
  await engineeringLink.click();
  await page.waitForFunction(href => document.getElementById('current-route').textContent === href, engineeringHref);
  await widthIs(page, expandedWidth);
  assert.equal(await sidebar.locator('a[aria-current="page"]').count(), 1);

  await routeTo(page, '/projects?view=plan-baseline', '/projects?view=plan-baseline');
  assert.match(await sidebar.locator('a[aria-current="page"]').innerText(), /Plan & Baseline/);
  await routeTo(page, '/projects?sort=name', '/projects');
  await routeTo(page, '/finance/incoming-invoices/fixture-id', '/finance/incoming-invoices');
  assert.equal(await sidebar.locator('a[href="/finance"][aria-current]').count(), 0, 'Finance overview is not selected for an invoice detail');
  await routeTo(page, '/hr/Employeprofile', '/hr/Employeprofile');
  assert.equal(await sidebar.getByRole('link', { name: '2.5 Employee self-service', exact: true }).count(), 1);
  await routeTo(page, '/hr', '/hr');
  await sidebar.screenshot({ path: path.join(artifacts, 'human-resources-expanded.png') });
  await routeTo(page, '/finance/incoming-invoices/fixture-id', '/finance/incoming-invoices');
  await sidebar.screenshot({ path: path.join(artifacts, 'finance-expanded.png') });

  await sidebar.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
  await widthIs(page, 72);
  assert.equal(await sidebar.getByRole('button', { name: '3. Finance', exact: true }).getAttribute('data-active'), 'true', 'Collapsed rail identifies the active department');
  assert.equal(await page.evaluate(key => localStorage.getItem(key), preferenceKey), 'true');
  await sidebar.screenshot({ path: path.join(artifacts, 'collapsed.png') });
  await page.reload();
  await widthIs(page, 72);
  await routeTo(page, '/finance/incoming-invoices');
  await widthIs(page, 72);
  await sidebar.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
  await widthIs(page, expandedWidth);
  await page.reload();
  await widthIs(page, expandedWidth);
  await routeTo(page, '/projects?view=plan-baseline', '/projects?view=plan-baseline');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await assertNavyTheme(page);
  await sidebar.screenshot({ path: path.join(artifacts, 'dark-project-control.png') });
  await checkContrast(page, 'desktop dark');
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await sidebar.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
  await widthIs(page, 72);

  // Opening mobile navigation must preserve the desktop preference and trap focus.
  await page.setViewportSize({ width: 390, height: 844 });
  const opener = page.locator('header button[aria-controls="application-sidebar"]');
  await opener.click();
  await page.waitForFunction(() => document.getElementById('application-sidebar').contains(document.activeElement));
  assert.equal(await page.locator('#application-content').evaluate(node => node.inert), true);
  assert.equal(await page.locator('#application-content').getAttribute('aria-hidden'), 'true');
  await page.waitForFunction(width => Math.abs(document.getElementById('application-sidebar').getBoundingClientRect().width - width) < 0.5, expandedWidth);
  assert.equal(Math.round((await sidebar.boundingBox()).width), expandedWidth);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), preferenceKey), 'true');
  assert.equal(await page.getByRole('dialog', { name: 'Application navigation' }).count(), 1);
  assert.equal(await sidebar.getAttribute('aria-modal'), 'true');
  assert.equal(await sidebar.getByRole('button', { name: 'Close sidebar', exact: true }).count(), 1);
  assert.equal(await page.evaluate(() => {
    const reminder = document.getElementById('fixture-reminder').getBoundingClientRect();
    const x = Math.max(reminder.left, 0) + 100;
    const y = reminder.top + reminder.height / 2;
    return document.getElementById('application-sidebar').contains(document.elementFromPoint(x,y));
  }), true, 'Drawer stays above the fixed z70 approval reminder');
  const controls = sidebar.locator('button, a[href], [tabindex="0"]');
  const visibleControls = await controls.evaluateAll(nodes => nodes.filter(node => node.getClientRects().length && !node.disabled).length);
  assert.ok(visibleControls > 2);
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('#application-sidebar button, #application-sidebar a[href], #application-sidebar [tabindex="0"]')].filter(node => node.getClientRects().length && !node.disabled);
    nodes[nodes.length - 1].focus();
  });
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('#application-sidebar button, #application-sidebar a[href], #application-sidebar [tabindex="0"]')].filter(node => node.getClientRects().length && !node.disabled);
    return document.activeElement === nodes[0];
  }), true, 'Tab wraps to the first drawer control');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('#application-sidebar button, #application-sidebar a[href], #application-sidebar [tabindex="0"]')].filter(node => node.getClientRects().length && !node.disabled);
    return document.activeElement === nodes[nodes.length - 1];
  }), true, 'Shift+Tab wraps to the final drawer control');
  await page.screenshot({ path: path.join(artifacts, 'mobile-drawer.png') });
  await assertNavyTheme(page);
  await checkContrast(page, 'mobile light');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({ path: path.join(artifacts, 'mobile-drawer-dark.png') });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.activeElement.matches('header button[aria-controls="application-sidebar"]'));
  assert.equal(await page.locator('#application-content').evaluate(node => node.inert), false);
  assert.equal(await opener.getAttribute('aria-expanded'), 'false');
  await page.locator('#fixture-reminder-action').click();
  assert.equal(await page.evaluate(() => window.reminderClicks), 1, 'Approval reminder is usable after closing the drawer');
  await opener.click();
  await page.waitForFunction(() => document.getElementById('application-sidebar').contains(document.activeElement));
  await page.mouse.click(350, 400);
  await page.waitForFunction(() => document.activeElement.matches('header button[aria-controls="application-sidebar"]'));
  assert.equal(await opener.getAttribute('aria-expanded'), 'false', 'Clicking the backdrop closes navigation');
  await opener.click();
  await page.waitForFunction(() => document.getElementById('application-sidebar').contains(document.activeElement));
  await sidebar.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await page.waitForFunction(() => document.getElementById('current-route').textContent === '/dashboard' && document.activeElement.matches('header button[aria-controls="application-sidebar"]'));
  assert.equal(await opener.getAttribute('aria-expanded'), 'false', 'Following a mobile link closes the drawer');
  await opener.click();
  await page.waitForFunction(() => document.getElementById('application-sidebar').contains(document.activeElement));
  await page.setViewportSize({ width: 1440, height: 900 });
  await widthIs(page, 72);
  await page.waitForFunction(() => document.activeElement.matches('[data-sidebar-toggle]'));
  assert.equal(await page.locator('#application-content').evaluate(node => node.inert), false);
  assert.ok((await page.evaluate(() => window.sidebarRequests)).every(request => request.method === 'GET'));

  const limited = await newPage('?fixture=limited&route=/finance/incoming-invoices');
  await limited.getByRole('link', { name: /3\.2 Incoming Invoices/ }).waitFor();
  assert.equal(await limited.locator('a[href="/finance"]').count(), 0);
  assert.equal(await limited.locator('a[href="/finance/outgoing-invoices"]').count(), 0);
  assert.equal(await limited.getByRole('button', { name: /^1\. Engineering/ }).count(), 0);
  assert.equal(await limited.getByText('Administration', { exact: true }).count(), 0);
  assert.equal(await limited.locator('#application-sidebar a[aria-current="page"]').count(), 1);
  const emptyAdmin = await newPage('?fixture=empty-admin');
  assert.equal(await emptyAdmin.getByRole('button', { name: /^9\./ }).count(), 0, 'Admin role with no granted children has no empty group');
  assert.equal(await emptyAdmin.getByText('Administration', { exact: true }).count(), 0);

  const storageBlocked = await newPage('', { unavailableStorage: true });
  await widthIs(storageBlocked, expandedWidth);
  await storageBlocked.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
  await widthIs(storageBlocked, 72);

  assert.deepEqual(errors, [], 'No runtime errors');
  assert.deepEqual(unexpectedRequests.filter(url => !/\.(woff2?|ttf|png|svg|jpe?g)(?:\?|$)/.test(url)), [], 'No unexpected network requests');
  console.log('PASS: Navy sidebar with loaded industrial artwork, numbering/indentation, groups, configured expanded/72px shell widths, real header at 1024/1280/1440, navigation and persisted preference, exact query/deep route selection, collapsed active department, mobile focus/Escape/backdrop/link dismissal and reminder layering, dark mode and permission filtering.');
  console.log('Contrast checks (photographic backgrounds can require visual review): ' + JSON.stringify(contrastResults));
  console.log('Screenshots: ' + artifacts);
} finally {
  await browser.close();
}
