import type { Metadata } from "next";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jesean Rentals",
  description: "Printer rentals, repairs, sales, and CCTV installations",
  openGraph: {
    title: "Jesean Printers",
    description: "Printer rentals, repairs, sales, and CCTV installations",
    url: "https://jesean-printer-rental.vercel.app/",
    siteName: "Jesean Printers",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Jesean Printers",
      },
    ],
    locale: "en_US",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Jesean Printers",
    description: "Printer rentals, repairs, sales, and CCTV installations",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
