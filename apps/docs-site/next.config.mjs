import nextra from 'nextra';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const withNextra = nextra({
  // Nextra 4.0 configuration
  // Theme configuration is now done in layout.jsx
});

export default withNextra({
  // Next.js configuration
  experimental: {
    mdxRs: false,
  },
  // Configure MDX import source
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'next-mdx-import-source-file': resolve(__dirname, 'app', 'mdx-components.tsx'),
    };
    return config;
  },
});

