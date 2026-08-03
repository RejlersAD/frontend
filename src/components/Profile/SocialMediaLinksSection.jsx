import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  Globe, Plus, X, Edit2, Trash2, ExternalLink, Check,
  Linkedin, Github, Twitter, BookOpen, GraduationCap,
  PenTool, Youtube, Award,
} from 'lucide-react';
import { API_BASE_URL } from '../../config/api.config';

// Icon mapping for social platforms
const PLATFORM_ICONS = {
  linkedin: Linkedin,
  github: Github,
  twitter: Twitter,
  'book-open': BookOpen,
  'id-card': Award,
  'graduation-cap': GraduationCap,
  'pen-tool': PenTool,
  youtube: Youtube,
  globe: Globe,
};

/**
 * Social Media Links Section
 * Connect professional and social network profiles
 */
const SocialMediaLinksSection = () => {
  const [links, setLinks] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    platform: '',
    url: '',
    username: '',
    is_public: true,
  });

  useEffect(() => {
    fetchLinks();
    fetchPlatforms();
  }, []);

  const fetchLinks = async () => {
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
      const res = await fetch(`${API_BASE_URL}/rbac/social-links/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch links');
      const data = await res.json();
      setLinks(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPlatforms = async () => {
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
      const res = await fetch(`${API_BASE_URL}/rbac/social-links/platforms/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPlatforms(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.platform || !formData.url) {
      toast.error('Platform and URL are required');
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
      const url = editingId
        ? `${API_BASE_URL}/rbac/social-links/${editingId}/`
        : `${API_BASE_URL}/rbac/social-links/`;
      
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.url ? error.url[0] : (error.detail || 'Failed to save link'));
      }

      toast.success(editingId ? 'Link updated!' : 'Link added!');
      await fetchLinks();
      resetForm();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (link) => {
    setEditingId(link.id);
    setFormData({
      platform: link.platform,
      url: link.url,
      username: link.username || '',
      is_public: link.is_public,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this link?')) return;
    
    setIsLoading(true);
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
      const res = await fetch(`${API_BASE_URL}/rbac/social-links/${id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Link deleted');
      await fetchLinks();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      platform: '',
      url: '',
      username: '',
      is_public: true,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const getPlatformConfig = (platformCode) => {
    return platforms.find(p => p.value === platformCode) || {};
  };

  const getPlatformIcon = (iconName) => {
    return PLATFORM_ICONS[iconName] || Globe;
  };

  const inputCls = 'w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-400 transition-all';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

  // Get available platforms (exclude already linked ones if not editing)
  const availablePlatforms = platforms.filter(p => {
    const isAlreadyLinked = links.some(link => link.platform === p.value);
    if (editingId) {
      // When editing, show current platform + unused platforms
      const currentPlatform = links.find(link => link.id === editingId)?.platform;
      return p.value === currentPlatform || !isAlreadyLinked;
    }
    return !isAlreadyLinked;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="w-6 h-6 text-green-500" />
            Social Media & Professional Networks
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Connect your LinkedIn, GitHub, ResearchGate, and other professional profiles
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-semibold transition-all"
          disabled={availablePlatforms.length === 0 && !showForm}
        >
          <Plus className="w-4 h-4" />
          Add Link
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-gradient-to-br from-green-50 to-cyan-50 rounded-xl p-6 border-2 border-green-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingId ? 'Edit Social Link' : 'Add Social Link'}
            </h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className={labelCls}>Platform *</label>
                <select
                  value={formData.platform}
                  onChange={e => {
                    setFormData(p => ({ ...p, platform: e.target.value }));
                    const selectedPlatform = platforms.find(pl => pl.value === e.target.value);
                    if (selectedPlatform && !formData.url) {
                      setFormData(p => ({ ...p, url: selectedPlatform.placeholder }));
                    }
                  }}
                  className={inputCls}
                  required
                  disabled={editingId !== null} // Cannot change platform when editing
                >
                  <option value="">Select platform...</option>
                  {availablePlatforms.map(platform => (
                    <option key={platform.value} value={platform.value}>
                      {platform.label}
                    </option>
                  ))}
                </select>
                {formData.platform && (
                  <p className="text-xs text-gray-500 mt-1">
                    {getPlatformConfig(formData.platform).placeholder}
                  </p>
                )}
              </div>

              <div>
                <label className={labelCls}>Profile URL *</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={e => setFormData(p => ({ ...p, url: e.target.value }))}
                  className={inputCls}
                  placeholder={formData.platform ? getPlatformConfig(formData.platform).placeholder : 'https://...'}
                  required
                />
              </div>

              <div>
                <label className={labelCls}>Username / Handle (Optional)</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={e => setFormData(p => ({ ...p, username: e.target.value }))}
                  className={inputCls}
                  placeholder="@username"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_public_social"
                  checked={formData.is_public}
                  onChange={e => setFormData(p => ({ ...p, is_public: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_public_social" className="text-sm font-medium text-gray-700">
                  Show on public profile
                </label>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-semibold"
              >
                {isLoading ? 'Saving...' : (editingId ? 'Update' : 'Add Link')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Social Links Display */}
      {links.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <Globe className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No social links added yet</h3>
          <p className="text-gray-400 mb-4">Connect your professional network profiles</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add First Link
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {links.map(link => {
            const platformConfig = getPlatformConfig(link.platform);
            const IconComponent = getPlatformIcon(link.platform_icon);
            
            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative bg-white border-2 border-gray-100 rounded-xl p-5 hover:border-blue-300 hover:shadow-lg transition-all flex items-center gap-4"
              >
                {/* Platform Icon */}
                <div
                  className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 text-white"
                  style={{ backgroundColor: link.platform_color || '#6B7280' }}
                >
                  <IconComponent className="w-7 h-7" />
                </div>

                {/* Platform Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-900">{link.platform_label}</h3>
                    {link.is_verified && (
                      <Check className="w-4 h-4 text-green-500" title="Verified" />
                    )}
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500 transition-colors ml-auto" />
                  </div>
                  {link.username && (
                    <p className="text-sm text-gray-600 truncate">
                      {link.username}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleEdit(link);
                    }}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg bg-white shadow"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete(link.id);
                    }}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg bg-white shadow"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </a>
            );
          })}
        </div>
      )}

      {/* Platform suggestions if less than 3 links */}
      {links.length > 0 && links.length < 3 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700 flex items-center gap-2">
            <Globe className="w-4 h-4" />
            <strong>Tip:</strong> Add at least 3 professional links to earn the "Well Connected" badge!
          </p>
        </div>
      )}
    </div>
  );
};

export default SocialMediaLinksSection;
