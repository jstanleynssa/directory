// pages/badge.js
// Self-serve badge-code page: directory.nssapros.com/badge?slug=<advisor-slug>
//
// An advisor follows the personalized link from the launch email and lands here
// to copy the HTML for their certification badge — which a web page can present
// reliably with a copy button (unlike a Gmail/YAMM merge, which renders the HTML
// instead of showing it as code).
//
// The advisor is identified by their PUBLIC directory slug (already visible as
// their profile URL — no private data in the URL). We look them up server-side
// from the same Supabase data + buildSlugIndex the profile pages use, so the
// generated snippet is always correct-by-construction.

import Head from 'next/head'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { buildSlugIndex } from '../lib/slug'

const NSSA  = { medium: '#1C80BC', dark: '#13405E' }
const IRMAA = { medium: '#DE5B63', dark: '#AF2A35' }
const GRAY  = { text: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb', dark: '#1f2937' }
const SITE  = 'https://directory.nssapros.com'
const NSSA_IMG  = `${SITE}/nssa-certificate-badge.png`
const IRMAA_IMG = `${SITE}/irmaa-certificate-badge.png`

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

async function fetchDirectoryMembers() {
  const supabase = admin()
  let all = []; let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('members')
      .select('id, email, first_name, last_name, city, state, nssa_certified, irmaa_certified, bio, is_active, directory_opt_out')
      .or('nssa_certified.eq.true,irmaa_certified.eq.true')
      .order('last_name', { ascending: true })
      .range(from, from + 999)
    if (error) { console.error('badge fetch error:', error.message); break }
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

// Build the exact embed snippet (matches the CSV generator).
function buildSnippet({ name, url, hasNssa, hasIrmaa }) {
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const nssa = `<a href="${url}" target="_blank" rel="noopener" title="${esc(name)} — verified NSSA® Certified Advisor" style="display:inline-block;margin-right:10px;"><img src="${NSSA_IMG}" alt="NSSA® Certified Advisor — view verified profile" width="150" height="150" style="max-width:150px;height:auto;border:0;" /></a>`
  const irmaa = `<a href="${url}" target="_blank" rel="noopener" title="${esc(name)} — verified IRMAACP™ Certified Planner" style="display:inline-block;"><img src="${IRMAA_IMG}" alt="IRMAACP™ Certified Planner — view verified profile" width="150" height="150" style="max-width:150px;height:auto;border:0;" /></a>`
  if (hasNssa && hasIrmaa) return nssa + '\n' + irmaa
  if (hasNssa) return nssa
  return irmaa
}

export async function getServerSideProps({ query }) {
  const slug = (query.slug || '').toString().trim()
  if (!slug) return { props: { found: false } }

  const members = await fetchDirectoryMembers()
  const { bySlug } = buildSlugIndex(members)
  const m = bySlug.get(slug)
  if (!m) return { props: { found: false } }

  const name = `${m.first_name || ''} ${m.last_name || ''}`.trim()
  const url = `${SITE}/${slug}`
  const hasNssa = !!m.nssa_certified
  const hasIrmaa = !!m.irmaa_certified
  const snippet = buildSnippet({ name, url, hasNssa, hasIrmaa })

  return { props: { found: true, name, url, hasNssa, hasIrmaa, snippet } }
}

function BadgePreview({ url, hasNssa, hasIrmaa, name }) {
  const a = { display: 'inline-block', marginRight: hasNssa && hasIrmaa ? '10px' : 0 }
  const img = { width: '150px', height: '150px', border: 0 }
  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      {hasNssa && <a href={url} target="_blank" rel="noopener" style={a}><img src={NSSA_IMG} alt="NSSA® Certified Advisor" style={img} /></a>}
      {hasIrmaa && <a href={url} target="_blank" rel="noopener" style={a}><img src={IRMAA_IMG} alt="IRMAACP™ Certified Planner" style={img} /></a>}
    </div>
  )
}

export default function BadgePage(props) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(props.snippet).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }).catch(() => {})
  }

  const wrap = { fontFamily: '"Open Sans", system-ui, -apple-system, sans-serif', color: GRAY.dark, maxWidth: '720px', margin: '0 auto', padding: '3rem 1.5rem' }

  if (!props.found) {
    return (
      <>
        <Head><title>Badge code — NSSA® Advisor Directory</title><meta name="robots" content="noindex" /></Head>
        <div style={wrap}>
          <h1 style={{ fontSize: '1.6rem', color: IRMAA.dark }}>We couldn't find that profile</h1>
          <p style={{ fontSize: '15px', color: GRAY.text, lineHeight: 1.6 }}>
            The link may be incomplete, or your profile isn't published yet. You can find your
            profile by searching your name on the <a href={`${SITE}/`} style={{ color: NSSA.medium }}>directory</a>,
            or reply to the email we sent and we'll help.
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <Head><title>Your certification badge — NSSA® Advisor Directory</title><meta name="robots" content="noindex" /></Head>
      <div style={wrap}>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 700, color: IRMAA.dark, marginBottom: '0.5rem' }}>Your certification badge</h1>
        <p style={{ fontSize: '15px', color: GRAY.text, lineHeight: 1.6, marginBottom: '2rem' }}>
          Add this badge to your website to show clients your{props.hasNssa && props.hasIrmaa ? ' NSSA® and IRMAACP™ credentials are' : ' credential is'} verified —
          it links straight to your directory profile.
        </p>

        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: GRAY.text, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Preview</p>
          <BadgePreview {...props} />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: GRAY.text, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Copy this code</p>
            <button onClick={copy} style={{ background: copied ? NSSA.medium : NSSA.dark, color: 'white', border: 'none', borderRadius: '6px', padding: '8px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              {copied ? '✓ Copied' : 'Copy code'}
            </button>
          </div>
          <pre style={{ background: GRAY.bg, border: `1px solid ${GRAY.border}`, borderRadius: '8px', padding: '16px', fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: GRAY.dark, overflow: 'auto', margin: 0 }}>
            {props.snippet}
          </pre>
        </div>

        <div style={{ marginTop: '2rem', padding: '1.25rem', background: GRAY.bg, borderRadius: '8px' }}>
          <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Where to put it</p>
          <p style={{ fontSize: '14px', color: GRAY.text, lineHeight: 1.7, margin: 0 }}>
            Paste the code into any HTML block on your site — your homepage, About page, or footer
            are great spots. Or just forward this page to whoever manages your website. No editing
            needed; it's ready to use as-is.
          </p>
        </div>
      </div>
    </>
  )
}
