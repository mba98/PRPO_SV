import { Cairo, JetBrains_Mono } from 'next/font/google';
import AppProviders from '@/components/providers/AppProviders';
import './globals.css';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

const themeBootstrap = `(function(){try{
var l=localStorage.getItem('procurement-locale')||'ar';
var d=l==='en'?'ltr':'rtl';
document.documentElement.lang=l;
document.documentElement.dir=d;
var m=localStorage.getItem('procurement-color-mode');
var dark=m!=='light';
document.documentElement.classList.toggle('dark',dark);
document.documentElement.setAttribute('data-theme',dark?'dark':'light');
}catch(e){document.documentElement.classList.add('dark');document.documentElement.setAttribute('data-theme','dark');}})();`;

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
