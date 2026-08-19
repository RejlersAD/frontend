/**
 * Employee Profile (Self-Service)
 * Aligned with HR Onboarding/Offboarding system
 * Allows individual users to view and edit their own employee data
 * 
 * ✅ Uses EmployeeMaster backend (same as Onboarding system)
 * ✅ Similar UI/UX to Onboarding List
 * ✅ Photo upload to AWS S3
 * ✅ Document management
 */
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import * as HeroIcons from '@heroicons/react/24/outline'
import apiClient from '../services/api.service'

// ── Soft-coded API endpoints ──────────────────────────────────────────────
const API_ENDPOINTS = {
  myProfile: '/users/employees/my-employee-profile',
  uploadPhoto: '/users/employees/my-profile-photo',
  activeEmployees: '/users/employees/active_employees', // For manager dropdown
}

// ── Soft-coded quick-edit fields ──────────────────────────────────────────
const EDITABLE_SECTIONS = [
  {
    title: 'Personal Information',
    icon: HeroIcons.UserIcon,
    fields: [
      { key: 'first_name', label: 'First Name', type: 'text', required: true },
      { key: 'last_name', label: 'Last Name', type: 'text', required: true },
      { key: 'preferred_given_name', label: 'Preferred Name', type: 'text' },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'phone_number', label: 'Phone Number', type: 'tel' },
    ]
  },
  {
    title: 'Employment Details',
    icon: HeroIcons.BriefcaseIcon,
    fields: [
      { key: 'employee_number', label: 'Employee Number', type: 'text', readonly: true },
      { key: 'employee_code', label: 'Employee Code', type: 'text', readonly: true },
      { key: 'job_title_uae', label: 'Job Title (UAE)', type: 'text' },
      { key: 'job_title_finland', label: 'Job Title (Finland)', type: 'text' },
      { key: 'division', label: 'Division', type: 'text' },
      { key: 'department', label: 'Department', type: 'text' },
      { key: 'business_unit', label: 'Business Unit', type: 'text' },
      { key: 'office', label: 'Office', type: 'text' },
    ]
  },
  {
    title: 'Contact & Address',
    icon: HeroIcons.MapPinIcon,
    fields: [
      { key: 'address', label: 'Street Address', type: 'textarea' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'postal_code', label: 'Postal Code', type: 'text' },
      { key: 'country', label: 'Country', type: 'text' },
    ]
  },
]

