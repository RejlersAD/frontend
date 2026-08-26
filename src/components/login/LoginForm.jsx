import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { Formik, Form, Field, ErrorMessage } from 'formik'
import { Link } from 'react-router-dom'
import { FORM_CONFIG, INTERACTIONS } from '../../config/login.config'

const LoginForm = ({ loginSchema, isLoading, onSubmit, loginGate, onDismissGate }) => {
  const { fields, buttons, options } = FORM_CONFIG
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)

  const handleCapsLock = (event) => {
    if (INTERACTIONS.capsLockWarning.enabled && typeof event.getModifierState === 'function') {
      setCapsLockOn(event.getModifierState('CapsLock'))
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <header className="mb-8 text-center">
        <img src="/assets/Rejlers_Logo.png" alt="Rejlers" className="mx-auto mb-5 h-12 w-auto" />
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-700">RADAI secure access</p>
        <h1 className="text-3xl font-light tracking-[0.14em] text-[#15395f] sm:text-4xl">User Login</h1>
      </header>

      <Formik initialValues={{ email: '', password: '' }} validationSchema={loginSchema} onSubmit={onSubmit}>
        {({ errors, touched }) => (
          <Form className="space-y-5">
            {loginGate && (
              <div
                className={`rounded-lg border p-4 text-sm ${
                  loginGate.severity === 'error'
                    ? 'border-red-200 bg-red-50 text-red-800'
                    : loginGate.severity === 'warning'
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : 'border-blue-200 bg-blue-50 text-blue-800'
                }`}
                role="alert"
              >
                <div className="flex items-start gap-3">
                  <span aria-hidden="true">{loginGate.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{loginGate.title}</p>
                    <p className="mt-1 text-xs leading-relaxed">{loginGate.body}</p>
                    {loginGate.helpEmail && (
                      <a
                        href={`mailto:${loginGate.helpEmail}${loginGate.autoSubject ? `?subject=${encodeURIComponent(loginGate.autoSubject)}` : ''}${loginGate.autoBody ? `${loginGate.autoSubject ? '&' : '?'}body=${encodeURIComponent(loginGate.autoBody)}` : ''}`}
                        className="mt-2 inline-block text-xs font-semibold underline"
                      >
                        {loginGate.helpEmailLabel || loginGate.helpEmail}
                      </a>
                    )}
                  </div>
                  {typeof onDismissGate === 'function' && (
                    <button type="button" onClick={onDismissGate} className="text-lg leading-none opacity-60 hover:opacity-100" aria-label="Dismiss message">×</button>
                  )}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">{fields.email.label}</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-slate-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9" /></svg>
                </span>
                <Field
                  id="login-email"
                  name="email"
                  type={fields.email.type}
                  autoComplete="email"
                  placeholder={fields.email.placeholder}
                  className={`w-full border py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-[#0b477c] focus:ring-2 focus:ring-blue-100 ${errors.email && touched.email ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-slate-100'}`}
                />
              </div>
              <ErrorMessage name="email" component="p" className="mt-1 text-xs text-red-600" />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-wide text-slate-600">{fields.password.label}</label>
                {capsLockOn && <span className="text-xs font-medium text-amber-700">{INTERACTIONS.capsLockWarning.message}</span>}
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-slate-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </span>
                <Field
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : fields.password.type}
                  autoComplete="current-password"
                  onKeyDown={handleCapsLock}
                  onKeyUp={handleCapsLock}
                  placeholder={fields.password.placeholder}
                  className={`w-full border py-3 pl-11 pr-12 text-sm text-slate-800 outline-none transition focus:border-[#0b477c] focus:ring-2 focus:ring-blue-100 ${errors.password && touched.password ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-slate-100'}`}
                />
                {INTERACTIONS.passwordToggle.enabled && (
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 px-4 text-xs font-semibold text-slate-500 hover:text-[#0b477c]" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                )}
              </div>
              <ErrorMessage name="password" component="p" className="mt-1 text-xs text-red-600" />
            </div>

            <div className="flex items-center justify-between gap-4 text-xs">
              {options.rememberMe.enabled && (
                <label className="flex cursor-pointer items-center gap-2 text-slate-600">
                  <input type="checkbox" className="h-4 w-4 accent-[#082f57]" />
                  <span>{options.rememberMe.label}</span>
                </label>
              )}
              <Link to={buttons.forgotPassword.link} className="font-medium text-slate-500 hover:text-[#0b477c]">{buttons.forgotPassword.text}</Link>
            </div>

            <button type="submit" disabled={isLoading} className="flex w-full items-center justify-center bg-[#082f57] px-5 py-3.5 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-[#0b477c] focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-wait disabled:opacity-70">
              {isLoading ? (
                <><span className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />{buttons.submit.loadingText}</>
              ) : buttons.submit.text}
            </button>
          </Form>
        )}
      </Formik>

      <footer className="mt-7 flex items-center justify-center gap-2 border-t border-slate-200 pt-4 text-[11px] text-slate-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span>Secure encrypted connection</span>
      </footer>
    </div>
  )
}

LoginForm.propTypes = {
  loginSchema: PropTypes.object.isRequired,
  isLoading: PropTypes.bool.isRequired,
  onSubmit: PropTypes.func.isRequired,
  loginGate: PropTypes.shape({
    severity: PropTypes.oneOf(['info', 'warning', 'error']),
    icon: PropTypes.node,
    title: PropTypes.string.isRequired,
    body: PropTypes.string.isRequired,
    helpEmail: PropTypes.string,
    helpEmailLabel: PropTypes.string,
    autoSubject: PropTypes.string,
    autoBody: PropTypes.string,
  }),
  onDismissGate: PropTypes.func,
}

export default LoginForm
