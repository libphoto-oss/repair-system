import './globals.css';

export const metadata = {
  title: '校園維修通報系統',
  description: '快速有效率的回報系統與進度追蹤',
};

export default function RootLayout({ children }) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  
  return (
    <html lang="zh-TW">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <style dangerouslySetInnerHTML={{ __html: `
          body { background-image: url('${basePath}/bibi_bg.png'); }
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
