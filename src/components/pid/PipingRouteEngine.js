/**
 * PipingRouteEngine.js
 * Advanced AI-driven piping routing and connection engine for P&ID diagrams
 * Uses intelligent pathfinding algorithms with industry-standard practices
 * 
 * Features:
 * - 4 routing strategies: Manhattan, Direct, Orthogonal, Smart (A*)
 * - Collision avoidance with equipment and other pipes
 * - Flow direction management
 * - Line sizing and categorization
 * - Connection point optimization
 * - Soft-coded configuration
 */

export class PipingRouteEngine {
  constructor(canvasWidth, canvasHeight, options = {}) {
    this.width = canvasWidth
    this.height = canvasHeight
    this.gridSize = options.gridSize || 25
    this.minPipeSpacing = options.minPipeSpacing || 30
    this.routingStrategy = options.routingStrategy || 'manhattan'
    this.avoidCrossings = options.avoidCrossings !== false
    this.snapToGrid = options.snapToGrid !== false
    this.margins = options.margins || { top: 50, right: 50, bottom: 50, left: 50 }
    
    // Connection cache for performance
    this.connectionCache = new Map()
    this.occupiedSpaces = []
  }

  /**
   * Route pipes between equipment based on P&ID data
   * @param {Array} equipmentPositions - Array of equipment with x, y positions
   * @param {Array} connections - Array of connections from P&ID data
   * @param {Object} options - Routing options
   * @returns {Array} Array of pipe routes with waypoints
   */
  routePipes(equipmentPositions, connections, options = {}) {
    const strategy = options.routingStrategy || this.routingStrategy
    const routes = []
    
    // Build equipment lookup map
    const equipmentMap = new Map()
    equipmentPositions.forEach((equipment, index) => {
      equipmentMap.set(equipment.tag_number, { ...equipment, index })
    })
    
    // Build occupied spaces from equipment
    this.occupiedSpaces = equipmentPositions.map(eq => ({
      x: eq.x - 30,
      y: eq.y - 30,
      width: 60,
      height: 60,
      type: 'equipment'
    }))
    
    // Route each connection
    connections.forEach((connection, connIndex) => {
      const fromEquipment = equipmentMap.get(connection.from_equipment)
      const toEquipment = equipmentMap.get(connection.to_equipment)
      
      if (!fromEquipment || !toEquipment) {
        console.warn(`Missing equipment for connection: ${connection.from_equipment} -> ${connection.to_equipment}`)
        return
      }
      
      // Determine connection points on equipment
      const fromPoint = this.getConnectionPoint(fromEquipment, toEquipment, 'outlet')
      const toPoint = this.getConnectionPoint(toEquipment, fromEquipment, 'inlet')
      
      // Route based on strategy
      let waypoints = []
      switch (strategy) {
        case 'manhattan':
          waypoints = this.routeManhattan(fromPoint, toPoint, connIndex)
          break
        case 'direct':
          waypoints = this.routeDirect(fromPoint, toPoint)
          break
        case 'orthogonal':
          waypoints = this.routeOrthogonal(fromPoint, toPoint, connIndex)
          break
        case 'smart':
          waypoints = this.routeSmart(fromPoint, toPoint, connIndex)
          break
        default:
          waypoints = this.routeManhattan(fromPoint, toPoint, connIndex)
      }
      
      // Snap to grid if enabled
      if (this.snapToGrid) {
        waypoints = waypoints.map(point => this.snapPointToGrid(point))
      }
      
      // Categorize pipe type
      const pipeCategory = this.categorizePipe(connection)
      
      routes.push({
        ...connection,
        id: `pipe_${connIndex}`,
        fromEquipment,
        toEquipment,
        fromPoint,
        toPoint,
        waypoints,
        category: pipeCategory,
        lineStyle: this.getLineStyle(pipeCategory),
        lineWidth: this.getLineWidth(connection),
        flowDirection: this.calculateFlowDirection(waypoints)
      })
      
      // Add route to occupied spaces if avoiding crossings
      if (this.avoidCrossings) {
        this.addRouteToOccupiedSpaces(waypoints, connIndex)
      }
    })
    
    return routes
  }

  /**
   * Manhattan routing (L-shaped: horizontal then vertical or vice versa)
   */
  routeManhattan(from, to, routeIndex) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    
    // Determine if we should go horizontal-first or vertical-first
    const preferHorizontalFirst = Math.abs(dx) > Math.abs(dy)
    
    // Add slight offset for parallel pipes
    const offset = (routeIndex % 3) * this.minPipeSpacing
    
