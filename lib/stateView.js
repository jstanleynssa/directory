// lib/stateView.js
// State-fit view math (center + zoom per US state) for the directory map.
//
// IMPORTANT: this module must NOT import react-simple-maps. It is imported by
// BOTH pages/index.js (server-side, at build) and components/AdvisorMap.js
// (client-side). It uses only d3-geo + topojson-client, which are pure and
// SSR-safe. Keeping react-simple-maps out of here is what lets index.js stay
// server-renderable while the map itself stays client-only.

import { feature } from 'topojson-client'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { STATE_NAMES } from './geo'
import usTopo from './us-states.json'

// Map dimensions — must match the ComposableMap width/height in AdvisorMap.
const MAP_W = 975, MAP_H = 610

// Precompute each state's center + a zoom that fits the WHOLE state within the
// viewport. We replicate react-simple-maps' default projection (geoAlbersUsa,
// translated to the map center) and measure each state's real pixel bbox.
const STATE_VIEW = (() => {
  const out = {}
  try {
    const fc = feature(usTopo, usTopo.objects.states)
    const projection = geoAlbersUsa().translate([MAP_W / 2, MAP_H / 2])
    const path = geoPath(projection)
    for (const f of fc.features) {
      const nm = f.properties && f.properties.name
      if (!nm) continue
      const [[x0, y0], [x1, y1]] = path.bounds(f)
      const w = Math.max(x1 - x0, 1)
      const h = Math.max(y1 - y0, 1)
      const fit = Math.min(MAP_W / w, MAP_H / h) * 0.88
      const zoom = Math.min(Math.max(fit, 1.2), 14)
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
      const center = projection.invert ? projection.invert([cx, cy]) : null
      if (center && isFinite(center[0]) && isFinite(center[1])) {
        out[nm] = { center, zoom }
      }
    }
  } catch (e) { /* fall back to advisor-spread zoom if anything fails */ }
  return out
})()

// Fitted view for a state abbreviation; falls back to the average of supplied
// advisor markers' coords if the bounds lookup misses.
export function getStateView(stateAbbr, markers) {
  const name = STATE_NAMES[stateAbbr]
  const v = name && STATE_VIEW[name]
  if (v) return v
  const pts = (markers || []).map(a => a.coords).filter(Boolean)
  if (pts.length) {
    const avgLng = pts.reduce((s, p) => s + p.lng, 0) / pts.length
    const avgLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length
    return { center: [avgLng, avgLat], zoom: 5 }
  }
  return null
}
