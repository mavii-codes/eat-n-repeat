import { NextResponse } from "next/server";
import os from "os";

// ── Constants (aligned with eat-n-repeat-local-manager/src/main/network.ts) ──

/** Skip adapters whose names match these patterns */
const SKIP_IFACE_RE =
  /veth|docker|wsl|virtual|virtualbox|vbox|vmware|hyper-?v|host-?only|vpn|loopback|hamachi|tailscale/i;

/** Skip adapters whose MAC address belongs to VM hypervisors */
const SKIP_MAC_RE =
  /^(08:00:27|00:05:69|00:0c:29|00:50:56|00:15:5d)/i;

/** Preferred adapter name patterns (Wi-Fi / Ethernet) */
const PREFERRED_IFACE_RE = /wi-?fi|wlan|eth|en/i;

/** Reject IPs in link-local or VirtualBox host-only ranges */
function isUsableIpv4(address: string): boolean {
  if (address.startsWith("169.254.")) return false; // APIPA / link-local
  if (/^192\.168\.56\./.test(address)) return false; // VirtualBox host-only
  return true;
}

// ── Detection ────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const interfaces = os.networkInterfaces();
    const candidates: string[] = [];
    let preferred: string | undefined;

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      if (SKIP_IFACE_RE.test(name)) continue;

      for (const alias of addrs) {
        if (alias.internal) continue;
        if (alias.family !== "IPv4") continue;
        if (!isUsableIpv4(alias.address)) continue;
        if (alias.mac && SKIP_MAC_RE.test(alias.mac)) continue;

        candidates.push(alias.address);

        if (!preferred && PREFERRED_IFACE_RE.test(name)) {
          preferred = alias.address;
        }
      }
    }

    const localIp = preferred ?? candidates[0];

    if (!localIp) {
      return NextResponse.json(
        { error: "No local IP address found." },
        { status: 404 },
      );
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
    return NextResponse.json(
      { error: "Failed to detect local network" },
      { status: 500 },
    );
  }
}
