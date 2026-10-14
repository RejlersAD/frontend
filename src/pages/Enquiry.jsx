import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRightIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ClockIcon,
  EnvelopeIcon,
  LockClosedIcon,
  PhoneIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import apiService from '../services/api.service'
import { ENQUIRY_CONFIG } from '../config/enquiry.config'

const REQUIRED_FIELDS = ['name', 'email', 'phone', 'subject', 'message']
const INPUT_CLASS = 'mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
const ERROR_INPUT_CLASS = 'border-red-400 focus:border-red-500 focus:ring-red-100'

const urgencyOptions = [
  { value: 'low', label: 'Low', note: 'Within 72 hours' },
  { value: 'normal', label: 'Normal', note: 'Within 24 hours' },
  { value: 'high', label: 'High', note: 'Within 12 hours' },
  { value: 'urgent', label: 'Urgent', note: 'Immediate review' },
]

const fieldError = (name, value) => {
  const clean = String(value || '').trim()
  if (name === 'name' && clean.length < 2) return clean ? 'Enter at least 2 characters.' : 'Full name is required.'
  if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return clean ? 'Enter a valid email address.' : 'Email address is required.'
  if (name === 'phone' && clean.length < 8) return clean ? 'Enter a valid phone number.' : 'Phone number is required.'
  if (name === 'subject' && clean.length < 5) return clean ? 'Enter at least 5 characters.' : 'Subject is required.'
  if (name === 'message' && clean.length < 10) return clean ? `Add ${10 - clean.length} more characters.` : 'Request details are required.'
  return ''
}

