/**
 * Equipment Placement Engine
 * Advanced AI-driven equipment placement for P&ID diagrams
 * Uses process flow analysis, industry standards, and optimization algorithms
 * 
 * Features:
 * - Smart auto-placement based on process sequence
 * - Equipment type-based grouping
 * - Elevation-aware positioning
 * - Collision detection
 * - Flow optimization
 * - Industry standard spacing
 */

export class EquipmentPlacementEngine {
  constructor(canvasWidth, canvasHeight, config = {}) {
    this.canvasWidth = canvasWidth
    this.canvasHeight = canvasHeight
    this.config = {
      minSpacing: config.minSpacing || 150,
      gridSize: config.gridSize || 50,
      margins: config.margins || { top: 100, right: 100, bottom: 100, left: 100 },
      equipmentSizes: config.equipmentSizes || {
        pump: { width: 60, height: 60 },
        tank: { width: 80, height: 100 },
        vessel: { width: 80, height: 100 },
        column: { width: 60, height: 150 },
        reactor: { width: 100, height: 120 },
        heat_exchanger: { width: 80, height: 60 },
        compressor: { width: 70, height: 70 },
        separator: { width: 90, height: 90 },
        default: { width: 70, height: 70 }
      },
      elevationLevels: config.elevationLevels || {
        overhead: 0.2,    // 20% from top
        high: 0.35,       // 35% from top
        medium: 0.5,      // 50% from top (middle)
        low: 0.65,        // 65% from top
        ground: 0.85      // 85% from top
      }
    }
  }

  /**
   * Main placement function - analyzes equipment and generates optimal positions
   * @param {Array} equipmentList - List of equipment from P&ID data
   * @param {Object} options - Placement options
   * @returns {Array} - Equipment with calculated positions
   */
  placeEquipment(equipmentList, options = {}) {
    const {
      flowDirection = 'left-to-right', // 'left-to-right', 'top-to-bottom', 'auto'
      layoutStyle = 'process-sequence', // 'process-sequence', 'equipment-type', 'elevation', 'grid'
      autoOptimize = true,
      respectElevation = true
    } = options

    // Step 1: Analyze equipment and build process graph
    const analysis = this.analyzeEquipment(equipmentList)
    
    // Step 2: Determine optimal flow direction if auto
    const optimalDirection = flowDirection === 'auto' 
      ? this.determineOptimalFlowDirection(analysis)
      : flowDirection

    // Step 3: Apply layout strategy
    let positions = []
    switch (layoutStyle) {
      case 'process-sequence':
        positions = this.layoutByProcessSequence(equipmentList, analysis, optimalDirection)
        break
      case 'equipment-type':
        positions = this.layoutByEquipmentType(equipmentList, optimalDirection)
        break
      case 'elevation':
        positions = this.layoutByElevation(equipmentList, analysis)
        break
      case 'grid':
        positions = this.layoutInGrid(equipmentList)
        break
      default:
        positions = this.layoutByProcessSequence(equipmentList, analysis, optimalDirection)
    }

    // Step 4: Apply elevation adjustments if enabled
    if (respectElevation) {
      positions = this.applyElevationAdjustments(positions, analysis)
    }

    // Step 5: Optimize positions to avoid collisions
    if (autoOptimize) {
      positions = this.optimizePositions(positions)
    }

    // Step 6: Snap to grid
    positions = this.snapToGrid(positions)

    return positions
  }

