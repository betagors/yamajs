import React from 'react';
import Image from 'next/image';

// Logo component with SVG icon from public folder
const Logo = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <Image
      src="/logo.svg"
      alt="Yama JS"
      width={24}
      height={24}
      style={{ flexShrink: 0, display: 'block' }}
      priority
    />
    <span style={{ fontWeight: 'bold', fontSize: '18px', lineHeight: '1', whiteSpace: 'nowrap' }}>Yama JS</span>
  </div>
);

export default {
  logo: <Logo />,
  project: {
    link: 'https://github.com/betagors/yamajs',
  },
  docsRepositoryBase: 'https://github.com/betagors/yamajs/tree/main/apps/docs-site',
  footer: {
    text: `MIT ${new Date().getFullYear()} © Yama JS.`,
  },
};