const Enquiry = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [reference, setReference] = useState('')
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', company: '',
    subject: searchParams.get('subject') || '',
    message: searchParams.get('message') || '',
    service: searchParams.get('service') || '', urgency: 'normal',
  })

  const progress = useMemo(() => {
    const completed = REQUIRED_FIELDS.filter((field) => String(formData[field] || '').trim()).length
    return Math.round((completed / REQUIRED_FIELDS.length) * 100)
  }, [formData])

  useEffect(() => {
    if (!submitted) return undefined
    const timer = window.setTimeout(() => navigate('/'), 7000)
    return () => window.clearTimeout(timer)
  }, [navigate, submitted])

  const updateField = (event) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
    setErrors((current) => {
      const next = { ...current }
      delete next.submit
      if (touched[name]) {
        const validationMessage = fieldError(name, value)
        if (validationMessage) next[name] = validationMessage
        else delete next[name]
      }
      return next
    })
  }

  const blurField = (event) => {
    const { name, value } = event.target
    setTouched((current) => ({ ...current, [name]: true }))
    const validationMessage = fieldError(name, value)
    setErrors((current) => {
      const next = { ...current }
      if (validationMessage) next[name] = validationMessage
      else delete next[name]
      return next
    })
  }

  const validateForm = () => {
    const nextErrors = REQUIRED_FIELDS.reduce((result, field) => {
      const validationMessage = fieldError(field, formData[field])
      if (validationMessage) result[field] = validationMessage
      return result
    }, {})
    setTouched(REQUIRED_FIELDS.reduce((result, field) => ({ ...result, [field]: true }), {}))
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!validateForm()) return
    setLoading(true)
    try {
      const response = await apiService.post('/enquiry/submit/', formData)
      setReference(response.data?.reference || response.data?.enquiry?.reference || '')
      setSubmitted(true)
    } catch (error) {
      setErrors({ submit: error.response?.data?.message || error.response?.data?.detail || 'We could not submit your request. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <main className="grid min-h-[calc(100vh-5rem)] place-content-center bg-[#f6f8fc] px-4 py-16 font-sans">
        <section className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)]">
          <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400" />
          <div className="p-8 text-center sm:p-10">
            <div className="mx-auto grid h-14 w-14 place-content-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-200"><CheckCircleIcon className="h-8 w-8 text-emerald-600" /></div>
            <div className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">Request received</div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">We’ll take it from here.</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">Your enquiry is being routed to the right RADAI team. You’ll receive updates at <strong className="font-semibold text-slate-700">{formData.email}</strong>.</p>
            {reference && <div className="mx-auto mt-5 w-fit rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-semibold text-slate-700">{reference}</div>}
            <div className="mt-8 grid grid-cols-3 gap-2 text-left"><SuccessStep icon={CheckCircleIcon} label="Submitted" active /><SuccessStep icon={SparklesIcon} label="Routing" active /><SuccessStep icon={ClockIcon} label="Response" /></div>
            <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center"><button type="button" onClick={() => window.location.reload()} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Submit another</button><button type="button" onClick={() => navigate('/')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-950">Return home <ArrowRightIcon className="h-4 w-4" /></button></div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen w-full min-w-0 overflow-x-hidden bg-[#f6f8fc] px-4 py-8 font-sans sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <div className="mb-5 flex items-center justify-end">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm"><span className="h-2 w-2 rounded-full bg-emerald-500" />RADAI Service Desk</div>
        </div>

        <div className="grid w-full min-w-0 items-start gap-5 xl:grid-cols-5 xl:gap-7">
          <aside className="relative w-full min-w-0 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 p-7 text-white shadow-xl lg:p-8 xl:sticky xl:top-6 xl:col-span-2">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" /><div className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 backdrop-blur"><SparklesIcon className="h-3.5 w-3.5" />Enquiry & ticketing</div>
              <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-[-0.035em] sm:text-5xl lg:text-[3.25rem]">One request.<br /><span className="text-cyan-300">The right team.</span><br />Clear resolution.</h1>
              <p className="mt-5 max-w-md text-sm leading-6 text-slate-300">Tell us what you need. RADAI automatically categorizes, assigns and tracks your request through resolution.</p>
              <div className="mt-8 space-y-3"><RouteStep number="01" title="Submit" detail="Share the essential context" /><RouteStep number="02" title="Route" detail="Matched to the responsible team" /><RouteStep number="03" title="Resolve" detail="Track response and closure" /></div>
              <div className="mt-8 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheckIcon className="h-5 w-5 text-cyan-300" />Secure by design</div><p className="mt-2 text-xs leading-5 text-slate-300">Your details are used only to manage this request and communicate service updates.</p></div>
              <div className="mt-7 grid gap-2 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"><a href="mailto:radai@rejlers.ae" className="flex items-center gap-2 rounded-xl px-2 py-2 transition hover:bg-white/10"><EnvelopeIcon className="h-4 w-4 text-cyan-300" />radai@rejlers.ae</a><a href="tel:+971505606987" className="flex items-center gap-2 rounded-xl px-2 py-2 transition hover:bg-white/10"><PhoneIcon className="h-4 w-4 text-cyan-300" />+971 50 560 6987</a></div>
            </div>
          </aside>

          <section className="w-full min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl xl:col-span-3">
            <div className="border-b border-slate-200 px-5 py-5 sm:px-7 sm:py-6">
              <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">Create a request</div><h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">How can we help?</h2><p className="mt-1 text-sm text-slate-500">Required fields are marked with an asterisk.</p></div><div className="min-w-[150px] text-right"><div className="text-xs font-semibold text-slate-500">{progress}% complete</div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-300" style={{ width: `${progress}%` }} /></div></div></div>
            </div>

            <form onSubmit={submit} noValidate className="space-y-8 p-5 sm:p-7">
              <FormSection number="1" title="Contact details" description="So the assigned team can reach you.">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Full name" required error={touched.name && errors.name}><input autoComplete="name" name="name" value={formData.name} onChange={updateField} onBlur={blurField} className={`${INPUT_CLASS} ${touched.name && errors.name ? ERROR_INPUT_CLASS : ''}`} placeholder="Your full name" /></Field>
                  <Field label="Email address" required error={touched.email && errors.email}><input type="email" autoComplete="email" name="email" value={formData.email} onChange={updateField} onBlur={blurField} className={`${INPUT_CLASS} ${touched.email && errors.email ? ERROR_INPUT_CLASS : ''}`} placeholder="you@company.com" /></Field>
                  <Field label="Phone number" required error={touched.phone && errors.phone}><input type="tel" autoComplete="tel" name="phone" value={formData.phone} onChange={updateField} onBlur={blurField} className={`${INPUT_CLASS} ${touched.phone && errors.phone ? ERROR_INPUT_CLASS : ''}`} placeholder="+971 50 000 0000" /></Field>
                  <Field label="Company" hint="Optional"><input autoComplete="organization" name="company" value={formData.company} onChange={updateField} className={INPUT_CLASS} placeholder="Company or organisation" /></Field>
                </div>
              </FormSection>

              <FormSection number="2" title="Request details" description="Give us enough context to route it correctly.">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Request type"><select name="service" value={formData.service} onChange={updateField} className={INPUT_CLASS}><option value="">Select a request type</option>{ENQUIRY_CONFIG.services.filter((service) => service.value !== 'password-reset').map((service) => <option key={service.value} value={service.value}>{service.label}</option>)}</select></Field>
                  <Field label="Priority"><select name="urgency" value={formData.urgency} onChange={updateField} className={INPUT_CLASS}>{urgencyOptions.map((option) => <option key={option.value} value={option.value}>{option.label} — {option.note}</option>)}</select></Field>
                  <div className="sm:col-span-2"><Field label="Subject" required error={touched.subject && errors.subject}><input name="subject" value={formData.subject} onChange={updateField} onBlur={blurField} maxLength="200" className={`${INPUT_CLASS} ${touched.subject && errors.subject ? ERROR_INPUT_CLASS : ''}`} placeholder="A short summary of your request" /></Field></div>
                  <div className="sm:col-span-2"><Field label="Request details" required error={touched.message && errors.message} trailing={`${formData.message.length}/1000`}><textarea name="message" value={formData.message} onChange={updateField} onBlur={blurField} maxLength="1000" rows="7" className={`${INPUT_CLASS} resize-none ${touched.message && errors.message ? ERROR_INPUT_CLASS : ''}`} placeholder="Describe what happened, what you need, and any relevant dates or references." /></Field></div>
                </div>
              </FormSection>

              {errors.submit && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errors.submit}</div>}
              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-xs text-slate-400"><LockClosedIcon className="h-4 w-4" />Encrypted and confidential</div><div className="flex gap-2"><button type="button" onClick={() => navigate('/')} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancel</button><button type="submit" disabled={loading} className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60">{loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Submitting</> : <>Submit request <ArrowRightIcon className="h-4 w-4" /></>}</button></div></div>
            </form>
          </section>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400"><span className="inline-flex items-center gap-1.5"><ClockIcon className="h-4 w-4" />Target response within 24 hours</span><span className="inline-flex items-center gap-1.5"><BuildingOffice2Icon className="h-4 w-4" />Abu Dhabi, UAE</span><span className="inline-flex items-center gap-1.5"><ShieldCheckIcon className="h-4 w-4" />Managed by RADAI</span></div>
      </div>
    </main>
  )
}

