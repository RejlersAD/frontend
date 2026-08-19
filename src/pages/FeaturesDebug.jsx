import React, { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config/api.config'

/**
 * Debug page to test feature API and category filtering
 */
const FeaturesDebug = () => {
  const [features, setFeatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeCategory, setActiveCategory] = useState('all')
  
  useEffect(() => {
    fetchFeatures()
  }, [])
  
  const fetchFeatures = async () => {
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access')
      
      const response = await fetch(`${API_BASE_URL}/features/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json()
      console.log('Features API Response:', data)
      
      setFeatures(data.features || [])
      setLoading(false)
    } catch (err) {
      console.error('Error fetching features:', err)
      setError(err.message)
      setLoading(false)
    }
  }
  
  // Categorize features
  const categorizedFeatures = features.reduce((acc, feature) => {
    const category = feature.category || 'other'
    if (!acc[category]) acc[category] = []
    acc[category].push(feature)
    return acc
  }, {})
  
  console.log('Categorized Features:', categorizedFeatures)
  console.log('Sales Features:', categorizedFeatures.sales)
  
  const categories = [
    { id: 'all', name: 'All Features' },
    { id: 'engineering', name: 'Engineering' },
    { id: 'document_management', name: 'Documents' },
    { id: 'sales', name: 'Sales' },
    { id: 'finance', name: 'Finance' },
    { id: 'other', name: 'Other' }
  ]
  
  const filteredFeatures = activeCategory === 'all' 
    ? features.filter(f => f.category !== 'other')
    : categorizedFeatures[activeCategory] || []
  
  console.log('Active Category:', activeCategory)
  console.log('Filtered Features:', filteredFeatures)
  
  if (loading) return <div className="p-8">Loading...</div>
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>
  
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Features API Debug</h1>
      
      {/* Category Buttons */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded ${
              activeCategory === cat.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-800'
            }`}
          >
            {cat.name} ({categorizedFeatures[cat.id]?.length || 0})
          </button>
        ))}
      </div>
      
      {/* Stats */}
      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-bold mb-2">Statistics</h2>
        <p>Total Features: {features.length}</p>
        <p>Active Category: {activeCategory}</p>
        <p>Filtered Features: {filteredFeatures.length}</p>
      </div>
      
      {/* Category Breakdown */}
      <div className="mb-6 p-4 bg-blue-50 rounded">
        <h2 className="text-xl font-bold mb-2">Features by Category</h2>
        {Object.entries(categorizedFeatures).map(([category, feats]) => (
          <div key={category} className="mb-2">
            <strong>{category}:</strong> {feats.length} features
            <ul className="ml-4">
              {feats.map(f => (
                <li key={f.id} className="text-sm">{f.name}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      
      {/* Filtered Features */}
      <div>
        <h2 className="text-xl font-bold mb-4">
          Filtered Features ({filteredFeatures.length})
        </h2>
        
        {filteredFeatures.length === 0 ? (
          <div className="p-8 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800 font-bold">No features found for category: {activeCategory}</p>
            <p className="text-sm text-yellow-600 mt-2">
              Check console logs for debugging information
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredFeatures.map(feature => (
              <div key={feature.id} className="p-4 border rounded">
                <h3 className="font-bold text-lg">{feature.name}</h3>
                <p className="text-sm text-gray-600">{feature.description}</p>
                <div className="mt-2 text-xs">
                  <span className="inline-block px-2 py-1 bg-blue-100 rounded mr-2">
                    {feature.category}
                  </span>
                  <span className="text-gray-500">Route: {feature.frontendRoute}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Raw Data */}
      <details className="mt-8">
        <summary className="cursor-pointer font-bold text-lg">Raw API Response</summary>
        <pre className="mt-4 p-4 bg-gray-800 text-white rounded overflow-auto text-xs">
          {JSON.stringify({ features }, null, 2)}
        </pre>
      </details>
    </div>
  )
}

export default FeaturesDebug
