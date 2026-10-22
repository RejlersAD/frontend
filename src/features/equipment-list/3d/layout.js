/**
 * Deterministic auto-layout for equipment without a plot-plan position.
 *
 * Plant coordinates: x = east, y = north, z = elevation (item base).
 * - One plot area per unit, west → east by ascending unit number.
 *   Area width 80 m, 10 m gap between areas.
 * - Pipe rack along X at y = 0, 6 m wide, beam levels z = 6.0 and 9.0.
 * - Rows (y of item centre): T +30; EA 0 at z 10.0 (rack top);
 *   G/P/K −6; C/V/F −14; D/E −24.
 * - Within a row: order by seq then suffix; spacing = previous
 *   footprint + 3.0 m clearance.
 */

export const UNIT_AREA_WIDTH = 80;
export const UNIT_GAP = 10;
export const RACK_WIDTH = 6;
export const RACK_LEVELS = [6.0, 9.0];
export const RACK_TOP_Z = 10.0;
export const ROW_CLEARANCE = 3.0;

function rowFor(typeCode) {
  if (typeCode === "T") return { y: 30, z: 0 };
  if (typeCode === "EA") return { y: 0, z: RACK_TOP_Z };
  if (typeCode === "G" || typeCode === "P" || typeCode === "K")
    return { y: -6, z: 0 };
  if (typeCode === "C" || typeCode === "V" || typeCode === "F")
    return { y: -14, z: 0 };
  if (typeCode === "D" || typeCode === "E") return { y: -24, z: 0 };
  return { y: -14, z: 0 };
}

/**
 * @param {Array} items model items with { tag, unit, typeCode, seq, suffix,
 *   footprint, position? }
 * @returns {{ positions: Map<string, {x,y,z,rotationDeg,source}>,
 *   autoPlacedByUnit: Map<string, number>, autoPlacedCount: number }}
 */
export function autoLayout(items) {
  const positions = new Map();
  const autoPlacedByUnit = new Map();
  let autoPlacedCount = 0;

  const byUnit = new Map();
  for (const item of items) {
    const unit = item.unit || "0000";
    if (!byUnit.has(unit)) byUnit.set(unit, []);
    byUnit.get(unit).push(item);
  }
  const units = [...byUnit.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  units.forEach((unit, unitIndex) => {
    const originX = unitIndex * (UNIT_AREA_WIDTH + UNIT_GAP);
    const rows = new Map(); // key `${y}:${z}` → items
    for (const item of byUnit.get(unit)) {
      if (item.position && item.position.source === "plotplan") {
        positions.set(item.tag, item.position);
        continue;
      }
      const row = rowFor(item.typeCode);
      const key = `${row.y}:${row.z}`;
      if (!rows.has(key)) rows.set(key, { row, items: [] });
      rows.get(key).items.push(item);
      autoPlacedCount += 1;
      autoPlacedByUnit.set(unit, (autoPlacedByUnit.get(unit) || 0) + 1);
    }
    for (const { row, items: rowItems } of rows.values()) {
      rowItems.sort(
        (a, b) => (a.seq - b.seq) || String(a.suffix).localeCompare(String(b.suffix)),
      );
      let cursorX = originX + 8;
      let previousFootprint = 0;
      for (const item of rowItems) {
        cursorX += previousFootprint > 0 ? previousFootprint / 2 + ROW_CLEARANCE + (item.footprint || 2) / 2 : 0;
        positions.set(item.tag, {
          x: cursorX,
          y: row.y,
          z: row.z,
          rotationDeg: 0,
          source: "auto",
        });
        previousFootprint = item.footprint || 2;
        cursorX += previousFootprint / 2;
      }
    }
  });

  return { positions, autoPlacedByUnit, autoPlacedCount };
}

/** Nearest pipe-rack beam level for a given elevation. */
export function nearestRackLevel(z) {
  return Math.abs(z - RACK_LEVELS[0]) <= Math.abs(z - RACK_LEVELS[1])
    ? RACK_LEVELS[0]
    : RACK_LEVELS[1];
}

/**
 * Route a line orthogonally: rise from the from-item to the nearest rack
 * level → run along the rack (y = 0) → drop to the to-item.
 * @returns array of {x,y,z} path points.
 */
export function routeLine(fromItem, toItem) {
  const a = fromItem.position;
  const b = toItem.position;
  const aTop = a.z + (fromItem.height || 2);
  const bTop = b.z + (fromItem === toItem ? 2 : toItem.height || 2);
  const level = nearestRackLevel(Math.max(aTop, bTop));
  return [
    { x: a.x, y: a.y, z: aTop },
    { x: a.x, y: a.y, z: level },
    { x: a.x, y: 0, z: level },
    { x: b.x, y: 0, z: level },
    { x: b.x, y: b.y, z: level },
    { x: b.x, y: b.y, z: bTop },
  ];
}
