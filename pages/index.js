// pages/index.js
// Placeholder root for the directory during the POC. The full directory index
// (search, filters, advisor grid) is a later Phase 3 deliverable. For now this
// keeps directory.nssapros.com/ from 404ing and points visitors back to the
// main Find an Advisor page.
import Head from 'next/head'

const NSSA = { dark: '#13405E', medium: '#1C80BC' }
const ROOT = 'https://nssapros.com'

export default function Home() {
  return (
    <>
      <Head>
        <title>NSSA® Advisor Directory</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', background: '#f3f4f6', padding: '2rem' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '3rem', maxWidth: '520px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: NSSA.dark, marginBottom: '0.75rem' }}>NSSA® Advisor Directory</h1>
          <p style={{ fontSize: '15px', color: '#6b7280', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Find an NSSA® or IRMAACP™ certified professional near you.
          </p>
          <a href={`${ROOT}/find-an-advisor`} style={{ display: 'inline-block', background: NSSA.dark, color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: '999px', fontSize: '14px', fontWeight: 600 }}>
            Browse Advisors
          </a>
        </div>
      </div>
    </>
  )
}
