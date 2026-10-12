
import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import {
  Cairo,
  Geist,
  Geist_Mono,
} from "next/font/google";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "JUST US",

  title: {
    default: "JUST US | Our Little Universe",
    template: "%s | JUST US",
  },

  description:
    "JUST US — عالم خاص بجوج، فيه ألعاب تفاعلية وأسئلة وتحديات ومفاجآت.",

  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="ar"
      className={`
        ${cairo.variable}
        ${geistSans.variable}
        ${geistMono.variable}
        h-full antialiased
      `}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
