/**
 * QHSE Interconnected Demo Page
 * Demonstrates how all 6 QHSE modules are connected with AI recommendations
 * Shows real-time change detection, cross-module impacts, and intelligent insights
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { PageLayout } from '@/layouts/PageLayout';
import { MainHeader } from './components/Common/MainHeader';
import { useQHSERunningProjects } from './hooks/useQHSEProjects';
import { useQHSEIntelligence } from '@/hooks/useQHSEIntelligence';
import QHSEAIInsightsPanel from '@/components/qhse/QHSEAIInsightsPanel';
import { 
  Network, 
  Activity,
  TrendingUp,
  Shield,
  Leaf,
  Zap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const QHSEInterconnectedDemo = () => {
  const { projectId } = useParams();
  const { data: allProjects, loading } = useQHSERunningProjects();
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeModule, setActiveModule] = useState('project-quality');

  // Use AI Intelligence Hook
  const {
    recommendations,
    isAnalyzing,
    crossModuleImpacts,
    systemInsights,
    changeDetected,
    isModuleAffected,
    getRiskLevel,
    getPriorityActions,
    refreshAnalysis
  } = useQHSEIntelligence(activeModule, selectedProject);

  useEffect(() => {
    if (allProjects && allProjects.length > 0) {
      const project = projectId 
        ? allProjects.find(p => p.id === projectId || p.projectNo === projectId)
        : allProjects[0];
      setSelectedProject(project);
    }
  }, [allProjects, projectId]);

  const modules = [
    {
      id: 'project-quality',
      name: '6.1 Project Quality',
      icon: CheckCircle2,
      color: 'blue',
      description: 'Project quality management and metrics'
    },
    {
      id: 'quality-management',
      name: '6.3 Quality Management',
      icon: Shield,
      color: 'indigo',
      description: 'Quality audits and compliance'
    },
    {
      id: 'health-safety',
      name: '6.4 Health & Safety',
      icon: Shield,
      color: 'red',
      description: 'Workplace safety management'
    },
    {
      id: 'environmental',
      name: '6.5 Environmental',
      icon: Leaf,
      color: 'green',
      description: 'Environmental compliance and sustainability'
    },
    {
      id: 'energy',
      name: '6.6 Energy',
      icon: Zap,
      color: 'yellow',
      description: 'Energy efficiency and optimization'
    }
  ];

  const colorMap = {
    blue: 'bg-blue-500',
    indigo: 'bg-indigo-500',
    red: 'bg-red-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500'
  };

  if (loading) {
    return (
      <PageLayout>
        <MainHeader title="QHSE Interconnected System" subtitle="AI-Powered Cross-Module Intelligence" />
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading QHSE data...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <MainHeader 
        title="QHSE Interconnected System" 
        subtitle="AI-Powered Cross-Module Intelligence and Real-Time Recommendations"
      >
        <div className="flex items-center gap-2">
          {changeDetected && (
            <div className="flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium animate-pulse">
              <Activity className="w-4 h-4" />
              Change Detected
            </div>
          )}
          {isAnalyzing && (
            <div className="flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
              Analyzing...
            </div>
          )}
        </div>
      </MainHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Project Selection & Module Navigator */}
        <div className="lg:col-span-1 space-y-6">
          {/* Project Selector */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Project</h3>
            <select
              value={selectedProject?.projectNo || ''}
              onChange={(e) => {
                const project = allProjects.find(p => p.projectNo === e.target.value);
                setSelectedProject(project);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {allProjects.map(project => (
                <option key={project.projectNo} value={project.projectNo}>
                  {project.projectNo} - {project.projectTitle}
                </option>
              ))}
            </select>

            {selectedProject && (
              <div className="mt-4 space-y-2">
                <div className="text-sm">
                  <span className="text-gray-500">Client:</span>
                  <span className="ml-2 font-medium">{selectedProject.client}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-500">Manager:</span>
                  <span className="ml-2 font-medium">{selectedProject.projectManager}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-500">Completion:</span>
                  <span className="ml-2 font-medium">{selectedProject.projectCompletionPercent}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Module Navigator */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Network className="w-5 h-5 text-purple-600" />
              QHSE Modules
            </h3>
            <div className="space-y-2">
              {modules.map((module) => {
                const Icon = module.icon;
                const isAffected = isModuleAffected(module.id);
                const isActive = activeModule === module.id;

                return (
                  <button
                    key={module.id}
                    onClick={() => setActiveModule(module.id)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      isActive 
                        ? 'border-purple-500 bg-purple-50' 
                        : isAffected
                        ? 'border-orange-300 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${colorMap[module.color]} flex items-center justify-center`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 text-sm">{module.name}</div>
                        <div className="text-xs text-gray-600">{module.description}</div>
                      </div>
                      {isAffected && (
                        <div className="bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                          Impact
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* System Health Score */}
          {systemInsights && (
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
              <h3 className="text-lg font-semibold mb-4">System Health</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Overall</span>
                  <span className="text-2xl font-bold">{systemInsights.systemHealth.overall}%</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div 
                    className="bg-white rounded-full h-2 transition-all duration-500"
                    style={{ width: `${systemInsights.systemHealth.overall}%` }}
                  ></div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                  <div className="bg-white/10 rounded p-2">
                    <div className="text-white/70">Quality</div>
                    <div className="font-bold">{systemInsights.systemHealth.quality}%</div>
                  </div>
                  <div className="bg-white/10 rounded p-2">
                    <div className="text-white/70">Safety</div>
                    <div className="font-bold">{systemInsights.systemHealth.safety}%</div>
                  </div>
                  <div className="bg-white/10 rounded p-2">
                    <div className="text-white/70">Environmental</div>
                    <div className="font-bold">{systemInsights.systemHealth.environmental}%</div>
                  </div>
                  <div className="bg-white/10 rounded p-2">
                    <div className="text-white/70">Energy</div>
                    <div className="font-bold">{systemInsights.systemHealth.energy}%</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - AI Insights */}
        <div className="lg:col-span-2">
          <QHSEAIInsightsPanel 
            recommendations={recommendations}
            isAnalyzing={isAnalyzing}
            onRefresh={refreshAnalysis}
            compact={false}
          />

          {/* Priority Actions Summary */}
          {recommendations && (
            <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Next Steps & Priority Actions
              </h3>
              <div className="space-y-3">
                {getPriorityActions('high').slice(0, 5).map((action, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-200">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{action.action}</p>
                      {action.affectedModules && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {action.affectedModules.map((module, idx) => (
                            <span key={idx} className="text-xs bg-white text-gray-700 px-2 py-0.5 rounded border border-gray-300 capitalize">
                              {module.replace(/-/g, ' ')}
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

          {/* Interconnection Visualization */}
          <div className="mt-6 bg-gradient-to-br from-slate-50 to-gray-100 rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Module Interconnections</h3>
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-4">
                All QHSE modules are interconnected. Changes in one module automatically trigger
                AI analysis and generate recommendations for related modules.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {crossModuleImpacts.map((impact, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-cyan-50 rounded border border-cyan-200">
                    <AlertCircle className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                    <div className="text-xs">
                      <div className="font-medium text-gray-900 capitalize">
                        {impact.sourceModule} → {impact.targetModule}
                      </div>
                      <div className="text-gray-600">{impact.recommendations.length} recommendations</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Info */}
      <div className="mt-6 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 text-white">
        <h3 className="text-xl font-bold mb-3">🚀 Advanced AI Features Active</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <h4 className="font-semibold mb-2">✨ Real-Time Change Detection</h4>
            <p className="text-sm text-purple-100">
              AI automatically detects changes in project data and triggers analysis across all related modules
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <h4 className="font-semibold mb-2">🧠 Cross-Module Intelligence</h4>
            <p className="text-sm text-purple-100">
              Changes in Quality affect Safety, Environmental, and Energy modules with smart recommendations
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <h4 className="font-semibold mb-2">📚 RAG-Powered Insights</h4>
            <p className="text-sm text-purple-100">
              Recommendations based on ISO standards, industry best practices, and historical data analysis
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default QHSEInterconnectedDemo;
