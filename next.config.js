/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['odbc', 'bcrypt'],
  },
};

export default nextConfig;
