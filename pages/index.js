// pages/index.js
// Advisor Directory index — branded US map + filters + results grid.
// SSG: getStaticProps builds the full advisor list (with zip-derived coords)
// at build time; all filtering happens client-side over that lightweight list.
//
// NOTE: the interactive US map lives in components/AdvisorMap.js and is loaded
// CLIENT-ONLY via next/dynamic({ ssr: false }). react-simple-maps cannot be
// server-prerendered (it throws "Invalid attempt to destructure non-iterable
// instance" during static export), and the map adds no SEO value — the page's
// heading, filters, and results grid still prerender for search engines.

import Head from 'next/head'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { buildSlugIndex, stateToken } from '../lib/slug'
import { STATE_NAMES, stateCode, coordsForZip, milesBetween } from '../lib/geo'

// Client-only map (react-simple-maps is not SSR-safe). A lightweight placeholder
// keeps layout stable until the map hydrates in the browser.
const AdvisorMap = dynamic(() => import('../components/AdvisorMap'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', aspectRatio: '975 / 610', background: '#eef1f4', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '14px' }}>
      Loading map…
    </div>
  ),
})
// Same fitted-view helper the map uses — imported from lib/stateView (which is
// SSR-safe: no react-simple-maps). Importing it from AdvisorMap would pull the
// map library into the server build and re-break the prerender.
import { getStateView } from '../lib/stateView'

const NSSA  = { light: '#8ECAEE', medium: '#1C80BC', dark: '#13405E' }
const IRMAA = { light: '#ED8E8E', medium: '#DE5B63', dark: '#AF2A35' }
const BOTH  = '#7B4F9E'
const GRAY  = { text: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb', dark: '#1f2937' }
const TAN   = '#b3a584'
const ROOT  = 'https://nssapros.com'
const SITE  = 'https://directory.nssapros.com'
const NSSA_COURSE  = 'https://www.nssapros.com/social-security-training'
const IRMAA_COURSE = 'https://www.nssapros.com/irmaa-medicare-training-course'

const RADIUS_OPTIONS = [10, 25, 50, 100, 250]

// Generic gray silhouette for advisors without a headshot.
function Silhouette({ size }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#e2e5ea', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} aria-hidden="true">
      <svg viewBox="0 0 64 64" width={size} height={size} style={{ display: 'block' }}>
        <circle cx="32" cy="24" r="13" fill="#b9bec7" />
        <path d="M9 60c0-13 10.3-21 23-21s23 8 23 21z" fill="#b9bec7" />
      </svg>
    </div>
  )
}

