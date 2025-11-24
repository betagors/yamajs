import nextra from 'nextra';

// Set up Nextra with its configuration
const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
});

// Export the final Next.js config with Nextra included
export default withNextra({
  // Add regular Next.js options here if needed
});

