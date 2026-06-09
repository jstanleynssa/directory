// lib/geo.js
// Build-time geographic helpers: state name lookups and zip→coordinate lookup.
// The zip-centroid dataset is large (~1.1MB) and must ONLY be imported in
// server-side code (getStaticProps), never in client components.
import zipCentroids from './zip-centroids.json'

// 2-letter code → full state/territory name (for filters and headings).
export const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
  // Territories
  AS: 'American Samoa',
  GU: 'Guam',
  MP: 'Northern Mariana Islands',
  PR: 'Puerto Rico',
  VI: 'U.S. Virgin Islands',
}

// Territory codes — used to skip map dots (territories are outside the
// geoAlbersUsa projection and cannot be plotted on the continental map).
export const TERRITORY_CODES = new Set(['AS', 'GU', 'MP', 'PR', 'VI'])

// Hardcoded centroids for territory ZIP prefixes that may be absent from the
// zip-centroids dataset. Keyed by the 3-digit ZIP prefix (first 3 chars).
// These are used as fallbacks in coordsForZip when the dataset returns nothing.
// Note: territory advisors intentionally receive coords: null in getStaticProps
// so they never render as map dots (geoAlbersUsa can't project them). These
// coords are here for completeness / future use if an inset map is ever added.
const TERRITORY_FALLBACK_COORDS = {
  '006': { lat: 18.2208, lng: -66.5901 }, // Puerto Rico (west)
  '007': { lat: 18.3893, lng: -66.0469 }, // Puerto Rico (east)
  '008': { lat: 17.7306, lng: -64.8963 }, // U.S. Virgin Islands (008xx shared with VI)
  '009': { lat: 18.4663, lng: -66.1057 }, // Puerto Rico (north)
  '967': { lat: -14.2710, lng: -170.1322 }, // American Samoa
  '969': { lat: 13.4443, lng:  144.7937 },  // Guam / CNMI (969xx shared)
}

// Normalize any state input (full name or abbreviation) to a 2-letter UPPER code.
const NAME_TO_CODE = Object.fromEntries(
  Object.entries(STATE_NAMES).map(([code, name]) => [name.toLowerCase(), code])
)
export function stateCode(state) {
  if (!state) return ''
  const s = String(state).trim()
  if (s.length === 2) return s.toUpperCase()
  return NAME_TO_CODE[s.toLowerCase()] || ''
}

// Look up {lat, lng} for a zip. Accepts messy input ("02072-1234", " 2072 ").
// Returns null if not resolvable. Territory ZIPs not in the dataset fall back
// to the hardcoded territory centroid for that prefix.
export function coordsForZip(zip) {
  if (!zip) return null
  const m = String(zip).match(/\d+/)
  if (!m) return null
  const z = m[0].slice(0, 5).padStart(5, '0')
  const hit = zipCentroids[z]
  if (hit) return { lat: hit[0], lng: hit[1] }
  // Fallback: territory prefix match
  const prefix = z.slice(0, 3)
  const fallback = TERRITORY_FALLBACK_COORDS[prefix]
  return fallback || null
}

// Haversine distance in miles between two {lat,lng} points.
export function milesBetween(a, b) {
  if (!a || !b) return Infinity
  const toRad = (d) => (d * Math.PI) / 180
  const R = 3958.8 // earth radius, miles
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// State-page URL slug helpers — single source of truth shared by the state
// landing pages (pages/advisors/[state].js) and the profile breadcrumb, so the
// generated paths and the links to them always agree.
// Full state name → slug:  "North Carolina" → "north-carolina"
export function stateNameToSlug(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
// State 2-letter code → slug:  "NC" → "north-carolina"
export function stateCodeToSlug(code) {
  const name = STATE_NAMES[String(code || '').toUpperCase()]
  return name ? stateNameToSlug(name) : ''
}
// Slug → 2-letter code:  "north-carolina" → "NC"  (null if unknown)
const SLUG_TO_CODE = Object.fromEntries(
  Object.entries(STATE_NAMES).map(([code, name]) => [stateNameToSlug(name), code])
)
export function slugToStateCode(slug) {
  return SLUG_TO_CODE[String(slug || '').toLowerCase()] || ''
}
