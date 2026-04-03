import './globals.css';

export const metadata = {
  title: '校園維修通報系統',
  description: '快速有效率的回報系統與進度追蹤',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  );
}
