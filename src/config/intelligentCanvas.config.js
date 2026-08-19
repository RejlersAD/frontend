/**
 * Intelligent Canvas Configuration
 * Hybrid AI + Expert System for P&ID Layout Customization
 * Soft-coded approach for maximum flexibility
 */

export const CANVAS_INTELLIGENCE_CONFIG = {
  /**
   * AI-Assisted Layout Engine
   */
  aiAssistance: {
    enabled: true,
    modes: {
      AUTO: {
        id: 'auto',
        name: 'Full AI Control',
        description: 'AI handles complete layout automatically',
        icon: '🤖',
        expertControl: 10, // 10% expert control
        aiControl: 90,
        features: ['auto-placement', 'auto-routing', 'auto-spacing', 'optimization']
      },
      GUIDED: {
        id: 'guided',
        name: 'AI-Guided Expert',
        description: 'AI suggests, expert decides and modifies',
        icon: '🤝',
        expertControl: 60,
        aiControl: 40,
        features: ['suggestions', 'validation', 'smart-snap', 'conflict-detection']
      },
      MANUAL: {
        id: 'manual',
        name: 'Expert Manual',
        description: 'Expert has full control with AI assistance',
        icon: '👨‍🔬',
        expertControl: 90,
        aiControl: 10,
        features: ['validation', 'warnings', 'standards-check']
      },
      HYBRID: {
        id: 'hybrid',
        name: 'Hybrid Intelligence',
        description: 'Perfect balance of AI automation and expert wisdom',
        icon: '⚡',
        expertControl: 50,
        aiControl: 50,
        features: ['real-time-suggestions', 'auto-correct', 'collaborative-placement', 'learning']
      }
    },
    defaultMode: 'HYBRID'
  },

  /**
   * Expert Customization Controls
   */
  expertControls: {
    dragAndDrop: {
      enabled: true,
      snapToGrid: true,
      smartSnap: true, // AI-powered intelligent snapping
      gridSize: 25, // pixels
      snapDistance: 15,
      showGhostImage: true,
      showSnapGuides: true
    },
    
    resize: {
      enabled: true,
      maintainAspectRatio: true,
      minSize: { width: 30, height: 30 },
      maxSize: { width: 200, height: 200 }
    },
    
    rotate: {
      enabled: true,
      snapAngles: [0, 45, 90, 135, 180, 225, 270, 315],
      freeRotation: true
    },
    
    connect: {
      enabled: true,
      autoRouting: true,
      orthogonalOnly: true,
      avoidCollisions: true,
      smartConnectionPoints: true
    },
    
    annotate: {
      enabled: true,
      freeTextEdit: true,
      richFormatting: true,
      autoPositioning: true
    }
  },

  /**
   * AI Recommendation System
   */
  recommendations: {
    realTime: true,
    categories: {
      LAYOUT: {
        id: 'layout',
        name: 'Layout Optimization',
        icon: '📐',
        priority: 'high',
        rules: [
          {
            id: 'flow-direction',
            name: 'Flow Direction Alignment',
            description: 'Equipment should follow process flow (left-to-right or top-to-bottom)',
            trigger: 'equipment_placement',
            severity: 'warning',
            autoFix: true,
            expertOverride: true,
            standard: 'ISO 10628'
          },
          {
            id: 'equipment-spacing',
            name: 'Optimal Equipment Spacing',
            description: 'Maintain 50-100mm spacing for clarity and pipe routing',
            trigger: 'equipment_proximity',
            severity: 'suggestion',
            autoFix: true,
            expertOverride: true,
            standard: 'Company Practice'
          },
          {
            id: 'symmetry',
            name: 'Process Symmetry',
            description: 'Similar equipment types should be aligned for visual clarity',
            trigger: 'alignment_check',
            severity: 'info',
            autoFix: true,
            expertOverride: true
          }
        ]
      },
      
      CONNECTIVITY: {
        id: 'connectivity',
        name: 'Piping & Connections',
        icon: '🔗',
        priority: 'critical',
        rules: [
          {
            id: 'pipe-crossing',
            name: 'Minimize Pipe Crossings',
            description: 'Reduce pipe crossings to improve readability',
            trigger: 'pipe_routing',
            severity: 'warning',
            autoFix: true,
            expertOverride: true,
            standard: 'ASME Y14.100'
          },
          {
            id: 'connection-length',
            name: 'Optimize Connection Length',
            description: 'Keep pipe runs as short as practical',
            trigger: 'pipe_length',
            severity: 'suggestion',
            autoFix: true,
            expertOverride: true
          },
          {
            id: 'orthogonal-routing',
            name: 'Orthogonal Pipe Routing',
            description: 'Use 90° angles for professional appearance',
            trigger: 'pipe_angle',
            severity: 'warning',
            autoFix: true,
            expertOverride: false,
            standard: 'ISO 10628'
          }
        ]
      },
      
      INSTRUMENTATION: {
        id: 'instrumentation',
        name: 'Instrument Placement',
        icon: '📊',
        priority: 'high',
        rules: [
          {
            id: 'instrument-position',
            name: 'Instrument Visibility',
            description: 'Place instruments near associated equipment for clarity',
            trigger: 'instrument_placement',
            severity: 'suggestion',
            autoFix: true,
            expertOverride: true,
            standard: 'ISA 5.1'
          },
          {
            id: 'tag-readability',
            name: 'Tag Readability',
            description: 'Ensure instrument tags are readable and not overlapping',
            trigger: 'tag_overlap',
            severity: 'warning',
            autoFix: true,
            expertOverride: true
          }
        ]
      },
      
      STANDARDS: {
        id: 'standards',
        name: 'Engineering Standards',
        icon: '📋',
        priority: 'critical',
        rules: [
          {
            id: 'elevation-indication',
            name: 'Elevation Representation',
            description: 'Show elevation differences for gravity flow systems',
            trigger: 'elevation_check',
            severity: 'warning',
            autoFix: false,
            expertOverride: true,
            standard: 'ASME B31.3'
          },
          {
            id: 'symbol-standards',
            name: 'ISA Symbol Compliance',
            description: 'Verify all symbols follow ISA 5.1 standards',
            trigger: 'symbol_validation',
            severity: 'critical',
            autoFix: false,
            expertOverride: false,
            standard: 'ISA 5.1'
          }
        ]
      },
      
      SAFETY: {
        id: 'safety',
        name: 'Safety & Compliance',
        icon: '⚠️',
        priority: 'critical',
        rules: [
          {
            id: 'relief-path',
            name: 'Relief Device Routing',
            description: 'Ensure PSV discharge paths are clearly shown',
            trigger: 'safety_check',
            severity: 'critical',
            autoFix: false,
            expertOverride: false,
            standard: 'API RP 520'
          },
          {
            id: 'isolation-valves',
            name: 'Isolation Valve Placement',
            description: 'Verify isolation valves for maintenance access',
            trigger: 'valve_check',
            severity: 'warning',
            autoFix: true,
            expertOverride: true,
            standard: 'ADNOC DEP'
          }
        ]
      }
    }
  },

  /**
   * Intelligent Suggestion System
   */
  suggestions: {
    displayMode: 'contextual', // 'contextual', 'panel', 'inline', 'toast'
    maxSuggestions: 5,
    autoApply: false, // Never auto-apply without expert approval
    
    types: {
      PLACEMENT: {
        icon: '📍',
        color: 'blue',
        priority: 1,
        actions: ['accept', 'modify', 'reject', 'learn']
      },
      ROUTING: {
        icon: '↗️',
        color: 'green',
        priority: 2,
        actions: ['accept', 'modify', 'reject']
      },
      OPTIMIZATION: {
        icon: '⚡',
        color: 'purple',
        priority: 3,
        actions: ['accept', 'reject']
      },
      WARNING: {
        icon: '⚠️',
        color: 'orange',
        priority: 4,
        actions: ['fix', 'ignore', 'override']
      },
      ERROR: {
        icon: '❌',
        color: 'red',
        priority: 5,
        actions: ['fix', 'explain']
      }
    },
    
    confidence: {
      high: { threshold: 0.85, icon: '🟢', label: 'High Confidence' },
      medium: { threshold: 0.65, icon: '🟡', label: 'Medium Confidence' },
      low: { threshold: 0.40, icon: '🟠', label: 'Low Confidence' },
      uncertain: { threshold: 0.0, icon: '🔴', label: 'Uncertain - Expert Review Required' }
    }
  },

  /**
   * Learning & Adaptation System
   */
  learning: {
    enabled: true,
    trackExpertDecisions: true,
    adaptToPreferences: true,
    
    patterns: {
      acceptedSuggestions: {
        weight: 1.0,
        influence: 'high'
      },
      rejectedSuggestions: {
        weight: -0.5,
        influence: 'medium'
      },
      expertModifications: {
        weight: 1.5,
        influence: 'very_high'
      },
      customPreferences: {
        weight: 2.0,
        influence: 'critical'
      }
    },
    
    // Store expert preferences
    expertProfile: {
      trackPlacementStyle: true,
      trackSpacingPreferences: true,
      trackRoutingPreferences: true,
      trackAnnotationStyle: true
    }
  },

  /**
   * Real-Time Validation System
   */
  validation: {
    realTime: true,
    debounceMs: 300,
    
    checks: [
      {
        id: 'overlap-detection',
        name: 'Equipment Overlap',
        severity: 'error',
        autoFix: true,
        message: 'Equipment overlapping detected'
      },
      {
        id: 'spacing-validation',
        name: 'Minimum Spacing',
        severity: 'warning',
        autoFix: true,
        message: 'Equipment too close - recommend {recommended_spacing}mm'
      },
      {
        id: 'connection-validation',
        name: 'Disconnected Equipment',
        severity: 'warning',
        autoFix: false,
        message: 'Equipment not connected to process flow'
      },
      {
        id: 'standards-compliance',
        name: 'Standards Check',
        severity: 'info',
        autoFix: false,
        message: 'Review against {standard}'
      }
    ]
  },

  /**
   * Collaboration Features
   */
  collaboration: {
    comments: {
      enabled: true,
      allowThreads: true,
      allowMentions: true,
      allowAttachments: true
    },
    
    changeTracking: {
      enabled: true,
      trackAll: true,
      showHistory: true,
      allowUndo: true,
      maxUndoSteps: 50
    },
    
    annotations: {
      sticky: true,
      richText: true,
      linking: true,
      tagging: true
    }
  },

  /**
   * Context-Aware Assistance
   */
  contextualHelp: {
    enabled: true,
    
    triggers: {
      onHover: {
        enabled: true,
        delay: 500,
        content: ['quick-info', 'suggestions', 'shortcuts']
      },
      
      onSelect: {
        enabled: true,
        content: ['properties', 'connections', 'recommendations']
      },
      
      onDrag: {
        enabled: true,
        content: ['snap-guides', 'spacing-indicators', 'collision-warnings']
      },
      
      onConnect: {
        enabled: true,
        content: ['routing-options', 'connection-validation', 'alternatives']
      }
    }
  },

  /**
   * Performance & Optimization
   */
  performance: {
    virtualRendering: true,
    lazyLoading: true,
    caching: true,
    debounceInputs: true,
    throttleRenders: true,
    maxElements: 1000
  },

  /**
   * Export & Integration
   */
  export: {
    formats: ['png', 'pdf', 'svg', 'dxf', 'json'],
    includeMetadata: true,
    includeChangelog: true,
    includeComments: true
  }
}

