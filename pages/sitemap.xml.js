// pages/sitemap.xml.js
// Dynamically generated sitemap for the advisor directory. Served at
// https://directory.nssapros.com/sitemap.xml
//
// Uses the SAME inclusion gate + slug logic as [slug].js, so the listed URLs
// always match the pages that actually exist. Generated on request (cached via
// CDN headers) so it reflects the current live advisor set — including any
// added by ISR since the last full build — without a redeploy.

import { createClient } from '@supabase/supabase-js'
import { buildSlugIndex } from '../lib/slug'

const SITE = 'https://directory.nssapros.com'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Same gate as the profile pages: certified + active + non-empty bio.
async function fetchDirectoryMembers() {
  const supabase = admin()
  let all = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('members')
      .select('email, first_name, last_name, city, state, nssa_certified, irmaa_certified, bio, is_active')
      .or('nssa_certified.eq.true,irmaa_certified.eq.true')
      .order('last_name', { ascending: true })
      .range(from, from + 999)
    if (error) { console.error('Sitemap fetch error:', error.message); break }
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < 1000) break
    from += 1000
  }
  return all.filter(m => {
    if (m.is_active === false) return false
    const bioText = (m.bio || '').replace(/<[^>]*>/g, '').trim()
    return bioText.length > 0
  })
}

function xmlEscape(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildSitemap(slugs) {
  const today = new Date().toISOString().slice(0, 10)
  const urls = [
    // The directory index itself.
    `  <url>\n    <loc>${SITE}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
    // One entry per advisor profile.
    ...slugs.map(slug =>
      `  <url>\n    <loc>${SITE}/${xmlEscape(slug)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
    ),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

export async function getServerSideProps({ res }) {
  const members = await fetchDirectoryMembers()
  const { byEmail } = buildSlugIndex(members)
  const slugs = [...byEmail.values()].filter(Boolean).sort()

  const xml = buildSitemap(slugs)

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  // Cache at the CDN for a day; serve stale while revalidating.
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200')
  res.write(xml)
  res.end()

  return { props: {} }
}

// Required default export for a Next.js page; never actually rendered because
// getServerSideProps writes the response directly.
export default function Sitemap() { return null }
