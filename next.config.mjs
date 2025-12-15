/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  images: {
    // Optimize images for faster loading
    minimumCacheTTL: 3600, // Cache images for 1 hour
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.guess.com",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "www.globalonline.co.il",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "globalonline.co.il",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "icpedcfdavwyvkuipqiz.supabase.co",
        pathname: "/**"
      }
    ]
  }
};

export default nextConfig;
