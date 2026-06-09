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
      <body className="min-h-screen text-gray-900 antialiased">
        {/* Decorative background: a blue-gray gradient with a faint, fractal
            texture (SVG feTurbulence) laid over it. Fixed behind all content,
            non-interactive, and hidden from screen readers. */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        >
          <svg
            className="h-full w-full"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="bgGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#eef2f8" />
                <stop offset="50%" stopColor="#dbe5f2" />
                <stop offset="100%" stopColor="#e7ebf0" />
              </linearGradient>
              {/* Large, soft fractal clouds tinted a muted blue. */}
              <filter id="fractalClouds">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.011"
                  numOctaves="5"
                  seed="11"
                  stitchTiles="stitch"
                  result="noise"
                />
                <feColorMatrix
                  in="noise"
                  type="matrix"
                  values="0 0 0 0 0.16
                          0 0 0 0 0.31
                          0 0 0 0 0.55
                          0 0 0 0.65 0"
                />
              </filter>
              {/* Finer grain to add subtle gray detail on top. */}
              <filter id="fractalGrain">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.08"
                  numOctaves="2"
                  seed="4"
                  stitchTiles="stitch"
                  result="grain"
                />
                <feColorMatrix
                  in="grain"
                  type="matrix"
                  values="0 0 0 0 0.42
                          0 0 0 0 0.46
                          0 0 0 0 0.54
                          0 0 0 0.18 0"
                />
              </filter>
            </defs>
            <rect width="100%" height="100%" fill="url(#bgGradient)" />
            <rect width="100%" height="100%" filter="url(#fractalClouds)" opacity="0.5" />
            <rect width="100%" height="100%" filter="url(#fractalGrain)" opacity="0.6" />
          </svg>
        </div>
        {children}
      </body>
    </html>
  );
}
