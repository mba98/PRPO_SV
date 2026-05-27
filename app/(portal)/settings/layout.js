import SettingsPageGuard from '@/components/settings/SettingsPageGuard';

export default function SettingsLayout({ children }) {
  return <SettingsPageGuard>{children}</SettingsPageGuard>;
}
