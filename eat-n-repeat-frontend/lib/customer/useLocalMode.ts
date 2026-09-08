"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "eat-n-repeat-mode";
const TOGGLE_EVENT = "local-mode-toggled";

type Mode = "online" | "local";

function getModeFromStorage(): Mode {
  if (typeof window === "undefined") return "online";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "local" || stored === "online") return stored;
  return "online";
}

function getModeFromURL(): Mode | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  if (mode === "local" || mode === "online") return mode;
  return null;
}

function setModeToStorage(mode: Mode) {
  localStorage.setItem(STORAGE_KEY, mode);
}

export function useLocalMode() {
  const [isLocalMode, setIsLocalMode] = useState<boolean | null>(null);

  useEffect(() => {
    const urlMode = getModeFromURL();
    if (urlMode) {
      setIsLocalMode(urlMode === "local");
      setModeToStorage(urlMode);
    } else {
      setIsLocalMode(getModeFromStorage() === "local");
    }

    const handleToggle = () => {
      setIsLocalMode(getModeFromStorage() === "local");
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setIsLocalMode(getModeFromStorage() === "local");
      }
    };

    window.addEventListener(TOGGLE_EVENT, handleToggle);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(TOGGLE_EVENT, handleToggle);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return isLocalMode ?? false;
}

export function setLocalMode(mode: Mode) {
  setModeToStorage(mode);
  window.dispatchEvent(new Event(TOGGLE_EVENT));
}

export function startLocalMode() {
  setLocalMode("local");
}

export function stopLocalMode() {
  setLocalMode("online");
}

export function getCurrentMode(): Mode {
  return getModeFromStorage();
}
