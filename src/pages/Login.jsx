import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import * as Yup from 'yup'
import { toast } from 'react-toastify'
import { loginStart, loginSuccess, loginFailure } from '../store/slices/authSlice'
import { authService } from '../services/auth.service'
import LoginForm from '../components/login/LoginForm'
import PWAInstallPrompt from '../components/PWAInstallPrompt'
import {
  VALIDATION_CONFIG,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  NAVIGATION,
  LOGGING,
  parseLoginError,
} from '../config/login.config'
import { REDIRECT_AFTER_LOGIN_KEY } from '../config/solutions.config'

const loginSchema = Yup.object().shape({
  email: Yup.string().email(VALIDATION_CONFIG.email.invalid).required(VALIDATION_CONFIG.email.required),
  password: Yup.string().required(VALIDATION_CONFIG.password.required),
})

const Login = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [isLoading, setIsLoading] = useState(false)
  const [loginGate, setLoginGate] = useState(null)

  const handleSubmit = async (values) => {
    setIsLoading(true)
    setLoginGate(null)
    dispatch(loginStart())

    try {
      if (LOGGING.enabled) console.log(LOGGING.login.attempt, values.email)
      const userData = await authService.login(values)

      dispatch(loginSuccess(userData))
      toast.success(SUCCESS_MESSAGES.login)

      const intendedPath = sessionStorage.getItem(REDIRECT_AFTER_LOGIN_KEY)
      if (intendedPath) {
        sessionStorage.removeItem(REDIRECT_AFTER_LOGIN_KEY)
        navigate(intendedPath)
      } else {
        navigate(NAVIGATION.afterLogin)
      }
    } catch (error) {
      if (LOGGING.enabled) console.error(LOGGING.login.failed, error)

      const { message: parsedMessage, gate } = parseLoginError(error)
      let errorMessage = parsedMessage || ERROR_MESSAGES.unexpected.message

      if (gate) {
        setLoginGate(gate)
      } else if (error.isTimeout) {
        errorMessage = ERROR_MESSAGES.timeout.message
      } else if (error.isNetworkError) {
        errorMessage = ERROR_MESSAGES.network.message
      }

      dispatch(loginFailure(errorMessage))
      if (!gate) toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-cyan-100 via-emerald-50 to-stone-100 px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-cyan-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-emerald-300/20 blur-3xl" />

      <section
        className="relative z-10 grid w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_rgba(15,55,70,0.18)] md:grid-cols-[minmax(0,1.55fr)_minmax(240px,0.85fr)]"
        aria-label="RADAI user login"
      >
        <div className="px-6 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-12">
          <LoginForm
            loginSchema={loginSchema}
            isLoading={isLoading}
            onSubmit={handleSubmit}
            loginGate={loginGate}
            onDismissGate={() => setLoginGate(null)}
          />
        </div>

        <aside className="relative flex min-h-44 items-center justify-center overflow-hidden bg-[#082f57] px-8 py-10 text-white md:min-h-full" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 via-transparent to-blue-950/40" />
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full border border-cyan-200/10" />
          <div className="absolute -bottom-24 -left-20 h-52 w-52 rounded-full border border-cyan-200/10" />
          <svg className="relative h-32 w-32 text-cyan-100/25 sm:h-40 sm:w-40" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M49 70V50C49 32.879 62.879 19 80 19C97.121 19 111 32.879 111 50V70" stroke="currentColor" strokeWidth="13" strokeLinecap="round" />
            <rect x="29" y="64" width="102" height="78" rx="12" fill="currentColor" />
            <circle cx="80" cy="99" r="15" fill="#082f57" />
            <path d="M80 108V124" stroke="#082f57" strokeWidth="10" strokeLinecap="round" />
          </svg>
        </aside>
      </section>

      <PWAInstallPrompt />
    </main>
  )
}

export default Login
