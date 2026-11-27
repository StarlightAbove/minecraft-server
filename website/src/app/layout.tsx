import type { Metadata } from "next";
import { Jersey_10, Noto_Sans, Pixelify_Sans } from "next/font/google";
import { SITE } from "@/lib/config";
import "./globals.css";

const display = Jersey_10({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const pixel = Pixelify_Sans({ subsets: ["latin"], variable: "--font-pixel" });
const body = Noto_Sans({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: `${SITE.title} - Status`,
  description: "Server status, online players and the current modpack.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${pixel.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
