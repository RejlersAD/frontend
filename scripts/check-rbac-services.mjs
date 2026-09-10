import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { readFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { BUSINESS_SERVICES, hasAssignedModule, resolveRouteModule } from '../src/config/serviceAccess.config.js';
const out='../artifacts/rbac-audit';await mkdir(out,{recursive:true});
const backend=await readFile('../backend/apps/rbac/service_catalogue.py','utf8');
for(const service of BUSINESS_SERVICES) assert.ok(backend.includes(`('${service.code}', '${service.name}', '${service.parent}'`), `Backend parity: ${service.code}`);
assert.equal(hasAssignedModule(['finance_incoming'],'finance_outgoing'),false);
assert.equal(hasAssignedModule(['finance'],'finance_outgoing'),false);
assert.equal(resolveRouteModule('sales','/sales/unknown'),'sales_unknown');
const app=(await readFile('src/App.jsx','utf8')).replaceAll('\r\n','\n');
for(const component of ['EnquiryManagement','EnquiryDetail']) assert.ok(app.includes(`<ModuleProtectedRoute moduleCode="enquiry_management">\n              <${component} />\n            </ModuleProtectedRoute>`));
const guard=app.slice(app.indexOf('const ModuleAccessContext ='),app.indexOf('function App() {'));
const modules=[...BUSINESS_SERVICES.map(service=>({...service,id:service.code})),...['project_control','planning_package','enquiry_management','ai_champion'].map(code=>({code,id:code,name:code,description:code}))];
const bundle=await build({stdin:{contents:`import React,{useState,useCallback} from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Navigate,useLocation} from 'react-router-dom';import {BUSINESS_SERVICES,resolveRouteModule,canAccessRouteModule} from './src/config/serviceAccess.config';import {GroupedModulePanel} from './src/pages/Admin/RoleManagement';
const root=createRoot(document.getElementById('root'));let key=0;
${guard}
function GuardHarness({codes,moduleCode,staff=false,superuser=false}){const isAuthenticated=true;const modulesLoaded=true;const user={is_staff:staff,is_superuser:superuser};const userModules=codes;return <ModuleAccessContext.Provider value={{isAuthenticated,modulesLoaded,user,userModules}}><ModuleProtectedRoute moduleCode={moduleCode}><><p>Protected content</p><input aria-label="Unsaved route draft" /></></ModuleProtectedRoute></ModuleAccessContext.Provider>}
window.renderGuard=props=>root.render(<MemoryRouter key={props.keepTree ? key : ++key} initialEntries={[props.path]}><GuardHarness {...props}/></MemoryRouter>);
function Catalog(){const [assigned,setAssigned]=useState(new Set());return <GroupedModulePanel modules={${JSON.stringify(modules)}} assignedModuleIds={assigned} onToggle={async(m,checked)=>setAssigned(previous=>{const next=new Set(previous);checked?next.add(m.id):next.delete(m.id);return next})} disabled={false} saving={false}/>};window.renderCatalog=()=>root.render(<Catalog/>);`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',loader:{'.css':'empty'},define:{'import.meta.env':'{}'},plugins:[{name:'expose-catalog-for-test',setup(b){b.onLoad({filter:/pages[\\/]Admin[\\/]RoleManagement\.jsx$/},async(args)=>({contents:(await readFile(args.path,'utf8'))+'\nexport { GroupedModulePanel };',loader:'jsx'}));}}]});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setContent('<div id="root"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});
for(const sample of [
 {path:'/admin/enquiries',moduleCode:'enquiry_management',codes:[],allow:false},
 {path:'/admin/enquiries/9',moduleCode:'enquiry_management',codes:[],staff:true,allow:false},
 {path:'/admin/enquiries/9',moduleCode:'enquiry_management',codes:['enquiry_management'],allow:true},
 {path:'/finance/incoming-invoices',moduleCode:'finance',codes:['finance_outgoing'],allow:false},
 {path:'/finance/outgoing-invoices',moduleCode:'finance',codes:['finance_outgoing'],allow:true},
 {path:'/sales/clients',moduleCode:'sales',codes:['sales_clients'],allow:true},
 {path:'/sales/opportunities',moduleCode:'sales',codes:['sales_clients'],allow:false},
 {path:'/sales/clients',moduleCode:'sales',codes:['sales'],allow:false},
 {path:'/qhse/general/quality',moduleCode:'qhse',codes:['qhse_quality'],allow:true},
 {path:'/qhse/general/quality',moduleCode:'qhse',codes:['qhse_health_safety'],allow:false},
 {path:'/projects?view=plan-baseline',moduleCode:'project_control',codes:['planning_package'],allow:true},
 {path:'/projects',moduleCode:'project_control',codes:['planning_package'],allow:false},
 {path:'/sales/clients',moduleCode:'sales',codes:[],superuser:true,allow:true},
]){await page.evaluate(props=>window.renderGuard(props),sample);await page.getByText(sample.allow?'Protected content':'Access Denied',{exact:true}).waitFor();}
await page.evaluate(()=>window.renderGuard({path:'/sales/clients',moduleCode:'sales',codes:['sales_clients']}));
await page.getByLabel('Unsaved route draft').fill('Keep my vendor draft');
await page.evaluate(()=>window.renderGuard({path:'/sales/clients',moduleCode:'sales',codes:['sales_clients','finance_incoming'],keepTree:true}));
assert.equal(await page.getByLabel('Unsaved route draft').inputValue(),'Keep my vendor draft');
await page.evaluate(()=>window.renderGuard({path:'/sales/clients',moduleCode:'sales',codes:[],keepTree:true}));
await page.getByText('Access Denied',{exact:true}).waitFor();
await page.evaluate(()=>window.renderCatalog());await page.getByText('Finance',{exact:true}).click();await page.getByText('Incoming Invoices',{exact:true}).waitFor();await page.getByText('Outgoing Invoices',{exact:true}).waitFor();assert.equal(await page.getByText('0/4',{exact:true}).count(),1);
await page.getByText('Sales',{exact:true}).click();await page.getByText('Sales Email Intake',{exact:true}).waitFor();assert.equal(await page.getByText('0/8',{exact:true}).count(),1);
await page.getByText('Project Control',{exact:true}).click();await page.getByText('planning_package',{exact:true}).first().waitFor();assert.ok(await page.getByText('0/2',{exact:true}).count() >= 1);
assert.deepEqual(errors,[]);console.log('Passed: 13 direct-route access cases, staff bypass denied, frontend/backend catalogue parity, Finance 4/Sales 8/Project Control 2 assignable entries.');
}finally{await browser.close()}
