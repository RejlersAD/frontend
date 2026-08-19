/**
 * PersonalCards - User Personal Information Cards
 * Displays leave balance, attendance, payroll, tasks, etc.
 */
import React from 'react'
import {
  CalendarDaysIcon,
  ClockIcon,
  CurrencyDollarIcon,
  FolderIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

const PersonalCards = () => {
  // TODO: Fetch from API when available
  const personalData = {
    leaveBalance: {
      annual: 15,
      sick: 10,
      emergency: 3,
      used: 5,
    },
    attendance: {
      checkIn: '08:45 AM',
      checkOut: null,
      workingHours: '5h 20m',
    },
    payroll: {
      nextSalary: 'AED 15,000',
      nextDate: '2026-07-25',
    },
    projects: {
      assigned: 3,
      pending: 2,
      completed: 12,
    },
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Leave Balance Card */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200 shadow-sm p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Leave Balance</p>
          </div>
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
            <CalendarDaysIcon className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-700">Annual</span>
            <span className="text-sm font-bold text-blue-900">{personalData.leaveBalance.annual} days</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-700">Sick</span>
            <span className="text-sm font-bold text-blue-900">{personalData.leaveBalance.sick} days</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-700">Emergency</span>
            <span className="text-sm font-bold text-blue-900">{personalData.leaveBalance.emergency} days</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-blue-300">
          <p className="text-xs text-blue-700">
            Used this year: <span className="font-bold">{personalData.leaveBalance.used} days</span>
          </p>
        </div>
      </div>

      {/* Attendance Card */}
      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl border border-emerald-200 shadow-sm p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Today's Attendance</p>
          </div>
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
            <ClockIcon className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-700">Check-in</span>
            <span className="text-sm font-bold text-emerald-900">{personalData.attendance.checkIn}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-700">Check-out</span>
            <span className="text-sm font-bold text-emerald-900">
              {personalData.attendance.checkOut || '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-700">Working</span>
            <span className="text-sm font-bold text-emerald-900">{personalData.attendance.workingHours}</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-emerald-300">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
            <CheckCircleIcon className="w-3.5 h-3.5" />
            On time
          </span>
        </div>
      </div>

      {/* Payroll Card */}
      <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl border border-amber-200 shadow-sm p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Payroll</p>
          </div>
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
            <CurrencyDollarIcon className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="mb-3">
          <p className="text-xs text-amber-700 mb-1">Upcoming Salary</p>
          <p className="text-2xl font-black text-amber-900">{personalData.payroll.nextSalary}</p>
        </div>

        <div className="mt-3 pt-3 border-t border-amber-300">
          <p className="text-xs text-amber-700">
            Payment date: <span className="font-bold">{personalData.payroll.nextDate}</span>
          </p>
        </div>
      </div>

      {/* Projects & Tasks Card */}
      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl border border-purple-200 shadow-sm p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">Projects & Tasks</p>
          </div>
          <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center">
            <FolderIcon className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-purple-700">Assigned</span>
            <span className="text-sm font-bold text-purple-900">{personalData.projects.assigned}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-purple-700">Pending</span>
            <span className="text-sm font-bold text-purple-900">{personalData.projects.pending}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-purple-700">Completed</span>
            <span className="text-sm font-bold text-purple-900">{personalData.projects.completed}</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-purple-300">
          <p className="text-xs text-purple-700">
            Completion rate: <span className="font-bold">85%</span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default PersonalCards
