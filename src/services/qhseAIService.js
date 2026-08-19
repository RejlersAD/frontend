/**
 * QHSE AI Intelligence Service
 * Advanced AI-powered recommendation system with RAG capabilities
 * Provides cross-module insights and predictive analytics
 */

import QHSE_AI_CONFIG, { calculateAIConfidence } from '../config/qhseIntelligence.config';

class QHSEAIService {
  constructor() {
    this.config = QHSE_AI_CONFIG;
    this.cache = new Map();
    this.analysisHistory = [];
  }

  /**
   * Generate AI-powered recommendations for a project
   * @param {Object} project - Project data
   * @param {String} sourceModule - Module requesting recommendations
   * @param {Array} allProjects - All projects for pattern analysis
   * @returns {Promise<Object>} AI recommendations
   */
  async generateRecommendations(project, sourceModule, allProjects = []) {
    // Simulate AI processing time
    await this._simulateProcessing();

    const recommendations = {
      projectId: project.id || project.projectNo,
      projectName: project.projectTitle,
      sourceModule,
      timestamp: new Date().toISOString(),
      overallScore: 0,
      riskLevel: 'low',
      insights: [],
      crossModuleImpacts: [],
      actionItems: [],
      aiMetadata: {
        confidence: 0,
        analysisDepth: 'standard',
        dataQuality: this._assessDataQuality(project),
        ragSources: []
      }
    };

    // Analyze project against all rules
    const triggeredRules = this._evaluateRules(project, allProjects);
    
    // Get module-specific insights
    const moduleInsights = this._analyzeModule(project, sourceModule);
    
    // Generate cross-module impacts
    const crossModuleImpacts = this._analyzeCrossModuleImpacts(project, sourceModule);
    
    // Combine all insights
    recommendations.insights = [...moduleInsights, ...triggeredRules.map(r => r.aiInsight)];
    recommendations.crossModuleImpacts = crossModuleImpacts;
    recommendations.actionItems = this._generateActionItems(triggeredRules, moduleInsights);
    
    // Calculate overall scores
    recommendations.overallScore = this._calculateOverallScore(project, sourceModule);
    recommendations.riskLevel = this._assessRiskLevel(recommendations.overallScore, triggeredRules);
    
    // Calculate AI confidence
    const dataQuality = recommendations.aiMetadata.dataQuality;
    const historicalAccuracy = this._getHistoricalAccuracy();
    const contextRelevance = this._assessContextRelevance(project, sourceModule);
    recommendations.aiMetadata.confidence = calculateAIConfidence(
      dataQuality,
      historicalAccuracy,
      contextRelevance
    );
    
    // Add RAG sources
    recommendations.aiMetadata.ragSources = this._getRelevantRAGSources(sourceModule, triggeredRules);
    
    // Cache the result
    this._cacheRecommendation(project.projectNo, recommendations);
    
    return recommendations;
  }

  /**
   * Get real-time insights when project data changes
   * @param {Object} oldProject - Previous project state
   * @param {Object} newProject - New project state
   * @param {String} sourceModule - Module where change occurred
   * @returns {Promise<Object>} Change impact analysis
   */
  async analyzeProjectChange(oldProject, newProject, sourceModule) {
    await this._simulateProcessing(800); // Faster for real-time analysis

    const changes = this._detectChanges(oldProject, newProject);
    const impacts = {
      changes: changes,
      affectedModules: [],
      propagationNeeded: [],
      urgentActions: [],
      aiPredictions: [],
      confidence: 0
    };

    // Analyze each change
    for (const change of changes) {
      const changeImpact = this._assessChangeImpact(change, newProject, sourceModule);
      impacts.affectedModules.push(...changeImpact.affectedModules);
      impacts.propagationNeeded.push(...changeImpact.propagationNeeded);
      if (changeImpact.urgent) {
        impacts.urgentActions.push(changeImpact.urgentAction);
      }
    }

    // Generate AI predictions based on changes
    impacts.aiPredictions = this._generateChangePredictions(changes, newProject);
    
    // Calculate confidence in impact assessment
    impacts.confidence = calculateAIConfidence(0.85, 0.80, 0.90);

    return impacts;
  }

