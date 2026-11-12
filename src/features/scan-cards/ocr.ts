// Client-only OCR runtime loading and bounded canvas preprocessing; photos never leave the browser.
import { reportError } from "../../services/report-error";

interface OcrEngine {
  recognize(image: Blob, language: string): Promise<{ data?: { text?: string } }>;
}
declare const Tesseract: OcrEngine | undefined;
let runtime: Promise<OcrEngine> | undefined;

function loadTesseract(): Promise<OcrEngine> {
  return (runtime ??= new Promise((resolve, reject) => {
    if (typeof Tesseract !== "undefined") {
      resolve(Tesseract);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.onload = () => {
      if (typeof Tesseract !== "undefined") resolve(Tesseract);
      else reject(new Error("The OCR library did not initialize."));
    };
    script.onerror = () =>
      reject(new Error("Could not load the OCR library -- check your connection and try again."));
    document.head.appendChild(script);
  }));
}

export async function preprocessImage(file: Blob): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (error) {
    reportError(error, { operation: "card-scan", severity: "warning" });
    return file;
  }
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale =
      longest > 2000
        ? 2000 / longest
        : bitmap.width < 1200
          ? Math.min(1.6, 1200 / bitmap.width)
          : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare the photo for OCR.");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    try {
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = image.data;
      const gray = new Uint8ClampedArray(data.length / 4);
      let min = 255,
        max = 0;
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const value = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        gray[p] = value;
        if (value < min) min = value;
        if (value > max) max = value;
      }
      const range = Math.max(max - min, 1);
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        data[i] = data[i + 1] = data[i + 2] = Math.round(((gray[p] - min) / range) * 255);
      }
      ctx.putImageData(image, 0, 0);
    } catch (error) {
      // Scaled pixels are still usable when pixel access fails; report before trying OCR.
      reportError(error, { operation: "card-scan", severity: "warning" });
    }
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((blob) => {
        if (!blob)
          reportError(new Error("Could not encode the photo."), {
            operation: "card-scan",
            severity: "warning",
          });
        resolve(blob || file);
      }, "image/png"),
    );
  } finally {
    bitmap.close();
  }
}

export async function readPhoto(file: Blob): Promise<string> {
  const image = await preprocessImage(file);
  const engine = await loadTesseract();
  const result = await engine.recognize(image, "eng");
  return result?.data?.text || "";
}