export default function DirectoryIndex({ advisors, stateList }) {
  const [name, setName] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [designation, setDesignation] = useState('') // '', 'nssa', 'irmaa', 'both'
  const [zip, setZip] = useState('')
  const [radius, setRadius] = useState(50)
  const [origin, setOrigin] = useState(null) // {lat,lng} for proximity
  const [zipError, setZipError] = useState('')
  const [zipLoading, setZipLoading] = useState(false)
  const [hovered, setHovered] = useState(null) // advisor under cursor (when map is zoomed)
  const [dismissing, setDismissing] = useState(false) // drives the fade-out animation
  const [zoomNudge, setZoomNudge] = useState(1) // user zoom-control multiplier on top of mapView.zoom
  const dismissTimer = useRef(null)
  const router = useRouter()

  // The map is "zoomed/interactive" when a state is selected OR a ZIP origin is set.
  const mapZoomed = !!(stateFilter || origin)

  // Reset manual zoom whenever the fitted view changes (new state / ZIP / cleared).
  useEffect(() => { setZoomNudge(1) }, [stateFilter, origin])

  // Show the hover badge, cancelling any pending fade-out.
  const showPreview = useCallback((advisor, x, y) => {
    if (dismissTimer.current) { clearTimeout(dismissTimer.current); dismissTimer.current = null }
    setDismissing(false)
    setHovered({ advisor, x, y })
  }, [])

  // Begin fade-out, then clear after the animation completes.
  const hidePreview = useCallback(() => {
    setDismissing(true)
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    dismissTimer.current = setTimeout(() => { setHovered(null); setDismissing(false); dismissTimer.current = null }, 160)
  }, [])

  // Resolve the visitor's zip via the lightweight API (keeps the big dataset server-side).
  const applyZip = useCallback(async () => {
    const z = zip.trim()
    if (!z) { setOrigin(null); setZipError(''); return }
    setZipLoading(true); setZipError('')
    try {
      const r = await fetch(`/api/zip?z=${encodeURIComponent(z)}`)
      if (!r.ok) { setOrigin(null); setZipError('ZIP not found'); return }
      const c = await r.json()
      setStateFilter('')   // proximity is national; clear any state filter so results aren't double-constrained
      setOrigin(c)
    } catch {
      setOrigin(null); setZipError('Could not look up ZIP')
    } finally {
      setZipLoading(false)
    }
  }, [zip])

  const clearProximity = useCallback(() => {
    setZip(''); setOrigin(null); setZipError('')
  }, [])

  // Filtered + distance-annotated advisor list.
  const filtered = useMemo(() => {
    const q = name.trim().toLowerCase()
    let list = advisors.filter(a => {
      if (stateFilter && a.stateCode !== stateFilter) return false
      if (designation === 'nssa'  && !a.nssa) return false
      if (designation === 'irmaa' && !a.irmaa) return false
      if (designation === 'both'  && !(a.nssa && a.irmaa)) return false
      if (q) {
        const hay = `${a.name} ${a.company || ''} ${a.city || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    if (origin) {
      list = list
        .map(a => ({ ...a, distance: a.coords ? milesBetween(origin, a.coords) : Infinity }))
        .filter(a => a.distance <= radius)
        .sort((x, y) => x.distance - y.distance)
    } else {
      list = [...list].sort((x, y) => x.name.localeCompare(y.name))
    }
    return list
  }, [advisors, name, stateFilter, designation, origin, radius])

  // Markers shown on the map = filtered advisors that have coordinates.
  const markers = useMemo(
    () => filtered.filter(a => a.coords),
    [filtered]
  )

  // Map dots are filtered by everything EXCEPT designation, so switching
  // designation only animates each dot's opacity (true differential cross-fade)
  // rather than swapping the whole dot set. `passesDesignation` decides visibility.
  const mapMarkers = useMemo(() => {
    const q = name.trim().toLowerCase()
    let list = advisors.filter(a => {
      if (!a.coords) return false
      if (stateFilter && a.stateCode !== stateFilter) return false
      if (q) {
        const hay = `${a.name} ${a.company || ''} ${a.city || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    if (origin) {
      list = list
        .map(a => ({ ...a, distance: milesBetween(origin, a.coords) }))
        .filter(a => a.distance <= radius)
    }
    return list
  }, [advisors, name, stateFilter, origin, radius])

  const passesDesignation = useCallback((a) => {
    if (designation === 'nssa')  return !!a.nssa
    if (designation === 'irmaa') return !!a.irmaa
    if (designation === 'both')  return !!(a.nssa && a.irmaa)
    return true
  }, [designation])

  // Count actually visible on the map (passing designation), for the caption.
  const visibleMapCount = useMemo(
    () => mapMarkers.filter(passesDesignation).length,
    [mapMarkers, passesDesignation]
  )

  const hasFilters = name || stateFilter || designation || origin
  // Whether a *narrowing* filter is active — name, state, or ZIP proximity, but
  // NOT the designation toggle. The advisor count is shown only when one of
  // these is set, so toggling NSSA®/IRMAACP®/All alone never reveals the total.
  const hasNarrowingFilter = !!(name || stateFilter || origin)

  // Map view: zoom to the selected state by its geographic bounds (consistent
  // regardless of advisor distribution), or to the proximity origin.
  const mapView = useMemo(() => {
    if (origin) {
      return { center: [origin.lng, origin.lat], zoom: 6 }
    }
    if (stateFilter) {
      const v = getStateView(stateFilter, markers)
      if (v) return v
    }
    return { center: [-96, 38], zoom: 1 }
  }, [markers, stateFilter, origin])

  return (
    <>
      <Head>
        <title>Find an NSSA® or IRMAACP™ Certified Advisor Near You | NSSA® Directory</title>
        <meta name="description" content="Search the national directory of NSSA® and IRMAACP™ certified advisors. Find a Social Security and Medicare planning professional by name, state, or proximity to your ZIP code." />
        <link rel="canonical" href={SITE + '/'} />
        <meta property="og:title" content="Find an NSSA® or IRMAACP™ Certified Advisor" />
        <meta property="og:description" content="Search the national directory of certified Social Security and Medicare planning advisors." />
        <meta property="og:url" content={SITE + '/'} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <style>{`
        .dir-top { display: grid; grid-template-columns: 320px 1fr; gap: 2rem; align-items: stretch; margin-bottom: 2.5rem; }
        .map-wrap { background: ${GRAY.bg}; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: center; }
        .cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem; }
        .cards > a { min-width: 0; }
        .filter-input { width: 100%; padding: 11px 13px; font-size: 15px; border: 1px solid ${GRAY.border}; border-radius: 8px; box-sizing: border-box; font-family: inherit; background: white; outline: none; }
        .filter-label { display:block; font-size: 13px; font-weight: 600; color: ${GRAY.dark}; margin-bottom: 6px; font-family: "Poppins", system-ui, sans-serif; }
        .rsm-geography:focus { outline: none; }
        .rsm-zoomable-group { transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1); }
        .map-marker { cursor: pointer; transition: r 0.2s ease; }
        @keyframes badgePop { 0% { opacity: 0; transform: scale(0.85) translateY(4px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes badgePopOut { 0% { opacity: 1; transform: scale(1) translateY(0); } 100% { opacity: 0; transform: scale(0.9) translateY(3px); } }
        .advisor-pop { animation: badgePop 0.16s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .advisor-pop-out { animation: badgePopOut 0.16s ease-in forwards; }
        @media (max-width: 1024px) {
          .dir-top { grid-template-columns: 1fr; }
          .cards { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .cards { grid-template-columns: 1fr; }
          .site-nav { display: none !important; }
        }
      `}</style>

      <div style={{ fontFamily: '"Open Sans", system-ui, -apple-system, sans-serif', color: GRAY.dark, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Nav — mirrors the profile pages */}
        <header style={{ background: 'white', borderBottom: `1px solid ${GRAY.border}`, padding: '1rem 2rem' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <a href={ROOT}><img src="/nssa-logo.png" alt="National Social Security Advisors" style={{ height: '44px', width: 'auto' }} /></a>
            <nav className="site-nav" style={{ display: 'flex', gap: '26px', alignItems: 'center', fontSize: '15px' }}>
              {[
                ['About Us', `${ROOT}/about`],
                ['Social Security Training', NSSA_COURSE],
                ['IRMAA Medicare Training', IRMAA_COURSE],
                ['Find an Advisor', SITE + '/'],
                ['Contact Us', `${ROOT}/contact`],
              ].map(([label, href]) => (
                <a key={label} href={href} style={{ color: GRAY.dark, textDecoration: 'none' }}>{label}</a>
              ))}
            </nav>
          </div>
        </header>

        {/* Hero / heading */}
        <section style={{ background: GRAY.bg, padding: '2.5rem 2rem 2rem' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ fontFamily: '"Poppins", system-ui, sans-serif', fontSize: '2.2rem', fontWeight: 700, color: IRMAA.dark, margin: 0 }}>
              Find a Certified Advisor
            </h1>
            <p style={{ fontSize: '16px', color: GRAY.text, maxWidth: '760px', marginTop: '0.75rem', lineHeight: 1.6 }}>
              Search our national directory of NSSA® and IRMAACP™ certified professionals.<br />
              Filter by name, state, designation, or distance from your ZIP code.
            </p>
          </div>
        </section>

        {/* Main */}
        <section style={{ padding: '2rem', flex: 1 }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

            {/* Top row: filters (left) + large map (right) */}
            <div className="dir-top">

              {/* Filters */}
              <div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="filter-label">Search by name, company, or city</label>
                  <input className="filter-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cheney, or Boston" />
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="filter-label">State</label>
                  <select className="filter-input" value={stateFilter} onChange={e => { setStateFilter(e.target.value); setHovered(null) }}>
                    <option value="">All states</option>
                    {stateList.map(([code, label]) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="filter-label">Designation</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[
                      ['',      'All',       '#9ca3af'],
                      ['nssa',  'NSSA®',     NSSA.medium],
                      ['irmaa', 'IRMAACP™',  IRMAA.medium],
                      ['both',  'Both',      BOTH],
                    ].map(([val, label, activeColor]) => (
                      <button
                        key={val}
                        onClick={() => setDesignation(val)}
                        style={{
                          flex: 1, padding: '9px 4px', fontSize: '12px', fontWeight: 600,
                          fontFamily: '"Poppins", system-ui, sans-serif', cursor: 'pointer',
                          borderRadius: '8px', border: `1.5px solid ${designation === val ? activeColor : GRAY.border}`,
                          background: designation === val ? activeColor : 'white',
                          color: designation === val ? 'white' : GRAY.dark,
                          transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                        }}
                      >{label}</button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label className="filter-label">Near my ZIP code</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      className="filter-input"
                      value={zip}
                      onChange={e => setZip(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') applyZip() }}
                      placeholder="ZIP"
                      inputMode="numeric"
                      style={{ flex: '0 0 90px' }}
                    />
                    <select className="filter-input" value={radius} onChange={e => setRadius(Number(e.target.value))} style={{ flex: 1 }}>
                      {RADIUS_OPTIONS.map(r => <option key={r} value={r}>{r} miles</option>)}
                    </select>
                    <button
                      onClick={applyZip}
                      disabled={zipLoading}
                      style={{ flex: '0 0 auto', padding: '0 16px', fontSize: '14px', fontWeight: 600, fontFamily: '"Poppins", system-ui, sans-serif', cursor: 'pointer', borderRadius: '8px', border: 'none', background: IRMAA.dark, color: 'white' }}
                    >{zipLoading ? '…' : 'Go'}</button>
                  </div>
                  {zipError && <p style={{ color: IRMAA.medium, fontSize: '13px', margin: '6px 0 0' }}>{zipError}</p>}
                  {origin && <button onClick={clearProximity} style={{ background: 'none', border: 'none', color: NSSA.medium, fontSize: '13px', cursor: 'pointer', padding: '6px 0 0', textDecoration: 'underline' }}>Clear ZIP filter</button>}
                </div>
              </div>

              {/* Map (large, right of filters) — client-only */}
              <div className="map-wrap">
                <div style={{ position: 'relative' }}>
                  <AdvisorMap
                    mapView={mapView}
                    zoomNudge={zoomNudge}
                    mapZoomed={mapZoomed}
                    mapMarkers={mapMarkers}
                    passesDesignation={passesDesignation}
                    designation={designation}
                    stateFilter={stateFilter}
                    stateList={stateList}
                    setStateFilter={setStateFilter}
                    setHovered={setHovered}
                    showPreview={showPreview}
                    hidePreview={hidePreview}
                    onMarkerClick={(a) => router.push(`/${a.slug}`)}
                  />

                  {/* Zoom controls */}
                  <div style={{ position: 'absolute', right: '12px', bottom: '12px', display: 'flex', flexDirection: 'column', gap: '6px', zIndex: 4 }}>
                    <button
                      aria-label="Zoom in"
                      onClick={() => setZoomNudge(z => Math.min(z * 1.5, 8))}
                      style={{ width: '34px', height: '34px', borderRadius: '8px', border: `1px solid ${GRAY.border}`, background: 'white', color: GRAY.dark, fontSize: '20px', fontWeight: 700, lineHeight: 1, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}
                    >+</button>
                    <button
                      aria-label="Zoom out"
                      onClick={() => setZoomNudge(z => Math.max(z / 1.5, 0.4))}
                      style={{ width: '34px', height: '34px', borderRadius: '8px', border: `1px solid ${GRAY.border}`, background: 'white', color: GRAY.dark, fontSize: '22px', fontWeight: 700, lineHeight: 1, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}
                    >−</button>
                  </div>

                  {/* Hover preview (when zoomed: state or ZIP). The dot itself is
                      clickable; this badge is informational and fades in/out. */}
                  {hovered && hovered.advisor && (
                    <a
                      href={`/${hovered.advisor.slug}`}
                      className={dismissing ? 'advisor-pop-out' : 'advisor-pop'}
                      style={{
                        position: 'absolute', left: hovered.x + 14, top: hovered.y - 10,
                        zIndex: 5, background: 'white', textDecoration: 'none', color: 'inherit',
                        border: `1px solid ${GRAY.border}`, borderRadius: '10px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.14)', padding: '10px 12px',
                        width: '240px', maxWidth: 'calc(100% - 20px)', pointerEvents: 'none',
                        display: 'block', transformOrigin: 'top left',
                        ...(hovered.x > 700 ? { transform: 'translateX(calc(-100% - 28px))' } : null),
                      }}
                    >
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {hovered.advisor.photo
                          ? <><img src={hovered.advisor.photo} alt="" width="44" height="44" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={(e) => { const fb = e.currentTarget.nextElementSibling; e.currentTarget.style.display = 'none'; if (fb) fb.style.display = 'flex' }} /><div style={{ display: 'none' }}><Silhouette size={44} /></div></>
                          : <Silhouette size={44} />}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: '"Poppins", system-ui, sans-serif', fontWeight: 700, fontSize: '14px', color: GRAY.dark, lineHeight: 1.2 }}>{hovered.advisor.name}</div>
                          {hovered.advisor.title && <div style={{ fontSize: '12px', color: GRAY.text, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hovered.advisor.title}</div>}
                          {(hovered.advisor.city || hovered.advisor.stateCode) && <div style={{ fontSize: '12px', color: GRAY.text }}>{[hovered.advisor.city, hovered.advisor.stateCode].filter(Boolean).join(', ')}</div>}
                          <div style={{ fontSize: '11px', color: NSSA.medium, marginTop: '4px', fontWeight: 600 }}>View profile →</div>
                        </div>
                      </div>
                    </a>
                  )}
                </div>

                {/* Map legend */}
                <div style={{ display: 'flex', gap: '18px', justifyContent: 'center', flexWrap: 'wrap', margin: '0.75rem 0 0', fontSize: '12px', color: GRAY.text }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: NSSA.medium, display: 'inline-block' }} />NSSA®</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: IRMAA.medium, display: 'inline-block' }} />IRMAACP™</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: BOTH, display: 'inline-block' }} />Both</span>
                  <span>
                    {hasNarrowingFilter ? `· ${visibleMapCount.toLocaleString()} of ${filtered.length.toLocaleString()} shown on map` : ''}
                    {mapZoomed ? `${hasNarrowingFilter ? ' · ' : '· '}hover a dot for details` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Results (full width, below) */}
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h2 style={{ fontFamily: '"Poppins", system-ui, sans-serif', fontSize: '1.3rem', fontWeight: 700, color: GRAY.dark, margin: 0 }}>
                  {hasNarrowingFilter
                    ? <>{filtered.length.toLocaleString()} {filtered.length === 1 ? 'Advisor' : 'Advisors'}{origin ? ` within ${radius} miles` : ''}</>
                    : 'Certified Advisors'}
                </h2>
              </div>

              {filtered.length === 0 ? (
                <div style={{ background: GRAY.bg, borderRadius: '12px', padding: '3rem 2rem', textAlign: 'center', color: GRAY.text }}>
                  <p style={{ margin: 0, fontSize: '16px' }}>No advisors match your filters.</p>
                  {hasFilters && <p style={{ margin: '0.5rem 0 0', fontSize: '14px' }}>Try widening your search or clearing a filter.</p>}
                </div>
              ) : (
                <div className="cards">
                  {filtered.map(a => (
                    <a key={a.slug} href={`/${a.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block', background: 'white', border: `1px solid ${GRAY.border}`, borderRadius: '12px', padding: '1.25rem', transition: 'box-shadow 0.15s, transform 0.15s' }}
                       onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                       onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}>
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                        {a.photo
                          ? <><img src={a.photo} alt={`Headshot of ${a.name}`} width="64" height="64" loading="lazy" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={(e) => { const fb = e.currentTarget.nextElementSibling; e.currentTarget.style.display = 'none'; if (fb) fb.style.display = 'flex' }} /><div style={{ display: 'none' }}><Silhouette size={64} /></div></>
                          : <Silhouette size={64} />}
                        <div style={{ minWidth: 0 }}>
                          <h3 style={{ fontFamily: '"Poppins", system-ui, sans-serif', fontSize: '1.05rem', fontWeight: 700, margin: '0 0 2px', color: GRAY.dark, lineHeight: 1.25 }}>{a.name}</h3>
                          {a.title && <p style={{ fontSize: '13px', color: GRAY.text, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</p>}
                          {(a.city || a.stateCode) && <p style={{ fontSize: '13px', color: GRAY.text, margin: 0 }}>{[a.city, a.stateCode].filter(Boolean).join(', ')}{origin && a.distance !== Infinity ? ` · ${Math.round(a.distance)} mi` : ''}</p>}
                          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                            {a.nssa && <span style={{ fontSize: '11px', fontWeight: 700, color: NSSA.dark, background: NSSA.light, borderRadius: '4px', padding: '2px 7px' }}>NSSA®</span>}
                            {a.irmaa && <span style={{ fontSize: '11px', fontWeight: 700, color: IRMAA.dark, background: IRMAA.light, borderRadius: '4px', padding: '2px 7px' }}>IRMAACP™</span>}
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Footer — matches profile pages */}
        <footer style={{ background: '#6b5e3d', borderTop: `10px solid ${TAN}`, padding: '1.75rem 2rem' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
            <a href={ROOT}><img src="/nssa-logo-white.png" alt="NSSA" style={{ height: '40px', width: 'auto' }} /></a>
            <span style={{ color: 'white', fontSize: '14px' }}>
              © {new Date().getFullYear()} Social Security Professionals, LLC · 1763 Columbia Road NW Ste 175 Washington, DC 20009
            </span>
          </div>
        </footer>
      </div>
    </>
  )
}

// ── Build-time data ─────────────────────────────────────────────────────────
function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function getStaticProps() {
  const supabase = admin()
  let all = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('members')
      .select('id, email, first_name, last_name, job_title, company, city, state, zip, profile_photo, nssa_certified, irmaa_certified, bio, is_active, directory_opt_out')
      .or('nssa_certified.eq.true,irmaa_certified.eq.true')
      .order('last_name', { ascending: true })
      .range(from, from + 999)
    if (error) { console.error('Index fetch error:', error.message); break }
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < 1000) break
    from += 1000
  }

  // Inclusion gate: active, has bio content, not opted out.
  const listed = all.filter(m => {
    if (m.is_active === false) return false
    if (m.directory_opt_out === true) return false
    const bioText = (m.bio || '').replace(/<[^>]*>/g, '').trim()
    return bioText.length > 0
  })

  const { byEmail } = buildSlugIndex(listed)

  // Lightweight client payload (no bios, no big fields).
  const advisors = listed.map(m => {
    const coords = coordsForZip(m.zip)
    const code = stateCode(m.state)
    return {
      slug: byEmail.get(m.email),
      name: `${m.first_name || ''} ${m.last_name || ''}`.trim(),
      title: [m.job_title, m.company].filter(Boolean).join(', ') || null,
      city: m.city || null,
      stateCode: code || null,
      photo: m.profile_photo || null,
      nssa: !!m.nssa_certified,
      irmaa: !!m.irmaa_certified,
      coords: coords || null,
    }
  })

  // State dropdown: only states that actually have advisors, alphabetized by label.
  const codes = [...new Set(advisors.map(a => a.stateCode).filter(Boolean))]
  const stateList = codes
    .map(code => [code, STATE_NAMES[code] || code])
    .sort((a, b) => a[1].localeCompare(b[1]))

  return { props: { advisors, stateList }, revalidate: 86400 }
}