  /**
   * Get interconnected insights across all QHSE modules
   * @param {Array} allProjects - All project data
   * @returns {Promise<Object>} System-wide insights
   */
  async getSystemWideInsights(allProjects) {
    await this._simulateProcessing(1500);

    const insights = {
      timestamp: new Date().toISOString(),
      totalProjects: allProjects.length,
      systemHealth: {
        quality: 0,
        safety: 0,
        environmental: 0,
        energy: 0,
        overall: 0
      },
      patterns: [],
      correlations: [],
      predictions: [],
      strategicRecommendations: [],
      aiMetadata: {
        confidence: 0,
        analysisType: 'comprehensive',
        dataPoints: allProjects.length
      }
    };

    // Calculate system health scores
    insights.systemHealth = this._calculateSystemHealth(allProjects);
    
    // Detect patterns across projects
    insights.patterns = this._detectSystemPatterns(allProjects);
    
    // Find correlations between modules
    insights.correlations = this._findModuleCorrelations(allProjects);
    
    // Generate predictive insights
    insights.predictions = this._generatePredictiveInsights(allProjects);
    
    // Strategic recommendations
    insights.strategicRecommendations = this._generateStrategicRecommendations(insights);
    
    // Calculate confidence
    insights.aiMetadata.confidence = calculateAIConfidence(0.88, 0.85, 0.92);

    return insights;
  }

  /**
   * Get RAG-enhanced contextual help
   * @param {String} query - User query or context
   * @param {String} moduleContext - Current module
   * @returns {Promise<Object>} RAG response with sources
   */
  async getRAGContextualHelp(query, moduleContext) {
    await this._simulateProcessing(1000);

    const response = {
      query: query,
      answer: '',
      sources: [],
      relevantStandards: [],
      bestPractices: [],
      confidence: 0
    };

    // Match query to knowledge vectors
    const ragData = this.config.ragKnowledgeVectors;
    response.relevantStandards = this._matchStandards(query, moduleContext, ragData);
    response.bestPractices = this._matchBestPractices(query, ragData);
    
    // Generate AI answer based on RAG sources
    response.answer = this._generateRAGAnswer(query, moduleContext, response.relevantStandards);
    response.sources = [...response.relevantStandards, ...response.bestPractices];
    
    // Calculate confidence
    response.confidence = calculateAIConfidence(0.90, 0.87, 0.85);

    return response;
  }

  // ========== Private Helper Methods ==========

