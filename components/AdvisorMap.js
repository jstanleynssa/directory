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
// Drag-to-pan: pointer events on the SVG accumulate a [dragDx, dragDy] offset
// (in SVG coordinate space) that is folded into the transform alongside the
// fitted-view center. The offset resets whenever the fitted view changes (new
// state / ZIP / cleared). Clicks on dots and states are suppressed when the
// pointer moved more than DRAG_THRESHOLD px during the interaction.

import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { feature } from 'topojson-client'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { stateCode } from '../lib/geo'
import usTopo from '../lib/us-states.json'

const NSSA  = { light: '#8ECAEE', medium: '#1C80BC', dark: '#13405E' }
const IRMAA = { light: '#ED8E8E', medium: '#DE5B63', dark: '#AF2A35' }

const MAP_W = 975, MAP_H = 610

// How many screen pixels the pointer must move before we treat the interaction
// as a drag (and suppress the click handler on release).
const DRAG_THRESHOLD = 4

const projection = geoAlbersUsa().translate([MAP_W / 2, MAP_H / 2])
const pathGen = geoPath(projection)

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

// Resolve dot fill color based on the active designation filter.
function dotColor(a, designation) {
  if (designation === 'nssa')  return NSSA.medium
  if (designation === 'irmaa') return IRMAA.medium
  if (designation === 'both')  return '#7B4F9E'
  return a.nssa && a.irmaa ? '#7B4F9E' : a.irmaa ? IRMAA.medium : NSSA.medium
}

