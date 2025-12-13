/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
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
