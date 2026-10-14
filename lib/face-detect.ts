// Finds the face in a member's photo, in the browser, for lib/photo-focus.ts.
//
// MediaPipe's BlazeFace (short range) runs on WebAssembly. It loads only when
// someone frames a photo — the upload step or the admin "Photo framing" panel —
// never on ordinary pages. The model looks at a small square, so a full-length
// photo's face can be too small for it: if the whole photo finds nothing, the
// upper part is tried again in zoomed tiles.

import type { FaceDetector } from "@mediapipe/tasks-vision";
import type { PhotoFocus } from "@/lib/photo-focus";

const VERSION = "0.10.21";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

let detector: Promise<FaceDetector> | null = null;

/**
 * MediaPipe's WebAssembly prints its own start-up chatter ("INFO: Created
 * TensorFlow Lite XNNPACK delegate for CPU.", WebGL fallbacks) through
 * console.error, which Next's dev overlay reports as an error. Only that
 * chatter is dropped while the detector runs; anything else passes through.
 */
const CHATTER = /^(INFO:|W\d{4}|I\d{4})|XNNPACK|gl_context|Graph successfully started/;
let quiet = 0;
let original: Pick<Console, "error" | "warn" | "info" | "log"> | null = null;
async function quietly<T>(run: () => T | Promise<T>): Promise<T> {
  // Overlapping runs share one patch; the last one out restores the console.
  if (quiet++ === 0) {
    original = { error: console.error, warn: console.warn, info: console.info, log: console.log };
    const filter = (out: (...a: unknown[]) => void) => (...a: unknown[]) => {
      if (typeof a[0] === "string" && CHATTER.test(a[0])) return;
      out(...a);
    };
    console.error = filter(original.error);
    console.warn = filter(original.warn);
    console.info = filter(original.info);
    console.log = filter(original.log);
  }
  try {
    return await run();
  } finally {
    if (--quiet === 0 && original) {
      Object.assign(console, original);
      original = null;
    }
  }
}

function getDetector() {
  if (!detector) {
    detector = (async () => {
      const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM);
      return quietly(() =>
        FaceDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
          runningMode: "IMAGE",
          minDetectionConfidence: 0.5,
        }),
      );
    })();
    detector.catch(() => { detector = null; });
  }
  return detector;
}

type Hit = { x: number; y: number; w: number; h: number; score: number };

/** Best face in a region of the image, in the image's own pixels. */
function detectIn(fd: FaceDetector, img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number): Hit | null {
  const scale = Math.min(1, 640 / Math.max(sw, sh));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(sw * scale));
  c.height = Math.max(1, Math.round(sh * scale));
  c.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  let best: Hit | null = null;
  for (const d of fd.detect(c).detections) {
    const b = d.boundingBox;
    const score = d.categories[0]?.score ?? 0;
    if (!b || (best && best.score >= score)) continue;
    best = { x: sx + b.originX / scale, y: sy + b.originY / scale, w: b.width / scale, h: b.height / scale, score };
  }
  return best;
}

/** Where the face is, or null if none was found (or the detector couldn't load). */
export async function detectFocus(img: HTMLImageElement): Promise<PhotoFocus | null> {
  let fd: FaceDetector;
  try {
    fd = await getDetector();
  } catch {
    return null;
  }
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (!iw || !ih) return null;
  return quietly(() => search(fd, img, iw, ih));
}

function search(fd: FaceDetector, img: HTMLImageElement, iw: number, ih: number): PhotoFocus | null {
  try {
    let hit = detectIn(fd, img, 0, 0, iw, ih);
    if (!hit) {
      // Faces sit in the upper part of a portrait: try it whole, then in tiles.
      const top = ih * 0.65;
      const tiles: [number, number, number, number][] = [[0, 0, iw, top]];
      const tw = iw / 2, th = top / 2;
      for (let ty = 0; ty < 3; ty++) for (let tx = 0; tx < 3; tx++) tiles.push([(tx * tw) / 2, (ty * th) / 2, tw, th]);
      for (const t of tiles) {
        const h = detectIn(fd, img, ...t);
        if (h && (!hit || h.score > hit.score)) hit = h;
      }
    }
    if (!hit) return null;
    return { x: (hit.x + hit.w / 2) / iw, y: (hit.y + hit.h / 2) / ih, s: hit.h / ih, a: iw / ih, w: iw, by: "auto" };
  } catch {
    return null;
  }
}

/** Loads a URL (or object URL) as an image the detector and canvas can read. */
export function loadForDetection(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load the photo."));
    img.src = src.split("#")[0];
  });
}
