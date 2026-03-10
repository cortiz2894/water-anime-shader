import type { Metadata } from "next";
import { bebasNeue, barlowCondensed, ibmPlexMono } from "@/components/shared/fonts";
import "./globals.css";
import Footer from "@/components/overlay/Footer";


export const metadata: Metadata = {
  title: "Anime Water Shader",
  description: "Anime style water in R3F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${bebasNeue.variable} ${barlowCondensed.variable} ${ibmPlexMono.variable} antialiased`}
      >
        {children}
        <Footer />
      </body>
    </html>
  );
}
