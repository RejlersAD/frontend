/**
 * Site Visit Tracking Page
 * GPS-based attendance for off-site engineers
 * Phase 1 MVP: Request + GPS Check-In/Out
 */

import React, { useState, useEffect } from 'react';
import {
  MapPinIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  PlusIcon,
  CameraIcon,
} from '@heroicons/react/24/outline';
import siteVisitService from '../../services/siteVisit.service';

const SiteVisits = () => {
  const [activeTab, setActiveTab] = useState('check-in'); // check-in, requests, history
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // State for sites
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);

  // State for GPS
  const [gpsPosition, setGpsPosition] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

  // State for check-ins
  const [activeCheckIn, setActiveCheckIn] = useState(null);
  const [checkInHistory, setCheckInHistory] = useState([]);

  // State for requests
  const [requests, setRequests] = useState([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestForm, setRequestForm] = useState({
    site_id: '',
    start_date: '',
    end_date: '',
    purpose: '',
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    loadSites();
    loadActiveCheckIn();
  }, []);

  useEffect(() => {
    if (activeTab === 'requests') {
      loadRequests();
    } else if (activeTab === 'history') {
      loadCheckInHistory();
    }
  }, [activeTab]);

  const loadSites = async () => {
    try {
      const data = await siteVisitService.getSites(true);
      setSites(data);
    } catch (err) {
      console.error('Failed to load sites:', err);
    }
  };

  const loadActiveCheckIn = async () => {
    try {
      const data = await siteVisitService.getActiveSiteVisits();
      if (data && data.length > 0) {
        setActiveCheckIn(data[0]); // Get the first active check-in
      }
    } catch (err) {
      console.error('Failed to load active check-in:', err);
    }
  };

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await siteVisitService.getMyRequests();
      setRequests(data);
    } catch (err) {
      setError('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const loadCheckInHistory = async () => {
    try {
      setLoading(true);
      const data = await siteVisitService.getMyCheckIns();
      setCheckInHistory(data);
    } catch (err) {
      setError('Failed to load check-in history');
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // GPS FUNCTIONALITY
  // ═══════════════════════════════════════════════════════════════════════════

  const getCurrentGPS = async () => {
    setGpsLoading(true);
    setGpsError('');
    
    try {
      const position = await siteVisitService.getCurrentPosition();
      setGpsPosition(position);
      return position;
    } catch (err) {
      setGpsError(err.message);
      return null;
    } finally {
      setGpsLoading(false);
    }
  };

  const calculateSiteDistance = (site) => {
    if (!gpsPosition || !site.latitude || !site.longitude) {
      return null;
    }
    
    const distance = siteVisitService.calculateDistance(
      gpsPosition.latitude,
      gpsPosition.longitude,
      parseFloat(site.latitude),
      parseFloat(site.longitude)
    );
    
    return Math.round(distance); // meters
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK-IN / CHECK-OUT
  // ═══════════════════════════════════════════════════════════════════════════

  const handleCheckIn = async () => {
    if (!selectedSite) {
      setError('Please select a site');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Get fresh GPS position
      const position = await getCurrentGPS();
      if (!position) {
        setError('Unable to get GPS location');
        setLoading(false);
        return;
      }

      // Validate accuracy
      if (position.accuracy > 50) {
        const proceed = window.confirm(
          `GPS accuracy is ${Math.round(position.accuracy)}m (threshold: 50m). Continue anyway?`
        );
        if (!proceed) {
          setLoading(false);
          return;
        }
      }

      // Check distance from site
      const distance = calculateSiteDistance(selectedSite);
      if (distance && distance > selectedSite.geofence_radius) {
        const proceed = window.confirm(
          `You are ${distance}m from the site (geofence: ${selectedSite.geofence_radius}m). Continue anyway?`
        );
        if (!proceed) {
          setLoading(false);
          return;
        }
      }

      // Submit check-in
      const checkInData = {
        site_id: selectedSite.id,
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        method: 'GPS',
      };

      const result = await siteVisitService.checkIn(checkInData);
      setActiveCheckIn(result);
      setSuccess(`✓ Checked in to ${selectedSite.name} at ${new Date().toLocaleTimeString()}`);
      setSelectedSite(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Check-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!activeCheckIn) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Get fresh GPS position
      const position = await getCurrentGPS();
      if (!position) {
        setError('Unable to get GPS location');
        setLoading(false);
        return;
      }

      // Submit check-out
      const checkOutData = {
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        method: 'GPS',
      };

      const result = await siteVisitService.checkOut(activeCheckIn.id, checkOutData);
      setSuccess(
        `✓ Checked out. Duration: ${result.duration_hours}h at ${new Date().toLocaleTimeString()}`
      );
      setActiveCheckIn(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Check-out failed');
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SITE VISIT REQUEST
  // ═══════════════════════════════════════════════════════════════════════════

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await siteVisitService.submitRequest(requestForm);
      setSuccess('Site visit request submitted for approval');
      setShowRequestForm(false);
      setRequestForm({ site_id: '', start_date: '', end_date: '', purpose: '' });
      loadRequests();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const getStatusBadge = (status) => {
    const colors = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors[status]}`}>
        {status}
      </span>
    );
  };

  const formatDuration = (hours) => {
    if (!hours) return 'N/A';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Site Visit Tracking</h1>
          <p className="text-gray-600 mt-1">GPS-based attendance for off-site work</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <XCircleIcon className="w-5 h-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
            <span className="text-green-800">{success}</span>
          </div>
        )}

        {/* Active Check-In Banner */}
        {activeCheckIn && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPinIcon className="w-6 h-6 text-blue-600" />
                <div>
                  <p className="font-semibold text-blue-900">
                    Currently on-site: {activeCheckIn.site_name}
                  </p>
                  <p className="text-sm text-blue-700">
                    Checked in at {new Date(activeCheckIn.check_in_time).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCheckOut}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Check Out'}
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex gap-6">
            {[
              { key: 'check-in', label: 'Check-In / Out' },
              { key: 'requests', label: 'My Requests' },
              { key: 'history', label: 'History' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {/* ═══ CHECK-IN TAB ═══ */}
          {activeTab === 'check-in' && !activeCheckIn && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-4">Check In to a Site</h2>
                
                {/* GPS Status */}
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-700">GPS Location</p>
                      {gpsPosition ? (
                        <p className="text-sm text-green-600">
                          ✓ Position acquired (±{Math.round(gpsPosition.accuracy)}m accuracy)
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">Click to get current location</p>
                      )}
                      {gpsError && <p className="text-sm text-red-600">{gpsError}</p>}
                    </div>
                    <button
                      onClick={getCurrentGPS}
                      disabled={gpsLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                    >
                      <ArrowPathIcon className={`w-5 h-5 ${gpsLoading ? 'animate-spin' : ''}`} />
                      {gpsLoading ? 'Locating...' : 'Get GPS'}
                    </button>
                  </div>
                </div>

                {/* Site Selection */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Select Site</label>
                  {sites.length === 0 ? (
                    <p className="text-gray-500">No active sites available</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {sites.map((site) => {
                        const distance = calculateSiteDistance(site);
                        const withinGeofence = distance && distance <= site.geofence_radius;
                        
                        return (
                          <div
                            key={site.id}
                            onClick={() => setSelectedSite(site)}
                            className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                              selectedSite?.id === site.id
                                ? 'border-blue-500 bg-blue-50'
                                : withinGeofence
                                ? 'border-green-300 hover:border-green-400'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-gray-900">{site.name}</p>
                                <p className="text-sm text-gray-600">{site.client_name}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {site.city}, {site.country}
                                </p>
                              </div>
                              <div className="text-right">
                                {distance !== null && (
                                  <div className="space-y-1">
                                    <p
                                      className={`text-sm font-medium ${
                                        withinGeofence ? 'text-green-600' : 'text-orange-600'
                                      }`}
                                    >
                                      {distance}m away
                                    </p>
                                    {withinGeofence && (
                                      <p className="text-xs text-green-600">✓ Within geofence</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Check-In Button */}
                <button
                  onClick={handleCheckIn}
                  disabled={!selectedSite || loading}
                  className="mt-6 w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Processing...' : 'Check In'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'check-in' && activeCheckIn && (
            <div className="text-center py-12">
              <MapPinIcon className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                You are on-site at {activeCheckIn.site_name}
              </h3>
              <p className="text-gray-600">
                Checked in at {new Date(activeCheckIn.check_in_time).toLocaleString()}
              </p>
              <button
                onClick={handleCheckOut}
                className="mt-6 px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
              >
                Check Out Now
              </button>
            </div>
          )}

          {/* ═══ REQUESTS TAB ═══ */}
          {activeTab === 'requests' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Site Visit Requests</h2>
                <button
                  onClick={() => setShowRequestForm(!showRequestForm)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <PlusIcon className="w-5 h-5" />
                  New Request
                </button>
              </div>

              {/* Request Form */}
              {showRequestForm && (
                <form onSubmit={handleSubmitRequest} className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Site *
                      </label>
                      <select
                        required
                        value={requestForm.site_id}
                        onChange={(e) =>
                          setRequestForm({ ...requestForm, site_id: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select a site</option>
                        {sites.map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.name} ({site.client_name})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={requestForm.start_date}
                        onChange={(e) =>
                          setRequestForm({ ...requestForm, start_date: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={requestForm.end_date}
                        onChange={(e) =>
                          setRequestForm({ ...requestForm, end_date: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Purpose *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., Installation work"
                        value={requestForm.purpose}
                        onChange={(e) =>
                          setRequestForm({ ...requestForm, purpose: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      Submit Request
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRequestForm(false)}
                      className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Requests List */}
              {loading ? (
                <div className="text-center py-8">
                  <ArrowPathIcon className="w-8 h-8 text-gray-400 animate-spin mx-auto" />
                  <p className="text-gray-500 mt-2">Loading...</p>
                </div>
              ) : requests.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No requests found</p>
              ) : (
                <div className="space-y-3">
                  {requests.map((req) => (
                    <div key={req.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-gray-900">{req.site_name}</p>
                        {getStatusBadge(req.status)}
                      </div>
                      <p className="text-sm text-gray-600">
                        {req.start_date} to {req.end_date}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">{req.purpose}</p>
                      {req.reviewer_note && (
                        <p className="text-sm text-gray-500 mt-2 italic">
                          Note: {req.reviewer_note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ HISTORY TAB ═══ */}
          {activeTab === 'history' && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Check-In History</h2>
              {loading ? (
                <div className="text-center py-8">
                  <ArrowPathIcon className="w-8 h-8 text-gray-400 animate-spin mx-auto" />
                  <p className="text-gray-500 mt-2">Loading...</p>
                </div>
              ) : checkInHistory.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No check-in history</p>
              ) : (
                <div className="space-y-3">
                  {checkInHistory.map((record) => (
                    <div key={record.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <MapPinIcon className="w-5 h-5 text-blue-600" />
                          <p className="font-semibold text-gray-900">{record.site_name}</p>
                        </div>
                        {record.check_out_time ? (
                          <span className="text-sm text-green-600 font-medium">
                            ✓ Completed
                          </span>
                        ) : (
                          <span className="text-sm text-blue-600 font-medium">
                            ◉ Active
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <p>
                            <span className="font-medium">Check-in:</span>{' '}
                            {new Date(record.check_in_time).toLocaleString()}
                          </p>
                          {record.geofence_valid && (
                            <p className="text-green-600 text-xs">✓ Within geofence</p>
                          )}
                        </div>
                        <div>
                          {record.check_out_time ? (
                            <>
                              <p>
                                <span className="font-medium">Check-out:</span>{' '}
                                {new Date(record.check_out_time).toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-500">
                                Duration: {formatDuration(record.duration_hours)}
                              </p>
                            </>
                          ) : (
                            <p className="text-gray-500">Not checked out yet</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SiteVisits;
