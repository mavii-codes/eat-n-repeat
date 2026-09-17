"use client";

import { useEffect, useState } from "react";

export function useLocalMode() {
  const [isLocalMode, setIsLocalMode] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      
      const isLocalHost = 
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.") ||
        hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./);

      const isLocalApi = 
        apiUrl.includes("localhost") || 
        apiUrl.includes("127.0.0.1") || 
        apiUrl.includes("192.168.") ||
        apiUrl.includes("10.") ||
        apiUrl.match(/172\.(1[6-9]|2[0-9]|3[0-1])\./);

      if (isLocalHost || isLocalApi) {
        setIsLocalMode(true);
      }
    }
  }, []);

  return isLocalMode;
}