  _simulateProcessing(time = null) {
    const delay = time || this.config.aiSimulation.responseTime;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  _evaluateRules(project, allProjects) {
    return this.config.recommendationRules.filter(rule => {
      try {
        return rule.condition(project, allProjects);
      } catch (error) {
        console.warn('Rule evaluation error:', error);
        return false;
      }
    });
  }

  _analyzeModule(project, moduleId) {
    const moduleKB = this.config.knowledgeBase[moduleId];
    if (!moduleKB) return [];

    const insights = [];
    const factors = moduleKB.factors;

    for (const [factorKey, factorConfig] of Object.entries(factors)) {
      const value = this._getProjectValue(project, factorKey);
      const assessment = this._assessFactor(value, factorConfig.threshold);
      
      if (assessment.level !== 'good') {
        insights.push({
          factor: factorKey,
          value: value,
          level: assessment.level,
          message: factorConfig.recommendations[assessment.level],
          impacts: factorConfig.impacts,
          weight: factorConfig.weight
        });
      }
    }

    return insights;
  }

  _analyzeCrossModuleImpacts(project, sourceModule) {
    const moduleConfig = this.config.moduleConnections[sourceModule];
    if (!moduleConfig) return [];

    const impacts = [];
    const moduleKB = this.config.knowledgeBase[sourceModule];

    if (moduleKB && moduleKB.crossModuleRecommendations) {
      for (const [targetModule, recommendations] of Object.entries(moduleKB.crossModuleRecommendations)) {
        impacts.push({
          sourceModule: sourceModule,
          targetModule: targetModule,
          recommendations: recommendations,
          priority: this._calculateImpactPriority(project, sourceModule, targetModule)
        });
      }
    }

    return impacts;
  }

  _generateActionItems(triggeredRules, moduleInsights) {
    const actions = [];
    
    // From triggered rules
    triggeredRules.forEach(rule => {
      rule.actions.forEach(action => {
        actions.push({
          priority: rule.priority,
          action: action,
          source: 'rule',
          ruleId: rule.id,
          affectedModules: rule.affectedModules
        });
      });
    });

    // From module insights
    moduleInsights.forEach(insight => {
      if (insight.level === 'critical') {
        actions.push({
          priority: 'high',
          action: `Address ${insight.factor}: ${insight.message}`,
          source: 'insight',
          factor: insight.factor,
          impacts: insight.impacts
        });
      }
    });

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return actions.slice(0, 10); // Return top 10 actions
  }

  _calculateOverallScore(project, moduleId) {
    const moduleKB = this.config.knowledgeBase[moduleId];
    if (!moduleKB) return 75; // Default score

    let weightedScore = 0;
    let totalWeight = 0;

    for (const [factorKey, factorConfig] of Object.entries(moduleKB.factors)) {
      const value = this._getProjectValue(project, factorKey);
      const factorScore = this._calculateFactorScore(value, factorConfig.threshold);
      weightedScore += factorScore * factorConfig.weight;
      totalWeight += factorConfig.weight;
    }

    return Math.round(weightedScore / totalWeight);
  }

  _assessRiskLevel(score, triggeredRules) {
    const criticalRules = triggeredRules.filter(r => r.priority === 'critical' || r.priority === 'high');
    
    if (score < 60 || criticalRules.length > 2) return 'critical';
    if (score < 75 || criticalRules.length > 0) return 'high';
    if (score < 85) return 'medium';
    return 'low';
  }

  _assessDataQuality(project) {
    let filledFields = 0;
    let totalFields = 0;

    for (const value of Object.values(project)) {
      totalFields++;
      if (value !== null && value !== undefined && value !== '' && value !== 'N/A') {
        filledFields++;
      }
    }

    return filledFields / totalFields;
  }

  _getHistoricalAccuracy() {
    // Simulate historical prediction accuracy
    if (this.analysisHistory.length < 10) return 0.75;
    
    const recentAnalyses = this.analysisHistory.slice(-20);
    const avgAccuracy = recentAnalyses.reduce((sum, a) => sum + (a.accuracy || 0.80), 0) / recentAnalyses.length;
    return avgAccuracy;
  }

  _assessContextRelevance(project, moduleId) {
    const moduleConfig = this.config.moduleConnections[moduleId];
    if (!moduleConfig) return 0.70;

    // Check if project has relevant data for this module
    const relevantFields = this._getModuleRelevantFields(moduleId);
    const filledRelevant = relevantFields.filter(field => {
      const value = project[field];
      return value !== null && value !== undefined && value !== '' && value !== 'N/A';
    }).length;

    return filledRelevant / relevantFields.length;
  }

  _getRelevantRAGSources(moduleId, triggeredRules) {
    const sources = [];
    const ragData = this.config.ragKnowledgeVectors;

    // Add module-specific standards
    if (moduleId.includes('quality')) {
      sources.push(...ragData.qualityStandards.slice(0, 3));
    }
    if (moduleId.includes('safety') || moduleId.includes('health')) {
      sources.push(...ragData.safetyStandards.slice(0, 3));
    }
    if (moduleId.includes('environmental')) {
      sources.push(...ragData.environmentalStandards.slice(0, 3));
    }
    if (moduleId.includes('energy')) {
      sources.push(...ragData.energyStandards.slice(0, 3));
    }

    // Add best practices
    sources.push(...ragData.bestPractices.slice(0, 2));

    return [...new Set(sources)]; // Remove duplicates
  }

  _detectChanges(oldProject, newProject) {
    const changes = [];
    const significantFields = [
      'carsOpen', 'carsClosed', 'obsOpen', 'obsClosed',
      'projectKPIsAchievedPercent', 'projectCompletionPercent',
      'manhoursBalance', 'delayInAuditsNoDays'
    ];

    for (const field of significantFields) {
      if (oldProject[field] !== newProject[field]) {
        changes.push({
          field: field,
          oldValue: oldProject[field],
          newValue: newProject[field],
          changeType: this._classifyChange(field, oldProject[field], newProject[field])
        });
      }
    }

    return changes;
  }

  _assessChangeImpact(change, project, sourceModule) {
    const impact = {
      affectedModules: [sourceModule],
      propagationNeeded: [],
      urgent: false,
      urgentAction: null
    };

    // Determine affected modules based on change type
    if (change.field === 'carsOpen' && change.newValue > change.oldValue) {
      impact.affectedModules.push('quality-management', 'health-safety');
      impact.urgent = change.newValue > 5;
      impact.urgentAction = 'High CAR count detected - immediate review required';
    }

    if (change.field === 'projectKPIsAchievedPercent' && change.newValue < 70) {
      impact.affectedModules.push('quality-management', 'environmental');
      impact.urgent = true;
      impact.urgentAction = 'Critical KPI drop - investigate root cause';
    }

    // Determine what needs to be updated in other modules
    impact.propagationNeeded = impact.affectedModules.map(module => ({
      module: module,
      updateType: 'dashboard-refresh',
      reason: `${change.field} changed from ${change.oldValue} to ${change.newValue}`
    }));

    return impact;
  }

  _generateChangePredictions(changes, project) {
    const predictions = [];

    changes.forEach(change => {
      if (change.field === 'carsOpen' && change.changeType === 'increased') {
        predictions.push({
          type: 'trend',
          message: 'Increasing CAR trend detected. Predict 2-3 more CARs in next 30 days if not addressed',
          confidence: 0.78,
          timeframe: '30 days'
        });
      }

      if (change.field === 'manhoursBalance' && parseFloat(change.newValue) < 100) {
        predictions.push({
          type: 'resource-shortage',
          message: 'Manhours depletion predicted within 45 days at current burn rate',
          confidence: 0.85,
          timeframe: '45 days'
        });
      }
    });

    return predictions;
  }

  _calculateSystemHealth(allProjects) {
    const health = {
      quality: 0,
      safety: 0,
      environmental: 0,
      energy: 0,
      overall: 0
    };

    // Calculate average scores across all projects
    const totalProjects = allProjects.length;
    
    allProjects.forEach(project => {
      health.quality += this._calculateQualityHealth(project);
      health.safety += this._calculateSafetyHealth(project);
      health.environmental += this._calculateEnvironmentalHealth(project);
      health.energy += this._calculateEnergyHealth(project);
    });

    health.quality = Math.round(health.quality / totalProjects);
    health.safety = Math.round(health.safety / totalProjects);
    health.environmental = Math.round(health.environmental / totalProjects);
    health.energy = Math.round(health.energy / totalProjects);
    health.overall = Math.round(
      (health.quality + health.safety + health.environmental + health.energy) / 4
    );

    return health;
  }

  _detectSystemPatterns(allProjects) {
    const patterns = [];

    // Pattern: High CAR concentration
    const highCARProjects = allProjects.filter(p => p.carsOpen > 3).length;
    if (highCARProjects > allProjects.length * 0.25) {
      patterns.push({
        type: 'quality-degradation',
        severity: 'high',
        message: `${highCARProjects} projects (${Math.round(highCARProjects/allProjects.length*100)}%) have high open CARs`,
        recommendation: 'Conduct organization-wide quality review and process audit'
      });
    }

    // Pattern: Audit delays
    const delayedAudits = allProjects.filter(p => p.delayInAuditsNoDays > 7).length;
    if (delayedAudits > allProjects.length * 0.20) {
      patterns.push({
        type: 'audit-scheduling',
        severity: 'medium',
        message: `${delayedAudits} projects have delayed audits`,
        recommendation: 'Review audit resource allocation and scheduling process'
      });
    }

    // Pattern: Resource constraints
    const lowManhours = allProjects.filter(p => p.manhoursBalance < 100).length;
    if (lowManhours > allProjects.length * 0.30) {
      patterns.push({
        type: 'resource-constraint',
        severity: 'high',
        message: `${lowManhours} projects facing manhours shortage`,
        recommendation: 'Evaluate overall resource allocation and prioritization'
      });
    }

    return patterns;
  }

  _findModuleCorrelations(allProjects) {
    const correlations = [];

    // Correlation: Quality KPIs vs Safety Performance
    const lowKPI = allProjects.filter(p => parseFloat(p.projectKPIsAchievedPercent) < 70);
    const withSafetyIssues = lowKPI.filter(p => p.carsOpen > 3);
    
    if (withSafetyIssues.length > lowKPI.length * 0.5) {
      correlations.push({
        modules: ['project-quality', 'health-safety'],
        strength: 'strong',
        correlation: 'positive',
        message: 'Strong correlation: Low quality KPIs associated with increased safety risks',
        confidence: 0.82
      });
    }

    // Correlation: Project completion vs Documentation quality
    const nearComplete = allProjects.filter(p => parseFloat(p.projectCompletionPercent) > 85);
    const withOpenCARs = nearComplete.filter(p => p.carsOpen > 0);
    
    if (withOpenCARs.length > nearComplete.length * 0.4) {
      correlations.push({
        modules: ['project-quality', 'quality-management'],
        strength: 'moderate',
        correlation: 'positive',
        message: 'Projects nearing completion still have open quality issues',
        confidence: 0.75
      });
    }

    return correlations;
  }

  _generatePredictiveInsights(allProjects) {
    const insights = [];

    // Predict projects at risk
    const atRiskProjects = allProjects.filter(p => {
      const lowKPI = parseFloat(p.projectKPIsAchievedPercent) < 75;
      const highCARs = p.carsOpen > 3;
      const lowManhours = p.manhoursBalance < 50;
      return (lowKPI && highCARs) || (lowKPI && lowManhours) || (highCARs && lowManhours);
    });

    if (atRiskProjects.length > 0) {
      insights.push({
        type: 'risk-prediction',
        severity: 'high',
        message: `${atRiskProjects.length} projects predicted to face delivery challenges`,
        projects: atRiskProjects.map(p => p.projectNo),
        confidence: 0.84,
        timeframe: '60-90 days'
      });
    }

    // Predict resource needs
    const avgManhoursUsage = allProjects.reduce((sum, p) => 
      sum + (parseFloat(p.manhoursUsed) || 0), 0) / allProjects.length;
    
    insights.push({
      type: 'resource-forecast',
      severity: 'medium',
      message: `Average manhours usage trending at ${Math.round(avgManhoursUsage)} per project`,
      recommendation: `Plan for ${Math.round(avgManhoursUsage * 1.2)} manhours per new project`,
      confidence: 0.79
    });

    return insights;
  }

  _generateStrategicRecommendations(insights) {
    const recommendations = [];

    if (insights.systemHealth.overall < 75) {
      recommendations.push({
        priority: 'critical',
        category: 'system-improvement',
        recommendation: 'Implement comprehensive QHSE improvement program',
        expectedImpact: 'Improve overall system health by 15-20%',
        timeline: '3-6 months'
      });
    }

    if (insights.patterns.some(p => p.type === 'quality-degradation')) {
      recommendations.push({
        priority: 'high',
        category: 'quality-management',
        recommendation: 'Conduct root cause analysis and update quality procedures',
        expectedImpact: 'Reduce open CARs by 30-40%',
        timeline: '2-3 months'
      });
    }

    if (insights.correlations.some(c => c.modules.includes('health-safety'))) {
      recommendations.push({
        priority: 'high',
        category: 'integrated-management',
        recommendation: 'Implement integrated quality-safety management approach',
        expectedImpact: 'Improve cross-module coordination and reduce incidents',
        timeline: '4-6 months'
      });
    }

    return recommendations;
  }

  // Helper methods for calculations
  _getProjectValue(project, factorKey) {
    const mapping = {
      'cars_open': 'carsOpen',
      'quality_kpi': 'projectKPIsAchievedPercent',
      'audit_delays': 'delayInAuditsNoDays',
      'manhours_balance': 'manhoursBalance',
      'project_completion': 'projectCompletionPercent'
    };

    const projectKey = mapping[factorKey] || factorKey;
    let value = project[projectKey];

    // Parse percentages
    if (typeof value === 'string' && value.includes('%')) {
      value = parseFloat(value.replace('%', ''));
    }

    return value || 0;
  }

  _assessFactor(value, threshold) {
    // Handle reversed thresholds (higher is worse, like for delays)
    if (threshold.critical < threshold.good) {
      if (value >= threshold.critical) return { level: 'critical', score: 30 };
      if (value >= threshold.warning) return { level: 'warning', score: 60 };
      return { level: 'good', score: 90 };
    } else {
      // Normal thresholds (higher is better)
      if (value <= threshold.critical) return { level: 'critical', score: 30 };
      if (value <= threshold.warning) return { level: 'warning', score: 60 };
      return { level: 'good', score: 90 };
    }
  }

  _calculateFactorScore(value, threshold) {
    const assessment = this._assessFactor(value, threshold);
    return assessment.score;
  }

  _calculateImpactPriority(project, sourceModule, targetModule) {
    // Calculate based on project risk and module connection strength
    const projectRisk = this._calculateOverallScore(project, sourceModule);
    
    if (projectRisk < 60) return 'high';
    if (projectRisk < 75) return 'medium';
    return 'low';
  }

  _getModuleRelevantFields(moduleId) {
    const fieldMapping = {
      'project-quality': ['carsOpen', 'obsOpen', 'projectKPIsAchievedPercent', 'manhoursBalance'],
      'quality-management': ['carsOpen', 'carsClosed', 'delayInAuditsNoDays'],
      'health-safety': ['carsOpen', 'obsOpen'],
      'environmental': ['projectKPIsAchievedPercent'],
      'energy': ['projectKPIsAchievedPercent']
    };

    return fieldMapping[moduleId] || [];
  }

  _classifyChange(field, oldValue, newValue) {
    const numOld = parseFloat(oldValue) || 0;
    const numNew = parseFloat(newValue) || 0;

    if (numNew > numOld) return 'increased';
    if (numNew < numOld) return 'decreased';
    return 'unchanged';
  }

  _calculateQualityHealth(project) {
    const kpi = parseFloat(project.projectKPIsAchievedPercent) || 0;
    const carsScore = Math.max(0, 100 - (project.carsOpen * 10));
    const obsScore = Math.max(0, 100 - (project.obsOpen * 5));
    return (kpi + carsScore + obsScore) / 3;
  }

  _calculateSafetyHealth(project) {
    const carsScore = Math.max(0, 100 - (project.carsOpen * 10));
    const obsScore = Math.max(0, 100 - (project.obsOpen * 5));
    return (carsScore + obsScore) / 2;
  }

  _calculateEnvironmentalHealth(project) {
    const kpi = parseFloat(project.projectKPIsAchievedPercent) || 70;
    return kpi;
  }

  _calculateEnergyHealth(project) {
    const kpi = parseFloat(project.projectKPIsAchievedPercent) || 70;
    return kpi;
  }

  _matchStandards(query, moduleContext, ragData) {
    const standards = [];
    const queryLower = query.toLowerCase();

    if (moduleContext.includes('quality') || queryLower.includes('quality') || queryLower.includes('audit')) {
      standards.push(...ragData.qualityStandards.slice(0, 2));
    }
    if (moduleContext.includes('safety') || queryLower.includes('safety') || queryLower.includes('health')) {
      standards.push(...ragData.safetyStandards.slice(0, 2));
    }
    if (moduleContext.includes('environmental') || queryLower.includes('environment') || queryLower.includes('carbon')) {
      standards.push(...ragData.environmentalStandards.slice(0, 2));
    }
    if (moduleContext.includes('energy') || queryLower.includes('energy')) {
      standards.push(...ragData.energyStandards.slice(0, 2));
    }

    return [...new Set(standards)];
  }

  _matchBestPractices(query, ragData) {
    return ragData.bestPractices.slice(0, 2);
  }

  _generateRAGAnswer(query, moduleContext, standards) {
    // Simplified RAG answer generation
    return `Based on ${standards.join(', ')} and industry best practices, the recommended approach for "${query}" in ${moduleContext} context involves implementing structured processes aligned with international standards. This ensures compliance, efficiency, and continuous improvement. Specific guidance should be obtained from the referenced standards documentation.`;
  }

  _cacheRecommendation(projectNo, recommendations) {
    this.cache.set(projectNo, {
      recommendations,
      timestamp: Date.now(),
      ttl: 5 * 60 * 1000 // 5 minutes
    });

    // Store in history
    this.analysisHistory.push({
      projectNo,
      timestamp: Date.now(),
      score: recommendations.overallScore,
      accuracy: 0.80 // Default accuracy, would be updated based on feedback
    });

    // Keep only last 100 analyses
    if (this.analysisHistory.length > 100) {
      this.analysisHistory = this.analysisHistory.slice(-100);
    }
  }
}

// Export singleton instance
export const qhseAIService = new QHSEAIService();
export default qhseAIService;
