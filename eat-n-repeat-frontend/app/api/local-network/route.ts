import { NextResponse } from "next/server";
import os from "os";

export async function GET() {
  try {
    const interfaces = os.networkInterfaces();
    let localIp = "";

    // Iterate through all network interfaces to find the best IPv4 address
    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (!iface) continue;

      for (const alias of iface) {
        // Skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
        if (alias.family === "IPv4" && !alias.internal) {
          // Ignore obvious virtual adapters (Docker, WSL, VPNs)
          if (
            name.toLowerCase().includes("veth") ||
            name.toLowerCase().includes("docker") ||
            name.toLowerCase().includes("wsl") ||
            name.toLowerCase().includes("virtual") ||
            name.toLowerCase().includes("vpn")
          ) {
            continue;
          }

          // Prioritize Wi-Fi and Ethernet (often starts with Wi-Fi, Ethernet, eth, wlan, en)
          if (!localIp || name.toLowerCase().includes("wi-fi") || name.toLowerCase().includes("wlan") || name.toLowerCase().includes("eth") || name.toLowerCase().includes("en")) {
            localIp = alias.address;
          }
        }
      }
    }

    // Fallback if no valid IP was found, try grabbing any non-internal IPv4
    if (!localIp) {
      for (const name of Object.keys(interfaces)) {
        const iface = interfaces[name];
        if (!iface) continue;
        for (const alias of iface) {
          if (alias.family === "IPv4" && !alias.internal) {
            localIp = alias.address;
            break;
          }
        }
        if (localIp) break;
      }
    }

    if (!localIp) {
      return NextResponse.json({ error: "No local IP address found." }, { status: 404 });
    }

    const port = 3000;
    const url = `http://${localIp}:${port}/customer`;

    return NextResponse.json({
      ip: localIp,
      port,
      url,
    });
  } catch (error) {
    console.error("Failed to detect local network:", error);
    return NextResponse.json({ error: "Failed to detect local network" }, { status: 500 });
  }
}