  /**
   * Analyze equipment to understand process flow and relationships
   */
  analyzeEquipment(equipmentList) {
    const analysis = {
      majorEquipment: [],
      rotatingEquipment: [],
      heatExchangers: [],
      vessels: [],
      processSequence: [],
      elevationRequirements: {}
    }

    equipmentList.forEach((equipment, index) => {
      const type = (equipment.equipment_type || equipment.type || '').toLowerCase()
      const tag = equipment.tag || `EQUIP-${index + 1}`

      // Categorize by type
      if (type.includes('column') || type.includes('tower') || type.includes('reactor')) {
        analysis.majorEquipment.push({ ...equipment, index, category: 'major' })
      } else if (type.includes('pump') || type.includes('compressor')) {
        analysis.rotatingEquipment.push({ ...equipment, index, category: 'rotating' })
      } else if (type.includes('exchanger') || type.includes('cooler') || type.includes('heater')) {
        analysis.heatExchangers.push({ ...equipment, index, category: 'heat_transfer' })
      } else if (type.includes('tank') || type.includes('vessel') || type.includes('drum') || type.includes('separator')) {
        analysis.vessels.push({ ...equipment, index, category: 'vessel' })
      }

      // Determine elevation requirements
      analysis.elevationRequirements[tag] = this.determineElevation(equipment)

      // Build process sequence (simplified - in real scenario would analyze connections)
      analysis.processSequence.push({ ...equipment, index, sequenceOrder: index })
    })

    return analysis
  }

  /**
   * Determine optimal flow direction based on equipment types
   */
  determineOptimalFlowDirection(analysis) {
    // If we have tall equipment (columns), prefer left-to-right
    if (analysis.majorEquipment.length > 2) {
      return 'left-to-right'
    }
    
    // If mostly horizontal equipment, prefer top-to-bottom
    if (analysis.rotatingEquipment.length > analysis.majorEquipment.length) {
      return 'top-to-bottom'
    }

    // Default to industry standard
    return 'left-to-right'
  }

  /**
   * Layout equipment by process sequence (most common in industry)
   */
  layoutByProcessSequence(equipmentList, analysis, flowDirection) {
    const positions = []
    const { margins } = this.config
    
    if (flowDirection === 'left-to-right') {
      // Calculate available width and spacing
      const availableWidth = this.canvasWidth - margins.left - margins.right
      const equipmentCount = equipmentList.length
      const spacing = Math.max(
        this.config.minSpacing,
        availableWidth / Math.max(equipmentCount - 1, 1)
      )

      equipmentList.forEach((equipment, index) => {
        const type = (equipment.equipment_type || equipment.type || 'default').toLowerCase()
        const size = this.config.equipmentSizes[type] || this.config.equipmentSizes.default

        positions.push({
          ...equipment,
          x: margins.left + index * spacing,
          y: this.canvasHeight / 2, // Center vertically (will adjust by elevation later)
          width: size.width,
          height: size.height,
          index,
          sequenceOrder: index
        })
      })
    } else if (flowDirection === 'top-to-bottom') {
      // Calculate available height and spacing
      const availableHeight = this.canvasHeight - margins.top - margins.bottom
      const equipmentCount = equipmentList.length
      const spacing = Math.max(
        this.config.minSpacing,
        availableHeight / Math.max(equipmentCount - 1, 1)
      )

      equipmentList.forEach((equipment, index) => {
        const type = (equipment.equipment_type || equipment.type || 'default').toLowerCase()
        const size = this.config.equipmentSizes[type] || this.config.equipmentSizes.default

        positions.push({
          ...equipment,
          x: this.canvasWidth / 2, // Center horizontally
          y: margins.top + index * spacing,
          width: size.width,
          height: size.height,
          index,
          sequenceOrder: index
        })
      })
    }

    return positions
  }

