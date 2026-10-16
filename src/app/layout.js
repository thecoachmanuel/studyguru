import './globals.css';
import Providers from '@/components/Providers';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export const metadata = {
  title: 'StudyCord – AI-Powered Student Collaboration Platform',
  description:
    'StudyCord is an AI-powered student collaboration platform with real-time messaging, voice, document sharing, semantic search, and an AI Study Assistant.',
  keywords:
    'StudyCord, AI study platform, student collaboration platform, study groups, semantic search for students, AI study assistant',
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'StudyCord',
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0E0E0E" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="StudyCord" />
        <meta name="application-name" content="StudyCord" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('studycord-theme');
                  var theme = saved === 'dark' ? 'dark' : 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {
                  document.documentElement.setAttribute('data-theme', 'light');
                }
                if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').then(
                      function(reg) {
                        /* SW registered successfully */
                      },
                      function(err) {
                        /* SW notice */
                      }
                    );
                  });
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
