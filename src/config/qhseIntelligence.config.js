/**
 * QHSE AI Intelligence Configuration
 * Soft-coded knowledge base and recommendation system
 * Interconnects all 6 QHSE modules with advanced AI and RAG
 */

export const QHSE_AI_CONFIG = {
  // Module interconnections mapping
  moduleConnections: {
    'project-quality': {
      id: 'project-quality',
      name: 'Project Quality',
      impacts: ['quality-management', 'health-safety', 'environmental', 'energy'],
      triggers: ['project_created', 'project_updated', 'project_deleted', 'manhours_changed', 'kpi_changed']
    },
    'quality-management': {
      id: 'quality-management',
      name: 'Quality Management',
      impacts: ['project-quality', 'health-safety'],
      triggers: ['audit_scheduled', 'cars_opened', 'cars_closed', 'compliance_changed']
    },
    'health-safety': {
      id: 'health-safety',
      name: 'Health & Safety',
      impacts: ['project-quality', 'quality-management', 'environmental'],
      triggers: ['incident_reported', 'safety_audit', 'ppe_compliance', 'risk_assessment']
    },
    'environmental': {
      id: 'environmental',
      name: 'Environmental',
      impacts: ['project-quality', 'energy', 'health-safety'],
      triggers: ['carbon_emission_change', 'waste_generated', 'compliance_check', 'sustainability_goal']
    },
    'energy': {
      id: 'energy',
      name: 'Energy',
      impacts: ['environmental', 'project-quality'],
      triggers: ['consumption_spike', 'efficiency_improvement', 'renewable_adoption', 'cost_optimization']
    }
  },

  // AI Knowledge Base for each module
  knowledgeBase: {
    'project-quality': {
      // Quality metrics impact factors
      factors: {
        cars_open: {
          weight: 0.3,
          threshold: { critical: 5, warning: 3, good: 1 },
          impacts: ['quality-score', 'project-health', 'audit-readiness'],
          recommendations: {
            critical: 'Immediate action required: High number of open CARs may delay project closure',
            warning: 'Multiple open CARs detected. Schedule resolution review meeting',
            good: 'Good management of corrective actions'
          }
        },
        quality_kpi: {
          weight: 0.25,
          threshold: { critical: 60, warning: 75, good: 85 },
          impacts: ['project-success', 'client-satisfaction'],
          recommendations: {
            critical: 'Critical: Quality KPIs below acceptable threshold. Implement improvement plan',
            warning: 'KPIs trending below target. Review quality processes',
            good: 'Quality KPIs meet or exceed targets'
          }
        },
        audit_delays: {
          weight: 0.2,
          threshold: { critical: 14, warning: 7, good: 0 },
          impacts: ['compliance', 'project-schedule'],
          recommendations: {
            critical: 'Critical delay in audits. Reschedule immediately and assess impact',
            warning: 'Audit delays detected. Coordinate with audit team',
            good: 'All audits conducted on schedule'
          }
        },
        manhours_balance: {
          weight: 0.15,
          threshold: { critical: 10, warning: 20, good: 30 },
          impacts: ['resource-planning', 'budget-management'],
          recommendations: {
            critical: 'Critical: Low manhours balance. Request additional allocation',
            warning: 'Manhours running low. Monitor closely and plan allocation',
            good: 'Adequate manhours balance for quality activities'
          }
        },
        project_completion: {
          weight: 0.1,
          threshold: { critical: 100, warning: 85, good: 70 },
          impacts: ['delivery-timeline', 'closure-readiness'],
          recommendations: {
            critical: 'Project nearing completion. Initiate closure checklist',
            warning: 'Project in final stages. Begin closure preparations',
            good: 'Project on track for successful completion'
          }
        }
      },

      // Cross-module recommendations
      crossModuleRecommendations: {
        'quality-management': [
          'Schedule quality audits based on project phase',
          'Implement continuous improvement initiatives',
          'Track non-conformances across all projects'
        ],
        'health-safety': [
          'Ensure safety protocols align with quality standards',
          'Coordinate safety inspections with quality audits',
          'Link safety incidents to quality impact assessment'
        ],
        'environmental': [
          'Monitor environmental compliance as part of quality metrics',
          'Track carbon footprint in project quality reports',
          'Integrate sustainability goals with quality objectives'
        ],
        'energy': [
          'Include energy efficiency in quality KPIs',
          'Monitor energy consumption patterns for optimization',
          'Link renewable energy adoption to project quality'
        ]
      }
    },

    'quality-management': {
      factors: {
        audit_completion_rate: {
          weight: 0.35,
          threshold: { critical: 60, warning: 80, good: 95 },
          impacts: ['compliance-status', 'certification-readiness'],
          recommendations: {
            critical: 'Low audit completion rate. Review and accelerate audit schedule',
            warning: 'Audit completion needs improvement. Allocate resources',
            good: 'Strong audit completion performance'
          }
        },
        nc_closure_rate: {
          weight: 0.3,
          threshold: { critical: 50, warning: 70, good: 85 },
          impacts: ['quality-performance', 'process-improvement'],
          recommendations: {
            critical: 'Many non-conformances remain open. Prioritize closure actions',
            warning: 'NC closure rate below target. Expedite corrective actions',
            good: 'Effective NC management and closure process'
          }
        },
        compliance_score: {
          weight: 0.25,
          threshold: { critical: 70, warning: 85, good: 95 },
          impacts: ['regulatory-compliance', 'audit-readiness'],
          recommendations: {
            critical: 'Compliance gaps identified. Immediate remediation required',
            warning: 'Compliance score needs improvement. Review procedures',
            good: 'High compliance standards maintained'
          }
        },
        documentation_quality: {
          weight: 0.1,
          threshold: { critical: 60, warning: 75, good: 90 },
          impacts: ['audit-success', 'knowledge-management'],
          recommendations: {
            critical: 'Documentation gaps affecting compliance. Update immediately',
            warning: 'Improve documentation quality and completeness',
            good: 'Comprehensive documentation maintained'
          }
        }
      },
      
      crossModuleRecommendations: {
        'project-quality': [
          'Align project quality plans with organizational standards',
          'Use audit findings to improve project processes',
          'Track quality metrics across all active projects'
        ],
        'health-safety': [
          'Integrate safety audits with quality management system',
          'Cross-reference safety incidents with quality non-conformances',
          'Unified reporting for quality and safety compliance'
        ]
      }
    },

    'health-safety': {
      factors: {
        incident_frequency: {
          weight: 0.35,
          threshold: { critical: 5, warning: 2, good: 0 },
          impacts: ['safety-performance', 'project-reputation'],
          recommendations: {
            critical: 'High incident frequency. Conduct urgent safety review',
            warning: 'Multiple incidents detected. Enhance safety protocols',
            good: 'Zero or minimal incidents. Maintain safety standards'
          }
        },
        safety_training_compliance: {
          weight: 0.25,
          threshold: { critical: 70, warning: 85, good: 95 },
          impacts: ['workforce-readiness', 'regulatory-compliance'],
          recommendations: {
            critical: 'Critical training gaps. Schedule mandatory safety training',
            warning: 'Training compliance below target. Plan training sessions',
            good: 'Strong safety training compliance'
          }
        },
        ppe_compliance: {
          weight: 0.2,
          threshold: { critical: 75, warning: 90, good: 98 },
          impacts: ['worker-safety', 'incident-prevention'],
          recommendations: {
            critical: 'Low PPE compliance. Enforce PPE requirements immediately',
            warning: 'PPE compliance needs improvement. Conduct awareness program',
            good: 'Excellent PPE compliance across workforce'
          }
        },
        risk_assessment_coverage: {
          weight: 0.2,
          threshold: { critical: 60, warning: 80, good: 95 },
          impacts: ['hazard-management', 'prevention-effectiveness'],
          recommendations: {
            critical: 'Many activities lack risk assessment. Complete assessments urgently',
            warning: 'Improve risk assessment coverage for all activities',
            good: 'Comprehensive risk assessment program in place'
          }
        }
      },

      crossModuleRecommendations: {
        'project-quality': [
          'Link safety performance to project quality metrics',
          'Include safety audit findings in project reviews',
          'Track safety manhours alongside quality manhours'
        ],
        'quality-management': [
          'Integrate safety management with quality system',
          'Use QMS tools for safety process improvement',
          'Align safety and quality audit schedules'
        ],
        'environmental': [
          'Monitor environmental health impacts',
          'Coordinate hazardous waste management',
          'Link environmental hazards to safety risks'
        ]
      }
    },

    'environmental': {
      factors: {
        carbon_footprint: {
          weight: 0.3,
          threshold: { critical: 1000, warning: 500, good: 250 }, // tons CO2e
          impacts: ['sustainability-goals', 'climate-impact'],
          recommendations: {
            critical: 'High carbon emissions. Implement reduction strategies urgently',
            warning: 'Carbon footprint above target. Review reduction opportunities',
            good: 'Carbon emissions within sustainable targets'
          }
        },
        waste_management_score: {
          weight: 0.25,
          threshold: { critical: 60, warning: 75, good: 90 },
          impacts: ['environmental-compliance', 'circular-economy'],
          recommendations: {
            critical: 'Poor waste management. Improve segregation and recycling',
            warning: 'Enhance waste management practices and reporting',
            good: 'Effective waste management and recycling program'
          }
        },
        water_conservation: {
          weight: 0.2,
          threshold: { critical: 50, warning: 70, good: 85 },
          impacts: ['resource-efficiency', 'sustainability'],
          recommendations: {
            critical: 'Water usage inefficient. Implement conservation measures',
            warning: 'Improve water management and reduce consumption',
            good: 'Strong water conservation practices'
          }
        },
        biodiversity_impact: {
          weight: 0.15,
          threshold: { critical: 30, warning: 50, good: 80 },
          impacts: ['ecological-balance', 'regulatory-compliance'],
          recommendations: {
            critical: 'Significant biodiversity impact. Implement mitigation plan',
            warning: 'Monitor and minimize impact on local ecosystems',
            good: 'Minimal biodiversity impact with protective measures'
          }
        },
        compliance_status: {
          weight: 0.1,
          threshold: { critical: 70, warning: 85, good: 95 },
          impacts: ['regulatory-adherence', 'permit-requirements'],
          recommendations: {
            critical: 'Environmental compliance gaps. Remediate immediately',
            warning: 'Improve compliance with environmental regulations',
            good: 'Full environmental compliance maintained'
          }
        }
      },

      crossModuleRecommendations: {
        'project-quality': [
          'Include environmental metrics in project quality reports',
          'Track environmental KPIs alongside quality KPIs',
          'Link environmental incidents to project quality impact'
        ],
        'energy': [
          'Coordinate renewable energy adoption for carbon reduction',
          'Align energy efficiency with environmental goals',
          'Track energy-related carbon emissions'
        ],
        'health-safety': [
          'Monitor environmental health hazards',
          'Coordinate hazardous material management',
          'Link environmental risks to safety protocols'
        ]
      }
    },

    'energy': {
      factors: {
        energy_efficiency: {
          weight: 0.3,
          threshold: { critical: 60, warning: 75, good: 85 },
          impacts: ['operational-cost', 'carbon-footprint'],
          recommendations: {
            critical: 'Low energy efficiency. Implement optimization measures',
            warning: 'Energy efficiency below target. Identify improvement areas',
            good: 'Strong energy efficiency performance'
          }
        },
        renewable_percentage: {
          weight: 0.25,
          threshold: { critical: 20, warning: 40, good: 60 },
          impacts: ['sustainability-goals', 'carbon-neutrality'],
          recommendations: {
            critical: 'Low renewable energy usage. Accelerate green energy adoption',
            warning: 'Increase renewable energy portfolio',
            good: 'Strong renewable energy adoption'
          }
        },
        peak_demand_management: {
          weight: 0.2,
          threshold: { critical: 80, warning: 65, good: 50 },
          impacts: ['cost-optimization', 'grid-stability'],
          recommendations: {
            critical: 'High peak demand. Implement load shifting strategies',
            warning: 'Optimize peak demand through smart scheduling',
            good: 'Effective peak demand management'
          }
        },
        energy_cost_per_unit: {
          weight: 0.15,
          threshold: { critical: 0.15, warning: 0.12, good: 0.09 }, // USD per kWh
          impacts: ['budget-efficiency', 'roi'],
          recommendations: {
            critical: 'High energy costs. Review contracts and optimize consumption',
            warning: 'Energy costs above industry average. Seek optimization',
            good: 'Competitive energy costs maintained'
          }
        },
        smart_technology_adoption: {
          weight: 0.1,
          threshold: { critical: 30, warning: 50, good: 70 },
          impacts: ['automation-level', 'monitoring-capability'],
          recommendations: {
            critical: 'Low smart technology adoption. Invest in monitoring systems',
            warning: 'Increase smart energy management technology',
            good: 'Strong smart technology deployment'
          }
        }
      },

      crossModuleRecommendations: {
        'environmental': [
          'Align energy strategy with carbon reduction targets',
          'Track energy-related environmental impact',
          'Coordinate renewable energy with sustainability goals'
        ],
        'project-quality': [
          'Include energy efficiency in project specifications',
          'Monitor energy consumption by project',
          'Link energy performance to project quality metrics'
        ]
      }
    }
  },

  // AI Recommendation Engine Rules
  recommendationRules: [
    {
      id: 'high-cars-safety-risk',
      condition: (project) => project.carsOpen > 3,
      priority: 'high',
      affectedModules: ['project-quality', 'quality-management', 'health-safety'],
      message: 'High number of open CARs may indicate safety risks',
      actions: [
        'Review recent incident reports for correlation',
        'Schedule safety audit',
        'Prioritize CAR closure for safety-related items'
      ],
      aiInsight: 'Pattern analysis suggests correlation between open CARs and safety incidents in similar projects'
    },
    {
      id: 'low-kpi-environmental-impact',
      condition: (project) => parseFloat(project.projectKPIsAchievedPercent) < 70,
      priority: 'medium',
      affectedModules: ['project-quality', 'environmental'],
      message: 'Low quality KPIs may impact environmental compliance',
      actions: [
        'Review environmental monitoring procedures',
        'Check waste management compliance',
        'Verify environmental permits and documentation'
      ],
      aiInsight: 'Historical data shows projects with low KPIs have 35% higher environmental non-conformances'
    },
    {
      id: 'manhours-depletion-risk',
      condition: (project) => project.manhoursBalance < 50 && parseFloat(project.projectCompletionPercent) < 80,
      priority: 'high',
      affectedModules: ['project-quality', 'quality-management'],
      message: 'Manhours depleting before project completion',
      actions: [
        'Request additional manhours allocation',
        'Prioritize critical quality activities',
        'Review resource utilization efficiency'
      ],
      aiInsight: 'AI predicts project may require additional 20-30% manhours based on completion trajectory'
    },
    {
      id: 'audit-delay-compliance-risk',
      condition: (project) => project.delayInAuditsNoDays > 7,
      priority: 'high',
      affectedModules: ['project-quality', 'quality-management', 'health-safety'],
      message: 'Audit delays may affect multiple compliance areas',
      actions: [
        'Reschedule delayed audits immediately',
        'Conduct interim quality checks',
        'Notify stakeholders of potential compliance impact'
      ],
      aiInsight: 'Projects with audit delays >7 days show 45% increase in final audit findings'
    },
    {
      id: 'project-completion-closure-preparation',
      condition: (project) => parseFloat(project.projectCompletionPercent) > 85,
      priority: 'medium',
      affectedModules: ['project-quality', 'quality-management', 'environmental', 'health-safety'],
      message: 'Project nearing completion - initiate closure activities',
      actions: [
        'Complete all pending audits',
        'Close all open CARs and observations',
        'Finalize environmental documentation',
        'Conduct final safety inspection',
        'Prepare lessons learned documentation'
      ],
      aiInsight: 'AI recommends starting closure preparation at 85% completion for smooth project handover'
    },
    {
      id: 'multi-project-pattern-detection',
      condition: (projects) => {
        const highCARProjects = projects.filter(p => p.carsOpen > 5).length;
        return highCARProjects > projects.length * 0.3;
      },
      priority: 'critical',
      affectedModules: ['quality-management', 'project-quality'],
      message: 'Systematic quality issues detected across multiple projects',
      actions: [
        'Conduct root cause analysis across projects',
        'Review and update quality procedures',
        'Implement organization-wide corrective measures',
        'Schedule management review meeting'
      ],
      aiInsight: 'Machine learning detects pattern: 30%+ projects with high CARs indicates systemic process gaps'
    }
  ],

  // RAG (Retrieval-Augmented Generation) Knowledge Vectors
  ragKnowledgeVectors: {
    qualityStandards: [
      'ISO 9001:2015 Quality Management Systems',
      'ISO 19011:2018 Audit Management',
      'ASME B31.3 Process Piping Standards',
      'API 510 Pressure Vessel Inspection',
      'ASTM International Standards'
    ],
    safetyStandards: [
      'ISO 45001:2018 Occupational Health & Safety',
      'OSHA Regulations and Guidelines',
      'NEBOSH Safety Management',
      'NFPA Fire Protection Standards',
      'ILO Safety Conventions'
    ],
    environmentalStandards: [
      'ISO 14001:2015 Environmental Management',
      'GHG Protocol Carbon Accounting',
      'EPA Environmental Regulations',
      'UN Sustainable Development Goals',
      'Paris Agreement Climate Targets'
    ],
    energyStandards: [
      'ISO 50001:2018 Energy Management',
      'LEED Certification Standards',
      'Energy Star Guidelines',
      'IEC 61850 Smart Grid Standards',
      'IEEE 2030 Energy Efficiency'
    ],
    bestPractices: [
      'Continuous improvement methodologies (Kaizen, Six Sigma)',
      'Risk-based thinking and FMEA analysis',
      'Predictive maintenance strategies',
      'Integrated management systems approach',
      'Digital transformation and Industry 4.0 integration'
    ]
  },

  // AI Simulation Parameters (for realistic AI behavior)
  aiSimulation: {
    responseTime: 1200, // ms - simulates AI processing time
    confidenceScores: {
      high: { min: 0.85, max: 0.98 },
      medium: { min: 0.65, max: 0.84 },
      low: { min: 0.40, max: 0.64 }
    },
    analysisDepth: {
      quick: { factors: 3, recommendations: 2 },
      standard: { factors: 5, recommendations: 4 },
      comprehensive: { factors: 8, recommendations: 6 }
    }
  }
};

// Helper function to calculate AI confidence score
export const calculateAIConfidence = (dataQuality, historicalAccuracy, contextRelevance) => {
  const baseScore = (dataQuality * 0.4) + (historicalAccuracy * 0.35) + (contextRelevance * 0.25);
  const variance = (Math.random() - 0.5) * 0.1; // Add slight randomness
  return Math.min(0.99, Math.max(0.40, baseScore + variance));
};

// Export configuration
export default QHSE_AI_CONFIG;