export default function AdvisorMap({
  mapView, zoomNudge, mapZoomed, mapMarkers, passesDesignation,
  designation,
  stateFilter, stateList, setStateFilter, setHovered,
  showPreview, hidePreview, onMarkerClick,
}) {
  const zoom = Math.min(Math.max(mapView.zoom * zoomNudge, 1), 16)
  const z = Math.pow(zoom, 0.7)

  // ── Drag state ────────────────────────────────────────────────────────────
  // dragOffset: accumulated pan in SVG coordinate space (persists across drags).
  // dragStart:  screen-pixel position where the current drag began (or null).
  // dragging:   true while pointer is down and has exceeded the threshold.
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const dragStart   = useRef(null)   // { screenX, screenY, offsetX, offsetY }
  const dragging    = useRef(false)  // exceeded threshold during this pointer-down
  const wasDragged  = useRef(false)  // used to suppress click on pointer-up
  const svgRef      = useRef(null)

  // Reset drag offset whenever the fitted view changes (state / ZIP / cleared).
  // We key on the serialised center + zoom so we only reset on real view changes.
  const viewKey = `${mapView.center[0]},${mapView.center[1]},${mapView.zoom}`
  const prevViewKey = useRef(viewKey)
  useEffect(() => {
    if (prevViewKey.current !== viewKey) {
      setDragOffset({ x: 0, y: 0 })
      prevViewKey.current = viewKey
    }
  }, [viewKey])

  // Convert a screen-pixel delta to SVG coordinate space.
  // The SVG is rendered at its natural aspect ratio inside whatever container
  // width the browser gives it. We read the rendered width off the element to
  // get the pixel→SVG scale factor, then divide by the current zoom so the map
  // moves 1:1 with the pointer regardless of zoom level.
  const screenDeltaToSvg = useCallback((dScreenX, dScreenY) => {
    const el = svgRef.current
    if (!el) return { dx: 0, dy: 0 }
    const renderedWidth = el.getBoundingClientRect().width
    const svgScale = MAP_W / renderedWidth  // SVG units per screen pixel
    return {
      dx: dScreenX * svgScale / zoom,
      dy: dScreenY * svgScale / zoom,
    }
  }, [zoom])

  const handlePointerDown = useCallback((e) => {
    // Only drag with primary button (left-click / touch)
    if (e.button !== undefined && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStart.current = {
      screenX: e.clientX,
      screenY: e.clientY,
      offsetX: dragOffset.x,
      offsetY: dragOffset.y,
    }
    dragging.current  = false
    wasDragged.current = false
  }, [dragOffset])

  const handlePointerMove = useCallback((e) => {
    if (!dragStart.current) return
    const dScreen = {
      x: e.clientX - dragStart.current.screenX,
      y: e.clientY - dragStart.current.screenY,
    }
    // Cross the threshold? Mark as a real drag and hide the hover badge.
    if (!dragging.current) {
      if (Math.abs(dScreen.x) > DRAG_THRESHOLD || Math.abs(dScreen.y) > DRAG_THRESHOLD) {
        dragging.current   = true
        wasDragged.current = true
        hidePreview()
      } else {
        return
      }
    }
    const { dx, dy } = screenDeltaToSvg(dScreen.x, dScreen.y)
    setDragOffset({
      x: dragStart.current.offsetX + dx,
      y: dragStart.current.offsetY + dy,
    })
  }, [screenDeltaToSvg, hidePreview])

  const handlePointerUp = useCallback((e) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    dragStart.current = null
    dragging.current  = false
    // wasDragged.current stays true until the next pointerDown so the click
    // handler (which fires after pointerUp) can suppress itself.
  }, [])

  // ── Transform ─────────────────────────────────────────────────────────────
  const transform = useMemo(() => {
    const c = projection(mapView.center)
    const px = (c && isFinite(c[0])) ? c[0] : MAP_W / 2
    const py = (c && isFinite(c[1])) ? c[1] : MAP_H / 2
    const tx = MAP_W / 2 - px * zoom + dragOffset.x * zoom
    const ty = MAP_H / 2 - py * zoom + dragOffset.y * zoom
    return `translate(${tx} ${ty}) scale(${zoom})`
  }, [mapView.center, zoom, dragOffset])

  // ── Jitter overlapping dots ───────────────────────────────────────────────
  const jitteredMarkers = useMemo(() => {
    const projected = []
    for (const a of mapMarkers) {
      const p = projection([a.coords.lng, a.coords.lat])
      if (!p || !isFinite(p[0]) || !isFinite(p[1])) continue
      projected.push({ a, px: p[0], py: p[1] })
    }
    const groups = new Map()
    for (const m of projected) {
      const key = `${Math.round(m.px)},${Math.round(m.py)}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(m)
    }
    const out = []
    const baseRadius = 7 / z
    for (const members of groups.values()) {
      if (members.length === 1) {
        out.push({ a: members[0].a, x: members[0].px, y: members[0].py })
        continue
      }
      const radius = baseRadius * (1 + Math.min(members.length, 8) * 0.12)
      members.forEach((m, i) => {
        const angle = (2 * Math.PI * i) / members.length - Math.PI / 2
        out.push({
          a: m.a,
          x: m.px + radius * Math.cos(angle),
          y: m.py + radius * Math.sin(angle),
        })
      })
    }
    return out
  }, [mapMarkers, z])

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      className="rsm-svg"
      style={{
        width: '100%', height: 'auto', display: 'block',
        cursor: dragging.current ? 'grabbing' : (mapZoomed ? 'grab' : 'default'),
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      role="img"
      aria-label="Map of NSSA and IRMAACP certified advisors across the United States"
      onPointerDown={mapZoomed ? handlePointerDown : undefined}
      onPointerMove={mapZoomed ? handlePointerMove : undefined}
      onPointerUp={mapZoomed ? handlePointerUp : undefined}
      onPointerCancel={mapZoomed ? handlePointerUp : undefined}
    >
      <g
        className="map-zoom-group"
        transform={transform}
        style={{
          // CSS transition only when NOT actively dragging — during a drag we
          // update on every pointermove so the animation would lag behind.
          transition: dragging.current ? 'none' : 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* States */}
        {STATE_FEATURES.map(s => {
          const code = s.name ? stateCode(s.name) : ''
          const clickable = !stateFilter && code && stateList.some(([c]) => c === code)
          return (
            <path
              key={s.name}
              d={s.d}
              onClick={clickable && !wasDragged.current
                ? () => { setStateFilter(code); setHovered(null) }
                : undefined}
              style={{
                fill: '#e9eef2',
                stroke: 'white',
                strokeWidth: 0.75 / z,
                outline: 'none',
                cursor: clickable ? (dragging.current ? 'grabbing' : 'pointer') : 'inherit',
                transition: 'fill 0.15s ease',
              }}
              onMouseEnter={clickable ? (e) => { e.currentTarget.style.fill = '#d6e3ec' } : undefined}
              onMouseLeave={clickable ? (e) => { e.currentTarget.style.fill = '#e9eef2' } : undefined}
            />
          )
        })}

        {/* Advisor dots */}
        {jitteredMarkers.map(({ a, x, y }) => {
          const visible = passesDesignation(a)
          return (
            <circle
              key={a.slug}
              className="map-marker"
              cx={x}
              cy={y}
              r={(mapZoomed ? 5 : 4) / z}
              fill={dotColor(a, designation)}
              stroke="white"
              strokeWidth={1.2 / z}
              style={{
                opacity: visible ? 0.85 : 0,
                transition: 'opacity 0.35s ease-in-out, fill 0.25s ease-in-out',
                pointerEvents: visible && mapZoomed ? 'auto' : 'none',
                cursor: mapZoomed ? (dragging.current ? 'grabbing' : 'pointer') : 'default',
              }}
              onClick={visible && mapZoomed && !wasDragged.current
                ? () => onMarkerClick(a)
                : undefined}
              onMouseEnter={visible && mapZoomed ? (e) => {
                if (dragging.current) return
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
