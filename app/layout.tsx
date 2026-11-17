import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "./components";

export const metadata: Metadata = {
  title: {
    default: "Anonymous — text imageboard",
    template: "%s — Anonymous",
  },
  description: "A text-only imageboard for open discussion.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SiteHeader />
          {children}
          <footer className="site-footer">
            <span className="footer-brand">Anonymous<span>.</span></span>
            <span>Text-only discussion boards.</span>
            <span>© Anonymous</span>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
