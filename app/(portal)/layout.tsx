import React from 'react';
import PortalShell from '@/components/portal/PortalShell';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
