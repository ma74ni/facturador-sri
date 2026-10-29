/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // El design system se consume como código fuente TypeScript del workspace.
  transpilePackages: ['@facturador-sri/ui'],
};

module.exports = nextConfig;
