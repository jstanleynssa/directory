// components/AdvisorMap.js
// Self-contained interactive US map, rendered directly with d3-geo (NO
// react-simple-maps). CLIENT-ONLY: imported into pages/index.js via
// next/dynamic({ ssr: false }).
//
// WHY no react-simple-maps: that library (v3, 2022) crashes against React 18 /
// modern d3 with "Invalid attempt to destructure non-iterable instance", both
// at build-time prerender and at client runtime. Since the app already depends
// on d3-geo + topojson-client, we render the states as plain SVG <path> and the
// advisors as <circle>, and implement zoom/pan as an animated SVG <g transform>.
// This removes the fragile dependency entirely while preserving every
// interaction: zoom-to-state on click, ZIP-proximity zoom, hover badges,
// click-to-navigate, designation cross-fade, and the +/- zoom controls.
//
// Drop-in: same props as the previous react-simple-maps version, so index.js
// needs no changes.

import { useMemo } from 'react'
import { feature } from 'topojson-client'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { stateCode } from '../lib/geo'
import usTopo from '../lib/us-states.json'

const NSSA  = { light: '#8ECAEE', medium: '#1C80BC', dark: '#13405E' }
const IRMAA = { light: '#ED8E8E', medium: '#DE5B63', dark: '#AF2A35' }

// Must match stateView.js (the zoom-fit math is computed against these dims).
const MAP_W = 975, MAP_H = 610

// One shared projection + path generator, identical to what react-simple-maps
// used by default (geoAlbersUsa translated to the map center). Built once.
const projection = geoAlbersUsa().translate([MAP_W / 2, MAP_H / 2])
const pathGen = geoPath(projection)

// Pre-extract the state features + their rendered SVG path strings once.
const STATE_FEATURES = (() => {
  try {
    const fc = feature(usTopo, usTopo.objects.states)
    return fc.features.map(f => ({
      name: (f.properties && f.properties.name) || '',
      d: pathGen(f) || '',
    })).filter(s => s.d)
  } catch (e) {
    return []
  }
})()

export default function AdvisorMap({
  mapView, zoomNudge, mapZoomed, mapMarkers, passesDesignation,
  stateFilter, stateList, setStateFilter, setHovered,
  showPreview, hidePreview, onMarkerClick,
}) {
  // Effective zoom = the fitted view's zoom × the user's +/- nudge, clamped.
  const zoom = Math.min(Math.max(mapView.zoom * zoomNudge, 1), 16)

  // Project the geographic center [lng, lat] to pixel space, then build a
  // transform that scales around that point and recentres it in the viewport.
  // This reproduces react-simple-maps' ZoomableGroup behavior with a plain
  // SVG <g transform>, animated via CSS transition.
  const transform = useMemo(() => {
    const c = projection(mapView.center) // -> [px, py] or null
    const px = (c && isFinite(c[0])) ? c[0] : MAP_W / 2
    const py = (c && isFinite(c[1])) ? c[1] : MAP_H / 2
    // translate the focal point to viewport center, scaled by zoom
    const tx = MAP_W / 2 - px * zoom
    const ty = MAP_H / 2 - py * zoom
    return `translate(${tx} ${ty}) scale(${zoom})`
  }, [mapView.center, zoom])

  // Stroke widths / dot radii shrink with zoom so they look right when scaled.
  const z = Math.pow(zoom, 0.7)

  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      className="rsm-svg"
      style={{ width: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label="Map of NSSA and IRMAACP certified advisors across the United States"
    >
      <g className="map-zoom-group" transform={transform} style={{ transition: 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)' }}>
        {/* States */}
        {STATE_FEATURES.map(s => {
          const code = s.name ? stateCode(s.name) : ''
          const clickable = !stateFilter && code && stateList.some(([c]) => c === code)
          return (
            <path
              key={s.name}
              d={s.d}
              onClick={clickable ? () => { setStateFilter(code); setHovered(null) } : undefined}
              style={{
                fill: '#e9eef2',
                stroke: 'white',
                strokeWidth: 0.75 / z,
                outline: 'none',
                cursor: clickable ? 'pointer' : 'default',
                transition: 'fill 0.15s ease',
              }}
              onMouseEnter={clickable ? (e) => { e.currentTarget.style.fill = '#d6e3ec' } : undefined}
              onMouseLeave={clickable ? (e) => { e.currentTarget.style.fill = '#e9eef2' } : undefined}
            />
          )
        })}

        {/* Advisor dots */}
        {mapMarkers.map(a => {
          const p = projection([a.coords.lng, a.coords.lat])
          if (!p || !isFinite(p[0]) || !isFinite(p[1])) return null
          const visible = passesDesignation(a)
          return (
            <circle
              key={a.slug}
              className="map-marker"
              cx={p[0]}
              cy={p[1]}
              r={(mapZoomed ? 5 : 4) / z}
              fill={a.nssa && a.irmaa ? '#7B4F9E' : a.irmaa ? IRMAA.medium : NSSA.medium}
              stroke="white"
              strokeWidth={1.2 / z}
              style={{
                opacity: visible ? 0.85 : 0,
                transition: 'opacity 0.35s ease-in-out',
                pointerEvents: visible && mapZoomed ? 'auto' : 'none',
                cursor: mapZoomed ? 'pointer' : 'default',
              }}
              onClick={visible && mapZoomed ? () => onMarkerClick(a) : undefined}
              onMouseEnter={visible && mapZoomed ? (e) => {
                const svg = e.currentTarget.ownerSVGElement
                const rect = svg.parentElement.getBoundingClientRect()
                showPreview(a, e.clientX - rect.left, e.clientY - rect.top)
              } : undefined}
              onMouseLeave={visible && mapZoomed ? hidePreview : undefined}
            />
          )
        })}
      </g>
    </svg>
  )
}
