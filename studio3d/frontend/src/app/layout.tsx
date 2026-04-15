import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Studio3D',
  description: 'Local AI creative pipeline — Image · 3D · Video · Voice',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* model-viewer CDN for 3D preview */}
        <script
          type="module"
          src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"
          async
        />
      </head>
      <body className="bg-canvas text-white antialiased">{children}</body>
    </html>
  );
}
