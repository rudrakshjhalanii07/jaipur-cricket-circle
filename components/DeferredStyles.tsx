"use client";

import { useEffect } from "react";

export default function DeferredStyles() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/non-critical-animations.css";
    document.head.appendChild(link);
  }, []);

  return null;
}
