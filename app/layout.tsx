import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Dashboard",
  description: "A personal daily view of project time blocks and subtasks.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
