import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'
const preSchema = JSON.parse(readFileSync(new URL('./pre-onboarding-schema.fixture.json', import.meta.url), 'utf8'))
const fullSchema = JSON.parse(readFileSync(new URL('./cv-schema.fixture.json', import.meta.url), 'utf8'))
const photoBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')

const schema = {
  version: 'rad-2026-10-v1', declaration: '', signature_note: '',
  sections: [
    { key: 'candidate', title: 'Candidate details', repeatable: false, fields: [
      { key: 'name', label: 'Full name', type: 'text', required: true },
      { key: 'email', label: 'Personal email', type: 'email', required: true },
      { key: 'phone', label: 'Personal contact number', type: 'text', required: true },
    ] },
    { key: 'education', title: 'Education', repeatable: true, fields: [
      { key: 'qualification', label: 'Qualification', type: 'text', required: true },
      { key: 'institution', label: 'Institution', type: 'text', required: false },
    ] },
    { key: 'acknowledgement', title: 'Accuracy acknowledgement', repeatable: false, fields: [
      { key: 'name', label: 'Typed full name', type: 'text', required: true },
      { key: 'accurate', label: 'I confirm that the information provided is accurate.', type: 'checkbox', required: true },
    ] },
  ],
}
async function setup(page, { pre = false, expired = false, conflict = false, publicLink = false, enhanced = false, extractionFails = false, slowSave = false, expireSessionOnReload = false } = {}) {
  const activeSchema = enhanced ? fullSchema : schema
  let writes = 0
  let reads = 0
  let verifiedEmail = ''
  let attachments = []
  let revision = 0, state = 'draft', data = { candidate: { name: 'Test Candidate', email: 'candidate@example.test', phone: '+91 1234567890' } }
  await page.route('**/candidate-forms/uploads/', route => {
    const isPhoto = route.request().postDataBuffer().includes(Buffer.from('name="kind"\r\n\r\nphoto'))
    const file = { id: isPhoto ? 101 : 102, kind: isPhoto ? 'photo' : 'cv', name: isPhoto ? 'professional-photo.jpg' : 'candidate.pdf', size: 120, content_type: isPhoto ? 'image/png' : 'application/pdf' }
    attachments = [...attachments.filter(item => item.kind !== file.kind), file]
    return route.fulfill({ status: 201, json: file })
  })
  await page.route('**/candidate-forms/uploads/101/', route => route.fulfill({contentType:'image/png',body:photoBytes}))
  await page.route('**/candidate-forms/extract-cv/', route => extractionFails ? route.fulfill({status:503,json:{detail:'CV uploaded. AI extraction is unavailable. Complete fields manually.'}}) : route.fulfill({json:{review_required:true,data:{candidate:{name:'Extracted Name',email:'extracted@example.test',current_position:'Senior Engineer',current_department:'Engineering',birth_year:'1990'},education:[{qualification:'Bachelor of Engineering',institution:'Example University',period:'2010 ? 2014'}],languages:[{language:'English',proficiency:'Fluent'}],competence:{projects:'FEED\nDetailed Design',technology:'Oil & Gas',techniques:'Project Management'},summary:{text:'Eight years in process engineering.'},projects:[{period:'2020-01 ? Present',title:'Lead Engineer',company:'Example Co',projects:'Gas processing facility',responsibilities:'Design review'}],employment:[{period:'2015-01 ? 2019-12',title:'Engineer',company:'Example Co'}],achievements:{achievements:'Completed 4 projects',certifications:'PMP'},acknowledgement:{}}}}))
  await page.route('**/candidate-forms/apply/', route => {
    const payload = route.request().postDataJSON()
    if (payload.register) {
      data.candidate = { name: payload.name, email: payload.email, phone: '' }
      return route.fulfill({ status: 201, json: { token: 'personal-draft-token', resume_link: 'http://localhost:5173/candidate-forms#invite=personal-draft-token', ...(pre ? { verification_required: true } : { session: 'scoped-test-session' }) } })
    }
    data = pre ? {identity:{}, contact:{}, beneficiary:{date:'2026-10-22'}} : {candidate:{}}
    return route.fulfill({ status: 201, json: { token: 'personal-draft-token', resume_link: 'http://localhost:5173/candidate-forms#invite=personal-draft-token', session: 'scoped-test-session' } })
  })
  await page.route('**/candidate-forms/access/', route => {
    const payload = route.request().postDataJSON()
    if (expired) return route.fulfill({ status: 403, json: { detail: 'This invitation has expired or was revoked. Please contact HR.' } })
    if (pre && payload.code !== '123456') return route.fulfill({ json: { verification_required: true, ...(payload.send_code ? { code_sent: true } : {}) } })
    if (pre) verifiedEmail = 'candidate@example.test'
    return route.fulfill({ json: { session: 'scoped-test-session' } })
  })
  await page.route('**/candidate-forms/session/', async route => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON()
      if (payload.action === 'send_code') return route.fulfill({json:{code_sent:true,verification_required:true}})
      if (payload.action === 'verify_email') {
        if (payload.code !== '123456') return route.fulfill({status:403,json:{detail:'Incorrect verification code.'}})
        verifiedEmail = payload.email
        return route.fulfill({json:{email_verified:true,verified_email:verifiedEmail}})
      }
      writes += 1
      if (slowSave) await new Promise(resolve => setTimeout(resolve, 700))
      if (conflict) return route.fulfill({ status: 409, json: { detail: 'This draft changed in another session. Reload before saving.' } })
      data = payload.data; revision += 1
      if (payload.action === 'submit') state = 'submitted'
      return route.fulfill({ json: { revision, state, version: state === 'submitted' ? 1 : 0 } })
    }
    reads += 1
    if (expireSessionOnReload && reads === 2) return route.fulfill({status:403,json:{detail:'Your form session has expired. Reopen your invitation link.'}})
    return route.fulfill({ json: { title: pre ? 'Pre-Onboarding Employee Form' : 'Candidate CV Submission Form', kind: pre ? 'pre_onboarding' : 'cv', position: 'Engineer', location: 'Abu Dhabi', public_application: publicLink, department: 'Engineering', schema: pre ? preSchema : activeSchema, data, attachments, verified_email:verifiedEmail, revision, state, version: 0, correction_note: '', expires_at: '2026-10-25T09:00:00Z' } })
  })
  await page.goto(`/tests/hr-enhancements/online-forms.html#${publicLink ? 'apply=shared-public-token' : 'invite=private-test-token'}`)
  return { writes: () => writes }
}

