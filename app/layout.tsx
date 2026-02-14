import type { Metadata } from "next";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/hooks/use-theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartWealth - Personal Finance Management",
  description: "Manage your personal finances with SmartWealth",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          {children}
          <Toaster 
            position="top-right" 
            richColors 
            closeButton
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
