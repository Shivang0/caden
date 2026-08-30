import './globals.css';

export const metadata = {
  title: 'Image → Video',
  description: 'Turn a still image into a short video. Powered by a laptop in the corner.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
