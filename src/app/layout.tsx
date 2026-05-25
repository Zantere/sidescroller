import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "2D Side Scrolling Shooter",
  description: "A browser-based arcade side-scrolling shooter prototype."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
