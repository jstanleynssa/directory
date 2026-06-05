// components/AdvisorMap.js
// The interactive US map (react-simple-maps). This component is CLIENT-ONLY:
// it is imported into pages/index.js via next/dynamic with { ssr: false }.
//
// WHY: react-simple-maps (ComposableMap/ZoomableGroup) is not safe to run
// during Next.js static prerender — it tries to destructure browser-only
// values at build time and throws "Invalid attempt to destructure non-iterable
// instance". The map is purely interactive (zoom, hover, click) and adds no SEO
// value, so deferring it to the browser is correct, not a workaround. The page's
// SEO content (heading, filters, results grid) still prerenders in index.js.

import { useMemo } from 'react'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'
import { feature } from 'topojson-client'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { STATE_NAMES, stateCode } from '../lib/geo'
import usTopo from '../lib/us-states.json'

const NSSA  = { light: '#8ECAEE', medium: '#1C80BC', dark: '#13405E' }
const IRMAA = { light: '#ED8E8E', medium: '#DE5B63', dark: '#AF2A35' }
const GRAY  = { text: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb', dark: '#1f2937' }

// Map dimensions — must match the ComposableMap width/height below.
const MAP_W = 975, MAP_H = 610

// Precompute each state's center + a zoom that fits the WHOLE state within the
// viewport. (Moved here with the map so all react-simple-maps / d3-geo usage
// lives behind the client-only boundary.)
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

// Exposed so index.js can use the same fitted-view logic for its caption/zoom.
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

export default function AdvisorMap({
  mapView, zoomNudge, mapZoomed, mapMarkers, passesDesignation,
  stateFilter, stateList, setStateFilter, setHovered,
  showPreview, hidePreview, onMarkerClick,
}) {
  return (
    <ComposableMap projection="geoAlbersUsa" width={975} height={610} className="rsm-svg" style={{ width: '100%', height: 'auto' }}>
      <ZoomableGroup center={mapView.center} zoom={Math.min(Math.max(mapView.zoom * zoomNudge, 1), 16)} minZoom={1} maxZoom={16}>
        <Geographies geography={usTopo}>
          {({ geographies }) =>
            geographies.map(geo => {
              const nm = geo.properties && geo.properties.name
              const code = nm ? stateCode(nm) : ''
              const clickable = !stateFilter && code && stateList.some(([c]) => c === code)
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onClick={clickable ? () => { setStateFilter(code); setHovered(null) } : undefined}
                  style={{
                    default: { fill: '#e9eef2', stroke: 'white', strokeWidth: 0.75, outline: 'none', cursor: clickable ? 'pointer' : 'default' },
                    hover:   { fill: clickable ? '#d6e3ec' : '#e9eef2', stroke: 'white', strokeWidth: 0.75, outline: 'none', cursor: clickable ? 'pointer' : 'default' },
                    pressed: { fill: '#d6e3ec', outline: 'none' },
                  }}
                />
              )
            })
          }
        </Geographies>
        {mapMarkers.map(a => {
          const visible = passesDesignation(a)
          return (
            <Marker key={a.slug} coordinates={[a.coords.lng, a.coords.lat]}>
              <circle
                className="map-marker"
                r={(mapZoomed ? 5 : 4) / mapView.zoom ** 0.7}
                fill={a.nssa && a.irmaa ? '#7B4F9E' : a.irmaa ? IRMAA.medium : NSSA.medium}
                stroke="white"
                strokeWidth={1.2 / mapView.zoom ** 0.7}
                style={{
                  opacity: visible ? 0.85 : 0,
                  transition: 'opacity 0.35s ease-in-out',
                  pointerEvents: visible && mapZoomed ? 'auto' : 'none',
                  cursor: mapZoomed ? 'pointer' : 'default',
                }}
                onClick={visible && mapZoomed ? () => onMarkerClick(a) : undefined}
                onMouseEnter={visible && mapZoomed ? (e) => {
                  const rect = e.currentTarget.ownerSVGElement.parentElement.getBoundingClientRect()
                  showPreview(a, e.clientX - rect.left, e.clientY - rect.top)
                } : undefined}
                onMouseLeave={visible && mapZoomed ? hidePreview : undefined}
              />
            </Marker>
          )
        })}
      </ZoomableGroup>
    </ComposableMap>
  )
}
