/**
 * AnnotationEngine.js
 * Advanced AI-driven annotation and documentation system for P&ID diagrams
 * Implements industry-standard documentation practices
 * 
 * Features:
 * - Smart annotation placement avoiding overlaps
 * - Process data callouts (flow, temperature, pressure)
 * - Equipment notes and specifications
 * - Safety warnings and alerts
 * - Revision clouds and tracking
 * - Design notes and legends
 * - Auto-generated documentation
 * - Soft-coded configuration
 */

export class AnnotationEngine {
  constructor(canvasWidth, canvasHeight, options = {}) {
    this.width = canvasWidth
    this.height = canvasHeight
    this.gridSize = options.gridSize || 25
    this.margins = options.margins || { top: 50, right: 50, bottom: 50, left: 50 }
    
    // Annotation types
    this.annotationTypes = {
      NOTE: 'note',
      PROCESS_DATA: 'process_data',
      EQUIPMENT_TAG: 'equipment_tag',
      SAFETY: 'safety',
      DESIGN_BASIS: 'design_basis',
      REVISION: 'revision',
      CALLOUT: 'callout',
      DIMENSION: 'dimension',
      LEGEND: 'legend'
    }
    
    // Annotation styles
    this.styles = {
      note: {
        backgroundColor: '#fef3c7',
        borderColor: '#f59e0b',
        textColor: '#92400e',
        icon: '📝'
      },
      process_data: {
        backgroundColor: '#dbeafe',
        borderColor: '#3b82f6',
        textColor: '#1e40af',
        icon: '📊'
      },
      equipment_tag: {
        backgroundColor: '#e0e7ff',
        borderColor: '#6366f1',
        textColor: '#3730a3',
        icon: '🏷️'
      },
      safety: {
        backgroundColor: '#fee2e2',
        borderColor: '#ef4444',
        textColor: '#991b1b',
        icon: '⚠️'
      },
      design_basis: {
        backgroundColor: '#d1fae5',
        borderColor: '#10b981',
        textColor: '#065f46',
        icon: '📐'
      },
      revision: {
        backgroundColor: '#f3e8ff',
        borderColor: '#a855f7',
        textColor: '#6b21a8',
        icon: '🔄'
      }
    }
    
    // Process data templates
    this.processDataTemplates = {
      flow: { unit: 'm³/h', symbol: 'F', color: '#3b82f6' },
      temperature: { unit: '°C', symbol: 'T', color: '#ef4444' },
      pressure: { unit: 'bar', symbol: 'P', color: '#10b981' },
      level: { unit: '%', symbol: 'L', color: '#f59e0b' },
      density: { unit: 'kg/m³', symbol: 'ρ', color: '#8b5cf6' },
      viscosity: { unit: 'cP', symbol: 'μ', color: '#ec4899' }
    }
    
    // Safety classifications
    this.safetyLevels = {
      CRITICAL: { color: '#dc2626', priority: 1, label: 'CRITICAL' },
      HIGH: { color: '#ea580c', priority: 2, label: 'HIGH' },
      MEDIUM: { color: '#f59e0b', priority: 3, label: 'MEDIUM' },
      LOW: { color: '#84cc16', priority: 4, label: 'LOW' }
    }
    
    // Placed annotations tracking
    this.placedAnnotations = []
  }

  /**
   * Auto-generate annotations based on P&ID data
   */
  generateAnnotations(pidData, equipmentPositions, instrumentPositions, pipeRoutes, options = {}) {
    const annotations = []
    const includeProcessData = options.includeProcessData !== false
    const includeEquipmentNotes = options.includeEquipmentNotes !== false
    const includeSafetyNotes = options.includeSafetyNotes !== false
    const includeDesignBasis = options.includeDesignBasis !== false
    
    // Generate process data annotations for pipes
    if (includeProcessData && pipeRoutes.length > 0) {
      pipeRoutes.forEach(route => {
        const processAnnotations = this.generateProcessDataAnnotations(route)
        annotations.push(...processAnnotations)
      })
    }
    
    // Generate equipment notes
    if (includeEquipmentNotes && equipmentPositions.length > 0) {
      equipmentPositions.forEach(equipment => {
        const equipNotes = this.generateEquipmentAnnotations(equipment)
        annotations.push(...equipNotes)
      })
    }
    
    // Generate safety annotations
    if (includeSafetyNotes) {
      const safetyAnnotations = this.generateSafetyAnnotations(equipmentPositions, pidData)
      annotations.push(...safetyAnnotations)
    }
    
    // Generate design basis annotations
    if (includeDesignBasis && pidData) {
      const designAnnotations = this.generateDesignBasisAnnotations(pidData)
      annotations.push(...designAnnotations)
    }
    
    // Place annotations intelligently
    const placedAnnotations = this.placeAnnotations(annotations, equipmentPositions, pipeRoutes)
    
    return placedAnnotations
  }

