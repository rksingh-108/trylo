/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  transpilePackages: ["@trylo/ui", "@trylo/design-tokens", "@trylo/mock-data", "@trylo/types"],
};

export default nextConfig;
