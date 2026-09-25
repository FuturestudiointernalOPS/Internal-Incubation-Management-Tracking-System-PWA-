import { Suspense } from "react";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/ThemeProvider";
import NavHistoryTracker from "@/components/NavHistoryTracker";
import NavigationLoader from "@/components/ui/NavigationLoader";
import ClientErrorReporter from "@/components/ClientErrorReporter";
import { DialogProvider } from "@/components/ui/DialogProvider";

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        {/*
          PRE-HYDRATION THEME SCRIPT
          Runs before React hydrates — prevents FOUT (Flash of Unstyled Theme).
          Reads localStorage → falls back to system preference → defaults to 'dark'.
          Sets data-theme on <html> synchronously before first paint.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('impactos_theme');
                  if (!theme || theme === 'system') {
                    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  document.documentElement.setAttribute('data-theme', theme);
                } catch(e) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
              })();
            `,
          }}
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
        />
        <title>Impact OS — Operating Platform for the Future Studio Ecosystem</title>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="antialiased min-h-screen">
        <ThemeProvider>
          <I18nProvider>
            <DialogProvider>
              <ClientErrorReporter />
              <Suspense fallback={null}>
                <NavigationLoader />
              </Suspense>
              <NavHistoryTracker />
              {children}
            </DialogProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
