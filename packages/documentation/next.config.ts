import type { NextConfig } from 'next';
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();


const config: NextConfig = withMDX({
  reactStrictMode: true,
    async rewrites() {
      return [
        {
          source: '/docs/:path*.md',
          destination: '/docs/llm-docs/:path*',
        },
        {
          source: '/docs/:path*.mdx',
          destination: '/docs/llm-docs/:path*',
        },
      ];
    },
  });

export default config;