test('candidate saves repeatable CV data, reviews and submits without an account', async ({ page }) => {
  await setup(page)
  await expect(page.getByRole('heading', { name: 'Candidate CV Submission Form', exact: true })).toBeVisible()
  expect(new URL(page.url()).hash).toBe('')
  await page.getByLabel('Full name *', { exact: true }).fill('Updated Candidate')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  await page.getByLabel('Qualification *', {exact:true}).selectOption('__other__')
  await page.getByLabel('Other Qualification', {exact:true}).fill('BSc Engineering')
  await page.getByLabel('Institution', { exact: true }).fill('Example University')
  await page.getByLabel('Typed full name *').fill('Updated Candidate')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Review form', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Review your information' })).toBeVisible()
  await expect(page.getByText('BSc Engineering', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Submit to HR', exact: true }).click()
  await expect(page.getByText('Submission received', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit to HR', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Print / Save as PDF', exact: true })).toBeVisible()
})

test('pre-onboarding asks for an emailed verification code', async ({ page }) => {
  await setup(page, { pre: true })
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible()
  await page.getByRole('button', { name: 'Email verification code', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('A verification code was sent')
  await page.getByLabel('Verification code', { exact: true }).fill('123456')
  await page.getByRole('button', { name: 'Verify and open form' }).click()
  await expect(page.getByRole('heading', { name: 'Pre-Onboarding Employee Form', exact: true })).toBeVisible()
})

test('invalid invitation shows a clear error and no candidate data', async ({ page }) => {
  await setup(page, { expired: true })
  await expect(page.getByRole('alert')).toContainText('expired or was revoked')
  await expect(page.getByLabel('Full name *', { exact: true })).toHaveCount(0)
})

test('stale draft keeps unsaved data and offers explicit reload', async ({ page }) => {
  await setup(page, { conflict: true })
  await page.getByLabel('Full name *', { exact: true }).fill('Keep My Changes')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('changed in another session')
  await expect(page.getByLabel('Full name *', { exact: true })).toHaveValue('Keep My Changes')
  await expect(page.getByRole('button', { name: 'Reload saved version' })).toBeVisible()
})

test('candidate form fits a mobile screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  await expect(page.getByRole('heading', { name: 'Candidate CV Submission Form', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: '../artifacts/candidate-online-form-mobile.png', fullPage: true })
})

test('public CV opens the full form directly without registration or position selection', async ({ page }) => {
  await setup(page, { publicLink: true })
  await expect(page.getByLabel('Full name *', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Qualification *')).toBeVisible()
  await expect(page.getByLabel('Typed full name *')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start application', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Position', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Email address', { exact: true })).toHaveCount(0)
  await expect(page.getByText(/Valid for 3 days/)).toBeVisible()
  await page.getByLabel('Full name *', { exact: true }).fill('Public Applicant')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await page.reload()
  await expect(page.getByLabel('Full name *', { exact: true })).toHaveValue('Public Applicant')
  await expect(page.getByLabel('Private resume link', { exact: true })).toHaveCount(0)
  expect(new URL(page.url()).hash).toBe('')
})

test('public pre-onboarding opens the complete form without registration and confirms email at submission', async ({ page }) => {
  await setup(page, { publicLink: true, pre: true })
  await expect(page.getByRole('heading', {name:'Identity as per passport',exact:true})).toBeVisible()
  await expect(page.getByRole('heading', {name:'Beneficiary declaration',exact:true})).toBeVisible()
  await expect(page.getByRole('button', {name:'Start application',exact:true})).toHaveCount(0)
  await expect(page.getByLabel('Position', {exact:true})).toHaveCount(0)
  await expect(page.getByLabel('Email address', {exact:true})).toHaveCount(0)
  await expect(page.getByRole('navigation', {name:'Form sections'})).toHaveCount(0)
  await page.getByLabel('First name (as per passport)', {exact:false}).fill('New')
  await page.getByLabel('Family name (as per passport)', {exact:false}).fill('Applicant')
  await page.getByLabel('Date of birth', {exact:false}).fill('1990-01-01')
  await page.getByLabel('Nationality', {exact:false}).fill('Indian')
  await page.getByLabel('Personal contact number(s)', {exact:false}).fill('+971 50 123 4567')
  await page.getByLabel('Personal email address', {exact:false}).fill('new@example.test')
  const emergency = page.locator('.cf-form-section').filter({has:page.getByRole('heading',{name:'Contact person in case of emergency',exact:true})})
  await emergency.getByLabel('Full name', {exact:false}).fill('Family Member')
  await emergency.getByLabel('Contact number', {exact:false}).fill('+971 50 123 4568')
  await emergency.getByLabel('Relationship', {exact:false}).fill('Sibling')
  const beneficiary = page.locator('.cf-form-section').filter({has:page.getByRole('heading',{name:'Beneficiary declaration',exact:true})})
  await beneficiary.getByLabel('Candidate full name', {exact:false}).fill('New Applicant')
  await beneficiary.getByLabel('Nominated person', {exact:false}).fill('Family Member')
  await beneficiary.getByLabel('Relationship', {exact:false}).fill('Sibling')
  await beneficiary.getByLabel('Typed name acknowledgement', {exact:false}).fill('New Applicant')
  await beneficiary.getByRole('checkbox').check()
  await page.getByRole('button',{name:'Save draft',exact:true}).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  await page.reload()
  await expect(page.getByLabel('First name (as per passport)',{exact:false})).toHaveValue('New')
  await page.getByRole('button',{name:'Review form',exact:true}).click()
  await expect(page.getByRole('button',{name:'Submit to HR',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'Email verification code',exact:true}).click()
  await page.getByLabel('Verification code',{exact:true}).fill('123456')
  await page.getByRole('button',{name:'Confirm email',exact:true}).click()
  await expect(page.getByRole('button',{name:'Submit to HR',exact:true})).toBeEnabled()
  await page.getByRole('button',{name:'Submit to HR',exact:true}).click()
  await expect(page.getByText('Submission received',{exact:true})).toBeVisible()
})

test('opening the page without an invitation displays both actual form templates', async ({ page }) => {
  let writes = 0
  await page.route('**/candidate-forms/**', route => {
    if (route.request().method() !== 'GET') writes += 1
    return route.fulfill({ json: schema })
  })
  await page.goto('/tests/hr-enhancements/online-forms.html')
  await expect(page.getByRole('heading', { name: 'Candidate CV Submission Form', exact: true })).toBeVisible()
  await expect(page.getByLabel('Full name *', { exact: true })).toBeVisible()
  await page.getByLabel('Full name *', { exact: true }).fill('Preview only')
  await expect(page.getByLabel('Qualification *')).toBeVisible()
  await page.getByRole('button', { name: 'Pre-Onboarding Employee Form', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Pre-Onboarding Employee Form', exact: true })).toBeVisible()
  await expect(page.getByLabel('Full name *', { exact: true })).toHaveValue('')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Pre-Onboarding Employee Form', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Submit to HR', exact: true })).toHaveCount(0)
  expect(writes).toBe(0)
})

test('CV upload fills sections in Word order while preserving candidate edits', async ({ page }) => {
  await setup(page, { publicLink: true, enhanced: true })
  await page.getByLabel('Full name *', {exact:true}).fill('Keep My Name')
  await page.getByLabel('Upload Professional Photo *', {exact:true}).setInputFiles({name:'photo.png',mimeType:'image/png',buffer:photoBytes})
  await expect(page.getByText('Photo saved', {exact:true})).toBeVisible()
  await page.getByLabel('Upload CV', {exact:true}).setInputFiles({name:'candidate.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-synthetic')})
  await expect(page.getByLabel('Full name *', {exact:true})).toHaveValue('Keep My Name')
  await expect(page.getByLabel('Personal email *', {exact:true})).toHaveValue('extracted@example.test')
  await expect(page.getByLabel('Current position', {exact:true})).toHaveValue('Senior Engineer')
  await expect(page.getByLabel('Qualification *', {exact:true})).toHaveValue('Bachelor of Engineering')
  await expect(page.getByLabel('Typed full name *', {exact:true})).toHaveValue('')
  await expect(page.getByLabel('I confirm that the information provided is accurate to the best of my knowledge. *')).not.toBeChecked()
  const headings = await page.locator('.cf-form-section h2').allTextContents()
  expect(headings.slice(0,9)).toEqual(['Candidate details','Education','Languages','Fields of competence','Experience summary','Relevant project experience','Employment history','Key Achievements','Certifications (If Any)'])
  await expect(page.getByRole('progressbar', {name:'CV completion'})).toHaveAttribute('value', /[1-9]/)
  await expect(page.getByRole('heading', {name:/2020-01.*Lead Engineer.*Example Co/})).toBeVisible()
  await expect(page.getByText('Your private resume link', {exact:true})).toHaveCount(0)
  await page.screenshot({path:'../artifacts/cv-assisted-upload-filled.png',fullPage:true})
})

test('chips, choices, phone formatting and autosave survive reload', async ({ page }) => {
  const server = await setup(page, {publicLink:true,enhanced:true})
  await page.getByLabel('Full name *', {exact:true}).fill('Autosaved Candidate')
  await page.getByLabel('Year of birth (optional)', {exact:true}).selectOption('1990')
  await page.getByLabel('Current department', {exact:true}).selectOption('Engineering')
  await page.getByLabel('Personal contact number *', {exact:true}).fill('00971501234567')
  await page.getByLabel('Personal contact number *', {exact:true}).blur()
  await expect(page.getByLabel('Personal contact number *', {exact:true})).toHaveValue('+971 50 123 4567')
  const skills = page.getByLabel('Techniques', {exact:true})
  await skills.fill('HAZOP'); await skills.press('Enter')
  await expect(page.getByRole('button', {name:'Remove HAZOP',exact:true})).toBeVisible()
  await expect.poll(server.writes).toBeGreaterThan(0)
  await expect(page.locator('.cf-progress-panel')).toContainText('All changes saved')
  await page.reload()
  await expect(page.getByLabel('Full name *', {exact:true})).toHaveValue('Autosaved Candidate')
  await expect(page.getByRole('button', {name:'Remove HAZOP',exact:true})).toBeVisible()
})

test('edits made during a slow autosave are kept and saved afterward', async ({ page }) => {
  const server = await setup(page, {publicLink:true,slowSave:true})
  await page.getByLabel('Full name *', {exact:true}).fill('First edit')
  await expect.poll(server.writes).toBe(1)
  await page.getByLabel('Full name *', {exact:true}).fill('Second edit while saving')
  await expect.poll(server.writes).toBe(2)
  await expect(page.locator('.cf-progress-panel')).toContainText('All changes saved')
  await page.reload()
  await expect(page.getByLabel('Full name *', {exact:true})).toHaveValue('Second edit while saving')
})

test('AI failure keeps manual entry available and candidate edits intact', async ({ page }) => {
  await setup(page, {publicLink:true,enhanced:true,extractionFails:true})
  await page.getByLabel('Full name *', {exact:true}).fill('Keep this candidate')
  await page.getByLabel('Upload CV', {exact:true}).setInputFiles({name:'candidate.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-synthetic')})
  await expect(page.getByRole('alert')).toContainText('AI extraction is unavailable')
  await expect(page.getByLabel('Full name *', {exact:true})).toHaveValue('Keep this candidate')
  await expect(page.getByLabel('Professional summary', {exact:true})).toBeEditable()
})

test('an expired short session resumes the same draft after refresh without a resume panel', async ({ page }) => {
  await setup(page, {publicLink:true,expireSessionOnReload:true})
  await page.getByLabel('Full name *', {exact:true}).fill('Same saved draft')
  await expect(page.locator('.cf-progress-panel')).toContainText('All changes saved')
  await page.getByRole('button', {name:'Save draft',exact:true}).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  await page.reload()
  await expect(page.getByLabel('Full name *', {exact:true})).toHaveValue('Same saved draft')
  await expect(page.getByLabel('Private resume link', {exact:true})).toHaveCount(0)
})

test('complete CV with uploads, chips and date controls fits mobile', async ({ page }) => {
  await page.setViewportSize({width:390,height:844})
  await setup(page, {publicLink:true,enhanced:true})
  await expect(page.getByLabel('Full name *', {exact:true})).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({path:'../artifacts/cv-assisted-complete-mobile.png',fullPage:true})
})