  /**
   * Generate process data annotations for pipes
   */
  generateProcessDataAnnotations(route) {
    const annotations = []
    const midPoint = route.waypoints[Math.floor(route.waypoints.length / 2)]
    
    // Flow rate annotation
    if (route.flow_rate || route.design_flow) {
      annotations.push({
        type: this.annotationTypes.PROCESS_DATA,
        subtype: 'flow',
        text: `${route.flow_rate || route.design_flow} ${this.processDataTemplates.flow.unit}`,
        symbol: this.processDataTemplates.flow.symbol,
        x: midPoint.x + 40,
        y: midPoint.y - 30,
        width: 100,
        height: 40,
        associatedElement: route.id,
        priority: 2
      })
    }
    
    // Temperature annotation
    if (route.temperature || route.design_temperature) {
      annotations.push({
        type: this.annotationTypes.PROCESS_DATA,
        subtype: 'temperature',
        text: `${route.temperature || route.design_temperature} ${this.processDataTemplates.temperature.unit}`,
        symbol: this.processDataTemplates.temperature.symbol,
        x: midPoint.x + 40,
        y: midPoint.y,
        width: 100,
        height: 40,
        associatedElement: route.id,
        priority: 2
      })
    }
    
    // Pressure annotation
    if (route.pressure || route.design_pressure) {
      annotations.push({
        type: this.annotationTypes.PROCESS_DATA,
        subtype: 'pressure',
        text: `${route.pressure || route.design_pressure} ${this.processDataTemplates.pressure.unit}`,
        symbol: this.processDataTemplates.pressure.symbol,
        x: midPoint.x + 40,
        y: midPoint.y + 30,
        width: 100,
        height: 40,
        associatedElement: route.id,
        priority: 2
      })
    }
    
    return annotations
  }

  /**
   * Generate equipment annotations
   */
  generateEquipmentAnnotations(equipment) {
    const annotations = []
    
    // Equipment tag annotation
    if (equipment.tag_number) {
      annotations.push({
        type: this.annotationTypes.EQUIPMENT_TAG,
        text: equipment.tag_number,
        description: equipment.description || equipment.equipment_type,
        x: equipment.x,
        y: equipment.y - 80,
        width: 150,
        height: 50,
        associatedElement: equipment.tag_number,
        priority: 1
      })
    }
    
    // Equipment specifications
    if (equipment.specifications || equipment.capacity || equipment.power) {
      const specs = []
      if (equipment.capacity) specs.push(`Capacity: ${equipment.capacity}`)
      if (equipment.power) specs.push(`Power: ${equipment.power}`)
      if (equipment.design_pressure) specs.push(`Design P: ${equipment.design_pressure} bar`)
      if (equipment.design_temperature) specs.push(`Design T: ${equipment.design_temperature}°C`)
      
      if (specs.length > 0) {
        annotations.push({
          type: this.annotationTypes.NOTE,
          text: specs.join('\n'),
          x: equipment.x + 80,
          y: equipment.y,
          width: 180,
          height: 20 + specs.length * 15,
          associatedElement: equipment.tag_number,
          priority: 3
        })
      }
    }
    
    return annotations
  }

  /**
   * Generate safety annotations
   */
  generateSafetyAnnotations(equipmentPositions, pidData) {
    const annotations = []
    
    // Check for pressure vessels
    equipmentPositions.forEach(equipment => {
      const eqType = (equipment.equipment_type || '').toLowerCase()
      
      if (['vessel', 'column', 'reactor', 'drum'].some(t => eqType.includes(t))) {
        const pressure = equipment.design_pressure || 0
        
        if (pressure > 10) {
          annotations.push({
            type: this.annotationTypes.SAFETY,
            text: 'HIGH PRESSURE VESSEL',
            detail: `Design: ${pressure} bar\nRequires PSV`,
            x: equipment.x + 100,
            y: equipment.y - 50,
            width: 200,
            height: 60,
            safetyLevel: pressure > 40 ? 'CRITICAL' : 'HIGH',
            associatedElement: equipment.tag_number,
            priority: 1
          })
        }
      }
      
      // Check for flammable/toxic fluids
      if (equipment.fluid) {
        const fluid = equipment.fluid.toLowerCase()
        if (['hydrogen', 'methane', 'propane', 'butane', 'gasoline'].some(f => fluid.includes(f))) {
          annotations.push({
            type: this.annotationTypes.SAFETY,
            text: 'FLAMMABLE FLUID',
            detail: `${equipment.fluid}\nFire protection required`,
            x: equipment.x - 120,
            y: equipment.y,
            width: 200,
            height: 60,
            safetyLevel: 'HIGH',
            associatedElement: equipment.tag_number,
            priority: 1
          })
        }
      }
    })
    
    return annotations
  }

  /**
   * Generate design basis annotations
   */
  generateDesignBasisAnnotations(pidData) {
    const annotations = []
    
    // Design conditions
    if (pidData.design_temperature || pidData.design_pressure) {
      annotations.push({
        type: this.annotationTypes.DESIGN_BASIS,
        text: 'DESIGN CONDITIONS',
        detail: [
          pidData.design_temperature ? `Temperature: ${pidData.design_temperature}°C` : null,
          pidData.design_pressure ? `Pressure: ${pidData.design_pressure} bar` : null,
          pidData.design_flow ? `Flow: ${pidData.design_flow} m³/h` : null
        ].filter(Boolean).join('\n'),
        x: this.margins.left + 20,
        y: this.margins.top + 20,
        width: 250,
        height: 80,
        fixed: true,
        priority: 3
      })
    }
    
    // Process description
    if (pidData.process_description || pidData.pid_description) {
      annotations.push({
        type: this.annotationTypes.NOTE,
        text: 'PROCESS DESCRIPTION',
        detail: pidData.process_description || pidData.pid_description,
        x: this.margins.left + 20,
        y: this.margins.top + 120,
        width: 300,
        height: 100,
        fixed: true,
        priority: 3
      })
    }
    
    return annotations
  }

  /**
   * Intelligently place annotations avoiding overlaps
   */
  placeAnnotations(annotations, equipmentPositions, pipeRoutes) {
    this.placedAnnotations = []
    
    // Sort by priority (lower number = higher priority)
    const sortedAnnotations = [...annotations].sort((a, b) => 
      (a.priority || 5) - (b.priority || 5)
    )
    
    sortedAnnotations.forEach(annotation => {
      if (annotation.fixed) {
        // Fixed position annotations (like legends)
        this.placedAnnotations.push(annotation)
      } else {
        // Find best position avoiding overlaps
        const bestPosition = this.findBestPosition(annotation, equipmentPositions, pipeRoutes)
        this.placedAnnotations.push({
          ...annotation,
          x: bestPosition.x,
          y: bestPosition.y
        })
      }
    })
    
    return this.placedAnnotations
  }

  /**
   * Find best position for annotation
   */
  findBestPosition(annotation, equipmentPositions, pipeRoutes) {
    const originalX = annotation.x
    const originalY = annotation.y
    
    // Try original position first
    if (!this.hasOverlap({ ...annotation, x: originalX, y: originalY })) {
      return { x: originalX, y: originalY }
    }
    
    // Try positions around original
    const offsets = [
      { dx: 0, dy: -50 },   // Above
      { dx: 0, dy: 50 },    // Below
      { dx: 50, dy: 0 },    // Right
      { dx: -50, dy: 0 },   // Left
      { dx: 50, dy: -50 },  // Top-right
      { dx: 50, dy: 50 },   // Bottom-right
      { dx: -50, dy: -50 }, // Top-left
      { dx: -50, dy: 50 }   // Bottom-left
    ]
    
    for (const offset of offsets) {
      const testX = originalX + offset.dx
      const testY = originalY + offset.dy
      
      if (!this.hasOverlap({ ...annotation, x: testX, y: testY })) {
        return { x: testX, y: testY }
      }
    }
    
    // If all positions overlap, return original with slight offset
    return { x: originalX + 60, y: originalY }
  }

  /**
   * Check if annotation overlaps with existing elements
   */
  hasOverlap(annotation) {
    // Check against other placed annotations
    return this.placedAnnotations.some(placed => {
      return this.rectanglesOverlap(
        annotation.x, annotation.y, annotation.width, annotation.height,
        placed.x, placed.y, placed.width, placed.height
      )
    })
  }

