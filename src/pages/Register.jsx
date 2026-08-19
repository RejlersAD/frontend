import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Formik, Form, Field, ErrorMessage } from 'formik'
import * as Yup from 'yup'
import { toast } from 'react-toastify'
import { authService } from '../services/auth.service'

/**
 * Register Page
 * Smart registration form with validation
 *
 * SOFT-CODED behaviour constants — change here without touching form logic.
 */

// SOFT-CODED: message shown after a successful registration submission.
// Reflects the admin-approval workflow: account is inactive until approved.
const REGISTER_SUCCESS_TITLE = 'Registration submitted!'
const REGISTER_SUCCESS_BODY  =
  'Your account is pending administrator approval. ' +
  'You will receive access once an admin activates your account.'

// SOFT-CODED: route to navigate to after showing the approval notice.
// '/login' lets the user attempt sign-in (they will see an informative
// blocked-account message if they try before approval).
const REGISTER_SUCCESS_REDIRECT = '/login'

const registerSchema = Yup.object().shape({
  username: Yup.string()
    .min(3, 'Username must be at least 3 characters')
    .required('Username is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
  password_confirm: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Passwords must match')
    .required('Confirm password is required'),
  first_name: Yup.string(),
  last_name: Yup.string(),
})

const Register = () => {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (values) => {
    setIsLoading(true)

    try {
      await authService.register(values)
      // SOFT-CODED: show approval-pending message (not "please login").
      // The account is inactive until a super-admin activates it.
      toast.success(REGISTER_SUCCESS_TITLE)
      toast.info(REGISTER_SUCCESS_BODY, { autoClose: 8000 })
      navigate(REGISTER_SUCCESS_REDIRECT)
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Registration failed'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 py-6 sm:py-8 md:py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md sm:max-w-lg w-full mx-auto">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 md:p-8">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
              Create Account
            </h2>
            <p className="text-sm sm:text-base text-gray-600">Join REJLERS RADAI Platform</p>
          </div>

          <Formik
            initialValues={{
              username: '',
              email: '',
              password: '',
              password_confirm: '',
              first_name: '',
              last_name: '',
            }}
            validationSchema={registerSchema}
            onSubmit={handleSubmit}
          >
            {({ errors, touched }) => (
              <Form className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                    Username *
                  </label>
                  <Field
                    name="username"
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-gray-50 text-gray-900 transition-all ${errors.username && touched.username ? 'border-red-400 focus:ring-red-100' : 'border-gray-200'}`}
                    placeholder="Choose a username"
                  />
                  <ErrorMessage
                    name="username"
                    component="div"
                    className="text-red-500 text-xs sm:text-sm mt-1"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email *
                  </label>
                  <Field
                    name="email"
                    type="email"
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-gray-50 text-gray-900 transition-all ${errors.email && touched.email ? 'border-red-400 focus:ring-red-100' : 'border-gray-200'}`}
                    placeholder="your@email.com"
                  />
                  <ErrorMessage
                    name="email"
                    component="div"
                    className="text-red-500 text-xs sm:text-sm mt-1"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      First Name
                    </label>
                    <Field
                      name="first_name"
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-gray-50 text-gray-900 transition-all border-gray-200"
                      placeholder="John"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Last Name
                    </label>
                    <Field
                      name="last_name"
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-gray-50 text-gray-900 transition-all border-gray-200"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password *
                  </label>
                  <Field
                    name="password"
                    type="password"
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-gray-50 text-gray-900 transition-all ${errors.password && touched.password ? 'border-red-400 focus:ring-red-100' : 'border-gray-200'}`}
                    placeholder="Minimum 8 characters"
                  />
                  <ErrorMessage
                    name="password"
                    component="div"
                    className="text-red-500 text-xs sm:text-sm mt-1"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Confirm Password *
                  </label>
                  <Field
                    name="password_confirm"
                    type="password"
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-gray-50 text-gray-900 transition-all ${errors.password_confirm && touched.password_confirm ? 'border-red-400 focus:ring-red-100' : 'border-gray-200'}`}
                    placeholder="Re-enter your password"
                  />
                  <ErrorMessage
                    name="password_confirm"
                    component="div"
                    className="text-red-500 text-xs sm:text-sm mt-1"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full px-5 sm:px-6 py-3 sm:py-4 text-sm sm:text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isLoading ? 'Submitting request...' : 'Request Access'}
                </button>

                {/* SOFT-CODED: approval notice — visible below the submit button */}
                <p className="text-center text-xs text-gray-500 mt-1">
                  Accounts require administrator approval before you can sign in.
                </p>
              </Form>
            )}
          </Formik>

          <p className="text-center mt-6 text-xs sm:text-sm md:text-base text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register
