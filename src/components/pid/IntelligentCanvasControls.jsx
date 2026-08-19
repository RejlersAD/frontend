/**
 * Intelligent Canvas Controls
 * Expert customization panel with AI assistance
 */

import React, { useState } from 'react'
import { CANVAS_INTELLIGENCE_CONFIG, CANVAS_SHORTCUTS } from '../../config/intelligentCanvas.config'

export const IntelligentCanvasControls = ({ 
  assistMode, 
  setAssistMode, 
  expertPreferences,
  setExpertPreferences,
  onValidate,
  validationErrors 
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [activeTab, setActiveTab] = useState('mode')
  
  const modes = CANVAS_INTELLIGENCE_CONFIG.aiAssistance.modes
  
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <span>⚡</span>
          Intelligent Canvas
        </h3>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
        >
          {showAdvanced ? 'Simple' : 'Advanced'}
        </button>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-200">
        {['mode', 'controls', 'validation'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      
      {/* Mode Selection */}
      {activeTab === 'mode' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-600 mb-3">
            Choose how AI assists your layout design
          </p>
          
          {Object.values(modes).map(mode => (
            <button
              key={mode.id}
              onClick={() => setAssistMode(mode.id.toUpperCase())}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                assistMode === mode.id.toUpperCase()
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{mode.icon}</span>
                <div className="flex-1">
                  <div className="font-bold text-gray-900 text-sm">{mode.name}</div>
                  <div className="text-xs text-gray-600">{mode.description}</div>
                </div>
              </div>
              
              {/* Control Balance Bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>🤖 AI: {mode.aiControl}%</span>
                  <span>👨‍🔬 Expert: {mode.expertControl}%</span>
                </div>
                <div className="flex h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-blue-500"
                    style={{ width: `${mode.aiControl}%` }}
                  ></div>
                  <div
                    className="bg-gradient-to-r from-green-500 to-emerald-500"
                    style={{ width: `${mode.expertControl}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Features */}
              {showAdvanced && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {mode.features.map(feature => (
                    <span
                      key={feature}
                      className="px-2 py-0.5 bg-white border border-gray-300 rounded text-xs text-gray-700"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      
      {/* Expert Controls */}
      {activeTab === 'controls' && (
        <div className="space-y-4">
          {/* Drag & Drop */}
          <div>
            <h4 className="font-medium text-gray-900 text-sm mb-2 flex items-center gap-2">
              <span>🎯</span>
              Drag & Drop
            </h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={expertPreferences.snapToGrid}
                  onChange={(e) => setExpertPreferences({
                    ...expertPreferences,
                    snapToGrid: e.target.checked
                  })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Snap to Grid</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={CANVAS_INTELLIGENCE_CONFIG.expertControls.dragAndDrop.smartSnap}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Smart Snap (AI)</span>
                <span className="ml-auto text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                  AI
                </span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={CANVAS_INTELLIGENCE_CONFIG.expertControls.dragAndDrop.showSnapGuides}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Show Snap Guides</span>
              </label>
            </div>
          </div>
          
          {/* Layout Style */}
          <div>
            <h4 className="font-medium text-gray-900 text-sm mb-2 flex items-center gap-2">
              <span>📐</span>
              Layout Style
            </h4>
            <select
              value={expertPreferences.layoutStyle}
              onChange={(e) => setExpertPreferences({
                ...expertPreferences,
                layoutStyle: e.target.value
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="process-sequence">Process Sequence</option>
              <option value="equipment-type">Equipment Type Grouping</option>
              <option value="elevation">Elevation-Based</option>
              <option value="grid">Grid Layout</option>
            </select>
          </div>
          
          {/* Flow Direction */}
          <div>
            <h4 className="font-medium text-gray-900 text-sm mb-2 flex items-center gap-2">
              <span>➡️</span>
              Flow Direction
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {['left-to-right', 'top-to-bottom', 'right-to-left', 'custom'].map(dir => (
                <button
                  key={dir}
                  onClick={() => setExpertPreferences({
                    ...expertPreferences,
                    flowDirection: dir
                  })}
                  className={`px-3 py-2 text-xs rounded border ${
                    expertPreferences.flowDirection === dir
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {dir.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </button>
              ))}
            </div>
          </div>
          
          {/* Spacing */}
          <div>
            <h4 className="font-medium text-gray-900 text-sm mb-2 flex items-center gap-2">
              <span>↔️</span>
              Equipment Spacing: {expertPreferences.spacingPreference}mm
            </h4>
            <input
              type="range"
              min="25"
              max="150"
              step="5"
              value={expertPreferences.spacingPreference}
              onChange={(e) => setExpertPreferences({
                ...expertPreferences,
                spacingPreference: parseInt(e.target.value)
              })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>Tight</span>
              <span>Standard</span>
              <span>Wide</span>
            </div>
          </div>
          
          {/* AI Recommendations */}
          <div>
            <h4 className="font-medium text-gray-900 text-sm mb-2 flex items-center gap-2">
              <span>💡</span>
              AI Recommendations
            </h4>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={expertPreferences.showRecommendations}
                onChange={(e) => setExpertPreferences({
                  ...expertPreferences,
                  showRecommendations: e.target.checked
                })}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Show real-time suggestions</span>
            </label>
          </div>
        </div>
      )}
      
      {/* Validation */}
      {activeTab === 'validation' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900 text-sm">Drawing Validation</h4>
            <button
              onClick={onValidate}
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
            >
              Validate Now
            </button>
          </div>
          
          {validationErrors && validationErrors.length > 0 ? (
            <div className="space-y-2">
              {validationErrors.map((error, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border-l-4 ${
                    error.severity === 'error' ? 'border-red-500 bg-red-50' :
                    error.severity === 'warning' ? 'border-orange-500 bg-orange-50' :
                    'border-blue-500 bg-blue-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900">{error.id}</div>
                      <div className="text-xs text-gray-700 mt-1">{error.message}</div>
                    </div>
                    {error.autoFix && error.fix && (
                      <button
                        onClick={() => error.fix()}
                        className="ml-2 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                      >
                        Fix
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <div className="text-3xl mb-2">✅</div>
              <div className="font-medium text-green-800 text-sm">All Checks Passed</div>
              <div className="text-xs text-green-700 mt-1">Drawing meets all standards</div>
            </div>
          )}
          
          {/* Standards Checklist */}
          {showAdvanced && (
            <div className="mt-4">
              <h5 className="font-medium text-gray-900 text-xs mb-2">Standards Compliance</h5>
              <div className="space-y-1">
                {['ISO 10628', 'ISA 5.1', 'ASME B31.3', 'API RP 520', 'ADNOC DEP'].map(std => (
                  <div key={std} className="flex items-center gap-2 text-xs">
                    <span className="text-green-600">✓</span>
                    <span className="text-gray-700">{std}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Keyboard Shortcuts Hint */}
      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="font-medium text-gray-900 text-xs mb-2">Keyboard Shortcuts</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700">Ctrl</kbd>
              <span>+</span>
              <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700">Space</kbd>
              <span className="ml-1 text-gray-600">Suggestions</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700">Ctrl</kbd>
              <span>+</span>
              <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700">V</kbd>
              <span className="ml-1 text-gray-600">Validate</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700">P</kbd>
              <span className="ml-1 text-gray-600">Expert Panel</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700">G</kbd>
              <span className="ml-1 text-gray-600">Toggle Grid</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
