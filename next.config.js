/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The profile pages use plain <img> tags (not next/image), so no image
  // domain config is strictly required. Left here documented in case you
  // switch to next/image later for the Supabase-hosted headshots.
  // images: {
  //   remotePatterns: [
  //     { protocol: 'https', hostname: '*.supabase.co' },
  //   ],
  // },
}

module.exports = nextConfig
