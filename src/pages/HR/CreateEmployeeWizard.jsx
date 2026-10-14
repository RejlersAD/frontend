import { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import * as Icons from '@heroicons/react/24/outline'
import apiClient from '../../services/api.service'
import OrganizationSuggestions from '../../components/HR/OrganizationSuggestions'
import { DEFAULT_COMPANY, EMPLOYEE_COUNTRIES, EMPLOYEE_STEPS, employeeDefaults, employeeReadiness, readEmployeeDraft, serializeEmployeeDraft, validateEmployeeStep } from './employeeCreationData'
import './CreateEmployeeWizard.css'

const ENDPOINT = '/onboarding/onboarding'
const managerLabel = manager => `${manager.first_name || ''} ${manager.last_name || ''}`.trim()
const managerOption = manager => `${managerLabel(manager)} · ${manager.email || manager.employee_number || manager.user_id}`
const formatDate = value => {
  if (!value) return 'Not selected'
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? 'Invalid date' : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function Field({ name, label, required, error, children, hint, ...props }) {
  return <div className={`employee-create-field${error ? ' has-error' : ''}`}>
    <label htmlFor={`employee-${name}`}>{label}{required && <span className="employee-create-required"> *</span>}</label>
    {children || <input id={`employee-${name}`} name={name} aria-required={required || undefined} aria-invalid={Boolean(error)} aria-describedby={error ? `employee-${name}-error` : undefined} {...props} />}
    {error && <p className="employee-create-error" id={`employee-${name}-error`}><Icons.ExclamationCircleIcon aria-hidden="true" />{error}</p>}
    {hint && <p className="employee-create-hint">{hint}</p>}
  </div>
}

export default function CreateEmployeeWizard({ onCancel, onCreated }) {
  const user = useSelector(state => state.auth?.user)
  const userKey = user?.id || user?.user_id || user?.email
  const draftKey = userKey ? `employee-create-draft:${userKey}` : null
  const [initialDraft] = useState(() => {
    try { return draftKey ? readEmployeeDraft(sessionStorage.getItem(draftKey)) : null } catch { return null }
  })
  const [data, setData] = useState(initialDraft?.data || employeeDefaults)
  const [step, setStep] = useState(initialDraft?.step || 0)
  const [errors, setErrors] = useState({})
  const [managers, setManagers] = useState([])
  const [managerSearch, setManagerSearch] = useState('')
  const [managerState, setManagerState] = useState('loading')
  const [managerRetry, setManagerRetry] = useState(0)
  const [photo, setPhoto] = useState(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [photoReminder, setPhotoReminder] = useState(Boolean(initialDraft?.hadPhoto))
  const [manualEmail, setManualEmail] = useState(Boolean(initialDraft?.data.email))
  const [identity, setIdentity] = useState(null)
  const [identityRetry, setIdentityRetry] = useState(0)
  const [draftState, setDraftState] = useState(initialDraft ? 'restored' : 'new')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [created, setCreated] = useState(null)
  const submitLock = useRef(false)
  const formRef = useRef(null)
  const photoRef = useRef(null)
  const touched = useRef(Boolean(initialDraft))
  const identityKey = JSON.stringify([data.first_name.trim(), data.surname.trim(), data.email.trim()])
  const hasNames = Boolean(data.first_name.trim() && data.surname.trim())
  const currentIdentity = identity?.key === identityKey ? identity : null
  const identityReady = currentIdentity?.status === 'done' && currentIdentity.available === true
  const generatedEmail = currentIdentity?.email || ''
  const selectedManager = managers.find(manager => String(manager.user_id) === String(data.manager_id))
  const readiness = employeeReadiness(data)
  const allFieldsReady = !Object.keys(validateEmployeeStep(data, 3)).length && Boolean(selectedManager)
  const fullName = `${data.first_name} ${data.surname}`.trim() || 'New employee'

  useEffect(() => {
    let active = true
    setManagerState('loading')
    apiClient.get(`${ENDPOINT}/employee_manager_options/`).catch(error => {
      // Older backend workers may still be serving the previous route table
      // during rollout. The established employee lookup enforces its own access.
      if (error.response?.status !== 404) throw error
      return apiClient.get('/users/employees/active_employees/', { params: { minimal: true } })
    }).then(response => {
      if (!active) return
      const rows = Array.isArray(response.data) ? response.data : response.data.results || []
      setManagers(rows.filter(manager => manager.user_id))
      setManagerState('ready')
    }).catch(() => { if (active) setManagerState('error') })
    return () => { active = false }
  }, [managerRetry])

  useEffect(() => {
    if (selectedManager) setManagerSearch(managerOption(selectedManager))
  }, [selectedManager])

  useEffect(() => {
    if (!photo) { setPhotoUrl(''); return undefined }
    const url = URL.createObjectURL(photo)
    setPhotoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  useEffect(() => {
    if (!hasNames) return undefined
    let active = true
    const timer = setTimeout(() => {
      setIdentity({ key: identityKey, status: 'loading' })
      const [first_name, surname, email] = JSON.parse(identityKey)
      apiClient.get(`${ENDPOINT}/employee_identity_preview/`, { params: { first_name, surname, ...(email ? { email } : {}) } })
        .then(response => { if (active) setIdentity({ ...response.data, key: identityKey, status: 'done' }) })
        .catch(() => { if (active) setIdentity({ key: identityKey, status: 'error' }) })
    }, 400)
    return () => { active = false; clearTimeout(timer) }
  }, [hasNames, identityKey, identityRetry])

  useEffect(() => {
    if (!draftKey || !touched.current || created) return undefined
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(draftKey, serializeEmployeeDraft(data, step, Boolean(photo) || photoReminder))
        setDraftState('saved')
      } catch { setDraftState('error') }
    }, 700)
    return () => clearTimeout(timer)
  }, [data, step, photo, photoReminder, draftKey, created])

  const update = (name, value) => {
    touched.current = true
    setData(current => ({ ...current, [name]: value }))
    setErrors(current => ({ ...current, [name]: undefined, ...(['first_name', 'surname', 'email'].includes(name) ? { email: undefined } : {}) }))
    setSubmitError('')
    setDraftState('unsaved')
  }
  const saveDraft = () => {
    if (!draftKey) { setDraftState('error'); return }
    try {
      sessionStorage.setItem(draftKey, serializeEmployeeDraft(data, step, Boolean(photo) || photoReminder))
      setDraftState('saved')
    } catch { setDraftState('error') }
  }
  const leaveWizard = () => {
    if (submitting) return
    if (touched.current) saveDraft()
    onCancel()
  }
  const validateStep = index => {
    const validation = validateEmployeeStep(data, index)
    if ((index === 0 || index === 3) && data.manager_id && !selectedManager) {
      validation.manager_id = managerState === 'loading' ? 'Wait for the reporting managers to load' : 'Select an active reporting manager from the list'
    }
    return validation
  }
  const focusError = validation => {
    const key = Object.keys(validation)[0]
    requestAnimationFrame(() => formRef.current?.querySelector(`[name="${key === 'manager_id' ? 'manager_search' : key}"]`)?.focus())
  }
  const goTo = target => {
    if (submitting) return
    if (target > step) {
      for (let index = 0; index < target; index += 1) {
        const validation = validateStep(index)
        if (Object.keys(validation).length) {
          setStep(index); setErrors(validation); focusError(validation); return
        }
      }
    }
    setErrors({}); setStep(target)
  }
  const pickPhoto = event => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setPhotoError('Choose a JPG or PNG image, no larger than 5 MB.'); event.target.value = ''; return
    }
    setPhoto(file); setPhotoError(''); setPhotoReminder(false); touched.current = true
  }
  const handleSubmit = async event => {
    event.preventDefault()
    if (submitLock.current || created) return
    if (step < 3) { goTo(step + 1); return }
    const validation = validateStep(3)
    if (Object.keys(validation).length) {
      const firstInvalid = [0, 1, 2].find(index => Object.keys(validateStep(index)).length)
      setStep(firstInvalid); setErrors(validation); focusError(validation); return
    }
    if (!identityReady) { setSubmitError('Complete the work email and duplicate check before creating the employee.'); return }
    submitLock.current = true; setSubmitting(true); setSubmitError('')
    const payload = new FormData()
    Object.entries({ ...data, email: generatedEmail }).forEach(([key, value]) => {
      if (String(value).trim()) payload.append(key, String(value).trim())
    })
    if (photo) payload.append('photo', photo)
    try {
      const response = await apiClient.post(`${ENDPOINT}/create_employee/`, payload, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (!response.data?.success) throw new Error(response.data?.error || response.data?.message || 'The employee could not be created.')
      setCreated(response.data)
      if (draftKey) { try { sessionStorage.removeItem(draftKey) } catch { /* Creation remains successful when storage is disabled. */ } }
    } catch (error) {
      const body = error.response?.data
      const message = body?.error || body?.detail || body?.message || error.message || 'The employee could not be created. Please try again.'
      setSubmitError(typeof message === 'string' ? message : 'The employee could not be created. Please review the details and try again.')
      if (body?.errors) setErrors(Object.fromEntries(Object.entries(body.errors).map(([key, value]) => [key, Array.isArray(value) ? value.join(' ') : String(value)])))
      setIdentityRetry(value => value + 1)
    } finally { submitLock.current = false; setSubmitting(false) }
  }

  const input = (name, label, options = {}) => <Field name={name} label={label} value={data[name]} onChange={event => update(name, event.target.value)} error={errors[name]} {...options} />
  const emailHint = !hasNames ? 'Generated after valid first name and surname are provided.' : currentIdentity?.status === 'error' ? 'The email check could not be completed. Retry the duplicate check.' : currentIdentity?.status !== 'done' ? 'Checking work email and existing employees…' : currentIdentity.errors?.email || (currentIdentity.available ? 'Work email validated. Availability is checked again when you create the employee.' : 'Review the identity details before continuing.')

  if (created) return <div className="employee-create-workspace employee-create-success">
    <section className="employee-create-panel" aria-labelledby="employee-created-title">
      <Icons.CheckCircleIcon className="employee-create-success-icon" aria-hidden="true" />
      <h1 id="employee-created-title">Employee created</h1>
      <p>{fullName}’s employee record and onboarding workflow are ready.</p>
      <dl><div><dt>Work email</dt><dd>{created.email}</dd></div><div><dt>Employee number</dt><dd>{created.employee_number || 'Assigned'}</dd></div><div><dt>Employee code</dt><dd>{created.employee_code || created.emp_code || 'Assigned'}</dd></div><div><dt>Employment ID</dt><dd>{created.employment_id || 'Assigned'}</dd></div></dl>
      {created.warnings?.map((warning, index) => <p className="employee-create-callout" key={index}>{warning}</p>)}
      <div className="employee-create-success-actions"><button type="button" className="employee-create-button" onClick={onCancel}>Back to employee lifecycle</button><button type="button" className="employee-create-button is-primary" onClick={() => onCreated({ ...created, employee_name: fullName, department: data.division, position: data.job_title_uae })}>Open onboarding<Icons.ArrowRightIcon aria-hidden="true" /></button></div>
    </section>
  </div>

  return <div className="employee-create-workspace">
    <nav className="employee-create-breadcrumb" aria-label="Breadcrumb"><a href="/hr"><Icons.BuildingOfficeIcon aria-hidden="true" />HR</a><span>/</span><button type="button" onClick={leaveWizard} disabled={submitting}>Employee Lifecycle</button><span>/</span><span aria-current="page">New employee</span></nav>
    <form ref={formRef} id="employee-create-form" noValidate onSubmit={handleSubmit}>
      <div className="employee-create-layout">
        <div className="employee-create-main">
          <header className="employee-create-heading"><div><h1>Create new employee</h1><p>Set up the employee record and prepare onboarding</p></div><div className="employee-create-draft-status" role="status"><Icons.CheckCircleIcon aria-hidden="true" /><div>{draftState === 'saved' ? 'Draft saved' : draftState === 'restored' ? 'Draft restored' : draftState === 'error' ? 'Draft not saved' : draftState === 'unsaved' ? 'Saving draft…' : 'New draft'}<small>{draftState === 'saved' || draftState === 'restored' ? 'Saved in this tab' : draftState === 'error' ? 'Browser storage is unavailable' : 'Complete the details below'}</small></div></div></header>
          <nav className="employee-create-steps" aria-label="Employee creation steps">{EMPLOYEE_STEPS.map((label, index) => <button type="button" key={label} onClick={() => goTo(index)} disabled={submitting} aria-current={step === index ? 'step' : undefined}><span className={index < step ? 'is-complete' : ''}>{index < step ? <Icons.CheckIcon aria-hidden="true" /> : index + 1}</span><b>{label}</b></button>)}<small>Step {step + 1} of 4</small></nav>
          {photoReminder && <p className="employee-create-callout" role="status">Draft restored. Please select your profile photo again; photos are not stored in drafts.</p>}
          {submitError && <p className="employee-create-callout is-error" role="alert">{submitError}</p>}
          <fieldset disabled={submitting} className="employee-create-fields">
            {step === 0 && <section className="employee-create-panel" aria-labelledby="employee-personal-title">
              <div className="employee-create-section-heading"><span><Icons.UserIcon aria-hidden="true" /></span><div><h2 id="employee-personal-title">Personal details</h2><p>Start with the employee’s basic information and contact details.</p></div></div>
              <div className="employee-create-personal">
                <div className="employee-create-field-grid">
                  {input('first_name', 'First name', { required: true, maxLength: 100, autoComplete: 'given-name' })}
                  {input('surname', 'Surname', { required: true, maxLength: 100, autoComplete: 'family-name' })}
                  {input('preferred_given_name', 'Preferred name (optional)', { placeholder: 'E.g. Sara', maxLength: 100 })}
                  <Field name="mobile_phone" label="Personal mobile number" required error={errors.mobile_phone}><div className="employee-create-phone"><span>+971<Icons.ChevronDownIcon aria-hidden="true" /></span><input id="employee-mobile_phone" name="mobile_phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="50 123 4567" aria-required="true" aria-invalid={Boolean(errors.mobile_phone)} aria-describedby={errors.mobile_phone ? 'employee-mobile_phone-error' : undefined} value={data.mobile_phone.replace(/^\+971/, '')} onChange={event => { const digits = event.target.value.replace(/\D/g, '').replace(/^971/, '').slice(0, 9); update('mobile_phone', digits ? `+971${digits}` : '') }} /></div></Field>
                  <Field name="country" label="Country" required error={errors.country}><select id="employee-country" name="country" value={data.country} onChange={event => update('country', event.target.value)} aria-required="true" aria-invalid={Boolean(errors.country)}><option value="">Select country</option>{EMPLOYEE_COUNTRIES.map(country => <option key={country}>{country}</option>)}</select></Field>
                  <Field name="manager_search" label="Reporting manager" required error={errors.manager_id}>
                    <input id="employee-manager_search" name="manager_search" list="employee-manager-options" placeholder={managerState === 'loading' ? 'Loading managers…' : 'Search name or email'} autoComplete="off" value={managerSearch} aria-required="true" aria-invalid={Boolean(errors.manager_id)} aria-describedby={errors.manager_id ? 'employee-manager_search-error' : undefined} onChange={event => { const value = event.target.value; setManagerSearch(value); const manager = managers.find(item => managerOption(item) === value); update('manager_id', manager ? String(manager.user_id) : '') }} />
                    <input type="hidden" name="manager_id" value={data.manager_id} /><datalist id="employee-manager-options">{managers.map(manager => <option key={manager.user_id} value={managerOption(manager)} />)}</datalist>
                    {managerState === 'error' && <p className="employee-create-error">Managers could not be loaded.<button type="button" className="employee-create-link" onClick={() => setManagerRetry(value => value + 1)}>Retry</button></p>}
                  </Field>
                  <div className="employee-create-email-field"><Field name="email" label={manualEmail ? 'Work email' : 'Work email (generated)'} error={errors.email || currentIdentity?.errors?.email}>
                    <input id="employee-email" name="email" type="email" readOnly={!manualEmail} placeholder="Generated after valid first name and surname are provided." value={manualEmail ? data.email : generatedEmail} aria-invalid={Boolean(errors.email || currentIdentity?.errors?.email)} onChange={event => update('email', event.target.value)} />
                  </Field><p className="employee-create-hint"><Icons.InformationCircleIcon aria-hidden="true" />{emailHint}</p><button type="button" className="employee-create-link" onClick={() => { setManualEmail(value => !value); update('email', '') }}>{manualEmail ? 'Use generated email' : 'Use a different work email'}</button></div>
                </div>
                <div className="employee-create-photo"><label htmlFor="employee-photo">Profile photo</label><button type="button" className="employee-create-photo-picker" onClick={() => photoRef.current?.click()}>{photoUrl ? <img src={photoUrl} alt="Selected employee profile" /> : <span><Icons.CameraIcon aria-hidden="true" /></span>}<b>{photo ? 'Change photo' : 'Upload photo'}</b></button><input ref={photoRef} id="employee-photo" name="photo" type="file" accept="image/jpeg,image/png" className="employee-create-file-input" onChange={pickPhoto} /><p>JPG, PNG (max 5 MB)<br />Square image works best</p>{photo && <button type="button" className="employee-create-link" onClick={() => { setPhoto(null); if (photoRef.current) photoRef.current.value = '' }}>Remove photo</button>}{photoError && <p className="employee-create-error" role="alert">{photoError}</p>}</div>
              </div>
              <div className="employee-create-identifiers"><div><Icons.CircleStackIcon aria-hidden="true" /><div><h3>Identifiers created automatically</h3><p>These will be generated after you create the employee record.</p></div></div><dl><div><dt>Employee number</dt><dd>Assigned after creation</dd></div><div><dt>Employee code</dt><dd>Generated by company sequence</dd></div><div><dt>Employment ID</dt><dd>Generated by company sequence</dd></div><div><dt>Account name</dt><dd>Created from approved work email</dd></div></dl></div>
            </section>}
            {step === 1 && <section className="employee-create-panel" aria-labelledby="employee-organisation-title"><div className="employee-create-section-heading"><span><Icons.BuildingOffice2Icon aria-hidden="true" /></span><div><h2 id="employee-organisation-title">Organisation</h2><p>Define where the employee works and their role in the company.</p></div></div><div className="employee-create-field-grid">{input('company', 'Company', { readOnly: true, className: 'employee-create-company' })}{input('business_unit', 'Business unit', { required: true, placeholder: 'Enter business unit' })}{input('division', 'Division', { required: true, list: 'employee-create-departments', placeholder: 'Select or enter division' })}{input('business_area', 'Business area', { required: true, placeholder: 'Enter business area' })}{input('office', 'Office', { required: true, placeholder: 'E.g. Abu Dhabi' })}{input('job_title_uae', 'Job title (UAE)', { required: true, list: 'employee-create-roles', placeholder: 'Select or enter job title' })}{input('job_title_finland', 'Job title (Finland, optional)', { list: 'employee-create-roles' })}</div></section>}
            {step === 2 && <section className="employee-create-panel" aria-labelledby="employee-employment-title"><div className="employee-create-section-heading"><span><Icons.BriefcaseIcon aria-hidden="true" /></span><div><h2 id="employee-employment-title">Employment</h2><p>Set the joining date, branch and onboarding notes.</p></div></div><div className="employee-create-field-grid">{input('joining_date', 'Joining date', { required: true, type: 'date' })}<Field name="branch" label="Branch" required error={errors.branch}><select id="employee-branch" name="branch" value={data.branch} onChange={event => update('branch', event.target.value)}><option value="RAD">Rejlers Abu Dhabi (RAD)</option><option value="RIN">Rejlers India (RIN)</option></select></Field><Field name="employment_status" label="Initial employment status" value="On probation" readOnly /><Field name="probation" label="Probation period" value="6 months (standard)" readOnly /><div className="employee-create-span"><Field name="notes" label="Onboarding notes (optional)"><textarea id="employee-notes" name="notes" rows="4" value={data.notes} onChange={event => update('notes', event.target.value)} placeholder="Add any information needed to prepare onboarding" /></Field></div></div></section>}
            {step === 3 && <section className="employee-create-panel" aria-labelledby="employee-review-title"><div className="employee-create-section-heading"><span><Icons.DocumentCheckIcon aria-hidden="true" /></span><div><h2 id="employee-review-title">Review & create</h2><p>Check the details before creating the employee and starting onboarding.</p></div></div>{[
              { title: 'Personal details', rows: [['Name', fullName], ['Preferred name', data.preferred_given_name || '—'], ['Work email', generatedEmail || 'Awaiting validation'], ['Mobile number', data.mobile_phone], ['Country', data.country], ['Reporting manager', selectedManager ? managerLabel(selectedManager) : 'Not selected']] },
              { title: 'Organisation', rows: [['Company', DEFAULT_COMPANY], ['Business unit', data.business_unit], ['Division', data.division], ['Business area', data.business_area], ['Office', data.office], ['Job title (UAE)', data.job_title_uae], ['Job title (Finland)', data.job_title_finland || '—']] },
              { title: 'Employment', rows: [['Joining date', formatDate(data.joining_date)], ['Branch', data.branch === 'RAD' ? 'Rejlers Abu Dhabi' : 'Rejlers India'], ['Initial status', 'On probation'], ['Probation', '6 months'], ['Notes', data.notes || '—']] },
            ].map((section, index) => <section className="employee-create-review" key={section.title}><header><h3>{section.title}</h3><button type="button" className="employee-create-link" onClick={() => goTo(index)}>Edit {section.title.toLowerCase()}</button></header><dl>{section.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>)}<p className="employee-create-callout"><Icons.InformationCircleIcon aria-hidden="true" />Creating this record starts Pre-Hire Initiation. HR users with Edit access can manage all four onboarding stages in order.</p></section>}
            {step < 3 && [0, 1, 2].filter(index => index !== step).map(index => { const Icon = [Icons.UserIcon, Icons.BuildingOffice2Icon, Icons.BriefcaseIcon][index]; const complete = !Object.keys(validateEmployeeStep(data, index)).length; return <div className="employee-create-collapsed" key={index}><Icon aria-hidden="true" /><div><h3>{EMPLOYEE_STEPS[index]}</h3><p>{['Name, contact details, country and reporting manager', 'Company, business unit, division, business area, office and job title', 'Joining date, branch, probation and notes'][index]}</p></div><span>{complete ? <Icons.CheckCircleIcon aria-hidden="true" /> : <Icons.EllipsisHorizontalCircleIcon aria-hidden="true" />}{complete ? 'Complete' : 'Not started'}</span><button type="button" className="employee-create-button" onClick={() => goTo(index)}>{index < step ? 'Edit' : 'Continue'}<Icons.ChevronRightIcon aria-hidden="true" /></button></div> })}
          </fieldset>
        </div>
        <aside className="employee-create-aside" aria-label="Employee summary and readiness">
          <section className="employee-create-panel employee-create-summary"><h2><Icons.UserIcon aria-hidden="true" />Employee summary</h2><div className="employee-create-profile"><div className="employee-create-avatar">{photoUrl ? <img src={photoUrl} alt="Employee profile preview" /> : <Icons.UserIcon aria-hidden="true" />}</div><div><h3>{fullName}</h3><span>Draft</span></div></div><dl>{[
            [Icons.EnvelopeIcon, 'Work email', generatedEmail || 'Generated after name validation'], [Icons.Squares2X2Icon, 'Manager', selectedManager ? managerLabel(selectedManager) : 'Not selected'], [Icons.BuildingOffice2Icon, 'Company', DEFAULT_COMPANY], [Icons.MapPinIcon, 'Office', data.office || 'Not selected'], [Icons.CalendarIcon, 'Joining date', formatDate(data.joining_date)],
          ].map(([Icon, label, value]) => <div key={label}><dt><Icon aria-hidden="true" />{label}</dt><dd className={value === 'Not selected' || value === 'Generated after name validation' ? 'is-muted' : ''}>{value}</dd></div>)}</dl></section>
          <section className="employee-create-panel employee-create-readiness"><h2><Icons.DocumentArrowUpIcon aria-hidden="true" />Record readiness</h2>{readiness.map(row => <div className="employee-create-readiness-row" key={row.label}><span className={row.done === row.total ? 'is-ready' : row.done ? 'is-partial' : ''}>{row.done === row.total ? <Icons.CheckCircleIcon aria-hidden="true" /> : <span className="employee-create-ring" />}</span><span>{row.label}</span><div role="progressbar" aria-label={row.label} aria-valuenow={row.done} aria-valuemin={0} aria-valuemax={row.total}><i style={{ width: `${row.done / row.total * 100}%` }} /></div><small>{row.done}/{row.total}</small></div>)}<p className={`employee-create-callout${allFieldsReady && identityReady ? ' is-ready' : ''}`}><Icons.ExclamationCircleIcon aria-hidden="true" />{allFieldsReady && identityReady ? 'The record is ready. Review the details, then create the employee.' : 'The employee record can be created after all required fields and duplicate checks pass.'}</p></section>
          <section className="employee-create-panel employee-create-duplicate"><h2><Icons.ShieldCheckIcon aria-hidden="true" />Duplicate check</h2><div className="employee-create-duplicate-status"><Icons.MagnifyingGlassIcon aria-hidden="true" /><div>Duplicate employee check<p>{!hasNames ? 'Runs after identity details' : currentIdentity?.status === 'error' ? 'Unable to check saved records' : !currentIdentity || currentIdentity.status === 'loading' ? 'Checking saved employee records…' : currentIdentity.duplicate_count ? `${currentIdentity.duplicate_count} matching ${currentIdentity.duplicate_count === 1 ? 'identity' : 'identities'} found` : currentIdentity.available ? 'No duplicate found' : 'Review the identity details'}</p></div><span className={identityReady ? 'is-ready' : ''}>{!hasNames ? 'Pending' : currentIdentity?.status === 'error' ? 'Retry' : currentIdentity?.status !== 'done' ? 'Checking' : identityReady ? (currentIdentity.duplicate_count ? 'Review' : 'Passed') : 'Action needed'}</span></div>
            {currentIdentity?.status === 'error' && <button type="button" className="employee-create-link" onClick={() => setIdentityRetry(value => value + 1)}>Retry duplicate check</button>}
            {currentIdentity?.errors?.email && <p className="employee-create-error">{currentIdentity.errors.email}</p>}
            {currentIdentity?.duplicates?.length > 0 && <div className="employee-create-matches"><p>{identityReady ? 'A person with the same name already exists. Confirm this is a different employee before creating the record.' : 'An existing identity uses this email. Open the existing record or choose a different address for a different employee.'}</p>{currentIdentity.duplicates.slice(0, 5).map((match, index) => <p key={index}><strong>{match.employee_name}</strong><br />{match.email}</p>)}</div>}
            {currentIdentity?.suggested_email && <button type="button" className="employee-create-link" onClick={() => { setManualEmail(true); update('email', currentIdentity.suggested_email) }}>Use {currentIdentity.suggested_email}</button>}
          </section>
        </aside>
      </div>
      <footer className="employee-create-footer"><button type="button" className="employee-create-button" onClick={saveDraft} disabled={submitting}><Icons.ArrowDownTrayIcon aria-hidden="true" />Save draft</button><div><button type="button" className="employee-create-button is-neutral" onClick={leaveWizard} disabled={submitting}>Cancel</button>{step > 0 && <button type="button" className="employee-create-button" onClick={() => goTo(step - 1)} disabled={submitting}>Back</button>}<button type="submit" className="employee-create-button is-primary" disabled={submitting || (step === 3 && !identityReady)}>{submitting ? 'Creating employee…' : ['Continue to organisation', 'Continue to employment', 'Review & create', 'Create employee'][step]}<Icons.ArrowRightIcon aria-hidden="true" /></button></div></footer>
      <OrganizationSuggestions id="employee-create" />
    </form>
  </div>
}