const Field = ({ label, required = false, hint, error, trailing, children }) => (
  <label className="block text-sm font-semibold text-slate-700"><span className="flex items-center justify-between gap-3"><span>{label}{required && <span className="ml-1 text-red-500">*</span>}</span>{(hint || trailing) && <span className="text-xs font-normal text-slate-400">{trailing || hint}</span>}</span>{children}{error && <span className="mt-1.5 block text-xs font-medium text-red-600">{error}</span>}</label>
)

const FormSection = ({ number, title, description, children }) => (
  <section><div className="mb-5 flex items-start gap-3"><span className="grid h-7 w-7 shrink-0 place-content-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700 ring-1 ring-blue-100">{number}</span><div><h3 className="text-sm font-bold text-slate-900">{title}</h3><p className="mt-0.5 text-xs text-slate-500">{description}</p></div></div>{children}</section>
)

const RouteStep = ({ number, title, detail }) => (
  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-3"><span className="font-mono text-[10px] font-bold text-cyan-300">{number}</span><div className="min-w-0"><div className="text-sm font-semibold text-white">{title}</div><div className="text-xs text-slate-400">{detail}</div></div></div>
)

const SuccessStep = ({ icon: Icon, label, active = false }) => (
  <div className={`rounded-xl border p-3 ${active ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}><Icon className="h-5 w-5" /><div className="mt-2 text-xs font-semibold">{label}</div></div>
)

export default Enquiry
