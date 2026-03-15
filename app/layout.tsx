import type { Metadata } from "next";
import { Geist_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "GhostDork",
  description:
    "Private OSINT research dashboard for authorized educational security research workflows.",
  applicationName: "GhostDork",
  keywords: [
    "OSINT",
    "security research",
    "cybersecurity",
    "Google Custom Search",
    "OCR",

    "Next.js",
  ],
  authors: [{ name: "GhostDork" }],
  creator: "GhostDork",
  metadataBase: new URL("https://ghostdork.local"),
  openGraph: {
    title: "GhostDork",
    description:
      "Private OSINT research dashboard for authorized educational security research workflows.",
    siteName: "GhostDork",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GhostDork",
    description:
      "Private OSINT research dashboard for authorized educational security research workflows.",
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${ibmPlexSans.variable} ${geistMono.variable} min-h-screen bg-[#0a0a0a] font-sans text-[#ededed] antialiased`}
      >
        <div className="relative min-h-screen bg-[radial-gradient(circle_at_top,rgba(0,255,136,0.08),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_28%)]">
          <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:24px_24px]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(0,255,136,0.75),transparent)]" />
          {children}
        </div>
      </body>
    </html>
  );
}
