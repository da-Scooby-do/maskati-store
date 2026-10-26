import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ScrollProgress } from "@/components/motion";
import { ShopProvider } from "@/components/shop-provider";
import { CartDrawer, LoadErrorBar, SiteFooter, SiteHeader, Toast, WhatsAppFloat } from "@/components/site-chrome";
import { SmoothScroll } from "@/components/smooth-scroll";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.maskaticare.com"),
  title: "ماسكاتي | عناية بالشعر في كل لحظة",
  description: "ماسكاتي: ماسك، زيت، بخاخ وكريم للشعر الجاف والمتضرر وبعد الصبغة. توصيل لكل محافظات مصر. Maskati hair care, delivered across Egypt.",
  // the picture shown when the site's link is shared (WhatsApp, Facebook, Telegram…): 1200×630
  openGraph: {
    title: "Maskati · ماسكاتي", description: "Hair care, every moment · العناية بالشعر في كل لحظة", siteName: "Maskati", type: "website",
    images: [{ url: "/assets/og-image.jpg", width: 1200, height: 630, alt: "Maskati · Natural hair care" }],
  },
  twitter: { card: "summary_large_image", images: ["/assets/og-image.jpg"] },
};
export const viewport: Viewport = { themeColor: "#4d5e2a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html dir="rtl" lang="ar">
      <head>
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link crossOrigin="" href="https://fonts.gstatic.com" rel="preconnect" />
        <link
          href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Bodoni+Moda:opsz,wght@6..96,400&family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ShopProvider>
          <SmoothScroll />
          <ScrollProgress />
          <LoadErrorBar />
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
          <CartDrawer />
          <Toast />
          <WhatsAppFloat />
        </ShopProvider>
      </body>
    </html>
  );
}
