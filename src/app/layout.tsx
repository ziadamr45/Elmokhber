import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#050907" },
    { media: "(prefers-color-scheme: dark)", color: "#050907" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "الخبير - لعبة الذكاء والمغامرة",
    template: "%s | الخبير",
  },
  description: "اكشف المخبر بينكم - لعبة عربية ممتعة للذكاء والتخفي. العب مع أصدقائك أونلاين أو أوفلاين!",
  keywords: ["عربية", "لعبة", "المخبر", "الخبير", "spy game", "لعبة جاسوس", "لعبة ذكاء", "لعبة جماعية", "PWA"],
  authors: [{ name: "الخبير" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-72x72.png", sizes: "72x72", type: "image/png" },
      { url: "/icons/icon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/icons/icon-128x128.png", sizes: "128x128", type: "image/png" },
      { url: "/icons/icon-144x144.png", sizes: "144x144", type: "image/png" },
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-384x384.png", sizes: "384x384", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    other: [
      { rel: "mask-icon", url: "/icon.png", color: "#050907" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "الخبير",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "الخبير - لعبة الذكاء والمغامرة",
    description: "اكشف المخبر بينكم - لعبة عربية ممتعة للذكاء والتخفي. العب مع أصدقائك أونلاين أو أوفلاين!",
    images: ["/og-image.png"],
    type: "website",
    locale: "ar_EG",
    siteName: "الخبير",
  },
  twitter: {
    card: "summary_large_image",
    title: "الخبير - لعبة الذكاء والمغامرة",
    description: "اكشف المخبر بينكم - لعبة عربية ممتعة للذكاء والتخفي",
    images: ["/og-image.png"],
  },
  applicationName: "الخبير",
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  creators: [{ name: "الخبير Team" }],
  publisher: "الخبير",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* PWA Meta Tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="الخبير" />
        <meta name="application-name" content="الخبير" />
        <meta name="msapplication-TileColor" content="#050907" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        
        {/* Splash screens for iOS */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        
        {/* Preconnect to improve performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable} font-cairo antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Register Service Worker
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('SW registered: ', registration.scope);
                    })
                    .catch(function(registrationError) {
                      console.log('SW registration failed: ', registrationError);
                    });
                });
              }
              
              // Handle PWA install prompt
              let deferredPrompt;
              window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
                window.pwaInstallPrompt = deferredPrompt;
                window.dispatchEvent(new CustomEvent('pwa-install-available'));
              });
              
              window.addEventListener('appinstalled', () => {
                console.log('PWA installed successfully');
                window.pwaInstallPrompt = null;
                window.dispatchEvent(new CustomEvent('pwa-installed'));
              });
            `,
          }}
        />
      </body>
    </html>
  );
}
