'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useI18n } from '@/lib/hooks/useI18n';

export default function SidebarSignOut({ className = '' }) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const { common, auth } = useI18n();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  async function handleConfirmLogout() {
    setLogoutLoading(true);
    try {
      await logout();
      router.push('/login');
      router.refresh();
    } finally {
      setLogoutLoading(false);
      setLogoutOpen(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setLogoutOpen(true)}
        className={`sidebar-signout-btn ${className}`.trim()}
      >
        {common.signOut}
      </button>
      <ConfirmDialog
        isOpen={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={handleConfirmLogout}
        title={auth.confirmSignOutTitle}
        message={auth.confirmSignOutMessage}
        confirmLabel={common.signOut}
        cancelLabel={common.cancel}
        confirmVariant="danger"
        loading={logoutLoading}
      />
    </>
  );
}
