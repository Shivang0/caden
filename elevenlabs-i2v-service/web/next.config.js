/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow larger multipart bodies for image uploads on the /api/jobs route.
  experimental: { serverActions: { bodySizeLimit: '5mb' } },
};
module.exports = nextConfig;
