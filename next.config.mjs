/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['xlsx']
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.globalonline.co.il',
      },
    ],
  },
};

export default nextConfig;
