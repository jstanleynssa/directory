// components/AdvisorMap.js
// The interactive US map (react-simple-maps). CLIENT-ONLY: imported into
// pages/index.js via next/dynamic with { ssr: false }.
//
// WHY CLIENT-ONLY: react-simple-maps (ComposableMap/ZoomableGroup) is not safe
// to run during Next.js static prerender — it destructures browser-only values
// at build time and throws "Invalid attempt to destructure non-iterable
// instance". The map is purely interactive (zoom/hover/click) and adds no SEO
// value, so deferring it to the browser is correct.
//
// CRITICAL: this is the ONLY module that imports react-simple-maps. Nothing
// server-reachable may import from here, or react-simple-maps gets pulled into
// the server build and the prerender error returns. The view math lives in
// lib/stateView.js (no react-simple-maps) so index.js can use it SSR-side.

import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'
import { stateCode } from '../lib/geo'
import usTopo from '../lib/us-states.json'

const NSSA  = { light: '#8ECAEE', medium: '#1C80BC', dark: '#13405E' }
const IRMAA = { light: '#ED8E8E', medium: '#DE5B63', dark: '#AF2A35' }

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
