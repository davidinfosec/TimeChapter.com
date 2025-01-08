/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  basePath: '',          // Ensures no base path is set
  assetPrefix: './',     // Uses relative paths for assets
  typescript: {
    ignoreBuildErrors: true,
  },
  productionBrowserSourceMaps: true, // Enable source maps
}

module.exports = nextConfig;