    if (preferHorizontalFirst) {
      // Horizontal then vertical
      const midX = from.x + dx * 0.5
      return [
        from,
        { x: midX, y: from.y + offset },
        { x: midX, y: to.y },
        to
      ]
    } else {
      // Vertical then horizontal
      const midY = from.y + dy * 0.5
      return [
        from,
        { x: from.x + offset, y: midY },
        { x: to.x, y: midY },
        to
      ]
    }
  }

  /**
   * Direct routing (straight line - simplest)
   */
  routeDirect(from, to) {
    return [from, to]
  }

  /**
   * Orthogonal routing (only 90-degree angles, industry standard)
   */
  routeOrthogonal(from, to, routeIndex) {
    const waypoints = [from]
    const offset = (routeIndex % 5) * this.minPipeSpacing * 0.5
    
    const dx = to.x - from.x
    const dy = to.y - from.y
    
    // Check if we need to route around obstacles
    if (this.hasObstacleInPath(from, to)) {
      // Route around with extra waypoints
      if (Math.abs(dx) > Math.abs(dy)) {
        // Go horizontal first, then around obstacle
        const quarterX = from.x + dx * 0.25
        const threeQuarterX = from.x + dx * 0.75
        
        waypoints.push({ x: quarterX, y: from.y + offset })
        waypoints.push({ x: quarterX, y: to.y + offset })
        waypoints.push({ x: threeQuarterX, y: to.y + offset })
        waypoints.push({ x: threeQuarterX, y: to.y })
      } else {
        // Go vertical first, then around obstacle
        const quarterY = from.y + dy * 0.25
        const threeQuarterY = from.y + dy * 0.75
        
        waypoints.push({ x: from.x + offset, y: quarterY })
        waypoints.push({ x: to.x + offset, y: quarterY })
        waypoints.push({ x: to.x + offset, y: threeQuarterY })
        waypoints.push({ x: to.x, y: threeQuarterY })
      }
    } else {
      // Simple L-route
      const midX = from.x + dx * 0.5
      waypoints.push({ x: midX, y: from.y + offset })
      waypoints.push({ x: midX, y: to.y })
    }
    
    waypoints.push(to)
    return waypoints
  }

  /**
   * Smart routing using simplified A* pathfinding
   */
  routeSmart(from, to, routeIndex) {
    // Use A* algorithm for optimal path
    const grid = this.createRoutingGrid()
    const path = this.aStarPathfinding(from, to, grid)
    
    if (path.length === 0) {
      // Fallback to Manhattan if pathfinding fails
      console.warn('A* pathfinding failed, falling back to Manhattan routing')
      return this.routeManhattan(from, to, routeIndex)
    }
    
    // Simplify path by removing unnecessary waypoints
    return this.simplifyPath(path)
  }

  /**
   * Simplified A* pathfinding
   */
  aStarPathfinding(start, end, grid) {
    const startNode = this.snapPointToGrid(start)
    const endNode = this.snapPointToGrid(end)
    
    const openSet = [startNode]
    const cameFrom = new Map()
    const gScore = new Map()
    const fScore = new Map()
    
    gScore.set(this.nodeKey(startNode), 0)
    fScore.set(this.nodeKey(startNode), this.heuristic(startNode, endNode))
    
    let iterations = 0
    const maxIterations = 1000 // Prevent infinite loops
    
    while (openSet.length > 0 && iterations < maxIterations) {
      iterations++
      
      // Get node with lowest fScore
      openSet.sort((a, b) => 
        (fScore.get(this.nodeKey(a)) || Infinity) - (fScore.get(this.nodeKey(b)) || Infinity)
      )
      const current = openSet.shift()
      
      // Check if we reached the goal
      if (this.distance(current, endNode) < this.gridSize) {
        return this.reconstructPath(cameFrom, current)
      }
      
      // Check neighbors (4-directional: up, down, left, right)
      const neighbors = this.getNeighbors(current)
      
      for (const neighbor of neighbors) {
        // Skip if obstacle
        if (this.isObstacle(neighbor)) {
          continue
        }
        
        const tentativeGScore = (gScore.get(this.nodeKey(current)) || Infinity) + this.distance(current, neighbor)
        
        if (tentativeGScore < (gScore.get(this.nodeKey(neighbor)) || Infinity)) {
          cameFrom.set(this.nodeKey(neighbor), current)
          gScore.set(this.nodeKey(neighbor), tentativeGScore)
          fScore.set(this.nodeKey(neighbor), tentativeGScore + this.heuristic(neighbor, endNode))
          
          if (!openSet.some(n => this.nodeKey(n) === this.nodeKey(neighbor))) {
            openSet.push(neighbor)
          }
        }
      }
    }
    
    return [] // Path not found
  }

  /**
   * Reconstruct path from A* cameFrom map
   */
  reconstructPath(cameFrom, current) {
    const path = [current]
    let key = this.nodeKey(current)
    
    while (cameFrom.has(key)) {
      current = cameFrom.get(key)
      path.unshift(current)
      key = this.nodeKey(current)
    }
    
    return path
  }

  /**
   * Simplify path by removing collinear points
   */
  simplifyPath(path) {
    if (path.length <= 2) return path
    
    const simplified = [path[0]]
    
    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1]
      const current = path[i]
      const next = path[i + 1]
      
      // Check if current point is collinear with prev and next
      const dx1 = current.x - prev.x
      const dy1 = current.y - prev.y
      const dx2 = next.x - current.x
      const dy2 = next.y - current.y
      
      // If not in same direction, keep the point
      if (Math.sign(dx1) !== Math.sign(dx2) || Math.sign(dy1) !== Math.sign(dy2)) {
        simplified.push(current)
      }
    }
    
    simplified.push(path[path.length - 1])
    return simplified
  }

  /**
   * Get connection point on equipment (inlet or outlet)
   */
  getConnectionPoint(equipment, targetEquipment, type) {
    // Determine which side of equipment to connect based on target location
    const dx = targetEquipment.x - equipment.x
    const dy = targetEquipment.y - equipment.y
    
    let offsetX = 0
    let offsetY = 0
    
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal connection
      offsetX = dx > 0 ? 30 : -30
      offsetY = 0
    } else {
      // Vertical connection
      offsetX = 0
      offsetY = dy > 0 ? 30 : -30
    }
    
    return {
      x: equipment.x + offsetX,
      y: equipment.y + offsetY
    }
  }

  /**
   * Categorize pipe type based on connection data
   */
  categorizePipe(connection) {
    const lineNumber = (connection.line_number || '').toLowerCase()
    const fluid = (connection.fluid || '').toLowerCase()
    
    // Detect utility lines
    if (fluid.includes('steam') || lineNumber.includes('stm')) return 'utility-steam'
    if (fluid.includes('cooling') || fluid.includes('cw') || lineNumber.includes('cw')) return 'utility-cooling'
    if (fluid.includes('air') || lineNumber.includes('air')) return 'utility-air'
    if (fluid.includes('nitrogen') || lineNumber.includes('n2')) return 'utility-nitrogen'
    
    // Detect instrumentation lines
    if (connection.connection_type === 'instrument' || lineNumber.includes('inst')) return 'instrument'
    if (connection.connection_type === 'signal') return 'signal'
    
    // Default to process line
    return 'process'
  }

  /**
   * Get line style based on category
   */
  getLineStyle(category) {
    const styles = {
      'process': 'solid',
      'utility-steam': 'dashed',
      'utility-cooling': 'dashed',
      'utility-air': 'dotted',
      'utility-nitrogen': 'dotted',
      'instrument': 'dotted',
      'signal': 'dotted'
    }
    return styles[category] || 'solid'
  }

  /**
   * Get line width based on pipe size
   */
  getLineWidth(connection) {
    const pipeSize = connection.pipe_size || connection.nominal_size || 2
    
    // Map pipe size to line width (1-6 pixels)
    if (pipeSize >= 12) return 6
    if (pipeSize >= 8) return 5
    if (pipeSize >= 6) return 4
    if (pipeSize >= 4) return 3
    if (pipeSize >= 2) return 2
    return 1
  }

  /**
   * Calculate flow direction along waypoints
   */
  calculateFlowDirection(waypoints) {
    const arrows = []
    
    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i]
      const to = waypoints[i + 1]
      
      const midX = (from.x + to.x) / 2
      const midY = (from.y + to.y) / 2
      
      const angle = Math.atan2(to.y - from.y, to.x - from.x)
      
      arrows.push({
        x: midX,
        y: midY,
        angle
      })
    }
    
    return arrows
  }

  /**
   * Check if path has obstacle
   */
  hasObstacleInPath(from, to) {
    return this.occupiedSpaces.some(space => {
      return this.lineIntersectsRect(from, to, space)
    })
  }

  /**
   * Line-rectangle intersection test
   */
  lineIntersectsRect(from, to, rect) {
    // Simple bounding box check
    const minX = Math.min(from.x, to.x)
    const maxX = Math.max(from.x, to.x)
    const minY = Math.min(from.y, to.y)
    const maxY = Math.max(from.y, to.y)
    
    return !(maxX < rect.x || minX > rect.x + rect.width ||
             maxY < rect.y || minY > rect.y + rect.height)
  }

  /**
   * Add route to occupied spaces
   */
  addRouteToOccupiedSpaces(waypoints, routeIndex) {
    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i]
      const to = waypoints[i + 1]
      
      this.occupiedSpaces.push({
        x: Math.min(from.x, to.x) - this.minPipeSpacing / 2,
        y: Math.min(from.y, to.y) - this.minPipeSpacing / 2,
        width: Math.abs(to.x - from.x) + this.minPipeSpacing,
        height: Math.abs(to.y - from.y) + this.minPipeSpacing,
        type: 'pipe',
        routeIndex
      })
    }
  }

  /**
   * Snap point to grid
   */
  snapPointToGrid(point) {
    return {
      x: Math.round(point.x / this.gridSize) * this.gridSize,
      y: Math.round(point.y / this.gridSize) * this.gridSize
    }
  }

  /**
   * Create routing grid for pathfinding
   */
  createRoutingGrid() {
    // Grid is implicit, we'll check obstacles on demand
    return null
  }

  /**
   * Get neighbors for A* (4-directional)
   */
  getNeighbors(node) {
    return [
      { x: node.x + this.gridSize, y: node.y }, // Right
      { x: node.x - this.gridSize, y: node.y }, // Left
      { x: node.x, y: node.y + this.gridSize }, // Down
      { x: node.x, y: node.y - this.gridSize }  // Up
    ].filter(n => 
      n.x >= this.margins.left && 
      n.x <= this.width - this.margins.right &&
      n.y >= this.margins.top && 
      n.y <= this.height - this.margins.bottom
    )
  }

  /**
   * Check if node is obstacle
   */
  isObstacle(node) {
    return this.occupiedSpaces.some(space => 
      node.x >= space.x - this.minPipeSpacing &&
      node.x <= space.x + space.width + this.minPipeSpacing &&
      node.y >= space.y - this.minPipeSpacing &&
      node.y <= space.y + space.height + this.minPipeSpacing
    )
  }

  /**
   * Manhattan distance heuristic
   */
  heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
  }

  /**
   * Euclidean distance
   */
  distance(a, b) {
    return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2))
  }

  /**
   * Create unique key for node
   */
  nodeKey(node) {
    return `${node.x},${node.y}`
  }

  /**
   * Re-route a specific pipe (for interactive editing)
   */
  reRoutePipe(pipeId, newWaypoints, allRoutes) {
    // Update route in cache
    const updatedRoutes = allRoutes.map(route => {
      if (route.id === pipeId) {
        return {
          ...route,
          waypoints: newWaypoints,
          flowDirection: this.calculateFlowDirection(newWaypoints)
        }
      }
      return route
    })
    
    return updatedRoutes
  }

  /**
   * Auto-generate connections from equipment list based on sequence
   */
  autoGenerateConnections(equipmentList) {
    const connections = []
    
    // Validate input
    if (!equipmentList || !Array.isArray(equipmentList) || equipmentList.length < 2) {
      console.warn('Invalid equipment list for auto-generating connections')
      return connections
    }
    
    for (let i = 0; i < equipmentList.length - 1; i++) {
      const fromEquipment = equipmentList[i]
      const toEquipment = equipmentList[i + 1]
      
      // Validate equipment items have tag numbers
      if (!fromEquipment?.tag_number || !toEquipment?.tag_number) {
        console.warn(`Skipping connection at index ${i}: missing tag_number`)
        continue
      }
      
      connections.push({
        from_equipment: fromEquipment.tag_number,
        to_equipment: toEquipment.tag_number,
        line_number: `${fromEquipment.tag_number}-${toEquipment.tag_number}`,
        fluid: 'Process',
        connection_type: 'process',
        pipe_size: 4
      })
    }
    
    return connections
  }

  /**
   * Optimize all routes (minimize crossings and length)
   */
  optimizeRoutes(routes) {
    // Simple optimization: sort routes by length
    // Route shorter connections first to minimize crossings
    return routes.sort((a, b) => {
      const lengthA = this.calculateRouteLength(a.waypoints)
      const lengthB = this.calculateRouteLength(b.waypoints)
      return lengthA - lengthB
    })
  }

  /**
   * Calculate total route length
   */
  calculateRouteLength(waypoints) {
    let length = 0
    for (let i = 0; i < waypoints.length - 1; i++) {
      length += this.distance(waypoints[i], waypoints[i + 1])
    }
    return length
  }
}
