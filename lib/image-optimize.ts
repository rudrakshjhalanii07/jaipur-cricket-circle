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

    // Export to WebP with requested quality
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to convert image to WebP blob."));
          return;
        }
        resolve({ blob, width, height });
      },
      "image/webp",
      quality
    );
  });
}

/**
 * Optimizes an image client-side dynamically:
 * - Resizes longest side to 512px, convert to WebP, quality 0.8
 * - If size > 500KB, decriment quality down to 0.7, 0.6, 0.5
 * - If size > 500KB still, resize longest side to 384px, quality 0.5
 * - Reject only if final optimized file is above 2MB
 *
 * @param file The original image file selected by the user.
 * @returns A Promise resolving to the optimized File, preview URL, and size statistics.
 */
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
            let resultBlob: Blob | null = null;
            let resultWidth = img.width;
            let resultHeight = img.height;
            let finalDimension = 512;
            let finalQuality = 0.8;

            // Pass 1: 512px, Q=0.8
            let attempt = await compressToBlob(img, 512, 0.8);
            resultBlob = attempt.blob;
            resultWidth = attempt.width;
            resultHeight = attempt.height;
            finalDimension = 512;
            finalQuality = 0.8;

            // Pass 2: 512px, Q=0.7 (if needed)
            if (resultBlob.size > 500 * 1024) {
              attempt = await compressToBlob(img, 512, 0.7);
              resultBlob = attempt.blob;
              resultWidth = attempt.width;
              resultHeight = attempt.height;
              finalQuality = 0.7;
            }

            // Pass 3: 512px, Q=0.6 (if needed)
            if (resultBlob.size > 500 * 1024) {
              attempt = await compressToBlob(img, 512, 0.6);
              resultBlob = attempt.blob;
              resultWidth = attempt.width;
              resultHeight = attempt.height;
              finalQuality = 0.6;
            }

            // Pass 4: 512px, Q=0.5 (if needed)
            if (resultBlob.size > 500 * 1024) {
              attempt = await compressToBlob(img, 512, 0.5);
              resultBlob = attempt.blob;
              resultWidth = attempt.width;
              resultHeight = attempt.height;
              finalQuality = 0.5;
            }

            // Pass 5: 384px, Q=0.5 (if needed)
            if (resultBlob.size > 500 * 1024) {
              attempt = await compressToBlob(img, 384, 0.5);
              resultBlob = attempt.blob;
              resultWidth = attempt.width;
              resultHeight = attempt.height;
              finalDimension = 384;
              finalQuality = 0.5;
            }

            // Reject if final optimized image is still > 2MB
            const maxOptimizedSize = 2 * 1024 * 1024; // 2MB
            if (resultBlob.size > maxOptimizedSize) {
              reject(new Error("Image is too large. Please upload a photo under 10MB."));
              return;
            }

            // Create File from Blob
            const originalBaseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
            const optimizedFile = new File([resultBlob], `${originalBaseName}.webp`, {
              type: "image/webp",
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
