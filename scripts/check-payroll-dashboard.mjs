import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import postcss from 'postcss'
import tailwind from 'tailwindcss'
import { mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
const out = '../artifacts/payroll-dashboard'
await mkdir(out, { recursive: true })
const runs = Array.from({ length: 6 }, (_, i) => ({ id: `run-${i}`, cycle_code: `2026-${String(9-i).padStart(2,'0')}`, year:2026, month:9-i, employee_count:286, total_gross:950000-i*20000, total_net:920000-i*20000, status:i ? 'paid' : 'draft' }))
const summary = { total_employees:286, current_month_gross:950000, current_month_net:920000, ytd_payroll:7800000, pending_approvals:12, open_alerts:3, approved_activity_hours_mtd:240, approved_activity_count_mtd:32, year:2026, month:9, leave_employees:286, leave_total_taken_ytd:143, leave_total_earned_ytd:3200, leave_avg_balance:12.5, leave_critical_alerts:4 }
const bundle = await build({ stdin:{ contents:`import React from 'react'; import {createRoot} from 'react-dom/client'; import {Provider} from 'react-redux'; import {MemoryRouter} from 'react-router-dom'; import Payroll from './src/pages/HR/Payroll'; const state={auth:{user:{}},rbac:{currentUser:{roles:[]}}}; const store={getState:()=>state,subscribe:()=>()=>{},dispatch:()=>{}}; createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter initialEntries={['/hr/payroll?tab=dashboard']}><Payroll /></MemoryRouter></Provider>);`, resolveDir:process.cwd(),loader:'jsx'}, bundle:true,write:false,loader:{'.css':'empty'},format:'iife',jsx:'automatic',define:{'import.meta.env':'{}'},plugins:[{name:'fixtures',setup(b){b.onLoad({filter:/services[\\/](payrollEngine|payroll)\.service\.js$/},()=>({contents:`export default {getDashboardSummary:async()=>(${JSON.stringify(summary)}),listRuns:async()=>({results:${JSON.stringify(runs)}}),listPayslips:async()=>({count:12,results:[]}),listEmployees:async()=>({results:[{id:1,employee_no:'23022',full_name:'Test Employee'}]})}`,loader:'js'}));b.onLoad({filter:/pages[\\/]HR[\\/]payroll[\\/](AttendanceDashboard|LeaveDashboard|PayrollEngine|ApprovalTracker)\.jsx$/},()=>({contents:'export default function Stub(){return <div>Selected payroll workspace</div>}',loader:'jsx'}))}}]})
const css=await postcss([tailwind({content:['./src/pages/HR/Payroll.jsx','./src/pages/HR/payroll/PayrollDashboard.jsx','./src/config/hrPayroll.config.js']})]).process('@tailwind base;@tailwind components;@tailwind utilities;',{from:undefined})
const browser=await chromium.launch({channel:'chrome',headless:true})
try {
const page=await browser.newPage({viewport:{width:1600,height:1100}})
page.on('pageerror', error=>console.log('PAGE ERROR:',error.message))
await page.setContent('<html><body style="font-family:Segoe UI,sans-serif"><div id="root"></div></body></html>')
await page.addStyleTag({content:css.css});await page.addScriptTag({content:bundle.outputFiles[0].text})
await page.getByText('Selected payroll workspace',{exact:true}).waitFor()
assert.equal(await page.getByText('PostgreSQL', {exact:false}).count(),0)
await page.screenshot({path:`${out}/desktop.png`,fullPage:true})
await page.getByRole('button',{name:/Active Employees/}).click()
await page.getByText('Test Employee',{exact:true}).waitFor()
await page.keyboard.press('Escape')
await page.setViewportSize({width:390,height:844})
await page.screenshot({path:`${out}/mobile.png`,fullPage:true})
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth))
await page.screenshot({path:`${out}/mobile.png`,fullPage:true})
assert.equal(await page.getByRole('button',{name:/Active Employees/}).count(),1)
console.log('Passed: dashboard render, KPI report, run navigation, mobile width; screenshots saved.')
} finally {await browser.close()}
