'use client';

import SidebarIdentity from './SidebarIdentity';
import SidebarNav from './SidebarNav';
import SidebarSignOut from './SidebarSignOut';

export default function Sidebar({ user }) {
  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col border-e border-border bg-card">
      <SidebarIdentity user={user} />
      <SidebarNav user={user} />
      <div className="border-t border-border p-3">
        <SidebarSignOut />
      </div>
    </aside>
  );
}
