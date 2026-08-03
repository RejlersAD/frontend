import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  Trophy, Award, Medal, Sparkles, Plus, X, Edit2, Check,
  ExternalLink, Calendar, MapPin, Building2, Star, Trash2
} from 'lucide-react';
import { API_BASE_URL } from '../../config/api.config';

/**
 * Achievement Section — Sports, Academics, Professional, Genius Records
 * Soft-coded categories fetched from backend
 */
const AchievementSection = () => {
  const [achievements, setAchievements] = useState([]);
  const [categories, setCategories] = useState([]);
  const [levels, setLevels] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
    level: '',
    achieved_date: '',
    location: '',
    organization: '',
    certificate_url: '',
    media_url: '',
    is_public: true,
  });

  useEffect(() => {
    fetchAchievements();
    fetchCategories();
    fetchLevels();
  }, []);

  const fetchAchievements = async () => {
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
      const res = await fetch(`${API_BASE_URL}/rbac/achievements/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch achievements');
      const data = await res.json();
      setAchievements(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
      const res = await fetch(`${API_BASE_URL}/rbac/achievements/categories/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLevels = async () => {
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
      const res = await fetch(`${API_BASE_URL}/rbac/achievements/levels/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLevels(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.category) {
      toast.error('Title and category are required');
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
      const url = editingId
        ? `${API_BASE_URL}/rbac/achievements/${editingId}/`
        : `${API_BASE_URL}/rbac/achievements/`;
      
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
        throw new Error(error.detail || 'Failed to save achievement');
      }

      toast.success(editingId ? 'Achievement updated!' : 'Achievement added!');
      await fetchAchievements();
      resetForm();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (achievement) => {
    setEditingId(achievement.id);
    setFormData({
      title: achievement.title,
      category: achievement.category,
      description: achievement.description || '',
      level: achievement.level || '',
      achieved_date: achievement.achieved_date || '',
      location: achievement.location || '',
      organization: achievement.organization || '',
      certificate_url: achievement.certificate_url || '',
      media_url: achievement.media_url || '',
      is_public: achievement.is_public,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this achievement?')) return;
    
    setIsLoading(true);
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
      const res = await fetch(`${API_BASE_URL}/rbac/achievements/${id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Achievement deleted');
      await fetchAchievements();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      category: '',
      description: '',
      level: '',
      achieved_date: '',
      location: '',
      organization: '',
      certificate_url: '',
      media_url: '',
      is_public: true,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const getCategoryConfig = (categoryCode) => {
    return categories.find(c => c.value === categoryCode) || {};
  };

  const getLevelConfig = (levelCode) => {
    return levels.find(l => l.value === levelCode) || {};
  };

  const inputCls = 'w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-400 transition-all';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

  // Group achievements by category
  const groupedAchievements = achievements.reduce((acc, ach) => {
    if (!acc[ach.category]) acc[ach.category] = [];
    acc[ach.category].push(ach);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
            Achievements & Milestones
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Showcase your sports, academic, professional achievements and genius records
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-semibold transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Achievement
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 border-2 border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingId ? 'Edit Achievement' : 'New Achievement'}
            </h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Achievement Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g., First Place - Regional Football Championship"
                  required
                />
              </div>

              <div>
                <label className={labelCls}>Category *</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}
                  className={inputCls}
                  required
                >
                  <option value="">Select category...</option>
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Achievement Level</label>
                <select
                  value={formData.level}
                  onChange={e => setFormData(p => ({ ...p, level: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Select level...</option>
                  {levels.map(lvl => (
                    <option key={lvl.value} value={lvl.value}>
                      {lvl.icon} {lvl.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Date Achieved</label>
                <input
                  type="date"
                  value={formData.achieved_date}
                  onChange={e => setFormData(p => ({ ...p, achieved_date: e.target.value }))}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={e => setFormData(p => ({ ...p, location: e.target.value }))}
                  className={inputCls}
                  placeholder="City, Country or Event Location"
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls}>Organization / Institution</label>
                <input
                  type="text"
                  value={formData.organization}
                  onChange={e => setFormData(p => ({ ...p, organization: e.target.value }))}
                  className={inputCls}
                  placeholder="Issuing organization or institution"
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls}>Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className={`${inputCls} resize-none`}
                  placeholder="Detailed description of your achievement..."
                />
              </div>

              <div>
                <label className={labelCls}>Certificate URL</label>
                <input
                  type="url"
                  value={formData.certificate_url}
                  onChange={e => setFormData(p => ({ ...p, certificate_url: e.target.value }))}
                  className={inputCls}
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className={labelCls}>Media URL (Photo/Video)</label>
                <input
                  type="url"
                  value={formData.media_url}
                  onChange={e => setFormData(p => ({ ...p, media_url: e.target.value }))}
                  className={inputCls}
                  placeholder="https://..."
                />
              </div>

              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_public"
                  checked={formData.is_public}
                  onChange={e => setFormData(p => ({ ...p, is_public: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_public" className="text-sm font-medium text-gray-700">
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
                {isLoading ? 'Saving...' : (editingId ? 'Update' : 'Add Achievement')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Achievement Display */}
      {achievements.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No achievements yet</h3>
          <p className="text-gray-400 mb-4">Start showcasing your accomplishments!</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add First Achievement
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedAchievements).map(([categoryCode, categoryAchievements]) => {
            const catConfig = getCategoryConfig(categoryCode);
            return (
              <div key={categoryCode} className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <span className="text-2xl">{catConfig.icon}</span>
                  {catConfig.label}
                  <span className="text-sm font-normal text-gray-400">
                    ({categoryAchievements.length})
                  </span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categoryAchievements.map(achievement => {
                    const levelConfig = getLevelConfig(achievement.level);
                    return (
                      <div
                        key={achievement.id}
                        className={`bg-gradient-to-br from-white to-${catConfig.color}-50 border-2 border-${catConfig.color}-200 rounded-xl p-5 hover:shadow-lg transition-all group`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={`w-12 h-12 rounded-full bg-${catConfig.color}-100 flex items-center justify-center text-2xl flex-shrink-0`}>
                              {catConfig.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-gray-900 text-base leading-tight mb-1">
                                {achievement.title}
                              </h4>
                              {levelConfig.icon && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-semibold inline-flex items-center gap-1">
                                  <span>{levelConfig.icon}</span>
                                  {levelConfig.label}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEdit(achievement)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(achievement.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {achievement.description && (
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                            {achievement.description}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                          {achievement.achieved_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(achievement.achieved_date).toLocaleDateString('en-US', {
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                          )}
                          {achievement.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {achievement.location}
                            </span>
                          )}
                          {achievement.organization && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5" />
                              {achievement.organization}
                            </span>
                          )}
                        </div>

                        {(achievement.certificate_url || achievement.media_url) && (
                          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                            {achievement.certificate_url && (
                              <a
                                href={achievement.certificate_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Certificate
                              </a>
                            )}
                            {achievement.media_url && (
                              <a
                                href={achievement.media_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 font-medium"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Media
                              </a>
                            )}
                          </div>
                        )}

                        {achievement.is_verified && (
                          <div className="mt-3 flex items-center gap-1 text-xs text-green-600">
                            <Check className="w-3.5 h-3.5" />
                            <span className="font-medium">Verified</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AchievementSection;
