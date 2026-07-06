import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const thicccboi = localFont({
  src: [
    { path: '../public/fonts/THICCCBOI-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../public/fonts/THICCCBOI-Medium.ttf', weight: '500', style: 'normal' },
    { path: '../public/fonts/THICCCBOI-SemiBold.ttf', weight: '600', style: 'normal' },
    { path: '../public/fonts/THICCCBOI-Bold.ttf', weight: '700', style: 'normal' },
    { path: '../public/fonts/THICCCBOI-ExtraBold.ttf', weight: '800', style: 'normal' },
    { path: '../public/fonts/THICCCBOI-Black.ttf', weight: '900', style: 'normal' },
  ],
  variable: '--font-thicccboi',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Simplifi EDU — Tutor Scheduler',
  description: 'Tutor scheduling platform for Simplifi EDU',
  verification: { google: '_Rdw3_ImJWF7TBHuJ_YyCRarrkFNZXbB8S9cj_f6gqg' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${thicccboi.variable} h-full antialiased`}>
      <body className="flex flex-col h-full bg-surface-2">{children}</body>
    </html>
  );
}
