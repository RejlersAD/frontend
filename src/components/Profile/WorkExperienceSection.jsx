import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  Briefcase, Plus, X, Edit2, Trash2, Calendar, MapPin, Building2,
  Check, ExternalLink, Clock, TrendingUp,
} from 'lucide-react';
import { API_BASE_URL } from '../../config/api.config';

/**
 * Work Experience Timeline Section
 * Shows professional career progression with company roles
 */
const WorkExperienceSection = () => {
  const [experiences, setExperiences] = useState([]);
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    company_name: '',
    company_logo_url: '',
    job_title: '',
    employment_type: '',
    industry: '',
    location: '',
    start_date: '',
    end_date: '',
    is_current: false,
    description: '',
    achievements_text: '',
    skills_used: [],
    is_public: true,
  });

  const [skillInput, setSkillInput] = useState('');

  useEffect(() => {
    fetchExperiences();
    fetchEmploymentTypes();
    fetchIndustries();
  }, []);

  const fetchExperiences = async () => {
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
      const res = await fetch(`${API_BASE_URL}/rbac/work-experience/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch experience');
      const data = await res.json();
      setExperiences(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEmploymentTypes = async () => {
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
      const res = await fetch(`${API_BASE_URL}/rbac/work-experience/employment_types/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmploymentTypes(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchIndustries = async () => {
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
      const res = await fetch(`${API_BASE_URL}/rbac/work-experience/industries/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIndustries(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.company_name || !formData.job_title || !formData.start_date) {
      toast.error('Company name, job title, and start date are required');
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
      const url = editingId
        ? `${API_BASE_URL}/rbac/work-experience/${editingId}/`
        : `${API_BASE_URL}/rbac/work-experience/`;
      
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
        throw new Error(error.detail || 'Failed to save experience');
      }

      toast.success(editingId ? 'Experience updated!' : 'Experience added!');
      await fetchExperiences();
      resetForm();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (experience) => {
    setEditingId(experience.id);
    setFormData({
      company_name: experience.company_name,
      company_logo_url: experience.company_logo_url || '',
      job_title: experience.job_title,
      employment_type: experience.employment_type || '',
      industry: experience.industry || '',
      location: experience.location || '',
      start_date: experience.start_date,
      end_date: experience.end_date || '',
      is_current: experience.is_current,
      description: experience.description || '',
      achievements_text: experience.achievements_text || '',
      skills_used: experience.skills_used || [],
      is_public: experience.is_public,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this experience entry?')) return;
    
    setIsLoading(true);
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
      const res = await fetch(`${API_BASE_URL}/rbac/work-experience/${id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Experience deleted');
      await fetchExperiences();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      company_name: '',
      company_logo_url: '',
      job_title: '',
      employment_type: '',
      industry: '',
      location: '',
      start_date: '',
      end_date: '',
      is_current: false,
      description: '',
      achievements_text: '',
      skills_used: [],
      is_public: true,
    });
    setSkillInput('');
    setEditingId(null);
    setShowForm(false);
  };

  const addSkill = () => {
    if (!skillInput.trim()) return;
    if (formData.skills_used.includes(skillInput.trim())) {
      toast.info('Skill already added');
      return;
    }
    setFormData(p => ({
      ...p,
      skills_used: [...p.skills_used, skillInput.trim()]
    }));
    setSkillInput('');
  };

  const removeSkill = (skill) => {
    setFormData(p => ({
      ...p,
      skills_used: p.skills_used.filter(s => s !== skill)
    }));
  };

  const inputCls = 'w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-400 transition-all';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-blue-500" />
            Work Experience
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Build your professional timeline and showcase career progression
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-semibold transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Experience
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingId ? 'Edit Experience' : 'Add Experience'}
            </h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Company Name *</label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={e => setFormData(p => ({ ...p, company_name: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g., Shell Global"
                  required
                />
              </div>

              <div>
                <label className={labelCls}>Job Title *</label>
                <input
                  type="text"
                  value={formData.job_title}
                  onChange={e => setFormData(p => ({ ...p, job_title: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g., Senior Process Engineer"
                  required
                />
              </div>

              <div>
                <label className={labelCls}>Employment Type</label>
                <select
                  value={formData.employment_type}
                  onChange={e => setFormData(p => ({ ...p, employment_type: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Select type...</option>
                  {employmentTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Industry</label>
                <select
                  value={formData.industry}
                  onChange={e => setFormData(p => ({ ...p, industry: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Select industry...</option>
                  {industries.map(ind => (
                    <option key={ind.value} value={ind.value}>{ind.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={e => setFormData(p => ({ ...p, location: e.target.value }))}
                  className={inputCls}
                  placeholder="City, Country"
                />
              </div>

              <div>
                <label className={labelCls}>Company Logo URL</label>
                <input
                  type="url"
                  value={formData.company_logo_url}
                  onChange={e => setFormData(p => ({ ...p, company_logo_url: e.target.value }))}
                  className={inputCls}
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className={labelCls}>Start Date *</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={e => setFormData(p => ({ ...p, start_date: e.target.value }))}
                  className={inputCls}
                  required
                />
              </div>

              <div>
                <label className={labelCls}>End Date</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={e => setFormData(p => ({ ...p, end_date: e.target.value }))}
                  className={inputCls}
                  disabled={formData.is_current}
                />
              </div>

              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_current"
                  checked={formData.is_current}
                  onChange={e => setFormData(p => ({ ...p, is_current: e.target.checked, end_date: e.target.checked ? '' : p.end_date }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_current" className="text-sm font-medium text-gray-700">
                  I currently work here
                </label>
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls}>Role Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className={`${inputCls} resize-none`}
                  placeholder="Brief description of your role and responsibilities..."
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls}>Key Achievements</label>
                <textarea
                  value={formData.achievements_text}
                  onChange={e => setFormData(p => ({ ...p, achievements_text: e.target.value }))}
                  rows={3}
                  className={`${inputCls} resize-none`}
                  placeholder="Notable accomplishments and impact in this role..."
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls}>Skills & Tools Used</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={e => setSkillInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                    className={inputCls}
                    placeholder="e.g., HYSYS, AutoCAD, Python"
                  />
                  <button
                    type="button"
                    onClick={addSkill}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold"
                  >
                    Add
                  </button>
                </div>
                {formData.skills_used.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.skills_used.map(skill => (
                      <span
                        key={skill}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => removeSkill(skill)}
                          className="hover:text-blue-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
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
                {isLoading ? 'Saving...' : (editingId ? 'Update' : 'Add Experience')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Experience Timeline */}
      {experiences.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No experience added yet</h3>
          <p className="text-gray-400 mb-4">Build your professional timeline</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add First Experience
          </button>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500" />

          <div className="space-y-8">
            {experiences.map((exp, index) => (
              <div key={exp.id} className="relative pl-20">
                {/* Timeline dot */}
                <div className={`absolute left-6 top-6 w-5 h-5 rounded-full border-4 border-white ${exp.is_current ? 'bg-green-500 ring-4 ring-green-100' : 'bg-blue-500'} shadow-lg z-10`} />

                {/* Experience card */}
                <div className="bg-white rounded-xl border-2 border-gray-100 p-6 hover:shadow-xl hover:border-blue-200 transition-all group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4 flex-1">
                      {exp.company_logo_url && (
                        <img
                          src={exp.company_logo_url}
                          alt={exp.company_name}
                          className="w-12 h-12 rounded-lg object-contain bg-gray-50 border border-gray-200"
                          onError={e => e.target.style.display = 'none'}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-gray-900">{exp.job_title}</h3>
                        <p className="text-blue-600 font-semibold">{exp.company_name}</p>
                        {exp.employment_type_label && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 mt-1 inline-block">
                            {exp.employment_type_label}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(exp)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(exp.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 text-sm text-gray-500 mb-4">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      {new Date(exp.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      {' - '}
                      {exp.is_current ? (
                        <span className="text-green-600 font-semibold">Present</span>
                      ) : exp.end_date ? (
                        new Date(exp.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                      ) : 'N/A'}
                      {exp.duration_text && (
                        <span className="text-gray-400">· {exp.duration_text}</span>
                      )}
                    </span>
                    {exp.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" />
                        {exp.location}
                      </span>
                    )}
                    {exp.industry && (
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4" />
                        {exp.industry}
                      </span>
                    )}
                  </div>

                  {exp.description && (
                    <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                      {exp.description}
                    </p>
                  )}

                  {exp.achievements_text && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded mb-3">
                      <p className="text-xs font-semibold text-yellow-700 mb-1 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Key Achievements
                      </p>
                      <p className="text-sm text-gray-700">{exp.achievements_text}</p>
                    </div>
                  )}

                  {exp.skills_used && exp.skills_used.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {exp.skills_used.map(skill => (
                        <span
                          key={skill}
                          className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkExperienceSection;
