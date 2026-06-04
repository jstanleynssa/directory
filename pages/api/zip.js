// pages/api/zip.js
// Resolves a single ZIP to {lat,lng} using the bundled centroid dataset.
// Keeps the ~1MB zip file server-side; the browser only needs one lookup
// when a visitor uses proximity search.
import { coordsForZip } from '../../lib/geo'

export default function handler(req, res) {
  const zip = (req.query.z || '').toString()
  const coords = coordsForZip(zip)
  // Cache aggressively at the edge — zip→coord never changes.
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800')
  if (!coords) return res.status(404).json({ error: 'zip_not_found' })
  return res.status(200).json(coords)
}
