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
  // User Management restructure: the tabbed /admin/users page and the old
  // standalone Staff Accounts / Customers pages became sidebar sub-pages
  // (mirroring the Inventory section). Real HTTP redirects before render.
  async redirects() {
    return [
      { source: "/admin/users", destination: "/admin/users/staff", permanent: false },
      { source: "/admin/staff", destination: "/admin/users/staff", permanent: false },
      { source: "/admin/customers", destination: "/admin/users/customers", permanent: false },
    ];
  },
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
