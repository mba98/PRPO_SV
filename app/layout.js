import { Cairo, JetBrains_Mono } from 'next/font/google';
import AppProviders from '@/components/providers/AppProviders';
import { buildThemeBootstrapScript } from '@/lib/theme/bootstrapScript';
import './globals.css';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

const themeBootstrap = buildThemeBootstrapScript();

export const metadata = {
  title: 'Procurement Portal',
  description: 'Procurement workflow portal',
};

export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className={`${cairo.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