  /**
   * Layout equipment grouped by type
   */
  layoutByEquipmentType(equipmentList, flowDirection) {
    const positions = []
    const groups = {}

    // Group equipment by type
    equipmentList.forEach((equipment, index) => {
      const type = (equipment.equipment_type || equipment.type || 'default').toLowerCase()
      const category = this.getEquipmentCategory(type)
      
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push({ ...equipment, index })
    })

    // Place each group
    const groupKeys = Object.keys(groups)
    const { margins } = this.config

    if (flowDirection === 'left-to-right') {
      const groupSpacing = (this.canvasWidth - margins.left - margins.right) / groupKeys.length
      
      groupKeys.forEach((category, groupIndex) => {
        const groupEquipment = groups[category]
        const groupX = margins.left + groupIndex * groupSpacing
        const verticalSpacing = 120

        groupEquipment.forEach((equipment, eqIndex) => {
          const type = (equipment.equipment_type || equipment.type || 'default').toLowerCase()
          const size = this.config.equipmentSizes[type] || this.config.equipmentSizes.default

          positions.push({
            ...equipment,
            x: groupX,
            y: margins.top + eqIndex * verticalSpacing,
            width: size.width,
            height: size.height,
            category
          })
        })
      })
    } else {
      const groupSpacing = (this.canvasHeight - margins.top - margins.bottom) / groupKeys.length
      
      groupKeys.forEach((category, groupIndex) => {
        const groupEquipment = groups[category]
        const groupY = margins.top + groupIndex * groupSpacing
        const horizontalSpacing = 120

        groupEquipment.forEach((equipment, eqIndex) => {
          const type = (equipment.equipment_type || equipment.type || 'default').toLowerCase()
          const size = this.config.equipmentSizes[type] || this.config.equipmentSizes.default

          positions.push({
            ...equipment,
            x: margins.left + eqIndex * horizontalSpacing,
            y: groupY,
            width: size.width,
            height: size.height,
            category
          })
        })
      })
    }

    return positions
  }

  /**
   * Layout equipment by elevation (critical for gravity-driven processes)
   */
  layoutByElevation(equipmentList, analysis) {
    const positions = []
    const { margins, elevationLevels } = this.config

    equipmentList.forEach((equipment, index) => {
      const tag = equipment.tag || `EQUIP-${index + 1}`
      const elevationLevel = analysis.elevationRequirements[tag] || 'medium'
      const type = (equipment.equipment_type || equipment.type || 'default').toLowerCase()
      const size = this.config.equipmentSizes[type] || this.config.equipmentSizes.default

      // Calculate Y position based on elevation
      const y = margins.top + (this.canvasHeight - margins.top - margins.bottom) * elevationLevels[elevationLevel]

      // Distribute horizontally
      const horizontalSpacing = (this.canvasWidth - margins.left - margins.right) / Math.max(equipmentList.length, 1)

      positions.push({
        ...equipment,
        x: margins.left + index * horizontalSpacing,
        y: y,
        width: size.width,
        height: size.height,
        index,
        elevation: elevationLevel
      })
    })

    return positions
  }

  /**
   * Layout equipment in a grid pattern
   */
  layoutInGrid(equipmentList) {
    const positions = []
    const { margins } = this.config
    
    const cols = Math.ceil(Math.sqrt(equipmentList.length))
    const rows = Math.ceil(equipmentList.length / cols)
    
    const cellWidth = (this.canvasWidth - margins.left - margins.right) / cols
    const cellHeight = (this.canvasHeight - margins.top - margins.bottom) / rows

    equipmentList.forEach((equipment, index) => {
      const row = Math.floor(index / cols)
      const col = index % cols
      const type = (equipment.equipment_type || equipment.type || 'default').toLowerCase()
      const size = this.config.equipmentSizes[type] || this.config.equipmentSizes.default

      positions.push({
        ...equipment,
        x: margins.left + col * cellWidth + cellWidth / 2,
        y: margins.top + row * cellHeight + cellHeight / 2,
        width: size.width,
        height: size.height,
        index,
        gridPos: { row, col }
      })
    })

    return positions
  }

  /**
   * Apply elevation adjustments based on equipment type and process requirements
   */
  applyElevationAdjustments(positions, analysis) {
    return positions.map(pos => {
      const tag = pos.tag || `EQUIP-${pos.index + 1}`
      const elevationLevel = analysis.elevationRequirements[tag] || 'medium'
      const type = (pos.equipment_type || pos.type || '').toLowerCase()

      // Adjust Y position based on elevation while maintaining general layout
      let elevationOffset = 0
      
      switch (elevationLevel) {
        case 'overhead':
          elevationOffset = -150
          break
        case 'high':
          elevationOffset = -75
          break
        case 'medium':
          elevationOffset = 0
          break
        case 'low':
          elevationOffset = 75
          break
        case 'ground':
          elevationOffset = 150
          break
      }

      return {
        ...pos,
        y: pos.y + elevationOffset,
        elevation: elevationLevel
      }
    })
  }

