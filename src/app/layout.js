'use client';

import { useEffect } from 'react';
import './globals.css';

export default function RootLayout({ children }) {
  useEffect(() => {
    // This script helps clear old PWA cache once if it's stuck
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
    }
  }, []);

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Poppins:wght@600;700;800;900&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </head>
      <body className="antialiased bg-[#080810] text-white selection:bg-[#0066FF]/30 min-h-screen">
        {children}
      </body>
    </html>
  );
}
