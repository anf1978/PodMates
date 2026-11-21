// Client-only OCR runtime loading and bounded canvas preprocessing; photos never leave the browser.
import { reportError } from "../../services/report-error";
import { colourFilter, filtersFor, stretch, type TextColour } from "./enhance";

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

/** The images OCR reads for one photo: the stretched photo, then one per colour filter. When the photo
 * can't be decoded or its pixels can't be read, the file (or the scaled photo) is read once as it is. */
export async function preprocessImage(file: Blob, colour: TextColour = "black"): Promise<Blob[]> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (error) {
    reportError(error, { operation: "card-scan", severity: "warning" });
    return [file];
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
    let image: ImageData;
    try {
      image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (error) {
      // Scaled pixels are still usable when pixel access fails; report before trying OCR.
      reportError(error, { operation: "card-scan", severity: "warning" });
      return [await encode(canvas, file)];
    }
    const data = image.data;
    const gray = new Uint8ClampedArray(data.length / 4);
    for (let i = 0, p = 0; i < data.length; i += 4, p++)
      gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const passes = [
      stretch(gray),
      ...filtersFor(colour).map((c) => colourFilter(gray, canvas.width, canvas.height, c)),
    ];
    const blobs: Blob[] = [];
    for (const pass of passes) {
      for (let i = 0, p = 0; i < data.length; i += 4, p++)
        data[i] = data[i + 1] = data[i + 2] = pass[p];
      ctx.putImageData(image, 0, 0);
      blobs.push(await encode(canvas, file));
    }
    return blobs;
  } finally {
    bitmap.close();
  }
}

function encode(canvas: HTMLCanvasElement, fallback: Blob): Promise<Blob> {
  return new Promise<Blob>((resolve) =>
    canvas.toBlob((blob) => {
      if (!blob)
        reportError(new Error("Could not encode the photo."), {
          operation: "card-scan",
          severity: "warning",
        });
      resolve(blob || fallback);
    }, "image/png"),
  );
}

/** Reads every pass of a photo and returns their text together; `progress` hears "pass 2 of 3". */
export async function readPhoto(
  file: Blob,
  colour: TextColour = "black",
  progress?: (pass: number, passes: number) => void,
): Promise<string> {
  const images = await preprocessImage(file, colour);
  const engine = await loadTesseract();
  const texts: string[] = [];
  for (const [index, image] of images.entries()) {
    progress?.(index + 1, images.length);
    const result = await engine.recognize(image, "eng");
    texts.push(result?.data?.text || "");
  }
  return texts.join("\n");
}
