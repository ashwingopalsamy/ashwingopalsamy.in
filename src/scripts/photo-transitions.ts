import { navigate } from "astro:transitions/client";
import { prefersReducedData } from "./network";
import type {
  TransitionBeforePreparationEvent,
  TransitionBeforeSwapEvent,
} from "astro:transitions/client";

interface PhotoTarget extends HTMLAnchorElement {
  dataset: DOMStringMap & {
    photoTarget?: string;
    photoAvif?: string;
    photoWebp?: string;
    photoJpeg?: string;
    photoJpegSrc?: string;
    photoSizes?: string;
  };
}

interface WarmEntry {
  id: string;
  key: string;
  picture: HTMLPictureElement;
  image: HTMLImageElement;
  lastUsed: number;
  decodedSrc?: string;
  decoding?: Promise<void>;
}

type PhotoTransitionKind = "open" | "swap" | null;

declare global {
  interface Window {
    __photoTransitionsReady?: boolean;
  }
}

const PHOTO_BASE = "/more/photos/";
const WARM_CACHE_LIMIT = 3;
const warmEntries = new Map<string, WarmEntry>();
let preloadHolder: HTMLDivElement | undefined;
let activeTransitionKind: PhotoTransitionKind = null;
let navigationEpoch = 0;
let activeRequest: {
  token: symbol;
  href: string;
  link: PhotoTarget;
  started: boolean;
} | undefined;

