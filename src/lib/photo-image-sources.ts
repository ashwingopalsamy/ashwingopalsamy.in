import { getImage } from "astro:assets";
import { photoWidths, type PhotoEntry } from "../data/photos";

export const PHOTO_DETAIL_SIZES = "(max-width: 38rem) calc(100vw - 2.5rem), min(760px, 72svh)";

export interface PhotoImageSources {
  avif: string;
  webp: string;
  jpeg: string;
  jpegSrc: string;
  sizes: string;
}

export async function getPhotoImageSources(
  source: PhotoEntry["data"]["source"],
  sizes = PHOTO_DETAIL_SIZES,
): Promise<PhotoImageSources> {
  const options = {
    src: source,
    widths: photoWidths(source.width),
    sizes,
  };
  const [avif, webp, jpeg] = await Promise.all([
    getImage({ ...options, format: "avif" }),
    getImage({ ...options, format: "webp" }),
    getImage({ ...options, format: "jpeg" }),
  ]);

  return {
    avif: avif.srcSet.attribute,
    webp: webp.srcSet.attribute,
    jpeg: jpeg.srcSet.attribute,
    jpegSrc: jpeg.src,
    sizes,
  };
}
