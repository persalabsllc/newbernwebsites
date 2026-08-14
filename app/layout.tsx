import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://newbernwebsites.com"),
  title: "New Bern Websites | We Handle Everything",
  description:
    "Turnkey websites for New Bern businesses. Design, development, domain, hosting, photography, video, and optional Captain 97.1 radio marketing.",
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