function normalizePath(pathname: string): string {
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

function isPhotoPath(pathname: string): boolean {
  return normalizePath(pathname) === PHOTO_BASE || photoIdFromPath(pathname) !== null;
}

function photoIdFromPath(pathname: string): string | null {
  const normalized = normalizePath(pathname);
  if (!normalized.startsWith(PHOTO_BASE) || normalized === PHOTO_BASE) return null;
  const id = normalized.slice(PHOTO_BASE.length, -1);
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ? id : null;
}

function mediaForId(root: ParentNode, id: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-photo-media][data-photo-id="${CSS.escape(id)}"]`);
}

function imageForMedia(media: HTMLElement | null): HTMLImageElement | null {
  return media?.querySelector<HTMLImageElement>("img.photo-image") ?? null;
}

function photoTarget(value: Element | null | undefined): PhotoTarget | null {
  if (!(value instanceof Element)) return null;
  return value.closest<HTMLAnchorElement>("a[data-photo-target]") as PhotoTarget | null;
}

function sourceKey(target: PhotoTarget): string | null {
  const { photoTarget: id, photoAvif, photoWebp, photoJpeg, photoJpegSrc, photoSizes } = target.dataset;
  if (!id || !photoAvif || !photoWebp || !photoJpeg || !photoJpegSrc || !photoSizes) return null;
  return [id, photoAvif, photoWebp, photoJpeg, photoJpegSrc, photoSizes].join("\n");
}

function matchingDisplayedImage(target: PhotoTarget): HTMLImageElement | null {
  const picture = target.querySelector<HTMLPictureElement>("picture.photo-picture");
  const image = picture?.querySelector<HTMLImageElement>("img.photo-image");
  if (!picture || !image) return null;

  const { photoAvif, photoWebp, photoJpeg, photoSizes } = target.dataset;
  const sources = [...picture.querySelectorAll("source")];
  const matches = sources.some((source) => source.type === "image/avif" && source.srcset === photoAvif) &&
    sources.some((source) => source.type === "image/webp" && source.srcset === photoWebp) &&
    image.getAttribute("srcset") === photoJpeg &&
    image.sizes === photoSizes &&
    sources.every((source) => source.sizes === photoSizes);
  if (!matches || (image.complete && image.naturalWidth === 0)) return null;
  return image;
}

function ensurePreloadHolder(): HTMLDivElement {
  if (preloadHolder?.isConnected) return preloadHolder;
  preloadHolder = document.createElement("div");
  preloadHolder.setAttribute("aria-hidden", "true");
  preloadHolder.inert = true;
  preloadHolder.style.cssText = [
    "position:fixed",
    "inset-block-start:0",
    "inset-inline-start:-2px",
    "inline-size:1px",
    "block-size:1px",
    "overflow:hidden",
    "opacity:0",
    "pointer-events:none",
    "contain:strict",
    "z-index:-1",
  ].join(";");
  document.body.append(preloadHolder);
  return preloadHolder;
}

function createWarmEntry(target: PhotoTarget, key: string, priority: "low" | "high"): WarmEntry {
  const {
    photoTarget: id,
    photoAvif,
    photoWebp,
    photoJpeg,
    photoJpegSrc,
    photoSizes,
  } = target.dataset;
  if (!id || !photoAvif || !photoWebp || !photoJpeg || !photoJpegSrc || !photoSizes) {
    throw new Error("Photo target is missing responsive image candidates.");
  }

  const picture = document.createElement("picture");
  picture.className = "photo-picture photo-preload-picture";
  for (const [type, srcset] of [
    ["image/avif", photoAvif],
    ["image/webp", photoWebp],
  ] as const) {
    const source = document.createElement("source");
    source.type = type;
    source.srcset = srcset;
    source.sizes = photoSizes;
    picture.append(source);
  }

  const image = document.createElement("img");
  image.className = "photo-image photo-preload-image";
  image.alt = "";
  image.decoding = "async";
  image.fetchPriority = priority;
  image.sizes = photoSizes;
  image.srcset = photoJpeg;
  image.src = photoJpegSrc;
  image.style.cssText = "display:block;inline-size:1px;block-size:1px;object-fit:contain";
  picture.append(image);
  ensurePreloadHolder().append(picture);

  return { id, key, picture, image, lastUsed: performance.now() };
}

function discardEntry(entry: WarmEntry): void {
  if (warmEntries.get(entry.id) === entry) warmEntries.delete(entry.id);
  entry.picture.remove();
  entry.picture.querySelectorAll("source").forEach((source) => source.removeAttribute("srcset"));
  entry.image.removeAttribute("srcset");
  entry.image.removeAttribute("src");
}

function reserveWarmSlot(priority: "low" | "high"): boolean {
  if (warmEntries.size < WARM_CACHE_LIMIT) return true;
  const activeId = activeRequest?.link.dataset.photoTarget;
  const candidate = [...warmEntries.values()]
    .filter((entry) => entry.id !== activeId && (priority === "high" || Boolean(entry.decodedSrc)))
    .sort((left, right) => left.lastUsed - right.lastUsed)[0];
  if (!candidate) return false;
  discardEntry(candidate);
  return true;
}

async function decodeImage(image: HTMLImageElement): Promise<void> {
  if (typeof image.decode === "function") {
    await image.decode();
  } else if (!image.complete) {
    await new Promise<void>((resolve, reject) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => reject(new Error("Photo failed to load.")), { once: true });
    });
  }
  if (!image.complete || image.naturalWidth === 0) {
    throw new Error("Photo failed to load.");
  }
}

async function warmPhoto(target: PhotoTarget, priority: "low" | "high" = "low"): Promise<WarmEntry | null> {
  if (priority === "low" && prefersReducedData()) return null;
  const key = sourceKey(target);
  if (!key) throw new Error("Photo target has no optimized image candidates.");
  const id = target.dataset.photoTarget!;
  const displayedImage = matchingDisplayedImage(target);
  if (displayedImage) {
    const staleEntry = warmEntries.get(id);
    if (staleEntry) discardEntry(staleEntry);
    await decodeImage(displayedImage);
    return null;
  }

  let entry = warmEntries.get(id);
  if (entry && entry.key !== key) {
    discardEntry(entry);
    entry = undefined;
  }
  if (!entry) {
    if (!reserveWarmSlot(priority)) return null;
    entry = createWarmEntry(target, key, priority);
    warmEntries.set(id, entry);
  }

  entry.lastUsed = performance.now();
  if (priority === "high" || entry.image.fetchPriority !== "high") entry.image.fetchPriority = priority;
  try {
    if (!entry.decoding || (entry.decodedSrc && entry.image.currentSrc && entry.decodedSrc !== entry.image.currentSrc)) {
      const decodingEntry = entry;
      entry.decoding = decodeImage(entry.image).then(() => {
        decodingEntry.decodedSrc = decodingEntry.image.currentSrc;
      }).catch((error: unknown) => {
        discardEntry(decodingEntry);
        throw error;
      });
    }
    await entry.decoding;
    if (warmEntries.get(id) !== entry) return null;
    entry.lastUsed = performance.now();
    return entry;
  } catch (error) {
    if (warmEntries.get(entry.id) === entry) discardEntry(entry);
    throw error;
  }
}

function copyImagePresentation(source: HTMLImageElement, target: HTMLImageElement): void {
  target.className = source.className;
  target.alt = source.alt;
  target.removeAttribute("style");
  for (const name of ["width", "height", "loading", "fetchpriority", "decoding", "data-image-component"]) {
    const value = source.getAttribute(name);
    if (value === null) target.removeAttribute(name);
    else target.setAttribute(name, value);
  }
}

function transplantWarmPicture(id: string, destinationMedia: HTMLElement): boolean {
  const entry = warmEntries.get(id);
  const destinationPicture = destinationMedia.querySelector<HTMLPictureElement>("picture.photo-picture");
  const destinationImage = destinationPicture?.querySelector<HTMLImageElement>("img.photo-image");
  const warmImage = entry?.picture.querySelector<HTMLImageElement>("img");
  if (!entry || !destinationPicture || !destinationImage || !warmImage) return false;

  const imageTransitionName = destinationImage.style.viewTransitionName;
  entry.picture.className = destinationPicture.className;
  copyImagePresentation(destinationImage, warmImage);
  warmImage.style.viewTransitionName = imageTransitionName;
  destinationPicture.replaceWith(entry.picture);
  warmEntries.delete(id);
  return true;
}

function syncPersistentPicture(currentMedia: HTMLElement, destinationMedia: HTMLElement): void {
  const currentPicture = currentMedia.querySelector<HTMLPictureElement>("picture.photo-picture");
  const destinationPicture = destinationMedia.querySelector<HTMLPictureElement>("picture.photo-picture");
  const currentImage = currentPicture?.querySelector<HTMLImageElement>("img.photo-image");
  const destinationImage = destinationPicture?.querySelector<HTMLImageElement>("img.photo-image");
  if (!currentPicture || !destinationPicture || !currentImage || !destinationImage) return;

  currentPicture.className = destinationPicture.className;
  const currentSources = currentPicture.querySelectorAll("source");
  const destinationSources = destinationPicture.querySelectorAll("source");
  destinationSources.forEach((destination, index) => {
    const current = currentSources[index];
    if (!current) return;
    for (const name of ["type", "media", "sizes", "srcset"]) {
      const value = destination.getAttribute(name);
      if (value === null) current.removeAttribute(name);
      else if (current.getAttribute(name) !== value) current.setAttribute(name, value);
    }
  });

  const transitionName = currentImage.style.viewTransitionName;
  currentImage.className = destinationImage.className;
  for (const name of ["alt", "sizes", "width", "height", "srcset", "src", "loading", "fetchpriority", "decoding"]) {
    const value = destinationImage.getAttribute(name);
    if (value === null) currentImage.removeAttribute(name);
    else if (currentImage.getAttribute(name) !== value) currentImage.setAttribute(name, value);
  }
  currentImage.style.viewTransitionName = transitionName;
}

function clearTransitionNames(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-photo-media], .photo-image, [data-photo-caption]").forEach((element) => {
    element.style.viewTransitionName = "";
  });
}

function setTransitionName(element: HTMLElement | null, name: string): void {
  if (element) element.style.viewTransitionName = name;
}

function setStatus(message: string, root: ParentNode = document): void {
  const status = root.querySelector<HTMLElement>("[data-photo-status]");
  if (status) status.textContent = message;
}

function clearActiveRequest(message = ""): void {
  const request = activeRequest;
  activeRequest = undefined;
  if (request) {
    request.link.removeAttribute("aria-busy");
    delete request.link.dataset.photoPending;
  }
  setStatus(message);
}

function handleWarmIntent(event: Event): void {
  if (event.defaultPrevented || activeRequest || prefersReducedData()) return;
  const target = photoTarget(event.target as Element | null);
  if (!target || target.hasAttribute("aria-busy")) return;
  void warmPhoto(target).catch(() => undefined);
}

function isPlainActivation(event: MouseEvent, link: HTMLAnchorElement): boolean {
  return event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    (!link.target || link.target === "_self") &&
    !link.hasAttribute("download");
}

async function handlePhotoActivation(event: MouseEvent): Promise<void> {
  if (event.defaultPrevented) return;
  const target = photoTarget(event.target as Element | null);
  if (!target || !isPlainActivation(event, target)) return;
  if (activeRequest) {
    if (activeRequest.link === target || activeRequest.href === target.href) event.preventDefault();
    return;
  }

  event.preventDefault();
  const request = {
    token: Symbol("photo-navigation"),
    href: target.href,
    link: target,
    started: false,
  };
  activeRequest = request;
  target.setAttribute("aria-busy", "true");
  target.dataset.photoPending = "true";
  setStatus("Preparing photo.");

  try {
    await warmPhoto(target, "high");
    if (activeRequest !== request) return;
    if (location.href === request.href) {
      clearActiveRequest();
      return;
    }
    setStatus("Opening photo.");
    await navigate(request.href, { sourceElement: target });
    if (activeRequest === request) clearActiveRequest();
  } catch {
    if (activeRequest !== request) return;
    clearActiveRequest("That photo could not be loaded. Activate the control to retry.");
  }
}

function handleBeforePreparation(rawEvent: Event): void {
  const event = rawEvent as TransitionBeforePreparationEvent;
  const epoch = ++navigationEpoch;
  const fromPath = normalizePath(event.from.pathname);
  const toPath = normalizePath(event.to.pathname);
  const fromId = photoIdFromPath(fromPath);
  const toId = photoIdFromPath(toPath);
  const fromGallery = fromPath === PHOTO_BASE;
  const toGallery = toPath === PHOTO_BASE;

  if (activeRequest) {
    if (new URL(activeRequest.href).pathname === toPath) {
      activeRequest.started = true;
    } else {
      clearActiveRequest();
    }
  }

  clearTransitionNames();
  activeTransitionKind = null;

  if (fromId && toId && fromId !== toId) {
    activeTransitionKind = "swap";
    setTransitionName(mediaForId(document, fromId), "photo-swap");
    setTransitionName(document.querySelector<HTMLElement>("[data-photo-caption]"), "photo-caption");
  } else if (fromId && toGallery) {
    activeTransitionKind = "open";
    setTransitionName(imageForMedia(mediaForId(document, fromId)), "photo-open");
  } else if (fromGallery && toId) {
    activeTransitionKind = "open";
    const source = photoTarget(event.sourceElement);
    const outgoingMedia = source?.querySelector<HTMLElement>("[data-photo-media]") ?? mediaForId(document, toId);
    setTransitionName(imageForMedia(outgoingMedia), "photo-open");
  } else if (!isPhotoPath(fromPath) && toId) {
    activeTransitionKind = "open";
  }

  event.signal.addEventListener("abort", () => {
    if (epoch !== navigationEpoch) return;
    clearTransitionNames();
    if (activeRequest?.started && new URL(activeRequest.href).pathname === toPath) clearActiveRequest();
  }, { once: true });
}

function handleBeforeSwap(rawEvent: Event): void {
  const event = rawEvent as TransitionBeforeSwapEvent;
  const epoch = navigationEpoch;
  const fromPath = normalizePath(event.from.pathname);
  const toPath = normalizePath(event.to.pathname);
  const fromId = photoIdFromPath(fromPath);
  const toId = photoIdFromPath(toPath);
  const fromGallery = fromPath === PHOTO_BASE;
  const toGallery = toPath === PHOTO_BASE;

  if (toId) {
    const destinationMedia = mediaForId(event.newDocument, toId);
    if (destinationMedia) {
      if (fromGallery) {
        const existingMedia = mediaForId(document, toId);
        if (existingMedia) {
          if (!transplantWarmPicture(toId, existingMedia)) {
            syncPersistentPicture(existingMedia, destinationMedia);
          }
          setTransitionName(imageForMedia(existingMedia), "photo-open");
        }
      } else if (fromId !== toId) {
        transplantWarmPicture(toId, destinationMedia);
      }
    }
  }

  if (activeTransitionKind === "swap" && toId) {
    setTransitionName(mediaForId(event.newDocument, toId), "photo-swap");
    setTransitionName(event.newDocument.querySelector<HTMLElement>("[data-photo-caption]"), "photo-caption");
  } else if (activeTransitionKind === "open") {
    if (toId) setTransitionName(imageForMedia(mediaForId(event.newDocument, toId)), "photo-open");
    else if (toGallery && fromId) {
      const galleryLink = event.newDocument.querySelector<PhotoTarget>(
        `a[data-photo-target="${CSS.escape(fromId)}"]`,
      );
      setTransitionName(imageForMedia(galleryLink?.querySelector<HTMLElement>("[data-photo-media]") ?? null), "photo-open");
    }
  }

  event.viewTransition.finished.then(
    () => {
      if (epoch === navigationEpoch) {
        clearTransitionNames();
        activeTransitionKind = null;
      }
    },
    () => {
      if (epoch === navigationEpoch) {
        clearTransitionNames();
        activeTransitionKind = null;
      }
    },
  );
}

function handleAfterSwap(): void {
  if (activeRequest?.started && new URL(activeRequest.href).pathname === normalizePath(location.pathname)) {
    clearActiveRequest();
  }
  if (!isPhotoPath(location.pathname)) {
    for (const entry of warmEntries.values()) discardEntry(entry);
    warmEntries.clear();
    preloadHolder?.remove();
  }
}

function initPhotoTransitions(): void {
  if (window.__photoTransitionsReady) return;
  window.__photoTransitionsReady = true;
  document.addEventListener("pointerover", handleWarmIntent, { passive: true });
  document.addEventListener("pointerdown", handleWarmIntent, { passive: true });
  document.addEventListener("focusin", handleWarmIntent);
  document.addEventListener("click", (event) => void handlePhotoActivation(event), true);
  document.addEventListener("astro:before-preparation", handleBeforePreparation);
  document.addEventListener("astro:before-swap", handleBeforeSwap);
  document.addEventListener("astro:after-swap", handleAfterSwap);
  document.addEventListener("astro:page-load", handleAfterSwap);
}

initPhotoTransitions();
