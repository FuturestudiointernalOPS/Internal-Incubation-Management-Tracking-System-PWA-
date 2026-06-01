"use client";

import { useEffect, useState } from "react";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/ThemeProvider";

export default function RootLayout({ children }) {
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    // Pre-hydration script already set data-theme on <html>.
    // Mark ready so ThemeProvider can sync from DOM without flash.
    setThemeReady(true);
  }, []);

  return (
    <html lang="en">
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
                  if (!theme) {
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
      </head>
      <body className="antialiased min-h-screen">
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
