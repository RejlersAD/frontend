export const isPasswordExpiredResponse = error =>
  error?.response?.status === 403 && error.response.data?.error === 'password_expired'

export const isExpectedAccessDenied = error =>
  error?.response?.status === 403 && !isPasswordExpiredResponse(error)

export const markExpectedAccessDenied = error => {
  if (!isExpectedAccessDenied(error)) return error
  error.isAccessDenied = true
  error.isExpected = true
  return error
}
