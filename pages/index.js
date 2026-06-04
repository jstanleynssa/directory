// pages/index.js
// Advisor Directory index — branded US map + filters + results grid.
// SSG: getStaticProps builds the full advisor list (with zip-derived coords)
// at build time; all filtering happens client-side over that lightweight list.

import Head from 'next/head'
import { useState, useMemo, useCallback } from 'react'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'
import { createClient } from '@supabase/supabase-js'
import { buildSlugIndex, stateToken } from '../lib/slug'
import { STATE_NAMES, stateCode, coordsForZip, milesBetween } from '../lib/geo'
import usTopo from '../lib/us-states.json'

const NSSA  = { light: '#8ECAEE', medium: '#1C80BC', dark: '#13405E' }
const IRMAA = { light: '#ED8E8E', medium: '#DE5B63', dark: '#AF2A35' }
const GRAY  = { text: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb', dark: '#1f2937' }
const TAN   = '#b3a584'
const ROOT  = 'https://nssapros.com'
const SITE  = 'https://directory.nssapros.com'
const NSSA_COURSE  = 'https://www.nssapros.com/social-security-training'
const IRMAA_COURSE = 'https://www.nssapros.com/irmaa-medicare-training-course'

const RADIUS_OPTIONS = [10, 25, 50, 100, 250]

export default function DirectoryIndex({ advisors, stateList }) {
  const [name, setName] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [designation, setDesignation] = useState('') // '', 'nssa', 'irmaa'
  const [zip, setZip] = useState('')
  const [radius, setRadius] = useState(50)
  const [origin, setOrigin] = useState(null) // {lat,lng} for proximity
  const [zipError, setZipError] = useState('')
  const [zipLoading, setZipLoading] = useState(false)
  const [hovered, setHovered] = useState(null) // advisor under cursor (state-level only)

  // Resolve the visitor's zip via the lightweight API (keeps the big dataset server-side).
  const applyZip = useCallback(async () => {
    const z = zip.trim()
    if (!z) { setOrigin(null); setZipError(''); return }
    setZipLoading(true); setZipError('')
    try {
      const r = await fetch(`/api/zip?z=${encodeURIComponent(z)}`)
      if (!r.ok) { setOrigin(null); setZipError('ZIP not found'); return }
      const c = await r.json()
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
      if (designation === 'nssa' && !a.nssa) return false
      if (designation === 'irmaa' && !a.irmaa) return false
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

  const hasFilters = name || stateFilter || designation || origin

  // Map view: zoom to the selected state (or proximity origin) by averaging the
  // relevant advisor coordinates; otherwise show the full national view.
  const mapView = useMemo(() => {
    const pts = markers.map(a => a.coords)
    if (origin) {
      return { center: [origin.lng, origin.lat], zoom: 6 }
    }
    if (stateFilter && pts.length) {
      const avgLng = pts.reduce((s, p) => s + p.lng, 0) / pts.length
      const avgLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length
      // Spread of points → zoom (tighter spread = more zoom). Higher base for a closer view.
      const lngs = pts.map(p => p.lng), lats = pts.map(p => p.lat)
      const span = Math.max(Math.max(...lngs) - Math.min(...lngs), Math.max(...lats) - Math.min(...lats), 0.5)
      const zoom = Math.min(Math.max(3.5, 16 / span), 14)
      return { center: [avgLng, avgLat], zoom }
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
                ['Find an Advisor', `${ROOT}/find-nssa`],
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
              Search our national directory of {advisors.length.toLocaleString()} NSSA® and IRMAACP™ certified professionals. Filter by name, state, designation, or distance from your ZIP code.
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
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[['', 'All', '#7B4F9E'], ['nssa', 'NSSA®', NSSA.medium], ['irmaa', 'IRMAACP™', IRMAA.medium]].map(([val, label, activeColor]) => (
                      <button
                        key={val}
                        onClick={() => setDesignation(val)}
                        style={{
                          flex: 1, padding: '9px 6px', fontSize: '13px', fontWeight: 600,
                          fontFamily: '"Poppins", system-ui, sans-serif', cursor: 'pointer',
                          borderRadius: '8px', border: `1.5px solid ${designation === val ? activeColor : GRAY.border}`,
                          background: designation === val ? activeColor : 'white',
                          color: designation === val ? 'white' : GRAY.dark,
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

              {/* Map (large, right of filters) */}
              <div className="map-wrap">
                <div
                  style={{ position: 'relative' }}
                  onMouseMove={e => {
                    if (hovered) {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setHovered(h => h ? { ...h, x: e.clientX - rect.left, y: e.clientY - rect.top } : h)
                    }
                  }}
                >
                  <ComposableMap projection="geoAlbersUsa" width={975} height={610} className="rsm-svg" style={{ width: '100%', height: 'auto' }}>
                    <ZoomableGroup center={mapView.center} zoom={mapView.zoom} minZoom={1} maxZoom={14}>
                      <Geographies geography={usTopo}>
                        {({ geographies }) =>
                          geographies.map(geo => (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              style={{
                                default: { fill: '#e9eef2', stroke: 'white', strokeWidth: 0.75, outline: 'none' },
                                hover:   { fill: '#e9eef2', stroke: 'white', strokeWidth: 0.75, outline: 'none' },
                                pressed: { fill: '#e9eef2', outline: 'none' },
                              }}
                            />
                          ))
                        }
                      </Geographies>
                      {markers.map(a => (
                        <Marker key={a.slug} coordinates={[a.coords.lng, a.coords.lat]}>
                          <circle
                            className="map-marker"
                            r={(stateFilter ? 5 : 4) / Math.sqrt(mapView.zoom)}
                            fill={a.nssa && a.irmaa ? '#7B4F9E' : a.irmaa ? IRMAA.medium : NSSA.medium}
                            stroke="white"
                            strokeWidth={1 / Math.sqrt(mapView.zoom)}
                            opacity={0.85}
                            onMouseEnter={stateFilter ? (e) => {
                              const rect = e.currentTarget.ownerSVGElement.parentElement.getBoundingClientRect()
                              setHovered({ advisor: a, x: e.clientX - rect.left, y: e.clientY - rect.top })
                            } : undefined}
                            onMouseLeave={stateFilter ? () => setHovered(null) : undefined}
                          />
                        </Marker>
                      ))}
                    </ZoomableGroup>
                  </ComposableMap>

                  {/* Hover preview (state level only) */}
                  {hovered && hovered.advisor && (
                    <div style={{
                      position: 'absolute', left: hovered.x + 14, top: hovered.y - 10,
                      pointerEvents: 'none', zIndex: 5, background: 'white',
                      border: `1px solid ${GRAY.border}`, borderRadius: '10px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.14)', padding: '10px 12px',
                      width: '240px', maxWidth: 'calc(100% - 20px)',
                      transform: hovered.x > 700 ? 'translateX(calc(-100% - 28px))' : 'none',
                    }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {hovered.advisor.photo
                          ? <img src={hovered.advisor.photo} alt="" width="44" height="44" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          : <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: NSSA.dark, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>{hovered.advisor.name[0]}</div>}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: '"Poppins", system-ui, sans-serif', fontWeight: 700, fontSize: '14px', color: GRAY.dark, lineHeight: 1.2 }}>{hovered.advisor.name}</div>
                          {hovered.advisor.title && <div style={{ fontSize: '12px', color: GRAY.text, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hovered.advisor.title}</div>}
                          {(hovered.advisor.city || hovered.advisor.stateCode) && <div style={{ fontSize: '12px', color: GRAY.text }}>{[hovered.advisor.city, hovered.advisor.stateCode].filter(Boolean).join(', ')}</div>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '18px', justifyContent: 'center', flexWrap: 'wrap', margin: '0.75rem 0 0', fontSize: '12px', color: GRAY.text }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: NSSA.medium, display: 'inline-block' }} />NSSA®</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: IRMAA.medium, display: 'inline-block' }} />IRMAACP™</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#7B4F9E', display: 'inline-block' }} />Both</span>
                  <span>· {markers.length.toLocaleString()} of {filtered.length.toLocaleString()} shown on map{stateFilter ? ' · hover a dot for details' : ''}</span>
                </div>
              </div>
            </div>

            {/* Results (full width, below) */}
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h2 style={{ fontFamily: '"Poppins", system-ui, sans-serif', fontSize: '1.3rem', fontWeight: 700, color: GRAY.dark, margin: 0 }}>
                  {filtered.length.toLocaleString()} {filtered.length === 1 ? 'Advisor' : 'Advisors'}
                  {origin ? ` within ${radius} miles` : ''}
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
                          ? <img src={a.photo} alt={`Headshot of ${a.name}`} width="64" height="64" loading="lazy" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          : <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: NSSA.dark, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700, flexShrink: 0 }}>{a.name[0]}</div>}
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
