import React, { useState } from 'react';
import {
  XMarkIcon,
  SparklesIcon,
  LightBulbIcon,
  DocumentCheckIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { PROCUREMENT_CONFIG, getCategoriesList } from '../../config/procurement.config';
import apiClient from '../../services/api.service';

const AIRequisitionCreator = ({ isOpen, onClose, onRequisitionCreated }) => {
  const [formData, setFormData] = useState({
    requisition_type: 'general',
    title: '',
    description: '',
    category: '',
    priority: 'normal',
    department: '',
    project: '',
    required_date: '',
    estimated_budget: '',
    items: []
  });

  const [aiSuggestions, setAiSuggestions] = useState({
    description: '',
    specifications: '',
    certifications: [],
    vendors: []
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [currentItem, setCurrentItem] = useState({
    item: '',
    quantity: 1,
    unit: 'ea',
    estimated_price: ''
  });

  if (!isOpen) return null;

  // AI-powered description generator
  const generateDescription = async () => {
    if (!formData.title || !formData.category) {
      alert('Please enter a title and select a category first');
      return;
    }

    setAiLoading(true);
    try {
      const categoryInfo = PROCUREMENT_CONFIG.categories[formData.category];
      
      // Simulating AI-generated description (in production, this would call OpenAI API)
      const aiDescription = `
**Requisition Purpose:**
Procurement of ${categoryInfo.name.toLowerCase()} for ${formData.project || 'operational requirements'}.

**Technical Requirements:**
- ${formData.title}
- Category: ${categoryInfo.name}
- Department: ${formData.department || 'Not specified'}

**Applicable Standards:**
${categoryInfo.standards.map(std => `- ${std}`).join('\n')}

**Quality & Compliance:**
- All materials must be supplied with proper certifications (MTC 3.1, COC)
- Third-party inspection ${categoryInfo.requiresCertification ? 'required' : 'optional'}
- Heat numbers and material traceability required for critical equipment
- NDT testing as per project specifications

**Delivery Requirements:**
- Expected lead time: ${categoryInfo.typicalLeadTime}
- Delivery to project site with proper packaging and handling
- Installation/commissioning support ${categoryInfo.name.includes('Equipment') ? 'required' : 'as needed'}
      `.trim();

      setFormData(prev => ({ ...prev, description: aiDescription }));
      
      // Generate AI suggestions
      setAiSuggestions({
        description: aiDescription,
        specifications: `Material Grade: As per ${categoryInfo.standards[0] || 'project spec'}\nPressure Rating: As per design requirements\nTemperature Rating: As per operating conditions`,
        certifications: categoryInfo.requiresCertification 
          ? ['MTC 3.1', 'Certificate of Conformance', 'Material Test Report', 'Heat Numbers']
          : ['Certificate of Conformance'],
        vendors: [] // Would be populated from API
      });

    } catch (error) {
      console.error('Error generating description:', error);
      alert('Failed to generate description. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  // AI-powered item specification generator
  const suggestItemSpecifications = async (itemName) => {
    if (!itemName || !formData.category) return;

    setAiLoading(true);
    try {
      const categoryInfo = PROCUREMENT_CONFIG.categories[formData.category];
      
      // Simulated AI suggestions (would call API in production)
      const suggestions = {
        piping_materials: {
          'pipe': 'API 5L X65 PSL2 Seamless Pipe, 6" Schedule 40',
          'elbow': 'ASME B16.9 90° LR Elbow, 6", Carbon Steel A234 WPB',
          'flange': 'ASME B16.5 Weld Neck Flange, Class 150, RF, A105',
          'valve': 'API 6D Gate Valve, 6", Class 150, Carbon Steel'
        },
        rotating_equipment: {
          'pump': 'API 610 Centrifugal Pump, OH2 Type, 100 GPM @ 150 ft',
          'compressor': 'API 617 Centrifugal Compressor, 1000 ACFM',
          'motor': 'IEC 60034 Electric Motor, 50 HP, 1800 RPM, TEFC'
        }
      };

      const categoryItems = suggestions[formData.category] || {};
      const matched = Object.keys(categoryItems).find(key => 
        itemName.toLowerCase().includes(key.toLowerCase())
      );

      if (matched) {
        alert(`AI Suggestion:\n${categoryItems[matched]}\n\nThis specification includes:\n- ${categoryInfo.standards.join('\n- ')}`);
      }

    } catch (error) {
      console.error('Error suggesting specifications:', error);
    } finally {
      setAiLoading(false);
    }
  };

  // Auto-calculate budget based on category and items
  const calculateEstimatedBudget = () => {
    const categoryMultipliers = {
      rotating_equipment: 50000,
      static_equipment: 30000,
      instrumentation: 5000,
      valves_fittings: 2000,
      piping_materials: 1000,
      spare_parts: 500
    };

    const basePrice = categoryMultipliers[formData.category] || 1000;
    const itemsTotal = formData.items.reduce((sum, item) => {
      return sum + (parseFloat(item.estimated_price) || 0) * (parseInt(item.quantity) || 1);
    }, 0);

    const estimated = itemsTotal > 0 ? itemsTotal : basePrice;
    setFormData(prev => ({ ...prev, estimated_budget: estimated.toString() }));
  };

  const addItem = () => {
    if (!currentItem.item) return;
    
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { ...currentItem, id: Date.now() }]
    }));
    
    setCurrentItem({
      item: '',
      quantity: 1,
      unit: 'ea',
      estimated_price: ''
    });

    // Auto-calculate budget after adding item
    setTimeout(calculateEstimatedBudget, 100);
  };

  const removeItem = (itemId) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await apiClient.post('/procurement/requisitions/', {
        ...formData,
        pr_number: `PR${Date.now()}`, // Would be auto-generated by backend
        status: 'draft'
      });

      const data = response.data;
      onRequisitionCreated(data);
      onClose();
    } catch (error) {
      console.error('Error creating requisition:', error);
      alert('Failed to create requisition');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <SparklesIcon className="h-8 w-8 text-white" />
                <h3 className="text-xl font-bold text-white">
                  AI-Powered Requisition Creator
                </h3>
              </div>
              <button
                type="button"
                className="text-white hover:text-gray-200 transition-colors"
                onClick={onClose}
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <p className="mt-1 text-sm text-indigo-100">
              Let AI assist you in creating a compliant purchase requisition with smart suggestions
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white px-6 py-6 max-h-[70vh] overflow-y-auto">
            {/* Basic Information */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <DocumentCheckIcon className="h-5 w-5 mr-2 text-indigo-600" />
                Basic Information
              </h4>
              
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Requisition Type - New Field */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Requisition Type *
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, requisition_type: 'general'})}
                      className={`relative flex items-center justify-center px-6 py-4 border-2 rounded-lg transition-all ${
                        formData.requisition_type === 'general'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-indigo-400'
                      }`}
                    >
                      {formData.requisition_type === 'general' && (
                        <div className="absolute top-2 right-2">
                          <svg className="h-5 w-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <div className="text-center">
                        <div className="text-2xl mb-2">📋</div>
                        <div className="font-semibold">General</div>
                        <div className="text-xs mt-1 opacity-75">For operational needs</div>
                      </div>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, requisition_type: 'project'})}
                      className={`relative flex items-center justify-center px-6 py-4 border-2 rounded-lg transition-all ${
                        formData.requisition_type === 'project'
                          ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-md'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-purple-400'
                      }`}
                    >
                      {formData.requisition_type === 'project' && (
                        <div className="absolute top-2 right-2">
                          <svg className="h-5 w-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <div className="text-center">
                        <div className="text-2xl mb-2">🏗️</div>
                        <div className="font-semibold">Project</div>
                        <div className="text-xs mt-1 opacity-75">For specific projects</div>
                      </div>
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., Centrifugal Pump for Crude Oil Transfer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select Category</option>
                    {getCategoriesList().map(cat => (
                      <option key={cat.code} value={cat.code}>
                        {cat.name} - {cat.standards.join(', ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., Operations, Maintenance"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project
                  </label>
                  <input
                    type="text"
                    value={formData.project}
                    onChange={(e) => setFormData({...formData, project: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., Platform Upgrade 2026"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority *
                  </label>
                  <select
                    required
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="urgent">🔴 Urgent (7 days)</option>
                    <option value="high">🟠 High (14 days)</option>
                    <option value="normal">🔵 Normal (30 days)</option>
                    <option value="low">⚪ Low (60 days)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Required Date
                  </label>
                  <input
                    type="date"
                    value={formData.required_date}
                    onChange={(e) => setFormData({...formData, required_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* AI-Generated Description */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Description *
                </label>
                <button
                  type="button"
                  onClick={generateDescription}
                  disabled={aiLoading}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                >
                  {aiLoading ? (
                    <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />
                  ) : (
                    <SparklesIcon className="h-4 w-4 mr-2" />
                  )}
                  {aiLoading ? 'Generating...' : 'Generate with AI'}
                </button>
              </div>
              <textarea
                required
                rows="8"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                placeholder="Click 'Generate with AI' for intelligent description based on category and standards..."
              />
              {aiSuggestions.certifications.length > 0 && (
                <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-md">
                  <div className="flex items-center space-x-2 mb-2">
                    <LightBulbIcon className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-900">AI Recommendations:</span>
                  </div>
                  <p className="text-xs text-purple-800">
                    Required Certifications: {aiSuggestions.certifications.join(', ')}
                  </p>
                </div>
              )}
            </div>

            {/* Items List */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Items</h4>
              
              {/* Add Item Form */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={currentItem.item}
                      onChange={(e) => {
                        setCurrentItem({...currentItem, item: e.target.value});
                        if (e.target.value.length > 3) {
                          suggestItemSpecifications(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Item description (AI will suggest specs)"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={currentItem.quantity}
                      onChange={(e) => setCurrentItem({...currentItem, quantity: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Qty"
                      min="1"
                    />
                  </div>
                  <div>
                    <select
                      value={currentItem.unit}
                      onChange={(e) => setCurrentItem({...currentItem, unit: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="ea">Each</option>
                      <option value="ft">Feet</option>
                      <option value="m">Meters</option>
                      <option value="kg">Kg</option>
                      <option value="ton">Ton</option>
                      <option value="set">Set</option>
                    </select>
                  </div>
                  <div>
                    <input
                      type="number"
                      value={currentItem.estimated_price}
                      onChange={(e) => setCurrentItem({...currentItem, estimated_price: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Est. Price"
                      step="0.01"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="mt-3 w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Add Item
                </button>
              </div>

              {/* Items List */}
              {formData.items.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {formData.items.map(item => (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-sm text-gray-900">{item.item}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{item.quantity}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{item.unit}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">${parseFloat(item.estimated_price || 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">
                            ${(parseFloat(item.estimated_price || 0) * parseInt(item.quantity || 1)).toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Estimated Budget */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Estimated Budget (USD)
                </label>
                <button
                  type="button"
                  onClick={calculateEstimatedBudget}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  Auto-calculate
                </button>
              </div>
              <input
                type="number"
                value={formData.estimated_budget}
                onChange={(e) => setFormData({...formData, estimated_budget: e.target.value})}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="0.00"
                step="0.01"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Create Requisition
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AIRequisitionCreator;
