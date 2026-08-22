import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://newbernwebsites.com"),
  title: "New Bern Websites | We Handle Everything",
  description:
    "Turnkey websites for New Bern businesses, with optional professional photography and video. Every package includes domain, hosting, launch support, and 30 days of Captain 97.1 underwriting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
