import React from 'react';
import Image from 'next/image';

export function Logo() {
  return (
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
}

