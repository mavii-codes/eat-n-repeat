import type { NextConfig } from "next";

import os from "os";

function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const ips = ["localhost", "127.0.0.1"];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

const nextConfig: NextConfig = {
  // Allow dev resources (HMR, webpack) from LAN IPs so phones on the same Wi-Fi work
  allowedDevOrigins: getLocalIps(),
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
