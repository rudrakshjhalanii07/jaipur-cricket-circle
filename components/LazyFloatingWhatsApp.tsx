"use client";

// Wraps FloatingWhatsApp in dynamic() with ssr:false so the JS chunk is only
// downloaded after the first paint.  ssr:false must live inside a Client
// Component — it cannot be used in Server Components.

import dynamic from "next/dynamic";

const FloatingWhatsApp = dynamic(() => import("./FloatingWhatsApp"), { ssr: false });

export default FloatingWhatsApp;
