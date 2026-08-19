import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import apiClient from '../../../services/api.service';
import {
  ArrowLeftIcon,
  CheckIcon,
  XMarkIcon,
  DocumentTextIcon,
  SparklesIcon,
  CloudArrowUpIcon
} from '@heroicons/react/24/outline';
import QualityCheckerReport from '../../../components/Electrical/QualityCheckerReport';
import FileUploadSection from '../../../components/Electrical/FileUploadSection';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const ElectricalDatasheetFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const equipmentTypeParam = searchParams.get('type');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [equipmentType, setEquipmentType] = useState(null);
  const [configuration, setConfiguration] = useState(null);
  const [formData, setFormData] = useState({});
  const [showQualityChecker, setShowQualityChecker] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [basicInfo, setBasicInfo] = useState({
    tag_number: '',
    service_description: '',
    location: '',
    project_name: '',
    project_number: ''
  });

  useEffect(() => {
    if (id) {
      // Edit mode - load existing datasheet
      loadDatasheet(id);
    } else if (equipmentTypeParam) {
      // Create mode - load equipment type configuration
      loadEquipmentTypeConfiguration(equipmentTypeParam);
    }
  }, [id, equipmentTypeParam]);

  const loadDatasheet = async (datasheetId) => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/electrical-datasheet/datasheets/${datasheetId}/`);
      
      const datasheet = response.data;
      setBasicInfo({
        tag_number: datasheet.tag_number,
        service_description: datasheet.service_description,
        location: datasheet.location,
        project_name: datasheet.project_name || '',
        project_number: datasheet.project_number || ''
      });
      setFormData(datasheet.form_data || {});
      
      // Load attached files
      if (datasheet.form_data?.attached_files) {
        setUploadedFiles(datasheet.form_data.attached_files);
      }
      
      // Load equipment type configuration
      await loadEquipmentTypeConfiguration(datasheet.equipment_type);
    } catch (err) {
      console.error('Error loading datasheet:', err);
      setError('Failed to load datasheet');
    } finally {
      setLoading(false);
    }
  };

  const loadEquipmentTypeConfiguration = async (typeId) => {
    try {
      setLoading(true);
      
      // Load equipment type details
      const typeResponse = await apiClient.get(`/electrical-datasheet/equipment-types/${typeId}/`);
      setEquipmentType(typeResponse.data);
      
      // Load configuration
      const configResponse = await apiClient.get(`/electrical-datasheet/equipment-types/${typeId}/configuration/`);
      setConfiguration(configResponse.data);
    } catch (err) {
      console.error('Error loading configuration:', err);
      setError('Failed to load equipment configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleBasicInfoChange = (field, value) => {
    setBasicInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleFieldChange = (fieldId, value) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleFileUpload = async (file) => {
    try {
      if (!id) {
        throw new Error('Please save the datasheet first before uploading files');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('file_type', 'datasheet');

      const response = await apiClient.post(
        `/electrical-datasheet/datasheets/${id}/attach_file/`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      // Reload datasheet to get updated file list
      await loadDatasheet(id);
      
      return response.data;
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  };

  const handleFileRemove = async (file, index) => {
    if (confirm('Are you sure you want to remove this file?')) {
      try {
        const updatedFiles = uploadedFiles.filter((_, i) => i !== index);
        
        // Update form_data with new file list
        const updatedFormData = { ...formData, attached_files: updatedFiles };
        
        await apiClient.patch(`/electrical-datasheet/datasheets/${id}/`, {
          form_data: updatedFormData
        });
        
        setUploadedFiles(updatedFiles);
        setFormData(updatedFormData);
      } catch (error) {
        console.error('Error removing file:', error);
        alert('Failed to remove file');
      }
    }
  };

  const handleFileDownload = async (file, index) => {
    try {
      const response = await apiClient.get(
        `/electrical-datasheet/datasheets/${id}/download_file/?file_index=${index}`
      );
      
      if (response.data.download_url) {
        window.open(response.data.download_url, '_blank');
      } else {
        alert('Download URL not available');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file');
    }
  };

  const handleSubmit = async (submitStatus = 'draft') => {
    try {
      setSaving(true);
      setError(null);
      
      const payload = {
        equipment_type: equipmentType.id,
        ...basicInfo,
        form_data: formData,
        status: submitStatus
      };

      let response;
      if (id) {
        // Update existing
        response = await apiClient.put(`/electrical-datasheet/datasheets/${id}/`, payload);
      } else {
        // Create new
        response = await apiClient.post('/electrical-datasheet/datasheets/', payload);
      }

      // Navigate back to list
      navigate('/engineering/electrical/datasheet');
    } catch (err) {
      console.error('Error saving datasheet:', err);
      if (err.response?.data) {
        const errors = err.response.data;
        const errorMessages = Object.entries(errors).map(([key, value]) => {
          if (Array.isArray(value)) {
            return `${key}: ${value.join(', ')}`;
          }
          return `${key}: ${value}`;
        }).join('\n');
        setError(errorMessages || 'Failed to save datasheet');
      } else {
        setError('Failed to save datasheet. Please check all required fields.');
      }
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field) => {
    const value = formData[field.id] || '';
    const commonProps = {
      id: field.id,
      value: value,
      onChange: (e) => handleFieldChange(field.id, e.target.value),
      className: "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm",
      placeholder: field.placeholder || '',
      required: field.required || false
    };

    switch (field.type) {
      case 'text':
        return <input type="text" {...commonProps} />;
      
      case 'number':
        return (
          <div className="flex items-center">
            <input
              type="number"
              {...commonProps}
              step={field.step || 'any'}
              min={field.min}
              max={field.max}
            />
            {field.unit && (
              <span className="ml-2 text-sm text-gray-500">{field.unit}</span>
            )}
          </div>
        );
      
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            rows={3}
          />
        );
      
      case 'select':
        return (
          <select {...commonProps}>
            <option value="">Select {field.label}</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      
      case 'multi_select':
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option.value)}
                  onChange={(e) => {
                    const newValues = e.target.checked
                      ? [...selectedValues, option.value]
                      : selectedValues.filter(v => v !== option.value);
                    handleFieldChange(field.id, newValues);
                  }}
                  className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                />
                <span className="ml-2 text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        );
      
      default:
        return <input type="text" {...commonProps} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!equipmentType || !configuration) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error || 'Equipment configuration not found'}</p>
          <button
            onClick={() => navigate('/engineering/electrical/datasheet')}
            className="mt-4 text-yellow-600 hover:text-yellow-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/engineering/electrical/datasheet')}
            className="flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Datasheets
          </button>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            {id ? 'Edit' : 'Create'} {equipmentType.name} Datasheet
          </h1>
          <p className="mt-1 text-sm text-gray-500">{configuration.description}</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <XMarkIcon className="w-5 h-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700 whitespace-pre-line">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="bg-white shadow rounded-lg">
          {/* Basic Information */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Basic Information</h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div>
              <label htmlFor="tag_number" className="block text-sm font-medium text-gray-700">
                Tag Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="tag_number"
                value={basicInfo.tag_number}
                onChange={(e) => handleBasicInfoChange('tag_number', e.target.value)}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="service_description" className="block text-sm font-medium text-gray-700">
                Service Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="service_description"
                value={basicInfo.service_description}
                onChange={(e) => handleBasicInfoChange('service_description', e.target.value)}
                required
                rows={2}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                Location/Area <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="location"
                value={basicInfo.location}
                onChange={(e) => handleBasicInfoChange('location', e.target.value)}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="project_name" className="block text-sm font-medium text-gray-700">
                  Project Name
                </label>
                <input
                  type="text"
                  id="project_name"
                  value={basicInfo.project_name}
                  onChange={(e) => handleBasicInfoChange('project_name', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="project_number" className="block text-sm font-medium text-gray-700">
                  Project Number
                </label>
                <input
                  type="text"
                  id="project_number"
                  value={basicInfo.project_number}
                  onChange={(e) => handleBasicInfoChange('project_number', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Dynamic Sections from Configuration */}
          {configuration.sections?.map((section) => (
            <div key={section.id} className="border-t border-gray-200">
              <div className="px-6 py-4 bg-gray-50">
                <h2 className="text-lg font-medium text-gray-900">{section.name}</h2>
              </div>
              <div className="px-6 py-4 space-y-4">
                {section.fields?.map((field) => (
                  <div key={field.id}>
                    <label htmlFor={field.id} className="block text-sm font-medium text-gray-700">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {renderField(field)}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* File Upload Section */}
          {id && (
            <div className="border-t border-gray-200">
              <div 
                className="px-6 py-4 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                onClick={() => setShowFileUpload(!showFileUpload)}
              >
                <div className="flex items-center">
                  <CloudArrowUpIcon className="w-5 h-5 text-purple-600 mr-2" />
                  <h2 className="text-lg font-medium text-gray-900">
                    Datasheet Files & ADNOC Validation
                  </h2>
                  {uploadedFiles.length > 0 && (
                    <span className="ml-3 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                      {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="text-gray-400">
                  {showFileUpload ? '▼' : '▶'}
                </div>
              </div>
              
              {showFileUpload && (
                <div className="px-6 py-4">
                  <FileUploadSection
                    onFileUpload={handleFileUpload}
                    existingFiles={uploadedFiles}
                    onFileRemove={handleFileRemove}
                    onFileDownload={handleFileDownload}
                    acceptedTypes=".pdf,.xlsx,.xls"
                    maxSize={10 * 1024 * 1024}
                    showADNOCValidation={true}
                  />
                </div>
              )}
            </div>
          )}

          {!id && (
            <div className="border-t border-gray-200 px-6 py-4 bg-purple-50">
              <div className="flex items-start space-x-3">
                <CloudArrowUpIcon className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-purple-900">File Upload Available After Save</h3>
                  <p className="text-xs text-purple-700 mt-1">
                    Save this datasheet first to enable file upload and ADNOC standards validation.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
            <div>
              {id && (
                <button
                  type="button"
                  onClick={() => setShowQualityChecker(true)}
                  className="inline-flex items-center px-4 py-2 border border-purple-300 rounded-md shadow-sm text-sm font-medium text-purple-700 bg-white hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                >
                  <SparklesIcon className="w-5 h-5 mr-2" />
                  AI Quality Check
                </button>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => navigate('/engineering/electrical/datasheet')}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSubmit('draft')}
                disabled={saving}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save as Draft'}
              </button>
              <button
                type="button"
                onClick={() => handleSubmit('under_review')}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
              >
                <CheckIcon className="w-5 h-5 mr-2" />
                {saving ? 'Submitting...' : 'Submit for Review'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quality Checker Modal */}
      {showQualityChecker && id && (
        <QualityCheckerReport
          datasheetId={id}
          onClose={() => setShowQualityChecker(false)}
        />
      )}
    </div>
  );
};

export default ElectricalDatasheetFormPage;
