/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['framer-motion'],
  experimental: {
    serverComponentsExternalPackages: ['odbc', 'bcrypt'],
    instrumentationHook: true,
  },
};

export default nextConfig;