  /**
   * Optimize positions to avoid collisions and maintain minimum spacing
   */
  optimizePositions(positions) {
    const optimized = [...positions]
    const maxIterations = 50
    let iteration = 0

    while (iteration < maxIterations) {
      let hasCollision = false

      for (let i = 0; i < optimized.length; i++) {
        for (let j = i + 1; j < optimized.length; j++) {
          const eq1 = optimized[i]
          const eq2 = optimized[j]

          if (this.checkCollision(eq1, eq2)) {
            hasCollision = true
            // Adjust positions to resolve collision
            this.resolveCollision(eq1, eq2)
          }
        }
      }

      if (!hasCollision) break
      iteration++
    }

    return optimized
  }

  /**
   * Check if two equipment items collide
   */
  checkCollision(eq1, eq2) {
    const margin = this.config.minSpacing / 2
    return (
      Math.abs(eq1.x - eq2.x) < (eq1.width + eq2.width) / 2 + margin &&
      Math.abs(eq1.y - eq2.y) < (eq1.height + eq2.height) / 2 + margin
    )
  }

  /**
   * Resolve collision by adjusting positions
   */
  resolveCollision(eq1, eq2) {
    const dx = eq2.x - eq1.x
    const dy = eq2.y - eq1.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    if (distance === 0) return

    const minDistance = this.config.minSpacing
    const overlap = minDistance - distance
    
    const moveX = (dx / distance) * overlap / 2
    const moveY = (dy / distance) * overlap / 2

    eq1.x -= moveX
    eq1.y -= moveY
    eq2.x += moveX
    eq2.y += moveY
  }

  /**
   * Snap positions to grid
   */
  snapToGrid(positions) {
    return positions.map(pos => ({
      ...pos,
      x: Math.round(pos.x / this.config.gridSize) * this.config.gridSize,
      y: Math.round(pos.y / this.config.gridSize) * this.config.gridSize
    }))
  }

  /**
   * Determine elevation requirement for equipment
   */
  determineElevation(equipment) {
    const type = (equipment.equipment_type || equipment.type || '').toLowerCase()
    const description = (equipment.description || equipment.service || '').toLowerCase()

    // Overhead equipment
    if (type.includes('condenser') || description.includes('overhead') || 
        type.includes('reflux drum') || description.includes('top product')) {
      return 'overhead'
    }

    // High elevation
    if (type.includes('column') || type.includes('tower') || type.includes('accumulator')) {
      return 'high'
    }

    // Low elevation
    if (type.includes('reboiler') || description.includes('bottom') ||
        description.includes('sump') || type.includes('bottom receiver')) {
      return 'low'
    }

    // Ground level
    if (type.includes('pump') || description.includes('pump')) {
      return 'ground'
    }

    // Default to medium
    return 'medium'
  }

  /**
   * Get equipment category for grouping
   */
  getEquipmentCategory(type) {
    if (type.includes('column') || type.includes('tower') || type.includes('reactor')) {
      return 'major'
    } else if (type.includes('pump') || type.includes('compressor')) {
      return 'rotating'
    } else if (type.includes('exchanger') || type.includes('cooler') || type.includes('heater')) {
      return 'heat_transfer'
    } else if (type.includes('tank') || type.includes('vessel') || type.includes('drum')) {
      return 'vessel'
    }
    return 'other'
  }

  /**
   * Re-arrange specific equipment maintaining relationships
   */
  reArrange(positions, equipmentIndex, newX, newY) {
    const updated = [...positions]
    if (equipmentIndex >= 0 && equipmentIndex < updated.length) {
      updated[equipmentIndex] = {
        ...updated[equipmentIndex],
        x: newX,
        y: newY
      }
    }
    return this.optimizePositions(updated)
  }
}

// Export singleton instance
export default EquipmentPlacementEngine
