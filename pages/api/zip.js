// pages/api/zip.js
// Resolves a ZIP code or US city name to {lat, lng}.
// Priority:
//   1. 5-digit ZIP → instant local lookup (bundled centroid dataset, no external call)
//   2. City / city+state text → Nominatim geocoding (OpenStreetMap, free, no key)
// Keeps the ~1MB zip file server-side; the browser only needs one lookup per search.
import { coordsForZip } from '../../lib/geo'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT    = 'nssapros-advisor-directory/1.0 (directory@updates.nssapros.com)'

function looksLikeZip(s) {
  // 5 digits, optionally with a dash extension (e.g. "32931" or "32931-1234")
  return /^\d{5}(-\d{4})?$/.test(s.trim())
}

async function geocodeCity(query) {
  // Append "USA" if the query doesn't already contain a country hint,
  // so Nominatim doesn't return an international result first.
  const q = /usa|united states/i.test(query) ? query : `${query}, USA`
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=us`
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!Array.isArray(data) || data.length === 0) return null
  const { lat, lon } = data[0]
  const latN = parseFloat(lat)
  const lonN = parseFloat(lon)
  if (isNaN(latN) || isNaN(lonN)) return null
  return { lat: latN, lng: lonN }
}

export default async function handler(req, res) {
  const input = (req.query.z || '').toString().trim()
  if (!input) return res.status(400).json({ error: 'missing_input' })

  // 1. Try ZIP centroid lookup first (fast, no external call).
  if (looksLikeZip(input)) {
    const coords = coordsForZip(input)
    if (coords) {
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800')
      return res.status(200).json(coords)
    }
  }

  // 2. Fall back to Nominatim for city names or unrecognised ZIPs.
  try {
    const coords = await geocodeCity(input)
    if (!coords) return res.status(404).json({ error: 'location_not_found' })
    // Cache city results for 1 hour at edge (city coords don't change, but
    // Nominatim requests should not be hammered — edge caching covers repeats).
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    return res.status(200).json(coords)
  } catch (err) {
    console.error('Nominatim geocode error:', err.message)
    return res.status(502).json({ error: 'geocode_failed' })
  }
}
