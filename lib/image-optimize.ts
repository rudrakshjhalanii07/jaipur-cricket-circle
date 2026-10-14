export interface OptimizationResult {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  originalSize: number;
  optimizedSize: number;
}

/**
 * Compresses an image onto a canvas of given maximum dimension and encodes it as a WebP blob at a target quality.
 */
function compressToBlob(
  img: HTMLImageElement,
  maxDimension: number,
  quality: number
): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    let width = img.width;
    let height = img.height;

    // Preserve aspect ratio while constraining to maxDimension
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Failed to acquire 2D canvas context."));
      return;
    }

    // Enable high-quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Draw image onto canvas
    ctx.drawImage(img, 0, 0, width, height);

    // Export to WebP. Safari can't encode WebP and silently hands back a
    // PNG, which is huge for a photo, so fall back to JPEG there.
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to convert image to WebP blob."));
          return;
        }
        if (blob.type === "image/webp") {
          resolve({ blob, width, height });
          return;
        }
        canvas.toBlob(
          (jpeg) => (jpeg ? resolve({ blob: jpeg, width, height }) : reject(new Error("Failed to encode image."))),
          "image/jpeg",
          quality
        );
      },
      "image/webp",
      quality
    );
  });
}

/**
 * Optimizes an image client-side:
 * - WebP, longest side 1440px, so photos stay sharp on 1080px story cards
 * - Steps down quality, then size (1200, 1024px) until it's under 900KB
 * - Reject only if the final file is above 2MB (the upload route's limit)
 *
 * @param file The original image file selected by the user.
 * @returns A Promise resolving to the optimized File, preview URL, and size statistics.
 */
const TARGET_BYTES = 900 * 1024;
const LADDER: [number, number][] = [
  [1440, 0.82], [1440, 0.74], [1440, 0.66],
  [1200, 0.74], [1200, 0.66],
  [1024, 0.66], [1024, 0.58],
];

export function optimizeImage(file: File): Promise<OptimizationResult> {
  return new Promise((resolve, reject) => {
    const originalSize = file.size;

    // Read file to data URL
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Run optimization passes sequentially in an async IIFE
        (async () => {
          try {
            let attempt = await compressToBlob(img, LADDER[0][0], LADDER[0][1]);
            let [finalDimension, finalQuality] = LADDER[0];
            for (const [dim, q] of LADDER.slice(1)) {
              if (attempt.blob.size <= TARGET_BYTES) break;
              attempt = await compressToBlob(img, dim, q);
              [finalDimension, finalQuality] = [dim, q];
            }
            const resultBlob = attempt.blob;
            const resultWidth = attempt.width;
            const resultHeight = attempt.height;

            // Reject if final optimized image is still > 2MB
            const maxOptimizedSize = 2 * 1024 * 1024; // 2MB
            if (resultBlob.size > maxOptimizedSize) {
              reject(new Error("Image is too large. Please upload a photo under 10MB."));
              return;
            }

            // Create File from Blob
            const originalBaseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
            const jpeg = resultBlob.type === "image/jpeg";
            const optimizedFile = new File([resultBlob], `${originalBaseName}.${jpeg ? "jpg" : "webp"}`, {
              type: jpeg ? "image/jpeg" : "image/webp",
              lastModified: Date.now(),
            });

            // Create fresh object URL for preview
            const previewUrl = URL.createObjectURL(optimizedFile);

            console.log(
              `[JCC Image Optimizer] Original: ${Math.round(originalSize / 1024)}KB | ` +
              `Optimized WebP: ${Math.round(resultBlob.size / 1024)}KB (${resultWidth}x${resultHeight} @ Q=${finalQuality}, longestSide=${finalDimension})`
            );

            resolve({
              file: optimizedFile,
              previewUrl,
              width: resultWidth,
              height: resultHeight,
              originalSize,
              optimizedSize: resultBlob.size,
            });
          } catch (err) {
            const error = err as Error;
            reject(new Error(error.message || "Failed to process image canvas."));
          }
        })();
      };

      img.onerror = () => {
        reject(new Error("Failed to load image file. The file may be corrupt."));
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error("Failed to read image file."));
    };

    reader.readAsDataURL(file);
  });
}
