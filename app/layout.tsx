import type {Metadata} from 'next';
import { Prompt } from 'next/font/google';
import './globals.css';
import AppShell from '@/components/AppShell';
import AuthSessionProvider from '@/components/providers/AuthSessionProvider';

const prompt = Prompt({
  subsets: ['latin', 'thai'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-prompt',
});

export const metadata: Metadata = {
  title: 'CardPay | Earn by Sharing',
  description: 'The most elegant way to share ads and earn rewards.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${prompt.variable} scroll-smooth`}>
      <body suppressHydrationWarning className={`${prompt.className} bg-white text-[#1A1A1A] font-prompt antialiased`}>
        <AuthSessionProvider>
          <AppShell>{children}</AppShell>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
