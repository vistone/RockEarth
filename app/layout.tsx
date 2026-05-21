import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Earth 3D - Next",
  description: "3D Earth data visualization built with Next.js and Three.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-black text-white overflow-hidden">
        {children}
      </body>
    </html>
  );
}
