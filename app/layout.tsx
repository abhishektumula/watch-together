import type { Metadata, Viewport } from 'next';
import { Toasts } from '@/components/Toasts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Watch Together',
  description: 'A private room for two. Share the movie and still see each other, all on one screen.',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' rx='6' fill='%23fafafa'/><path d='m10 8.5 5.5 3.5-5.5 3.5z' fill='%2309090b'/></svg>",
  },
};

export const viewport: Viewport = { themeColor: '#09090b', colorScheme: 'dark' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toasts />
      </body>
    </html>
  );
}