/**
 * Default Expert Preferences
 */
export const DEFAULT_EXPERT_PREFERENCES = {
  layoutStyle: 'process-sequence',
  flowDirection: 'left-to-right',
  spacingPreference: 75, // mm
  routingStyle: 'orthogonal',
  annotationStyle: 'detailed',
  colorScheme: 'standard',
  symbolSet: 'ISA-5.1',
  gridVisible: true,
  snapToGrid: true,
  showRecommendations: true,
  aiAssistLevel: 'HYBRID'
}

/**
 * Keyboard Shortcuts
 */
export const CANVAS_SHORTCUTS = {
  // Mode Switching
  'Shift+A': { action: 'switchToAutoMode', description: 'Switch to Auto Mode' },
  'Shift+H': { action: 'switchToHybridMode', description: 'Switch to Hybrid Mode' },
  'Shift+M': { action: 'switchToManualMode', description: 'Switch to Manual Mode' },
  
  // AI Suggestions
  'Ctrl+Space': { action: 'showSuggestions', description: 'Show AI Suggestions' },
  'Ctrl+Enter': { action: 'acceptSuggestion', description: 'Accept Current Suggestion' },
  'Ctrl+Shift+Enter': { action: 'acceptAllSuggestions', description: 'Accept All Suggestions' },
  'Escape': { action: 'rejectSuggestion', description: 'Reject Current Suggestion' },
  
  // Expert Controls
  'D': { action: 'duplicateSelected', description: 'Duplicate Selected' },
  'R': { action: 'rotateSelected', description: 'Rotate Selected 90°' },
  'F': { action: 'flipHorizontal', description: 'Flip Horizontal' },
  'Shift+F': { action: 'flipVertical', description: 'Flip Vertical' },
  'A': { action: 'alignLeft', description: 'Align Left' },
  'Shift+A': { action: 'alignCenter', description: 'Align Center' },
  
  // Validation
  'Ctrl+V': { action: 'validateDrawing', description: 'Validate Drawing' },
  'Ctrl+Shift+V': { action: 'showValidationReport', description: 'Show Validation Report' },
  
  // View
  'G': { action: 'toggleGrid', description: 'Toggle Grid' },
  'S': { action: 'toggleSnap', description: 'Toggle Snap' },
  'Ctrl+H': { action: 'toggleHelpers', description: 'Toggle Helpers' }
}
