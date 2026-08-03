/**
 * Interactive Calendar Date Picker Component
 * Visual calendar with month/year dropdowns for intuitive date selection
 */
import { useState, useEffect, useRef } from 'react'
import { CalendarIcon } from '@heroicons/react/24/outline'

// ── Soft-coded calendar configuration ──────────────────────────────────────
const CALENDAR_CONFIG = {
  weekDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  monthNames: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ],
  monthNamesShort: [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ],
  dateFormat: {
    display: 'DD-MMM-YYYY', // Format for display in input
    locale: 'en-GB'
  },
  yearRange: {
    start: 2020,
    end: 2030
  }
}

const DatePicker = ({ 
  value, 
  onChange, 
  placeholder = 'Select date',
  minDate = null,
  maxDate = null,
  className = '',
  name = ''
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const pickerRef = useRef(null)

  // Initialize calendar to selected date's month/year if value exists
  useEffect(() => {
    if (value) {
      const date = new Date(value)
      setCurrentMonth(date.getMonth())
      setCurrentYear(date.getFullYear())
    }
  }, [value])

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Generate calendar days for current month
  const getDaysInMonth = (month, year) => {
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()
    
    const days = []
    
    // Previous month's trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
        month: month === 0 ? 11 : month - 1,
        year: month === 0 ? year - 1 : year
      })
    }
    
    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        month,
        year
      })
    }
    
    // Next month's leading days
    const remainingDays = 42 - days.length // 6 rows × 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        month: month === 11 ? 0 : month + 1,
        year: month === 11 ? year + 1 : year
      })
    }
    
    return days
  }

  const days = getDaysInMonth(currentMonth, currentYear)

  const handleDateSelect = (day) => {
    const selectedDate = new Date(day.year, day.month, day.day)
    
    // Check min/max date constraints
    if (minDate && selectedDate < new Date(minDate)) return
    if (maxDate && selectedDate > new Date(maxDate)) return
    
    // Format date as YYYY-MM-DD for input value
    const formattedDate = selectedDate.toISOString().split('T')[0]
    onChange({ target: { name, value: formattedDate } })
    setIsOpen(false)
  }

  const isDateSelected = (day) => {
    if (!value) return false
    const selectedDate = new Date(value)
    return (
      day.day === selectedDate.getDate() &&
      day.month === selectedDate.getMonth() &&
      day.year === selectedDate.getFullYear()
    )
  }

  const isDateDisabled = (day) => {
    const date = new Date(day.year, day.month, day.day)
    if (minDate && date < new Date(minDate)) return true
    if (maxDate && date > new Date(maxDate)) return true
    return false
  }

  const formatDisplayDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = CALENDAR_CONFIG.monthNamesShort[date.getMonth()]
    const year = date.getFullYear()
    return `${day}-${month}-${year}`
  }

  // Generate year options
  const yearOptions = []
  for (let year = CALENDAR_CONFIG.yearRange.start; year <= CALENDAR_CONFIG.yearRange.end; year++) {
    yearOptions.push(year)
  }

  return (
    <div className="relative" ref={pickerRef}>
      {/* Input Display */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-white flex items-center justify-between hover:border-blue-400 transition-colors ${className}`}
      >
        <span className={value ? 'text-slate-800' : 'text-slate-400'}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <CalendarIcon className="w-5 h-5 text-slate-400" />
      </div>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 w-80">
          {/* Month/Year Dropdown Selectors */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Month</label>
              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {CALENDAR_CONFIG.monthNames.map((month, index) => (
                  <option key={index} value={index}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Year</label>
              <select
                value={currentYear}
                onChange={(e) => setCurrentYear(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {CALENDAR_CONFIG.weekDays.map((day) => (
              <div
                key={day}
                className="text-xs font-medium text-slate-500 text-center py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              const isSelected = isDateSelected(day)
              const isDisabled = isDateDisabled(day)
              const isToday = 
                day.day === new Date().getDate() &&
                day.month === new Date().getMonth() &&
                day.year === new Date().getFullYear()

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => !isDisabled && handleDateSelect(day)}
                  disabled={isDisabled}
                  className={`
                    w-9 h-9 rounded-lg text-sm font-medium transition-all
                    ${!day.isCurrentMonth ? 'text-slate-300' : 'text-slate-700'}
                    ${isSelected 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : isToday
                      ? 'bg-blue-50 text-blue-600 border border-blue-300'
                      : 'hover:bg-slate-100'
                    }
                    ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {day.day}
                </button>
              )
            })}
          </div>

          {/* Quick Actions */}
          <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between">
            <button
              type="button"
              onClick={() => {
                const today = new Date().toISOString().split('T')[0]
                onChange({ target: { name, value: today } })
                setIsOpen(false)
              }}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                onChange({ target: { name, value: '' } })
                setIsOpen(false)
              }}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DatePicker
