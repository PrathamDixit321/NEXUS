import type { ReactNode } from "react";
import type { Metadata } from "next";
import { AuthProvider } from "@/context/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexus | Enterprise AI Operating System",
  description: "A unified workspace for enterprise knowledge and AI workflows.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

