/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdf2json"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
};

module.exports = nextConfig;
