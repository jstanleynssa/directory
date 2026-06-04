// pages/index.js
// Advisor Directory index — branded US map + filters + results grid.
// SSG: getStaticProps builds the full advisor list (with zip-derived coords)
// at build time; all filtering happens client-side over that lightweight list.

import Head from 'next/head'
import { useState, useMemo, useCallback } from 'react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import { createClient } from '@supabase/supabase-js'
import { buildSlugIndex, stateToken } from '../lib/slug'
import { STATE_NAMES, stateCode, coordsForZip, milesBetween } from '../lib/geo'
import usTopo from '../lib/us-states-albers.json'

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
        .dir-grid { display: grid; grid-template-columns: 320px 1fr; gap: 2rem; align-items: start; }
        .map-wrap { position: sticky; top: 1rem; background: ${GRAY.bg}; border-radius: 12px; padding: 1rem; }
        .cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.25rem; }
        .filter-input { width: 100%; padding: 11px 13px; font-size: 15px; border: 1px solid ${GRAY.border}; border-radius: 8px; box-sizing: border-box; font-family: inherit; background: white; outline: none; }
        .filter-label { display:block; font-size: 13px; font-weight: 600; color: ${GRAY.dark}; margin-bottom: 6px; font-family: "Poppins", system-ui, sans-serif; }
        .rsm-geography:focus { outline: none; }
        @media (max-width: 1024px) {
          .dir-grid { grid-template-columns: 1fr; }
          .map-wrap { position: static; }
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
          <div style={{ maxWidth: '1200px', margin: '0 auto' }} className="dir-grid">

            {/* Left: filters + map */}
            <div>
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="filter-label">Search by name, company, or city</label>
                <input className="filter-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cheney, or Boston" />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="filter-label">State</label>
                <select className="filter-input" value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
                  <option value="">All states</option>
                  {stateList.map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="filter-label">Designation</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[['', 'All'], ['nssa', 'NSSA®'], ['irmaa', 'IRMAACP™']].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setDesignation(val)}
                      style={{
                        flex: 1, padding: '9px 6px', fontSize: '13px', fontWeight: 600,
                        fontFamily: '"Poppins", system-ui, sans-serif', cursor: 'pointer',
                        borderRadius: '8px', border: `1.5px solid ${designation === val ? NSSA.medium : GRAY.border}`,
                        background: designation === val ? NSSA.medium : 'white',
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

              {/* Map */}
              <div className="map-wrap">
                <ComposableMap projection="geoAlbersUsa" width={800} height={500} style={{ width: '100%', height: 'auto' }}>
                  <Geographies geography={usTopo}>
                    {({ geographies }) =>
                      geographies.map(geo => (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          style={{
                            default: { fill: '#e9eef2', stroke: 'white', strokeWidth: 0.75, outline: 'none' },
                            hover:   { fill: '#dbe6ee', stroke: 'white', strokeWidth: 0.75, outline: 'none' },
                            pressed: { fill: '#dbe6ee', outline: 'none' },
                          }}
                        />
                      ))
                    }
                  </Geographies>
                  {markers.map(a => (
                    <Marker key={a.slug} coordinates={[a.coords.lng, a.coords.lat]}>
                      <circle r={4} fill={a.irmaa && !a.nssa ? IRMAA.medium : NSSA.medium} stroke="white" strokeWidth={1} opacity={0.85} />
                    </Marker>
                  ))}
                </ComposableMap>
                <p style={{ fontSize: '12px', color: GRAY.text, textAlign: 'center', margin: '0.5rem 0 0' }}>
                  {markers.length.toLocaleString()} advisor{markers.length === 1 ? '' : 's'} shown on map
                </p>
              </div>
            </div>

            {/* Right: results */}
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
