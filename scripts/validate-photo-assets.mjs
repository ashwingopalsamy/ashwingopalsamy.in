import { readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import sharp from "sharp";

const photoRoot = resolve("src/assets/photos");
const allowedExtensions = new Set([".avif", ".jpg", ".jpeg", ".png", ".webp"]);
const allowedFormats = new Set(["avif", "jpg", "jpeg", "png", "webp"]);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Photo asset "${path}" cannot be a symbolic link.`);
      }
      if (entry.isDirectory()) return listFiles(path);
      if (!entry.isFile() || entry.name === ".gitkeep" || entry.name === ".DS_Store") return [];
      return [path];
    }),
  );
  return nested.flat();
}

for (const path of await listFiles(photoRoot)) {
  const extension = extname(path).toLowerCase();
  if (!allowedExtensions.has(extension)) {
    throw new Error(`Unsupported photo asset "${path}". Use AVIF, JPEG, PNG, or WebP.`);
  }

  const metadata = await sharp(path).metadata();
  if (!metadata.format || !allowedFormats.has(metadata.format)) {
    throw new Error(`Photo asset "${path}" is not in a supported raster format.`);
  }
  if (metadata.exif || metadata.iptc || metadata.xmp) {
    throw new Error(`Photo asset "${path}" contains EXIF, IPTC, or XMP metadata. Normalize and strip metadata before adding it.`);
  }
}