  /**
   * Check if two rectangles overlap
   */
  rectanglesOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return !(x1 + w1 < x2 || x2 + w2 < x1 || y1 + h1 < y2 || y2 + h2 < y1)
  }

  /**
   * Generate revision cloud around area
   */
  generateRevisionCloud(centerX, centerY, radius, revisionNumber, description) {
    return {
      type: this.annotationTypes.REVISION,
      x: centerX - radius,
      y: centerY - radius,
      width: radius * 2,
      height: radius * 2,
      cloudRadius: radius,
      revisionNumber,
      description,
      date: new Date().toLocaleDateString(),
      priority: 1
    }
  }

  /**
   * Generate notes legend
   */
  generateNotesLegend(notes) {
    return {
      type: this.annotationTypes.LEGEND,
      text: 'NOTES',
      items: notes.map((note, index) => ({
        number: index + 1,
        text: note
      })),
      x: this.margins.left + 20,
      y: this.height - this.margins.bottom - 200,
      width: 400,
      height: Math.min(200, 40 + notes.length * 20),
      fixed: true,
      priority: 4
    }
  }

  /**
   * Generate process data table
   */
  generateProcessDataTable(processData) {
    return {
      type: this.annotationTypes.LEGEND,
      text: 'PROCESS DATA SUMMARY',
      tableHeaders: ['Parameter', 'Normal', 'Design', 'Unit'],
      tableData: processData,
      x: this.width - this.margins.right - 450,
      y: this.margins.top + 20,
      width: 430,
      height: Math.min(300, 60 + processData.length * 25),
      fixed: true,
      priority: 4
    }
  }

  /**
   * Add custom annotation
   */
  addAnnotation(type, text, x, y, options = {}) {
    const annotation = {
      type,
      text,
      x,
      y,
      width: options.width || 150,
      height: options.height || 60,
      detail: options.detail || '',
      priority: options.priority || 3,
      ...options
    }
    
    this.placedAnnotations.push(annotation)
    return annotation
  }

  /**
   * Generate automatic callouts for equipment
   */
  generateCallouts(equipmentPositions, style = 'leader') {
    const callouts = []
    
    equipmentPositions.forEach((equipment, index) => {
      if (!equipment.tag_number) return
      
      const angle = (index * Math.PI / 4) + Math.PI / 6
      const distance = 100
      
      callouts.push({
        type: this.annotationTypes.CALLOUT,
        text: equipment.tag_number,
        description: equipment.description || equipment.equipment_type,
        fromX: equipment.x,
        fromY: equipment.y,
        toX: equipment.x + Math.cos(angle) * distance,
        toY: equipment.y + Math.sin(angle) * distance,
        width: 140,
        height: 50,
        style,
        priority: 2
      })
    })
    
    return callouts
  }

  /**
   * Generate dimensioning annotations
   */
  generateDimensions(element1, element2, type = 'horizontal') {
    const dx = Math.abs(element2.x - element1.x)
    const dy = Math.abs(element2.y - element1.y)
    
    return {
      type: this.annotationTypes.DIMENSION,
      fromX: element1.x,
      fromY: element1.y,
      toX: element2.x,
      toY: element2.y,
      distance: type === 'horizontal' ? dx : dy,
      unit: 'mm',
      dimensionType: type,
      priority: 4
    }
  }

  /**
   * Get annotation style
   */
  getStyle(type) {
    return this.styles[type] || this.styles.note
  }

  /**
   * Export annotations as data
   */
  exportAnnotations() {
    return {
      annotations: this.placedAnnotations,
      metadata: {
        totalAnnotations: this.placedAnnotations.length,
        byType: this.getAnnotationCountByType(),
        generated: new Date().toISOString()
      }
    }
  }

  /**
   * Get count by type
   */
  getAnnotationCountByType() {
    const counts = {}
    this.placedAnnotations.forEach(annotation => {
      counts[annotation.type] = (counts[annotation.type] || 0) + 1
    })
    return counts
  }

  /**
   * Clear all annotations
   */
  clearAnnotations() {
    this.placedAnnotations = []
  }

  /**
   * Filter annotations by type
   */
  filterByType(type) {
    return this.placedAnnotations.filter(a => a.type === type)
  }
}