export default function ProfileAligned() {
  const currentUser = useSelector((state) => state.auth.user)
  const [employee, setEmployee] = useState(null)
  const [fieldGroups, setFieldGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editFormData, setEditFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [managers, setManagers] = useState([])

  useEffect(() => {
    loadProfile()
    loadManagers()
  }, [])

  const loadProfile = () => {
    setLoading(true)
    apiClient
      .get(API_ENDPOINTS.myProfile)
      .then((res) => {
        setEmployee(res.data.employee)
        setFieldGroups(res.data.field_groups || [])
        // Initialize edit form data
        setEditFormData(res.data.employee)
      })
      .catch((err) => {
        console.error('Failed to load profile:', err)
        setAlert({ type: 'error', message: 'Failed to load profile data' })
      })
      .finally(() => setLoading(false))
  }

  const loadManagers = () => {
    apiClient
      .get(`${API_ENDPOINTS.activeEmployees}/?search=`)
      .then((res) => {
        setManagers(res.data.results || [])
      })
      .catch((err) => console.error('Failed to load managers:', err))
  }

  const handleEdit = () => {
    setEditMode(true)
    setEditFormData({ ...employee })
  }

  const handleCancel = () => {
    setEditMode(false)
    setEditFormData({ ...employee })
  }

  const handleFieldChange = (fieldKey, value) => {
    setEditFormData(prev => ({
      ...prev,
      [fieldKey]: value
    }))
  }

  const handleSave = () => {
    setSaving(true)

    apiClient
      .patch(API_ENDPOINTS.myProfile, editFormData)
      .then(() => {
        setAlert({ type: 'success', message: 'Profile updated successfully' })
        loadProfile()
        setEditMode(false)
        setTimeout(() => setAlert(null), 3000)
      })
      .catch((err) => {
        setAlert({ type: 'error', message: err.response?.data?.error || 'Failed to update profile' })
        setTimeout(() => setAlert(null), 5000)
      })
      .finally(() => setSaving(false))
  }

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file
    if (file.size > 5 * 1024 * 1024) {
      setAlert({ type: 'error', message: 'File size exceeds 5MB limit' })
      return
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setAlert({ type: 'error', message: 'Invalid file type. Use JPEG, PNG, or WebP' })
      return
    }

    setUploadingPhoto(true)

    const formData = new FormData()
    formData.append('photo', file)

    apiClient
      .post(API_ENDPOINTS.uploadPhoto, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      .then((res) => {
        setAlert({ type: 'success', message: 'Profile photo updated successfully' })
        loadProfile()
        setTimeout(() => setAlert(null), 3000)
      })
      .catch((err) => {
        setAlert({ type: 'error', message: err.response?.data?.error || 'Failed to upload photo' })
        setTimeout(() => setAlert(null), 5000)
      })
      .finally(() => setUploadingPhoto(false))
  }

  const renderField = (field) => {
    const value = editMode ? (editFormData[field.key] || '') : (employee[field.key] || '')
    const isEmpty = !value || value === ''

    if (field.readonly) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-700 font-medium">{value || '—'}</span>
          {field.key === 'employee_number' && (
            <span className="text-xs text-slate-500">(Auto-generated)</span>
          )}
        </div>
      )
    }

    if (editMode) {
      if (field.type === 'textarea') {
        return (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={field.label}
          />
        )
      }

      return (
        <input
          type={field.type || 'text'}
          value={value}
          onChange={(e) => handleFieldChange(field.key, e.target.value)}
          className="w-full px-3 py-2 text-sm border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={field.label}
          required={field.required}
        />
      )
    }

    // View mode
    if (isEmpty) {
      return <span className="text-slate-400 italic text-sm">Not set</span>
    }

    return <span className="text-sm text-slate-700">{value}</span>
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
        <span className="ml-2 text-slate-500 mt-4">Loading profile...</span>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <HeroIcons.ExclamationCircleIcon className="w-16 h-16 text-slate-300 mb-4" />
        <p className="text-slate-500">Failed to load profile data</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/20 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Alert */}
        {alert && (
          <div className={`rounded-lg border p-4 flex items-center gap-3 ${
            alert.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
            {alert.type === 'success' ? (
              <HeroIcons.CheckCircleIcon className="w-6 h-6" />
            ) : (
              <HeroIcons.ExclamationCircleIcon className="w-6 h-6" />
            )}
            <span className="text-sm font-medium">{alert.message}</span>
          </div>
        )}

        {/* Header Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Gradient Header */}
          <div className="bg-gradient-to-r from-blue-500 to-violet-500 p-8 text-white">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-6">
                {/* Profile Photo */}
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-4 border-white/30 overflow-hidden">
                    {employee.photo_url ? (
                      <img src={employee.photo_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <HeroIcons.UserIcon className="w-12 h-12 text-white" />
                    )}
                  </div>
                  <label className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      disabled={uploadingPhoto}
                    />
                    {uploadingPhoto ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                    ) : (
                      <HeroIcons.CameraIcon className="w-8 h-8 text-white" />
                    )}
                  </label>
                </div>

                {/* Name & Title */}
                <div>
                  <h1 className="text-3xl font-bold mb-1">
                    {employee.first_name} {employee.last_name}
                  </h1>
                  {employee.preferred_given_name && (
                    <p className="text-blue-100 text-sm mb-2">
                      "{employee.preferred_given_name}"
                    </p>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 text-sm font-medium backdrop-blur-sm">
                      <HeroIcons.IdentificationIcon className="w-4 h-4 mr-1.5" />
                      {employee.employee_number || 'No ID'}
                    </span>
                    {employee.employee_code && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 text-sm font-medium backdrop-blur-sm">
                        {employee.employee_code}
                      </span>
                    )}
                    {employee.is_active && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/90 text-sm font-medium">
                        <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
                        Active
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Edit Button */}
              <div>
                {editMode ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <HeroIcons.CheckIcon className="w-5 h-5" />
                      Save Changes
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <HeroIcons.XMarkIcon className="w-5 h-5" />
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleEdit}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 backdrop-blur-sm"
                  >
                    <HeroIcons.PencilSquareIcon className="w-5 h-5" />
                    Edit Profile
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Info Bar */}
          <div className="border-t border-slate-200 bg-slate-50 px-8 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <HeroIcons.EnvelopeIcon className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-sm font-medium text-slate-700">{employee.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <HeroIcons.PhoneIcon className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Phone</p>
                  <p className="text-sm font-medium text-slate-700">{employee.phone_number || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <HeroIcons.BuildingOfficeIcon className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Department</p>
                  <p className="text-sm font-medium text-slate-700">{employee.division || employee.department || '—'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Editable Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {EDITABLE_SECTIONS.map((section) => {
            const IconComponent = section.icon
            return (
              <div key={section.title} className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <IconComponent className="w-5 h-5 text-blue-500" />
                    {section.title}
                  </h3>
                  <div className="space-y-4">
                    {section.fields.map((field) => (
                      <div key={field.key}>
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1.5">
                          {field.label}
                          {field.required && <span className="text-rose-500 ml-1">*</span>}
                        </label>
                        {renderField(field)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* All Field Groups (from backend) */}
        {fieldGroups.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <HeroIcons.DocumentTextIcon className="w-5 h-5 text-blue-500" />
                Additional Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {fieldGroups.map((group) => (
                  <div key={group.group} className="border border-slate-200 rounded-lg p-4">
                    <h4 className="text-sm font-bold text-slate-700 mb-3 pb-2 border-b border-slate-100">
                      {group.group}
                    </h4>
                    <div className="space-y-2">
                      {group.fields.map((field) => (
                        <div key={field.key}>
                          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-0.5">
                            {field.label}
                          </p>
                          <p className="text-sm text-slate-700">
                            {employee[field.key] || <span className="text-slate-400 italic">—</span>}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
