// pages/advisors/[state].js
// State landing page — SEO-focused: optimized H1, keyword-rich intro paragraph,
// and a two-column grid of that state's advisor cards. No map (kept lightweight
// and crawl-friendly). One static page per state that has listed advisors.

import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import { buildSlugIndex } from '../../lib/slug'
import { STATE_NAMES, stateCode, stateNameToSlug, stateCodeToSlug, slugToStateCode } from '../../lib/geo'

const NSSA  = { light: '#8ECAEE', medium: '#1C80BC', dark: '#13405E' }
const IRMAA = { light: '#ED8E8E', medium: '#DE5B63', dark: '#AF2A35' }
const GRAY  = { text: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb', dark: '#1f2937' }
const TAN   = '#b3a584'
const ROOT  = 'https://nssapros.com'
const SITE  = 'https://directory.nssapros.com'
const NSSA_COURSE  = 'https://www.nssapros.com/social-security-training'
const IRMAA_COURSE = 'https://www.nssapros.com/irmaa-medicare-training-course'

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

export default function StatePage({ stateNameProp, stateCodeProp, advisors, cities, counts }) {
  const stName = stateNameProp
  const stCode = stateCodeProp
  const url = `${SITE}/advisors/${stateNameToSlug(stName)}`

  // Cert-adaptive subject for the H1.
  const subject = (counts.nssa && counts.irmaa)
    ? 'Social Security & IRMAA Medicare Advisors'
    : counts.irmaa && !counts.nssa
      ? 'IRMAA & Medicare Advisors'
      : 'Social Security Advisors'
  const h1 = `${subject} in ${stName}`

  const pageTitle = `${subject} in ${stName} | NSSA® Directory`.slice(0, 65)
  const cityList = cities.slice(0, 6)
  const cityPhrase = cityList.length
    ? `${cityList.slice(0, -1).join(', ')}${cityList.length > 1 ? ', and ' : ''}${cityList[cityList.length - 1]}`
    : ''
  const metaDesc = `Find NSSA® and IRMAACP™ certified Social Security and Medicare planning advisors in ${stName}. Browse ${advisors.length} trusted professionals${cityPhrase ? ` serving ${cityList.slice(0, 3).join(', ')} and beyond` : ''}.`.slice(0, 158)

  const breadcrumbs = [
    { label: 'United States', href: SITE + '/' },
    { label: stName, href: null },
  ]
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((b, i) => ({
      '@type': 'ListItem', position: i + 1, name: b.label, ...(b.href ? { item: b.href } : {}),
    })),
  }
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: h1,
    url,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: advisors.length,
      itemListElement: advisors.slice(0, 100).map((a, i) => ({
        '@type': 'ListItem', position: i + 1, url: `${SITE}/${a.slug}`, name: a.name,
      })),
    },
  }

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDesc} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      </Head>

      <style>{`
        .cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem; }
        .cards > a { min-width: 0; }
        @media (max-width: 640px) {
          .cards { grid-template-columns: 1fr; }
          .site-nav { display: none !important; }
        }
      `}</style>

      <div style={{ fontFamily: '"Open Sans", system-ui, -apple-system, sans-serif', color: GRAY.dark, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Nav */}
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

        {/* Hero / H1 */}
        <section style={{ background: GRAY.bg, padding: '2.5rem 2rem 2rem' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ fontFamily: '"Poppins", system-ui, sans-serif', fontSize: '2.2rem', fontWeight: 700, color: IRMAA.dark, margin: 0 }}>
              {h1}
            </h1>
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" style={{ marginTop: '0.85rem' }}>
              <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', fontSize: '14px', color: GRAY.text }}>
                {breadcrumbs.map((b, i) => (
                  <li key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                    {b.href
                      ? <a href={b.href} style={{ color: NSSA.medium, textDecoration: 'none', fontWeight: 600 }}>{b.label}</a>
                      : <span aria-current="page" style={{ color: GRAY.text }}>{b.label}</span>}
                    {i < breadcrumbs.length - 1 && <span style={{ color: GRAY.text, userSelect: 'none', fontWeight: 600 }}>&gt;</span>}
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </section>

        {/* SEO intro */}
        <section style={{ padding: '2rem 2rem 0' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <p style={{ fontSize: '16px', color: '#374151', lineHeight: 1.75, marginBottom: '1rem' }}>
              {stName} residents planning for retirement can connect with {advisors.length} {advisors.length === 1 ? 'professional' : 'professionals'} who hold
              the <a href={NSSA_COURSE} style={{ color: NSSA.medium }}>National Social Security Advisor (NSSA®)</a>
              {counts.irmaa ? <> or <a href={IRMAA_COURSE} style={{ color: IRMAA.medium }}>IRMAA Certified Planner (IRMAACP™)</a></> : null} certification.
              These advisors specialize in Social Security claiming strategies, Medicare enrollment, and IRMAA surcharge planning&nbsp;
              {cityPhrase ? <>for clients in {cityPhrase}, and communities across {stName}.</> : <>for clients across {stName}.</>}
            </p>
            <p style={{ fontSize: '16px', color: '#374151', lineHeight: 1.75, marginBottom: '0' }}>
              Whether you need help deciding when to claim Social Security benefits, coordinating spousal and survivor strategies,
              or managing Medicare premiums and income-related adjustments, the certified {stName} advisors below can guide your
              retirement income planning. Browse the directory and connect directly with a professional near you.
            </p>
          </div>
        </section>

        {/* Advisor cards */}
        <section style={{ padding: '2rem', flex: 1 }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <h2 style={{ fontFamily: '"Poppins", system-ui, sans-serif', fontSize: '1.3rem', fontWeight: 700, color: GRAY.dark, margin: '0 0 1.25rem' }}>
              {advisors.length} {advisors.length === 1 ? 'Advisor' : 'Advisors'} in {stName}
            </h2>
            <div className="cards">
              {advisors.map(a => (
                <a key={a.slug} href={`/${a.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block', background: 'white', border: `1px solid ${GRAY.border}`, borderRadius: '12px', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    {a.photo
                      ? <><img src={a.photo} alt={`Headshot of ${a.name}`} width="64" height="64" loading="lazy" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={(e) => { const fb = e.currentTarget.nextElementSibling; e.currentTarget.style.display = 'none'; if (fb) fb.style.display = 'flex' }} /><div style={{ display: 'none' }}><Silhouette size={64} /></div></>
                      : <Silhouette size={64} />}
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontFamily: '"Poppins", system-ui, sans-serif', fontSize: '1.05rem', fontWeight: 700, margin: '0 0 2px', color: GRAY.dark, lineHeight: 1.25 }}>{a.name}</h3>
                      {a.title && <p style={{ fontSize: '13px', color: GRAY.text, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</p>}
                      {(a.city || stCode) && <p style={{ fontSize: '13px', color: GRAY.text, margin: 0 }}>{[a.city, stCode].filter(Boolean).join(', ')}</p>}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                        {a.nssa && <span style={{ fontSize: '11px', fontWeight: 700, color: NSSA.dark, background: NSSA.light, borderRadius: '4px', padding: '2px 7px' }}>NSSA®</span>}
                        {a.irmaa && <span style={{ fontSize: '11px', fontWeight: 700, color: IRMAA.dark, background: IRMAA.light, borderRadius: '4px', padding: '2px 7px' }}>IRMAACP™</span>}
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>

            <p style={{ marginTop: '2rem', fontSize: '15px' }}>
              <a href={SITE + '/'} style={{ color: NSSA.medium, fontWeight: 600, textDecoration: 'none' }}>← Browse the full national advisor directory</a>
            </p>
          </div>
        </section>

        {/* Footer */}
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

// Fetch all listed advisors (same gate as the index/profiles), once.
async function fetchListed() {
  const supabase = admin()
  let all = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('members')
      .select('id, email, first_name, last_name, job_title, company, city, state, profile_photo, nssa_certified, irmaa_certified, bio, is_active, directory_opt_out')
      .or('nssa_certified.eq.true,irmaa_certified.eq.true')
      .order('last_name', { ascending: true })
      .range(from, from + 999)
    if (error) { console.error('State page fetch error:', error.message); break }
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < 1000) break
    from += 1000
  }
  return all.filter(m => {
    if (m.is_active === false) return false
    if (m.directory_opt_out === true) return false
    const bioText = (m.bio || '').replace(/<[^>]*>/g, '').trim()
    return bioText.length > 0
  })
}

export async function getStaticPaths() {
  const listed = await fetchListed()
  const codes = new Set()
  for (const m of listed) {
    const c = stateCode(m.state)
    if (c) codes.add(c)
  }
  const paths = [...codes]
    .map(c => stateCodeToSlug(c))
    .filter(Boolean)
    .map(slug => ({ params: { state: slug } }))
  // fallback:'blocking' lets any new state ISR-generate on first request.
  return { paths, fallback: 'blocking' }
}

export async function getStaticProps({ params }) {
  const code = slugToStateCode(params.state)
  if (!code) return { notFound: true }
  const stName = STATE_NAMES[code]

  const listed = await fetchListed()
  const inState = listed.filter(m => stateCode(m.state) === code)
  if (inState.length === 0) return { notFound: true }

  // Slugs are built from the FULL listed set so they match the profile pages exactly.
  const { byEmail } = buildSlugIndex(listed)

  const advisors = inState.map(m => ({
    slug: byEmail.get(m.email),
    name: `${m.first_name || ''} ${m.last_name || ''}`.trim(),
    title: [m.job_title, m.company].filter(Boolean).join(', ') || null,
    city: m.city || null,
    photo: m.profile_photo || null,
    nssa: !!m.nssa_certified,
    irmaa: !!m.irmaa_certified,
  })).sort((a, b) => a.name.localeCompare(b.name))

  // Top cities by advisor count (for the keyword-rich intro).
  const cityCounts = {}
  for (const m of inState) {
    const c = (m.city || '').trim()
    if (c) cityCounts[c] = (cityCounts[c] || 0) + 1
  }
  const cities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).map(([c]) => c)

  const counts = {
    nssa: inState.some(m => m.nssa_certified),
    irmaa: inState.some(m => m.irmaa_certified),
  }

  return {
    props: { stateNameProp: stName, stateCodeProp: code, advisors, cities, counts },
    revalidate: 86400,
  }
}
