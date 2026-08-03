/**
 * QHSE Cross-Module Intelligence Hook
 * Connects all QHSE modules with real-time AI insights and recommendations
 * Detects changes and propagates intelligence across modules
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { qhseAIService } from '../services/qhseAIService';
import { useQHSERunningProjects } from '../pages/QHSE/hooks/useQHSEProjects';

/**
 * Custom hook for QHSE module intelligence
 * @param {String} moduleId - Current module identifier
 * @param {Object} currentProject - Current project being viewed (optional)
 * @returns {Object} AI insights, recommendations, and utility functions
 */
export const useQHSEIntelligence = (moduleId, currentProject = null) => {
  const { data: allProjects, loading: projectsLoading } = useQHSERunningProjects();
  
  const [aiInsights, setAIInsights] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [crossModuleImpacts, setCrossModuleImpacts] = useState([]);
  const [systemInsights, setSystemInsights] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [changeDetected, setChangeDetected] = useState(false);
  
  const previousProjectRef = useRef(null);
  const analysisTimerRef = useRef(null);

  /**
   * Analyze current project and generate recommendations
   */
  const analyzeProject = useCallback(async (project) => {
    if (!project || projectsLoading) return;

    setIsAnalyzing(true);
    try {
      const result = await qhseAIService.generateRecommendations(
        project,
        moduleId,
        allProjects || []
      );
      
      setRecommendations(result);
      setCrossModuleImpacts(result.crossModuleImpacts);
      setAIInsights(result.insights);
    } catch (error) {
      console.error('Error analyzing project:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [moduleId, allProjects, projectsLoading]);

  /**
   * Detect and analyze project changes
   */
  const detectChanges = useCallback(async (newProject) => {
    if (!previousProjectRef.current || !newProject) {
      previousProjectRef.current = newProject;
      return;
    }

    const oldProject = previousProjectRef.current;
    
    try {
      const changeAnalysis = await qhseAIService.analyzeProjectChange(
        oldProject,
        newProject,
        moduleId
      );

      if (changeAnalysis.changes.length > 0) {
        setChangeDetected(true);
        
        // Trigger re-analysis after changes
        setTimeout(() => {
          analyzeProject(newProject);
          setChangeDetected(false);
        }, 1000);

        // Notify about urgent actions
        if (changeAnalysis.urgentActions.length > 0) {
          console.log('🚨 Urgent actions required:', changeAnalysis.urgentActions);
        }
      }

      previousProjectRef.current = newProject;
    } catch (error) {
      console.error('Error detecting changes:', error);
    }
  }, [moduleId, analyzeProject]);

  /**
   * Get system-wide insights
   */
  const getSystemInsights = useCallback(async () => {
    if (!allProjects || allProjects.length === 0) return;

    setIsAnalyzing(true);
    try {
      const insights = await qhseAIService.getSystemWideInsights(allProjects);
      setSystemInsights(insights);
    } catch (error) {
      console.error('Error getting system insights:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [allProjects]);

  /**
   * Get contextual help using RAG
   */
  const getContextualHelp = useCallback(async (query) => {
    try {
      const help = await qhseAIService.getRAGContextualHelp(query, moduleId);
      return help;
    } catch (error) {
      console.error('Error getting contextual help:', error);
      return null;
    }
  }, [moduleId]);

  /**
   * Get recommendations for a specific factor
   */
  const getFactorRecommendation = useCallback((factorKey) => {
    if (!recommendations) return null;

    const insight = recommendations.insights.find(i => i.factor === factorKey);
    return insight ? {
      level: insight.level,
      message: insight.message,
      impacts: insight.impacts,
      actions: recommendations.actionItems.filter(a => a.factor === factorKey)
    } : null;
  }, [recommendations]);

  /**
   * Get cross-module impact for specific module
   */
  const getCrossModuleImpact = useCallback((targetModuleId) => {
    return crossModuleImpacts.find(impact => impact.targetModule === targetModuleId);
  }, [crossModuleImpacts]);

  /**
   * Check if module is affected by current analysis
   */
  const isModuleAffected = useCallback((targetModuleId) => {
    return crossModuleImpacts.some(impact => impact.targetModule === targetModuleId);
  }, [crossModuleImpacts]);

  /**
   * Get priority action items
   */
  const getPriorityActions = useCallback((priority = 'high') => {
    if (!recommendations) return [];
    
    return recommendations.actionItems.filter(action => 
      action.priority === priority || action.priority === 'critical'
    );
  }, [recommendations]);

  /**
   * Get risk level indicator
   */
  const getRiskLevel = useCallback(() => {
    if (!recommendations) return { level: 'unknown', color: 'gray', score: 0 };

    const levelMap = {
      critical: { color: 'red', bgColor: 'bg-red-100', textColor: 'text-red-800', score: 25 },
      high: { color: 'orange', bgColor: 'bg-orange-100', textColor: 'text-orange-800', score: 50 },
      medium: { color: 'yellow', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800', score: 75 },
      low: { color: 'green', bgColor: 'bg-green-100', textColor: 'text-green-800', score: 90 }
    };

    return {
      level: recommendations.riskLevel,
      score: recommendations.overallScore,
      ...levelMap[recommendations.riskLevel]
    };
  }, [recommendations]);

  /**
   * Get AI confidence score
   */
  const getConfidenceScore = useCallback(() => {
    if (!recommendations) return 0;
    return Math.round(recommendations.aiMetadata.confidence * 100);
  }, [recommendations]);

  /**
   * Refresh analysis
   */
  const refreshAnalysis = useCallback(() => {
    if (currentProject) {
      analyzeProject(currentProject);
    }
    if (allProjects && allProjects.length > 0) {
      getSystemInsights();
    }
  }, [currentProject, allProjects, analyzeProject, getSystemInsights]);

  // Auto-analyze current project when it changes
  useEffect(() => {
    if (currentProject && !projectsLoading) {
      // Clear previous timer
      if (analysisTimerRef.current) {
        clearTimeout(analysisTimerRef.current);
      }

      // Debounce analysis
      analysisTimerRef.current = setTimeout(() => {
        analyzeProject(currentProject);
        detectChanges(currentProject);
      }, 500);
    }

    return () => {
      if (analysisTimerRef.current) {
        clearTimeout(analysisTimerRef.current);
      }
    };
  }, [currentProject, projectsLoading, analyzeProject, detectChanges]);

  // Get system insights on module load
  useEffect(() => {
    if (allProjects && allProjects.length > 0 && !systemInsights) {
      getSystemInsights();
    }
  }, [allProjects, systemInsights, getSystemInsights]);

  return {
    // State
    aiInsights,
    recommendations,
    crossModuleImpacts,
    systemInsights,
    isAnalyzing,
    changeDetected,
    
    // Analysis functions
    analyzeProject,
    getSystemInsights,
    getContextualHelp,
    refreshAnalysis,
    
    // Helper functions
    getFactorRecommendation,
    getCrossModuleImpact,
    isModuleAffected,
    getPriorityActions,
    getRiskLevel,
    getConfidenceScore,
    
    // Data
    allProjects: allProjects || [],
    projectsLoading
  };
};

export default useQHSEIntelligence;
