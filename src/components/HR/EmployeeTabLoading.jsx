import { Loader } from 'lucide-react'

/**
 * Shared loading state for every employee self-service tab.
 */
export default function EmployeeTabLoading({ message = 'Loading your employee profile…' }) {
  return (
    <div
      className="flex min-h-64 w-full items-center justify-center rounded-2xl bg-[#F0F2F5]"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="text-center">
        <Loader className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-600" aria-hidden="true" />
        <p className="font-medium text-slate-600">{message}</p>
      </div>
    </div>
  )
}
