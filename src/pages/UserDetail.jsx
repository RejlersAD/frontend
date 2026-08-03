/**
 * User Detail Page
 * Comprehensive user profile and activity view
 * Reusable pattern for detail pages across the system
 */

import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
  CalendarIcon,
  ShieldCheckIcon,
  KeyIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  LockClosedIcon,
  UserPlusIcon
} from '@heroicons/react/24/outline'
import { API_BASE_URL } from '../config/api.config'

/**
 * Reusable Detail Page Component
 * This pattern can be replicated for other entities
 */
const UserDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: currentUser } = useSelector((state) => state.auth)

  const [userData, setUserData] = useState(null)
  const [userModules, setUserModules] = useState([])
  const [userRoles, setUserRoles] = useState([])
  const [userActivity, setUserActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchUserDetails()
  }, [id])

  const fetchUserDetails = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access')
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }

      // Fetch user data
      const userResponse = await fetch(`${API_BASE_URL}/rbac/users/${id}/`, { headers })
      if (!userResponse.ok) throw new Error('Failed to fetch user')
      const user = await userResponse.json()
      setUserData(user)

      // Fetch user modules
      try {
        const modulesResponse = await fetch(`${API_BASE_URL}/rbac/users/${id}/modules/`, { headers })
        if (modulesResponse.ok) {
          const modules = await modulesResponse.json()
          setUserModules(modules)
        }
      } catch (err) {
        console.log('Modules not available')
      }

      // Fetch user roles
      try {
        const rolesResponse = await fetch(`${API_BASE_URL}/rbac/users/${id}/roles/`, { headers })
        if (rolesResponse.ok) {
          const roles = await rolesResponse.json()
          setUserRoles(roles)
        }
      } catch (err) {
        console.log('Roles not available')
      }

      // Fetch user activity (if available)
      try {
        const activityResponse = await fetch(`${API_BASE_URL}/rbac/users/${id}/activity/`, { headers })
        if (activityResponse.ok) {
          const activity = await activityResponse.json()
          setUserActivity(activity.results || activity)
        }
      } catch (err) {
        console.log('Activity not available')
      }

      setLoading(false)
    } catch (err) {
      console.error('Error fetching user details:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access')
      const response = await fetch(`${API_BASE_URL}/rbac/users/${id}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) throw new Error('Failed to delete user')

      alert('User deleted successfully')
      navigate('/admin/users')
    } catch (err) {
      console.error('Error deleting user:', err)
      alert('Failed to delete user')
    }
  }

  const handleToggleStatus = async () => {
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access')
      const response = await fetch(`${API_BASE_URL}/rbac/users/${id}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          is_active: !userData.is_active
        })
      })

      if (!response.ok) throw new Error('Failed to update status')

      const updated = await response.json()
      setUserData(updated)
    } catch (err) {
      console.error('Error updating status:', err)
      alert('Failed to update user status')
    }
  }

  const handleResetPassword = async () => {
    if (!window.confirm('Send password reset email to this user?')) {
      return
    }

    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access')
      const response = await fetch(`${API_BASE_URL}/rbac/users/${id}/reset-password/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) throw new Error('Failed to reset password')

      alert('Password reset email sent successfully')
    } catch (err) {
      console.error('Error resetting password:', err)
      alert('Failed to send password reset email')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-20">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200"></div>
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-600 absolute top-0"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !userData) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <XCircleIcon className="w-20 h-20 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">User Not Found</h2>
            <p className="text-gray-600 mb-6">{error || 'The user you are looking for does not exist.'}</p>
            <button
              onClick={() => navigate('/admin/users')}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
            >
              Back to Users
            </button>
          </div>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', name: 'Overview', icon: UserIcon },
    { id: 'modules', name: 'Modules & Permissions', icon: KeyIcon },
    { id: 'roles', name: 'Roles', icon: ShieldCheckIcon },
    { id: 'activity', name: 'Activity Log', icon: ChartBarIcon }
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin/users')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Back to Users
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">User Details</h1>
              <p className="text-gray-600">Complete profile and activity information</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/admin/users')}
                className="px-4 py-2 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-500 transition-all flex items-center gap-2"
              >
                <PencilIcon className="w-5 h-5" />
                Edit
              </button>
              <button
                onClick={handleToggleStatus}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  userData.is_active
                    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {userData.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={handleResetPassword}
                className="px-4 py-2 bg-purple-100 text-purple-700 rounded-xl hover:bg-purple-200 transition-colors flex items-center gap-2"
              >
                <LockClosedIcon className="w-5 h-5" />
                Reset Password
              </button>
              {currentUser?.is_superuser && (
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-colors flex items-center gap-2"
                >
                  <TrashIcon className="w-5 h-5" />
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-xl p-8 mb-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center text-4xl font-bold backdrop-blur-sm">
                {userData.first_name?.[0]}{userData.last_name?.[0]}
              </div>
              <div>
                <h2 className="text-3xl font-bold mb-2">
                  {userData.first_name} {userData.last_name}
                </h2>
                <p className="text-blue-100 text-lg mb-3">{userData.email}</p>
                <div className="flex flex-wrap gap-2">
                  {userData.is_superuser && (
                    <span className="px-3 py-1 bg-yellow-400 text-yellow-900 rounded-full text-sm font-semibold">
                      Super Admin
                    </span>
                  )}
                  {userData.is_staff && (
                    <span className="px-3 py-1 bg-purple-400 text-purple-900 rounded-full text-sm font-semibold">
                      Staff
                    </span>
                  )}
                  {userData.is_active ? (
                    <span className="px-3 py-1 bg-green-400 text-green-900 rounded-full text-sm font-semibold flex items-center gap-1">
                      <CheckCircleIcon className="w-4 h-4" />
                      Active
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-red-400 text-red-900 rounded-full text-sm font-semibold flex items-center gap-1">
                      <XCircleIcon className="w-4 h-4" />
                      Inactive
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-blue-100 text-sm mb-1">User ID</p>
              <p className="text-2xl font-bold">#{userData.employee_id || userData.id}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-lg mb-6 overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-6 py-4 flex items-center justify-center gap-2 font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="p-8">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Contact Information */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <EnvelopeIcon className="w-5 h-5 text-blue-600" />
                      Contact Information
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Email</p>
                        <p className="text-gray-900 font-medium">{userData.email}</p>
                      </div>
                      {userData.phone && (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Phone</p>
                          <p className="text-gray-900 font-medium">{userData.phone}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Organization Information */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <BuildingOfficeIcon className="w-5 h-5 text-purple-600" />
                      Organization
                    </h3>
                    <div className="space-y-3">
                      {userData.organization && (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Organization</p>
                          <p className="text-gray-900 font-medium">{userData.organization_name || userData.organization.name || userData.organization}</p>
                        </div>
                      )}
                      {userData.department && (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Department</p>
                          <p className="text-gray-900 font-medium">{userData.department}</p>
                        </div>
                      )}
                      {userData.job_title && (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Job Title</p>
                          <p className="text-gray-900 font-medium">{userData.job_title}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Account Details */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5 text-green-600" />
                      Account Details
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Created At</p>
                        <p className="text-gray-900 font-medium">
                          {new Date(userData.created_at || userData.date_joined).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      {userData.last_login && (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Last Login</p>
                          <p className="text-gray-900 font-medium">
                            {new Date(userData.last_login).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Statistics */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <ChartBarIcon className="w-5 h-5 text-indigo-600" />
                      Statistics
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-2xl font-bold text-blue-600">{userModules.length}</p>
                        <p className="text-sm text-gray-600">Modules</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-purple-600">{userRoles.length}</p>
                        <p className="text-sm text-gray-600">Roles</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">{userActivity.length}</p>
                        <p className="text-sm text-gray-600">Activities</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-orange-600">
                          {userData.is_active ? 'Active' : 'Inactive'}
                        </p>
                        <p className="text-sm text-gray-600">Status</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modules Tab */}
            {activeTab === 'modules' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Assigned Modules</h3>
                  <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl font-semibold">
                    {userModules.length} Modules
                  </span>
                </div>
                {userModules.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {userModules.map((module, index) => (
                      <div
                        key={index}
                        className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                            {module.code?.[0] || module.name?.[0] || 'M'}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{module.name || module.code || module}</p>
                            {module.description && (
                              <p className="text-sm text-gray-600">{module.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <KeyIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No modules assigned</p>
                  </div>
                )}
              </div>
            )}

            {/* Roles Tab */}
            {activeTab === 'roles' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Assigned Roles</h3>
                  <span className="px-4 py-2 bg-purple-100 text-purple-700 rounded-xl font-semibold">
                    {userRoles.length} Roles
                  </span>
                </div>
                {userRoles.length > 0 ? (
                  <div className="space-y-4">
                    {userRoles.map((role, index) => (
                      <div
                        key={index}
                        className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-lg font-bold text-gray-900 mb-2">
                              {role.name || role}
                            </h4>
                            {role.description && (
                              <p className="text-gray-600 mb-3">{role.description}</p>
                            )}
                            {role.permissions && role.permissions.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {role.permissions.slice(0, 5).map((perm, idx) => (
                                  <span
                                    key={idx}
                                    className="px-3 py-1 bg-white rounded-lg text-sm text-gray-700 border border-purple-200"
                                  >
                                    {perm.name || perm}
                                  </span>
                                ))}
                                {role.permissions.length > 5 && (
                                  <span className="px-3 py-1 bg-white rounded-lg text-sm text-gray-500 border border-gray-200">
                                    +{role.permissions.length - 5} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <ShieldCheckIcon className="w-8 h-8 text-purple-600" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <ShieldCheckIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No roles assigned</p>
                  </div>
                )}
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Recent Activity</h3>
                  <span className="px-4 py-2 bg-green-100 text-green-700 rounded-xl font-semibold">
                    {userActivity.length} Activities
                  </span>
                </div>
                {userActivity.length > 0 ? (
                  <div className="space-y-3">
                    {userActivity.map((activity, index) => (
                      <div
                        key={index}
                        className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-blue-500 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ClockIcon className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900">
                                {activity.action || activity.description || 'User activity'}
                              </p>
                              {activity.details && (
                                <p className="text-sm text-gray-600">{activity.details}</p>
                              )}
                            </div>
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(activity.created_at || activity.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <ChartBarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No activity recorded</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserDetail
