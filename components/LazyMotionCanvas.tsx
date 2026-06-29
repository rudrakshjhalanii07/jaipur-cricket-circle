"use client";

// Wraps MotionCanvas in dynamic() with ssr:false.  This wrapper must be a
// Client Component — ssr:false is not allowed inside Server Components.
// MotionCanvas already self-defers rendering via requestIdleCallback, so this
// only defers the JS download; it doesn't affect visual output.

import dynamic from "next/dynamic";

const MotionCanvas = dynamic(() => import("./MotionCanvas"), { ssr: false });

export default MotionCanvas;
