import type { NextConfig } from 'next';

// In development Next.js only serves its JS/HMR to `localhost`. Allow the usual ways of opening
// the dev server from elsewhere: 127.0.0.1, LAN IPs (testing from a phone/second laptop) and
// tunnels. Add more with DEV_ORIGINS="my.host.dev,*.example.com". Has no effect in production.
const allowedDevOrigins = [
  '127.0.0.1',
  '192.168.*.*',
  '10.*.*.*',
  '172.*.*.*',
  '*.local',
  '*.trycloudflare.com',
  '*.ngrok-free.app',
  '*.ngrok.app',
  '*.ngrok.io',
  '*.loca.lt',
  ...(process.env.DEV_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins,
  // The dev badge sits on top of the Mic button; build errors still show in the overlay.
  devIndicators: false,
};

export default nextConfig;
