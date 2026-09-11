import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { readFile, mkdir } from 'node:fs/promises';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import assert from 'node:assert/strict';

const modules = [
  ['hr_management', 'Employee records', 'View and manage employee information'],
  ['timesheet', 'Attendance', 'Manage attendance and working time'],
  ['hr_onboarding', 'Onboarding', 'Manage employee onboarding'],
  ['payroll', 'Salary records', 'View and manage salary information'],
  ['user_mgmt', 'User directory', 'Manage user accounts and profiles'],
  ['role_access_mgmt', 'Role management', 'Create and manage roles'],
  ['project_control', 'Project Control', 'Manage project access'],
].map(([code, name, description], i) => ({id:`m${i}`,code,name,description,is_active:true}));
modules.push(...Array.from({length:57}, (_, i) => ({id:`extra${i}`,code:i === 0 ? 'finance' : `extra_${i}`,name:i === 0 ? 'Finance' : `Additional application ${i+1}`,description:'No action definitions yet',is_active:true})));
const permissions = modules.flatMap(module => ['read','create','update','approve','delete','export'].map(action => ({id:`${module.id}-${action}`,module:module.id,module_code:module.code,name:`${module.name} ${action}`,code:`${module.code}.${action}`,action,is_active:true})));
const role = {id:'hr-role',code:'hr_admin',name:'HR & Payroll Administrator',description:'Manage employee records, attendance, leave and payroll operations.',is_system_role:true,level:2,user_count:3,modules:modules.slice(0,4),permissions:permissions.filter(p=>['read','update'].includes(p.action))};
const roles = [role, ...['Super Administrator','Administrator','Manager','Onboarding','Project Control','Project Manager','Default','QHSE Engineer'].map((name,i)=>({id:`r${i}`,code:i===0?'super_admin':`role_${i}`,name,level:3,user_count:i,is_system_role:i%2===0,modules:[],permissions:[]}))];
const users = ['Emma Rasmussen','Jonas Lindström','Sara Khalid'].map((name,i)=>({id:`u${i}`,user:{id:`auth${i}`,first_name:name.split(' ')[0],last_name:name.split(' ')[1],email:`user${i}@example.test`},roles:[role]}));
const bundle = await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {Provider} from 'react-redux';import {MemoryRouter} from 'react-router-dom';import Page from './src/pages/Admin/RoleManagement';const state={auth:{user:{is_superuser:true}},rbac:{currentUser:{roles:window.ownRole?[{id:'hr-role',code:'hr_admin'},{code:'super_admin'}]:[{code:'super_admin'}]}}};const store={getState:()=>state,subscribe:()=>()=>{},dispatch:()=>{}};createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter><Page/></MemoryRouter></Provider>);`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',loader:{'.css':'empty'},plugins:[{name:'fixtures',setup(b){
  b.onLoad({filter:/services[\\/]rbac\.service\.js$/},()=>({loader:'js',contents:`let roles=${JSON.stringify(roles)};const permissions=${JSON.stringify(permissions)};export default {
    getRoles:async()=>({data:roles}),getModules:async()=>({data:${JSON.stringify(modules)}}),getPermissionCatalogue:async()=>({data:window.legacyCatalogue ? permissions.filter(p=>p.module==='m0') : permissions}),
    getUsers:async()=>({data:{results:${JSON.stringify(users)},count:3,total_pages:1,current_page:1}}),getAccessRequests:async()=>({data:{count:2,results:[]}}),
    getUserPermissionOverrides:async(id)=>({data:{snapshot:'v1',locked:false,permissions:permissions.map(p=>({...p,module_name:${JSON.stringify(modules)}.find(m=>m.id===p.module).name,inherited:['read','update'].includes(p.action),effect:window.userEffects?.[id]?.[p.id]||'inherit'}))}}),
    saveUserPermissionOverrides:async(id,payload)=>{if(window.failUserSave)throw {response:{data:{detail:'User permissions changed. Reload and review again.'}}};window.userSaves??=[];window.userSaves.push({id,payload});window.userEffects??={};window.userEffects[id]??={};payload.changes.forEach(c=>window.userEffects[id][c.permission_id]=c.effect);return {data:{snapshot:'v2',locked:false,permissions:permissions.map(p=>({...p,module_name:${JSON.stringify(modules)}.find(m=>m.id===p.module).name,inherited:['read','update'].includes(p.action),effect:window.userEffects[id][p.id]||'inherit'}))}};},
    getAuditLogs:async()=>({data:{count:0,results:[]}}),
    reviewRoleAccess:async(id,payload)=>{window.savedReviews??=[];window.savedReviews.push(payload);if(window.failSave)throw {response:{data:{detail:'This role changed while you were editing. Reload the role and review again.'}}};const existing=roles.find(role=>role.id===id);const updated={...existing,permissions:permissions.filter(p=>payload.permission_ids.includes(p.id)),modules:${JSON.stringify(modules)}.filter(m=>payload.module_ids.includes(m.id))};roles=roles.map(r=>r.id===id?updated:r);return {data:updated};}
  };`}));
  b.onLoad({filter:/services[\\/]radaiDialog/},()=>({loader:'js',contents:'export const radaiConfirm=async()=>true;'}));
}}]});
const css='* { margin:0; padding:0; box-sizing:border-box; }' + (await postcss([tailwindcss({content:['src/pages/Admin/RoleManagement.jsx','src/pages/Admin/RoleAccessEditor.jsx','src/pages/Admin/UserPermissionEditor.jsx'],corePlugins:{preflight:true}})]).process('@tailwind base; @tailwind utilities;', {from:undefined})).css + (await readFile('src/pages/Admin/RoleManagement.css','utf8')).replace(/^@import.*$/gm,'');
await mkdir('../artifacts/roles-access',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1672,height:941}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<div id="root"></div>');await page.addStyleTag({content:css});await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.locator('.ra-assignment-row').first().waitFor();
  assert.deepEqual(await page.locator('.ra-editor [role=tab]').allTextContents(), ['Assigned users','Permissions','Change history']);
  assert.equal(await page.getByRole('tab',{name:'Assigned users',exact:true}).getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('.ra-assignment-row').count(),3);
  await page.getByRole('button',{name:'Edit permissions for Emma Rasmussen',exact:true}).click();
  await page.getByRole('dialog').getByRole('checkbox',{name:'Employee records: View',exact:true}).waitFor();
  assert.equal(await page.getByRole('dialog').locator('tr[data-module-code]').count(),64);
  assert.equal(await page.getByRole('dialog').locator('tr[data-module-code="finance"]').count(),1);
  await page.getByRole('button',{name:'Collapse all groups',exact:true}).click();
  assert.equal(await page.getByRole('dialog').locator('tr[data-module-code]').count(),0);
  await page.getByRole('textbox',{name:'Search user permissions'}).fill('Additional application 57');
  assert.equal(await page.getByRole('dialog').locator('tr[data-module-code]').count(),1);
  assert.equal(await page.getByRole('dialog').locator('tr[data-module-code]').getByRole('checkbox').count(),6);
  assert.equal(await page.getByRole('dialog').locator('tr[data-module-code]').locator('input:disabled').count(),0);
  await page.getByRole('textbox',{name:'Search user permissions'}).fill('');
  await page.getByRole('button',{name:'Expand all groups',exact:true}).click();
  assert.equal(await page.getByRole('dialog').locator('tr[data-module-code]').count(),64);

  assert.ok(await page.getByRole('dialog').evaluate(el=>{const r=el.getBoundingClientRect();return Math.abs(r.left+r.width/2-innerWidth/2)<2 && Math.abs(r.top+r.height/2-innerHeight/2)<2;}),'User permission dialog is centered with the global CSS reset');
  assert.deepEqual((await page.getByRole('dialog').locator('thead th').allTextContents()).slice(1,7),['View','Create','Edit','Approve','Delete','Export']);
  assert.equal(await page.getByRole('dialog').locator('tr[data-module-code] input[type=checkbox]').count(),64*6);
  const groupCreate=page.getByRole('checkbox',{name:'Group Human Resources: Create',exact:true});
  await groupCreate.check();
  assert.equal(await page.getByRole('checkbox',{name:'Employee records: Create',exact:true}).isChecked(),true);
  await page.getByRole('checkbox',{name:'Attendance: Create',exact:true}).uncheck();
  assert.equal(await groupCreate.evaluate(el=>el.indeterminate),true);
  await page.getByRole('button',{name:'Use role permissions',exact:true}).click();
  await page.getByRole('checkbox',{name:'Group Human Resources: View',exact:true}).uncheck();
  assert.equal(await page.getByRole('checkbox',{name:'Salary records: View',exact:true}).isChecked(),false);
  assert.equal(await page.getByRole('checkbox',{name:'User directory: View',exact:true}).isChecked(),true);
  await page.getByRole('button',{name:'Use role permissions',exact:true}).click();
  await page.getByRole('dialog').getByRole('checkbox',{name:'Employee records: View',exact:true}).uncheck();
  await page.getByRole('dialog').getByRole('checkbox',{name:'Employee records: Export',exact:true}).check();
  assert.equal(await page.getByRole('button',{name:'Save user permissions',exact:true}).isDisabled(),true);
  await page.getByRole('textbox',{name:'Reason for user permission change'}).fill('Individual export duties');
  await page.screenshot({path:'../artifacts/roles-access/user-permissions-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Save user permissions',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Permissions saved for Emma'}).waitFor();
  const individual = await page.evaluate(()=>window.userSaves[0]);
  assert.equal(individual.id,'u0');
  assert.deepEqual(individual.payload.changes,[{permission_id:'m0-read',effect:'deny'},{permission_id:'m0-export',effect:'allow'}]);
  await page.getByRole('button',{name:'Close user permissions'}).click();
  assert.equal(await page.locator('.ra-assignment-row').count(),3);
  await page.getByRole('button',{name:/Edit permissions for Jonas/}).click();
  await page.getByRole('dialog').getByRole('checkbox',{name:'Employee records: View',exact:true}).waitFor();
  assert.equal(await page.getByRole('dialog').getByRole('checkbox',{name:'Employee records: View',exact:true}).isChecked(),true);
  assert.equal(await page.getByRole('dialog').getByRole('checkbox',{name:'Employee records: Export',exact:true}).isChecked(),false);
  await page.getByRole('dialog').getByRole('checkbox',{name:'Employee records: View',exact:true}).uncheck();
  await page.getByRole('textbox',{name:'Reason for user permission change'}).fill('Stale user edit');
  await page.evaluate(()=>{window.failUserSave=true;});
  await page.getByRole('button',{name:'Save user permissions'}).click();
  await page.getByRole('alert').filter({hasText:'User permissions changed'}).waitFor();
  assert.equal(await page.getByRole('dialog').getByRole('checkbox',{name:'Employee records: View',exact:true}).isChecked(),false);
  await page.getByRole('button',{name:'Reload permissions'}).click();
  await page.waitForFunction(()=>!document.querySelector('.ra-user-permission-dialog [role=alert]'));
  await page.getByRole('dialog').getByRole('checkbox',{name:'Employee records: View',exact:true}).waitFor();
  assert.equal(await page.getByRole('dialog').getByRole('checkbox',{name:'Employee records: View',exact:true}).isChecked(),true);
  await page.evaluate(()=>{window.failUserSave=false;});

  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'../artifacts/roles-access/user-permissions-mobile.png',fullPage:true});
  assert.ok(await page.getByRole('dialog').evaluate(el=>el.getBoundingClientRect().right<=innerWidth));
  await page.getByRole('button',{name:'Close user permissions'}).click();
  await page.setViewportSize({width:1672,height:941});
  await page.screenshot({path:'../artifacts/roles-access/assigned-users-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'../artifacts/roles-access/assigned-users-mobile.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Assigned users has no mobile overflow');
  await page.setViewportSize({width:1672,height:941});
  await page.getByRole('tab',{name:'Permissions',exact:true}).click();
  await page.getByRole('checkbox',{name:'Employee records: read',exact:true}).waitFor();
  assert.equal(await page.locator('h1').innerText(),'Roles & Access');
  assert.equal(await page.locator('h1').evaluate(el=>getComputedStyle(el).fontSize),'28px');
  assert.equal(await page.locator('.ra-layout').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),3);
  await page.screenshot({path:'../artifacts/roles-access/desktop.png',fullPage:true});
  assert.deepEqual((await page.locator('.ra-matrix thead th').allTextContents()).slice(1,7), ['View','Create','Edit','Approve','Delete','Export']);
  await page.getByRole('tab',{name:'Assigned users',exact:true}).click();
  await page.evaluate(()=>{window.legacyCatalogue=true; window.dispatchEvent(new Event('focus'));});
  await page.waitForTimeout(100);
  await page.evaluate(()=>{window.legacyCatalogue=false;});
  await page.getByRole('tab',{name:'Permissions',exact:true}).click();
  await page.getByRole('checkbox',{name:'Attendance: read',exact:true}).waitFor();
  await page.getByRole('checkbox',{name:'Employee records: export',exact:true}).check();
  await page.getByRole('checkbox',{name:'Employee records: delete',exact:true}).check();
  await page.getByRole('checkbox',{name:'Employee records: create',exact:true}).check();
  await page.evaluate(()=>{window.legacyCatalogue=true; window.dispatchEvent(new Event('focus'));});
  await page.getByRole('checkbox',{name:'Attendance: read',exact:true}).waitFor({state:'detached'});
  await page.evaluate(()=>{window.legacyCatalogue=false; window.dispatchEvent(new Event('focus'));});
  await page.getByRole('checkbox',{name:'Attendance: read',exact:true}).waitFor();
  assert.equal(await page.getByRole('checkbox',{name:'Employee records: create',exact:true}).isChecked(),true,'Catalogue refresh preserves staged changes');
  assert.equal(await page.evaluate(()=>window.savedReviews?.length||0),0);
  await page.getByRole('button',{name:'Review changes',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Confirm changes',exact:true}).isDisabled(),true);
  await page.getByRole('textbox',{name:'Reason for change'}).fill('Project review access');
  await page.getByRole('button',{name:'Confirm changes',exact:true}).click();
  await page.waitForFunction(()=>window.savedReviews?.length===1);
  assert.equal(await page.getByRole('dialog').count(),0);
  const saved = await page.evaluate(()=>window.savedReviews[0]);
  assert.ok(saved.permission_ids.includes('m0-export'));
  assert.ok(saved.permission_ids.includes('m0-delete'));
  assert.deepEqual(saved.module_ids, saved.original_module_ids);
  await page.getByRole('tab',{name:'Assigned users',exact:true}).click();
  assert.equal(await page.locator('.ra-assignment-row').count(),3);
  await page.getByRole('tab',{name:'Permissions',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Review changes',exact:true}).isDisabled(),true);
  await page.getByRole('checkbox',{name:'Employee records: create',exact:true}).uncheck();
  await page.getByRole('button',{name:'Discard',exact:true}).click();
  assert.equal(await page.getByRole('checkbox',{name:'Employee records: create',exact:true}).isChecked(),true);
  await page.getByRole('textbox',{name:'Search permissions'}).fill('Salary');
  assert.equal(await page.locator('.ra-matrix tbody tr:not(.ra-group)').count(),1);
  await page.getByRole('textbox',{name:'Search permissions'}).fill('');
  await page.getByRole('button',{name:'Manage assignments'}).click();
  await page.getByRole('tab',{name:'Change history',exact:true}).click();
  await page.getByText('No role changes recorded.',{exact:true}).waitFor();
  await page.getByRole('tab',{name:'Permissions',exact:true}).click();
  await page.evaluate(()=>{window.failSave=true;});
  await page.getByRole('checkbox',{name:'Employee records: create',exact:true}).uncheck();
  await page.getByRole('button',{name:'Review changes',exact:true}).click();
  await page.getByRole('textbox',{name:'Reason for change'}).fill('Changed requirements');
  await page.getByRole('button',{name:'Confirm changes',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'This role changed'}).waitFor();
  await page.getByRole('button',{name:'Close review'}).click();await page.getByRole('button',{name:'Discard',exact:true}).click();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'../artifacts/roles-access/mobile.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No mobile overflow');
  await page.getByRole('tab',{name:'Access reviews',exact:true}).click();await page.getByText('No completed access reviews recorded.',{exact:true}).waitFor();
  await page.getByRole('tab',{name:'Audit',exact:true}).click();await page.getByText('No role changes recorded.',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  const protectedPage=await browser.newPage();await protectedPage.setContent('<div id="root"></div>');await protectedPage.evaluate(()=>{window.ownRole=true;});await protectedPage.addScriptTag({content:bundle.outputFiles[0].text});
  await protectedPage.getByRole('tab',{name:'Permissions',exact:true}).click();
  await protectedPage.getByRole('checkbox',{name:'Employee records: create',exact:true}).waitFor();assert.equal(await protectedPage.getByRole('checkbox',{name:'Employee records: create',exact:true}).isDisabled(),true);
  console.log('Passed: role workspace, real catalogue matrix, staged grants, required reason, save, discard, filters, assignments, history, stale-save handling, self-access protection, and mobile layout.');
} finally {await browser.close();}
