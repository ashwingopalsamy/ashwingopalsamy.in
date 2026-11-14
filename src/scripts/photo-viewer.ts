/**
 * photo-viewer - the wall's full-screen viewer, behaving as a phone's photo
 * app does: one document, no navigation, every motion a spring on transform
 * or opacity.
 *
 *   open      the thumbnail lifts out of the grid (its slot goes empty) and
 *             zooms to fit; the scrim and chrome fade up under it
 *   page      the track follows the finger, rubber-bands at the ends, and a
 *             flick hands its speed to the page spring
 *   dismiss   drag down: the photo follows the finger and shrinks about the
 *             grab point while the grid shows through; let go and it flies
 *             back into its slot at the speed it was thrown
 *   zoom      double tap, pinch, ctrl-wheel or + and -; pans are clamped to
 *             the photo with rubber edges and settle with momentum
 *   info      the swipe-up sheet: the photo's capture record
 *
 * Each slide shows the thumbnail's own decoded pixels first and swaps to the
 * full-size picture in one frame once it decodes, so nothing is ever blank.
 * The viewer pages through what the wall shows, in its current filter and
 * order. The address follows (pushState on open, replaceState per page, Back
 * closes); popstate is taken in the capture phase so the router never
 * re-renders the wall underneath. Reduced motion keeps direct manipulation
 * and turns every travel into a short fade.
 */
import { onPageCleanup, pageSignal } from "./lifecycle";
import { prefersReducedData } from "./network";
import { playAccent } from "./sound";
import { spring, springs, type SpringOptions } from "./spring";

interface Shot {
  id: string;
  href: string;
  item: HTMLElement;
  thumb: HTMLImageElement | null;
  ratio: number;
  avif: string;
  webp: string;
  jpeg: string;
  jpegSrc: string;
  alt: string;
  title: string;
  meta: string;
  exposure: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Slide {
  el: HTMLElement;
  frame: HTMLElement;
  zoom: HTMLElement;
  lo: HTMLImageElement;
  hi: HTMLImageElement;
  sources: HTMLSourceElement[];
  index: number;
  rect: Rect;
  hiFor: string | null;
}

interface Zoom {
  z: number;
  x: number;
  y: number;
}

type Mode = "idle" | "pending" | "x" | "y" | "pan" | "pinch" | "sheet" | "spent";

interface Sample {
  x: number;
  y: number;
  t: number;
}

const PHOTO_PATH = /^\/more\/photos\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/;
const GAP = 24;
const SLOP = 8;
const MAX_ZOOM = 5;
const TAP_ZOOM = 2.5;
const DOUBLE_TAP_MS = 280;
const ENTER = "cubic-bezier(0.16, 1, 0.3, 1)";
const EXIT = "cubic-bezier(0.55, 0, 1, 0.45)";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
/** distance past an edge, resisted the way a scroll view's edge is */
const rubber = (overshoot: number, dimension: number) =>
  Math.sign(overshoot) * dimension * (1 - 1 / ((Math.abs(overshoot) * 0.55) / dimension + 1));
const tx = (x: number, y = 0) => `translate3d(${x}px, ${y}px, 0)`;
const zt = ({ z, x, y }: Zoom) => `translate3d(${x}px, ${y}px, 0) scale(${z})`;

function photoId(pathname: string): string | null {
  return PHOTO_PATH.exec(pathname)?.[1] ?? null;
}

/** The element's transform as it is drawn right now, made inline; running animations are dropped. */
function freeze(element: HTMLElement): DOMMatrix {
  const drawn = getComputedStyle(element).transform;
  element.getAnimations().forEach((animation) => animation.cancel());
  // explicit, even "none": an element's stylesheet may rest it elsewhere (the sheet)
  element.style.transform = drawn;
  return new DOMMatrix(drawn === "none" ? undefined : drawn);
}

function freezeOpacity(element: HTMLElement): number {
  const drawn = Number(getComputedStyle(element).opacity);
  element.getAnimations().forEach((animation) => animation.cancel());
  element.style.opacity = String(drawn);
  return drawn;
}

class PhotoViewer {
  private readonly dialog: HTMLDialogElement;
  private readonly scrim: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly track: HTMLElement;
  private readonly chrome: HTMLElement;
  private readonly caption: HTMLElement;
  private readonly title: HTMLElement;
  private readonly meta: HTMLElement;
  private readonly exposure: HTMLElement;
  private readonly count: HTMLElement;
  private readonly prev: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private readonly info: HTMLButtonElement;
  private readonly sheet: HTMLElement;
  private readonly sheetBody: HTMLElement;
  private readonly status: HTMLElement;
  private readonly reduce = matchMedia("(prefers-reduced-motion: reduce)");
  private readonly phone = matchMedia("(max-width: 38rem)");

  private shots: Shot[] = [];
  private index = 0;
  private slides = new Map<number, Slide>();
  private pool: Slide[] = [];
  private open = false;
  private closing = false;
  private pushed = false;
  /** the wall entry's router state, parked while the viewer owns history */
  private wallState: unknown = null;
  private wallUrl = "";
  private chromeOn = true;
  private sheetOpen = false;
  private W = 0;
  private H = 0;
  private P = 0;
  private trackX = 0;
  private zoom: Zoom = { z: 1, x: 0, y: 0 };
  private release: { vx: number; vy: number } | null = null;

  private mode: Mode = "idle";
  private pointers = new Map<number, { x: number; y: number }>();
  private primary = -1;
  private start: Sample = { x: 0, y: 0, t: 0 };
  private samples: Sample[] = [];
  private baseTrackX = 0;
  private baseZoom: Zoom = { z: 1, x: 0, y: 0 };
  private pinch = { d0: 1, mx: 0, my: 0, base: { z: 1, x: 0, y: 0 } as Zoom };
  private lastTap: Sample | null = null;
  private tapTimer = 0;
  private wheelX = 0;
  private wheelLocked = false;
  private wheelTimer = 0;
  private preloadTimer = 0;

  constructor(private readonly wall: HTMLElement, dialog: HTMLDialogElement, signal: AbortSignal) {
    this.dialog = dialog;
    const q = <T extends HTMLElement>(selector: string) => dialog.querySelector<T>(selector)!;
    this.scrim = q("[data-pv-scrim]");
    this.stage = q("[data-pv-stage]");
    this.track = q("[data-pv-track]");
    this.chrome = q("[data-pv-chrome]");
    this.caption = q("[data-pv-caption]");
    this.title = q("[data-pv-title]");
    this.meta = q("[data-pv-meta]");
    this.exposure = q("[data-pv-exposure]");
    this.count = q("[data-pv-count]");
    this.prev = q<HTMLButtonElement>("[data-pv-prev]");
    this.next = q<HTMLButtonElement>("[data-pv-next]");
    this.info = q<HTMLButtonElement>("[data-pv-info]");
    this.sheet = q("[data-pv-sheet]");
    this.sheetBody = q("[data-pv-sheet-body]");
    this.status = q("[data-pv-status]");

    const on = { signal };
    window.addEventListener("click", this.onWallClick, { capture: true, signal });
    window.addEventListener("popstate", this.onPopState, { capture: true, signal });
    window.addEventListener("resize", this.onResize, on);
    dialog.addEventListener("pointerdown", this.onPointerDown, on);
    dialog.addEventListener("pointermove", this.onPointerMove, on);
    dialog.addEventListener("pointerup", this.onPointerUp, on);
    dialog.addEventListener("pointercancel", this.onPointerUp, on);
    dialog.addEventListener("wheel", this.onWheel, { passive: false, signal });
    dialog.addEventListener("keydown", this.onKey, on);
    dialog.addEventListener("cancel", this.onCancel, on);
    dialog.addEventListener("close", this.onNativeClose, on);
    dialog.addEventListener("dragstart", (event) => event.preventDefault(), on);
    q("[data-pv-close]").addEventListener("click", () => this.requestClose(), on);
    this.prev.addEventListener("click", () => this.pageTo(this.index - 1), on);
    this.next.addEventListener("click", () => this.pageTo(this.index + 1), on);
    this.info.addEventListener("click", () => this.toggleSheet(!this.sheetOpen), on);
    document.addEventListener("astro:before-preparation", () => this.teardown(), on);
    onPageCleanup(() => this.teardown(), signal);
  }

  /* ---------------------------------------------------------------- data */

  private collect(): void {
    this.shots = Array.from(this.wall.querySelectorAll<HTMLElement>("[data-engine-item]"))
      .filter((item) => !item.hidden)
      .flatMap((item) => {
        const link = item.querySelector<HTMLAnchorElement>("a.photo-link[data-photo-target]");
        if (!link) return [];
        const data = link.dataset;
        const thumb = link.querySelector<HTMLImageElement>("img.photo-image");
        return [{
          id: data.photoTarget ?? "",
          href: link.href,
          item,
          thumb,
          ratio: Number(data.pvRatio) || 1.5,
          avif: data.photoAvif ?? "",
          webp: data.photoWebp ?? "",
          jpeg: data.photoJpeg ?? "",
          jpegSrc: data.photoJpegSrc ?? "",
          alt: thumb?.alt ?? "",
          title: data.pvTitle ?? "",
          meta: data.pvMeta ?? "",
          exposure: data.pvExposure ?? "",
        }];
      });
  }

  private measure(): void {
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.P = this.W + GAP;
  }

  /** The photo fitted inside the chrome's insets, centred. */
  private fit(ratio: number): Rect {
    const inset = this.phone.matches
      ? { top: 68, bottom: 132, side: 0 }
      : { top: 80, bottom: 136, side: Math.min(96, this.W * 0.08) };
    const availW = this.W - inset.side * 2;
    const availH = Math.max(120, this.H - inset.top - inset.bottom);
    let w = availW;
    let h = w / ratio;
    if (h > availH) {
      h = availH;
      w = h * ratio;
    }
    return { x: (this.W - w) / 2, y: inset.top + (availH - h) / 2, w, h };
  }

  /* -------------------------------------------------------------- slides */

  private makeSlide(): Slide {
    const el = document.createElement("div");
    el.className = "pv-slide";
    const frame = document.createElement("div");
    frame.className = "pv-frame";
    const zoom = document.createElement("div");
    zoom.className = "pv-zoom";
    const lo = document.createElement("img");
    lo.className = "pv-lo";
    lo.alt = "";
    lo.decoding = "async";
    lo.draggable = false;
    const picture = document.createElement("picture");
    picture.className = "pv-hi";
    const sources = ["image/avif", "image/webp"].map((type) => {
      const source = document.createElement("source");
      source.type = type;
      picture.append(source);
      return source;
    });
    const hi = document.createElement("img");
    hi.decoding = "async";
    hi.draggable = false;
    picture.append(hi);
    zoom.append(lo, picture);
    frame.append(zoom);
    el.append(frame);
    this.track.append(el);
    return { el, frame, zoom, lo, hi, sources, index: -1, rect: { x: 0, y: 0, w: 0, h: 0 }, hiFor: null };
  }

  private place(slide: Slide, index: number): void {
    const shot = this.shots[index];
    const changed = slide.index !== index || slide.hiFor !== null && slide.hiFor !== shot.id;
    slide.index = index;
    slide.rect = this.fit(shot.ratio);
    const { x, y, w, h } = slide.rect;
    slide.el.style.transform = tx(index * this.P);
    Object.assign(slide.frame.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    // radius scaled so it matches the thumbnail's 8px at the thumbnail's size
    const thumbWidth = shot.thumb?.getBoundingClientRect().width || w / 3;
    slide.frame.style.setProperty("--pv-r", `${clamp((8 * w) / thumbWidth, 8, 28).toFixed(1)}px`);
    if (changed) {
      slide.frame.getAnimations().forEach((animation) => animation.cancel());
      slide.zoom.getAnimations().forEach((animation) => animation.cancel());
      slide.frame.style.transform = "";
      slide.zoom.style.transform = "";
      slide.lo.src = shot.thumb?.currentSrc || shot.jpegSrc;
      if (slide.hiFor !== shot.id) {
        slide.hiFor = null;
        delete slide.el.dataset.hi;
        slide.sources.forEach((source) => source.removeAttribute("srcset"));
        slide.hi.removeAttribute("srcset");
        slide.hi.removeAttribute("src");
      }
    }
    slide.el.setAttribute("aria-hidden", String(index !== this.index));
  }

  private loadHi(slide: Slide, priority: "high" | "low", scale = 1): void {
    const shot = this.shots[slide.index];
    if (!shot) return;
    const sizes = `${Math.ceil(slide.rect.w * scale)}px`;
    if (slide.hiFor === shot.id) {
      if (scale > 1 && slide.hi.sizes !== sizes) {
        slide.sources.forEach((source) => { source.sizes = sizes; });
        slide.hi.sizes = sizes;
      }
      return;
    }
    slide.hiFor = shot.id;
    const [avif, webp] = slide.sources;
    avif.sizes = sizes;
    avif.srcset = shot.avif;
    webp.sizes = sizes;
    webp.srcset = shot.webp;
    slide.hi.alt = shot.alt;
    slide.hi.fetchPriority = priority;
    slide.hi.sizes = sizes;
    slide.hi.srcset = shot.jpeg;
    slide.hi.src = shot.jpegSrc;
    slide.hi.decode().then(() => {
      if (slide.hiFor === shot.id) slide.el.dataset.hi = "ready";
    }, () => undefined);
  }

  /** Keep slides for the current photo and its two neighbours; recycle the rest. */
  private ensureSlides(): void {
    const want = [this.index - 1, this.index, this.index + 1].filter((k) => k >= 0 && k < this.shots.length);
    for (const [k, slide] of this.slides) {
      if (!want.includes(k)) {
        this.slides.delete(k);
        this.pool.push(slide);
      }
    }
    for (const k of want) {
      const slide = this.slides.get(k) ?? this.pool.pop() ?? this.makeSlide();
      this.slides.set(k, slide);
      this.place(slide, k);
      slide.el.hidden = false;
    }
    for (const slide of this.pool) slide.el.hidden = true;
  }

  private get current(): Slide {
    return this.slides.get(this.index)!;
  }

  private preloadNeighbours(): void {
    clearTimeout(this.preloadTimer);
    if (prefersReducedData()) return;
    this.preloadTimer = window.setTimeout(() => {
      for (const k of [this.index + 1, this.index - 1]) {
        const slide = this.slides.get(k);
        if (slide) this.loadHi(slide, "low");
      }
    }, 240);
  }

  /* ------------------------------------------------------------- motion */

  private play(
    element: HTMLElement,
    from: string,
    to: string,
    options: SpringOptions,
    velocity = 0,
  ): Animation | null {
    element.style.transform = to;
    if (this.reduce.matches || from === to) return null;
    const { easing, duration } = spring({ ...options, velocity });
    return element.animate([{ transform: from }, { transform: to }], { duration, easing });
  }

  private fade(element: HTMLElement, to: number, duration: number, easing = ENTER, delay = 0): Animation | null {
    const from = freezeOpacity(element);
    element.style.opacity = String(to);
    if (from === to) return null;
    return element.animate([{ opacity: from }, { opacity: to }], {
      duration: this.reduce.matches ? Math.min(duration, 140) : duration,
      easing,
      delay: this.reduce.matches ? 0 : delay,
      fill: "backwards",
    });
  }

  private setThumbHidden(shot: Shot | undefined): void {
    this.wall.querySelectorAll<HTMLElement>("[data-pv-hidden]").forEach((item) => item.removeAttribute("data-pv-hidden"));
    shot?.item.setAttribute("data-pv-hidden", "");
  }

  /* --------------------------------------------------------- open, close */

  private onWallClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest?.<HTMLAnchorElement>("a.photo-link[data-photo-target]");
    if (!link || !this.wall.contains(link) || this.open) return;
    this.collect();
    const index = this.shots.findIndex((shot) => shot.href === link.href);
    if (index < 0) return;
    event.preventDefault();
    this.show(index, true);
  };

  show(index: number, push: boolean): void {
    if (this.open) return;
    this.open = true;
    this.closing = false;
    this.index = index;
    this.measure();
    this.zoom = { z: 1, x: 0, y: 0 };
    this.sheetOpen = false;
    this.chromeOn = true;
    this.dialog.removeAttribute("data-chrome");
    this.dialog.removeAttribute("data-zoomed");
    this.stage.style.transform = "";
    this.sheet.style.transform = "";
    this.sheet.inert = true;
    this.info.setAttribute("aria-expanded", "false");
    this.trackX = -index * this.P;
    this.track.style.transform = tx(this.trackX);

    const shot = this.shots[index];
    const from = shot.thumb?.getBoundingClientRect();
    this.dialog.showModal();
    this.ensureSlides();
    this.updateChrome(false);
    this.setThumbHidden(shot);
    const slide = this.current;
    this.loadHi(slide, "high");
    if (push) this.pushEntry(shot.href);

    if (from && from.width > 0) {
      const { x, y, w, h } = slide.rect;
      const start = `translate3d(${from.left - x}px, ${from.top - y}px, 0) scale(${from.width / w}, ${from.height / h})`;
      this.play(slide.frame, start, "none", springs.open);
    }
    this.fade(this.scrim, 1, 300);
    this.fade(this.chrome, 1, 280, ENTER, 90);
    playAccent("pop");
    this.preloadNeighbours();
  }

  /* The router ignores history entries whose state is null, and it acts on a
     traversal before any popstate listener can stop it. So while the viewer
     is open the wall's entry is parked at null (its router state kept here)
     and the viewer's own entry is null too: Back and Forward between them
     are the viewer's alone. Closing hands the router its state back. */
  private pushEntry(href: string): void {
    if (history.state !== null) this.wallState = history.state;
    this.wallUrl = location.href;
    history.replaceState(null, "", this.wallUrl);
    history.pushState(null, "", href);
    this.pushed = true;
  }

  /** Return the current entry to the router as the wall, whichever entry it is. */
  private restoreEntry(): void {
    if (!this.wallUrl) return;
    if (history.state === null) history.replaceState(this.wallState, "", photoId(location.pathname) ? this.wallUrl : location.href);
  }

  /** Close through history when this viewer added the entry, so Back and the button agree. */
  requestClose(release?: { vx: number; vy: number }): void {
    if (!this.open || this.closing) return;
    this.release = release ?? null;
    if (this.pushed && history.state === null && photoId(location.pathname)) {
      this.pushed = false;
      history.back();
      // if the browser had nowhere to go back to, close anyway
      window.setTimeout(() => { if (this.open && !this.closing) this.close(); }, 450);
      return;
    }
    this.close();
  }

  private onPopState = (event: PopStateEvent): void => {
    const id = photoId(location.pathname);
    if (this.open) {
      event.stopImmediatePropagation();
      if (!id) {
        this.pushed = false;
        this.restoreEntry();
        this.close();
      } else {
        const index = this.shots.findIndex((shot) => shot.id === id);
        if (index >= 0) this.pageTo(index);
      }
      return;
    }
    // Forward again into an entry this viewer made: the wall entry behind it
    // has its router state back, so turn this one into a parked wall entry
    // and open on a fresh one, keeping Back the viewer's.
    if (id && event.state === null && this.wallUrl) {
      this.collect();
      const index = this.shots.findIndex((shot) => shot.id === id);
      history.replaceState(null, "", this.wallUrl);
      if (index < 0) {
        this.restoreEntry();
        return;
      }
      event.stopImmediatePropagation();
      this.show(index, false);
      this.pushEntry(this.shots[index].href);
    }
  };

  private close(): void {
    if (!this.open || this.closing) return;
    this.closing = true;
    this.pushed = false;
    this.restoreEntry();
    clearTimeout(this.tapTimer);
    const release = this.release;
    this.release = null;
    const shot = this.shots[this.index];
    const slide = this.current;
    playAccent("dismiss");

    // Bring the slot into view behind the still-opaque scrim.
    let target = shot.thumb?.getBoundingClientRect();
    if (target && (target.bottom < 0 || target.top > this.H)) {
      window.scrollBy({ top: target.top - (this.H - target.height) / 2, behavior: "instant" });
      target = shot.thumb!.getBoundingClientRect();
    }

    // Fold the sheet's lift and the zoom into the frame, so one transform
    // carries the photo from exactly where it is drawn.
    const lift = freeze(this.stage);
    const scale = freeze(slide.zoom);
    const frameNow = freeze(slide.frame);
    this.stage.style.transform = "";
    slide.zoom.style.transform = "";
    const track = freeze(this.track);
    const offset = slide.index * this.P + track.m41;
    const folded = new DOMMatrix().translate(lift.m41, lift.m42).multiply(frameNow).multiply(scale);
    slide.frame.style.transform = folded.toString();

    if (this.sheetOpen) {
      this.sheetOpen = false;
      this.play(this.sheet, freeze(this.sheet).toString(), "translate3d(0, calc(100% + 32px), 0)", springs.sheet);
    }
    this.fade(this.chrome, 0, 120, EXIT);

    const finish = () => this.finishClose();
    if (!target || target.width === 0 || this.reduce.matches) {
      this.fade(this.scrim, 0, 160, EXIT);
      const fading = this.fade(slide.frame.parentElement as HTMLElement, 0, 160, EXIT);
      if (fading) fading.finished.then(finish, finish);
      else finish();
      return;
    }

    const { x, y, w, h } = slide.rect;
    const dx = target.left - (x + offset);
    const dy = target.top - y;
    const end = `translate3d(${dx}px, ${dy}px, 0) scale(${target.width / w}, ${target.height / h})`;
    let velocity = 0;
    if (release) {
      const pathX = dx - folded.m41;
      const pathY = dy - folded.m42;
      const length = pathX * pathX + pathY * pathY;
      if (length > 1) velocity = clamp(((release.vx * pathX + release.vy * pathY) * 1000) / length, 0, 14);
    }
    const flight = this.play(slide.frame, folded.toString(), end, springs.close, velocity);
    const scrimTime = Math.min(spring({ ...springs.close, velocity }).duration * 0.6, 300);
    this.fade(this.scrim, 0, scrimTime, "cubic-bezier(0.2, 0, 0, 1)");
    if (flight) flight.finished.then(finish, finish);
    else finish();
  }

  private finishClose(): void {
    if (!this.open) return;
    this.open = false;
    this.closing = false;
    this.setThumbHidden(undefined);
    if (this.dialog.open) this.dialog.close();
    for (const slide of this.slides.values()) {
      slide.el.style.opacity = "";
      slide.el.hidden = true;
      this.pool.push(slide);
    }
    this.slides.clear();
    this.mode = "idle";
    this.pointers.clear();
  }

  /** The browser closed the dialog itself (a repeated Escape): end at once. */
  private onNativeClose = (): void => {
    if (this.open && !this.closing) this.teardown();
  };

  private teardown(): void {
    if (!this.open) return;
    // a navigation away starts from this entry: give it back to the router first
    this.pushed = false;
    this.restoreEntry();
    this.dialog.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
    this.closing = true;
    this.finishClose();
  }

  private onCancel = (event: Event): void => {
    event.preventDefault();
    if (this.sheetOpen) this.toggleSheet(false);
    else if (this.zoom.z > 1.01) this.setZoom({ z: 1, x: 0, y: 0 });
    else this.requestClose();
  };

  /* -------------------------------------------------------------- paging */

  pageTo(target: number, vx = 0): void {
    if (!this.open || this.closing) return;
    const next = clamp(target, 0, this.shots.length - 1);
    const from = freeze(this.track).m41;
    if (next !== this.index) {
      if (this.zoom.z > 1.01) this.setZoom({ z: 1, x: 0, y: 0 });
      this.index = next;
      this.ensureSlides();
      const shot = this.shots[next];
      this.setThumbHidden(shot);
      if (photoId(location.pathname)) history.replaceState(null, "", shot.href);
      this.updateChrome(true);
      this.loadHi(this.current, "high");
      this.preloadNeighbours();
      playAccent("tick");
    }
    const to = -next * this.P;
    this.trackX = to;
    const distance = to - from;
    const velocity = Math.abs(distance) > 1 ? clamp((vx * 1000) / distance, 0, 30) : 0;
    this.play(this.track, tx(from), tx(to), springs.page, velocity);
  }

  private updateChrome(animate: boolean): void {
    const shot = this.shots[this.index];
    const total = this.shots.length;
    const pad = (n: number) => String(n).padStart(String(total).length < 2 ? 2 : String(total).length, "0");
    this.count.textContent = `${pad(this.index + 1)} / ${pad(total)}`;
    this.title.textContent = shot.title;
    this.meta.textContent = shot.meta;
    this.exposure.textContent = shot.exposure;
    this.prev.disabled = this.index === 0;
    this.next.disabled = this.index === total - 1;
    this.status.textContent = `Photo ${this.index + 1} of ${total}${shot.title ? `: ${shot.title}` : ""}`;
    if (this.sheetOpen) this.fillSheet();
    if (animate && !this.reduce.matches) {
      this.caption.animate(
        [{ opacity: 0, transform: "translate3d(0, 6px, 0)" }, { opacity: 1, transform: "none" }],
        { duration: 240, easing: ENTER },
      );
    }
  }

  /* ---------------------------------------------------------------- zoom */

  /** Bounds for a zoomed photo: it covers the viewport where it can, centres where it cannot. */
  private clampZoom(zoom: Zoom): Zoom {
    if (zoom.z <= 1.001) return { z: 1, x: 0, y: 0 };
    const { x: rx, y: ry, w, h } = this.current.rect;
    const cw = w * zoom.z;
    const ch = h * zoom.z;
    const x = cw <= this.W ? (w - cw) / 2 : clamp(zoom.x, this.W - rx - cw, -rx);
    const y = ch <= this.H ? (h - ch) / 2 : clamp(zoom.y, this.H - ry - ch, -ry);
    return { z: zoom.z, x, y };
  }

  private setZoom(target: Zoom, velocity = 0): void {
    const slide = this.current;
    const from = freeze(slide.zoom).toString();
    this.zoom = target;
    this.dialog.toggleAttribute("data-zoomed", target.z > 1.01);
    this.play(slide.zoom, from === "matrix(1, 0, 0, 1, 0, 0)" ? "none" : from, target.z === 1 && !target.x && !target.y ? "none" : zt(target), springs.zoom, velocity);
    if (target.z > 1.01) this.loadHi(slide, "high", Math.min(target.z, 3));
  }

  private zoomAt(point: { x: number; y: number }, z: number): void {
    const { x: rx, y: ry } = this.current.rect;
    const base = this.zoom;
    const cx = (point.x - rx - base.x) / base.z;
    const cy = (point.y - ry - base.y) / base.z;
    this.setZoom(this.clampZoom({ z, x: point.x - rx - cx * z, y: point.y - ry - cy * z }));
  }

  /* ------------------------------------------------------------ gestures */

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.open || this.closing) return;
    const target = event.target as Element;
    if (target.closest("button, a")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (target.closest("[data-pv-sheet]") && this.sheet.scrollTop > 0) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      this.dialog.setPointerCapture(event.pointerId);
    } catch {
      /* the pointer is already gone */
    }

    if (this.pointers.size === 2 && this.mode !== "spent") {
      this.beginPinch();
      return;
    }
    if (this.pointers.size > 1) return;

    // grab whatever is moving, exactly where it is drawn
    this.trackX = freeze(this.track).m41;
    this.baseTrackX = this.trackX;
    const slide = this.current;
    const frame = freeze(slide.frame);
    if (!frame.isIdentity && this.mode === "idle") {
      // a settle in flight: let it land from here under the finger
      slide.frame.style.transform = frame.toString();
    }
    const zoom = freeze(slide.zoom);
    this.zoom = zoom.isIdentity ? { z: 1, x: 0, y: 0 } : { z: zoom.a, x: zoom.e, y: zoom.f };
    this.baseZoom = { ...this.zoom };
    this.primary = event.pointerId;
    this.start = { x: event.clientX, y: event.clientY, t: event.timeStamp };
    this.samples = [this.start];
    this.mode = "pending";
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.mode === "pinch") {
      this.updatePinch();
      return;
    }
    if (event.pointerId !== this.primary || this.mode === "idle" || this.mode === "spent") return;

    const dx = event.clientX - this.start.x;
    const dy = event.clientY - this.start.y;
    this.samples.push({ x: event.clientX, y: event.clientY, t: event.timeStamp });
    while (this.samples.length > 2 && event.timeStamp - this.samples[0].t > 100) this.samples.shift();

    if (this.mode === "pending") {
      if (Math.hypot(dx, dy) < SLOP) return;
      clearTimeout(this.tapTimer);
      if (this.zoom.z > 1.01) this.mode = "pan";
      else if (this.sheetOpen) this.mode = Math.abs(dy) > Math.abs(dx) ? "sheet" : "x";
      else this.mode = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }

    if (this.mode === "x") this.dragX(dx);
    else if (this.mode === "y") this.dragY(dx, dy);
    else if (this.mode === "pan") this.dragPan(dx, dy);
    else if (this.mode === "sheet") this.dragSheet(dy);
  };

  private velocity(): { vx: number; vy: number } {
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const dt = last.t - first.t;
    if (!first || dt < 8) return { vx: 0, vy: 0 };
    return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
  }

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.delete(event.pointerId);
    if (this.mode === "pinch") {
      this.endPinch();
      return;
    }
    if (this.mode === "spent") {
      if (!this.pointers.size) this.mode = "idle";
      return;
    }
    if (event.pointerId !== this.primary) return;

    const mode = this.mode;
    this.mode = "idle";
    const dx = event.clientX - this.start.x;
    const dy = event.clientY - this.start.y;
    const { vx, vy } = event.type === "pointercancel" ? { vx: 0, vy: 0 } : this.velocity();

    if (mode === "pending") {
      if (event.type !== "pointercancel") this.tap(event);
      return;
    }
    if (mode === "x") {
      const projected = dx + vx * 180;
      let target = this.index;
      if (projected < -this.W * 0.3 || (vx < -0.3 && dx < 0)) target += 1;
      else if (projected > this.W * 0.3 || (vx > 0.3 && dx > 0)) target -= 1;
      this.pageTo(target, vx);
    } else if (mode === "y") {
      if (dy > 0 && (dy > 120 || vy > 0.5)) this.requestClose({ vx, vy });
      else if (dy < -64 || vy < -0.6) {
        this.settleFrame(0);
        this.toggleSheet(true);
      } else this.settleFrame(vy);
    } else if (mode === "pan") {
      this.setZoom(this.clampZoom({ z: this.zoom.z, x: this.zoom.x + vx * 240, y: this.zoom.y + vy * 240 }));
    } else if (mode === "sheet") {
      if (dy > 64 || vy > 0.5) this.toggleSheet(false);
      else this.play(this.sheet, freeze(this.sheet).toString(), "none", springs.sheet);
    }
  };

  private dragX(dx: number): void {
    const last = this.shots.length - 1;
    const edge = (this.index === 0 && dx > 0) || (this.index === last && dx < 0);
    this.track.style.transform = tx(this.baseTrackX + (edge ? rubber(dx, this.W) : dx));
  }

  private dragY(dx: number, dy: number): void {
    const slide = this.current;
    if (dy < 0) {
      slide.frame.style.transform = tx(0, rubber(dy, this.H) * 0.5);
      return;
    }
    const progress = clamp(dy / (this.H * 0.55), 0, 1);
    const s = 1 - progress * 0.32;
    const { x, y } = slide.rect;
    // shrink about the grab point, which stays under the finger
    const gx = this.start.x - (x + slide.index * this.P + this.trackX);
    const gy = this.start.y - y;
    slide.frame.style.transform = `translate3d(${dx + gx * (1 - s)}px, ${dy + gy * (1 - s)}px, 0) scale(${s})`;
    this.scrim.getAnimations().forEach((animation) => animation.cancel());
    this.scrim.style.opacity = String(clamp(1 - progress * 1.15, 0, 1));
    if (this.chromeOn) {
      this.chrome.getAnimations().forEach((animation) => animation.cancel());
      this.chrome.style.opacity = String(clamp(1 - progress * 5, 0, 1));
    }
  }

  private settleFrame(vy: number): void {
    const slide = this.current;
    const from = freeze(slide.frame);
    const distance = -from.m42;
    const velocity = Math.abs(distance) > 1 ? clamp((vy * 1000) / distance, 0, 20) : 0;
    this.play(slide.frame, from.isIdentity ? "none" : from.toString(), "none", springs.settle, velocity);
    this.fade(this.scrim, 1, 220);
    if (this.chromeOn) this.fade(this.chrome, 1, 220);
  }

  private dragPan(dx: number, dy: number): void {
    const want = { z: this.baseZoom.z, x: this.baseZoom.x + dx, y: this.baseZoom.y + dy };
    const bound = this.clampZoom(want);
    this.zoom = {
      z: want.z,
      x: bound.x + rubber(want.x - bound.x, this.W),
      y: bound.y + rubber(want.y - bound.y, this.H),
    };
    this.current.zoom.style.transform = zt(this.zoom);
  }

  private beginPinch(): void {
    clearTimeout(this.tapTimer);
    const [a, b] = [...this.pointers.values()];
    const slide = this.current;
    // a dismiss or page drag in progress gives way to the pinch
    this.settleFrame(0);
    this.pageTo(this.index);
    const zoom = freeze(slide.zoom);
    this.zoom = zoom.isIdentity ? { z: 1, x: 0, y: 0 } : { z: zoom.a, x: zoom.e, y: zoom.f };
    this.pinch = {
      d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      mx: (a.x + b.x) / 2,
      my: (a.y + b.y) / 2,
      base: { ...this.zoom },
    };
    this.mode = "pinch";
  }

  private updatePinch(): void {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return;
    const { rect } = this.current;
    const { d0, mx, my, base } = this.pinch;
    const raw = (base.z * Math.hypot(a.x - b.x, a.y - b.y)) / d0;
    const z = raw > MAX_ZOOM ? MAX_ZOOM + rubber(raw - MAX_ZOOM, MAX_ZOOM) : Math.max(0.4, raw);
    const cx = (mx - rect.x - base.x) / base.z;
    const cy = (my - rect.y - base.y) / base.z;
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.zoom = { z, x: m.x - rect.x - cx * z, y: m.y - rect.y - cy * z };
    this.current.zoom.style.transform = zt(this.zoom);
    if (z < 1) {
      this.scrim.getAnimations().forEach((animation) => animation.cancel());
      this.scrim.style.opacity = String(clamp(0.4 + (z - 0.4) / 0.6 * 0.6, 0, 1));
    }
  }

  private endPinch(): void {
    this.mode = this.pointers.size ? "spent" : "idle";
    if (this.zoom.z < 0.8) {
      // a pinch closed past the photo's own size puts it back in the grid
      const slide = this.current;
      const zoom = this.zoom;
      slide.zoom.style.transform = "";
      slide.frame.style.transform = `translate3d(${zoom.x}px, ${zoom.y}px, 0) scale(${zoom.z})`;
      this.zoom = { z: 1, x: 0, y: 0 };
      this.requestClose();
      return;
    }
    this.fade(this.scrim, 1, 200);
    const z = clamp(this.zoom.z, 1, MAX_ZOOM);
    if (z === this.zoom.z) this.setZoom(this.clampZoom(this.zoom));
    else {
      const { rect } = this.current;
      const cx = (this.pinch.mx - rect.x - this.zoom.x) / this.zoom.z;
      const cy = (this.pinch.my - rect.y - this.zoom.y) / this.zoom.z;
      this.setZoom(this.clampZoom({ z, x: this.pinch.mx - rect.x - cx * z, y: this.pinch.my - rect.y - cy * z }));
    }
  }

  private tap(event: PointerEvent): void {
    const point = { x: event.clientX, y: event.clientY, t: event.timeStamp };
    const inside = this.isOnPhoto(point);
    if (this.lastTap && point.t - this.lastTap.t < DOUBLE_TAP_MS && Math.hypot(point.x - this.lastTap.x, point.y - this.lastTap.y) < 32) {
      clearTimeout(this.tapTimer);
      this.lastTap = null;
      if (this.zoom.z > 1.01) this.setZoom({ z: 1, x: 0, y: 0 });
      else this.zoomAt(point, TAP_ZOOM);
      return;
    }
    this.lastTap = point;
    const mouse = event.pointerType === "mouse";
    if (mouse && !inside && this.zoom.z <= 1.01 && !this.sheetOpen) {
      this.lastTap = null;
      this.requestClose();
      return;
    }
    clearTimeout(this.tapTimer);
    this.tapTimer = window.setTimeout(() => {
      this.lastTap = null;
      if (this.sheetOpen && !(event.target as Element).closest("[data-pv-sheet]")) this.toggleSheet(false);
      else if (!mouse) this.toggleChrome();
    }, DOUBLE_TAP_MS);
  }

  private isOnPhoto(point: { x: number; y: number }): boolean {
    const box = this.current.frame.getBoundingClientRect();
    return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
  }

  private toggleChrome(): void {
    this.chromeOn = !this.chromeOn;
    if (this.chromeOn) this.dialog.removeAttribute("data-chrome");
    else this.dialog.setAttribute("data-chrome", "off");
    this.fade(this.chrome, this.chromeOn ? 1 : 0, this.chromeOn ? 220 : 140, this.chromeOn ? ENTER : EXIT);
  }

  private onWheel = (event: WheelEvent): void => {
    if ((event.target as Element).closest("[data-pv-sheet]") && this.sheet.scrollHeight > this.sheet.clientHeight) return;
    event.preventDefault();
    if (!this.open || this.closing || this.mode !== "idle") return;
    const slide = this.current;
    if (event.ctrlKey) {
      // a trackpad pinch arrives as ctrl + wheel
      const base = this.zoom;
      const z = clamp(base.z * Math.exp(-event.deltaY * 0.01), 1, MAX_ZOOM);
      const { x: rx, y: ry } = slide.rect;
      const cx = (event.clientX - rx - base.x) / base.z;
      const cy = (event.clientY - ry - base.y) / base.z;
      freeze(slide.zoom);
      this.zoom = this.clampZoom({ z, x: event.clientX - rx - cx * z, y: event.clientY - ry - cy * z });
      this.dialog.toggleAttribute("data-zoomed", this.zoom.z > 1.01);
      slide.zoom.style.transform = this.zoom.z > 1 ? zt(this.zoom) : "";
      if (this.zoom.z > 1.01) this.loadHi(slide, "high", Math.min(this.zoom.z, 3));
      return;
    }
    if (this.zoom.z > 1.01) {
      freeze(slide.zoom);
      this.zoom = this.clampZoom({ z: this.zoom.z, x: this.zoom.x - event.deltaX, y: this.zoom.y - event.deltaY });
      slide.zoom.style.transform = zt(this.zoom);
      return;
    }
    // one page per horizontal swipe, however many wheel events it sends
    clearTimeout(this.wheelTimer);
    this.wheelTimer = window.setTimeout(() => {
      this.wheelLocked = false;
      this.wheelX = 0;
    }, 160);
    if (this.wheelLocked || Math.abs(event.deltaX) < Math.abs(event.deltaY)) return;
    this.wheelX += event.deltaX;
    if (Math.abs(this.wheelX) > 36) {
      this.wheelLocked = true;
      this.pageTo(this.index + Math.sign(this.wheelX));
    }
  };

  private onKey = (event: KeyboardEvent): void => {
    if (!this.open || event.altKey || event.metaKey || event.ctrlKey) return;
    const key = event.key;
    if (key === "ArrowRight") this.pageTo(this.index + 1);
    else if (key === "ArrowLeft") this.pageTo(this.index - 1);
    else if (key === "i") this.toggleSheet(!this.sheetOpen);
    else if (key === "+" || key === "=") this.zoomAt({ x: this.W / 2, y: this.H / 2 }, Math.min(this.zoom.z * 1.6, MAX_ZOOM));
    else if (key === "-" || key === "0") this.setZoom({ z: 1, x: 0, y: 0 });
    else return;
    event.preventDefault();
  };

  private onResize = (): void => {
    if (!this.open || this.closing) return;
    this.measure();
    this.zoom = { z: 1, x: 0, y: 0 };
    this.dialog.removeAttribute("data-zoomed");
    for (const [k, slide] of this.slides) this.place(slide, k);
    this.trackX = -this.index * this.P;
    freeze(this.track);
    this.track.style.transform = tx(this.trackX);
    if (this.sheetOpen) this.liftForSheet(false);
  };

  /* --------------------------------------------------------------- sheet */

  private fillSheet(): void {
    const id = this.shots[this.index]?.id;
    const template = id
      ? this.wall.querySelector<HTMLTemplateElement>(`template[data-pv-sheet-for="${CSS.escape(id)}"]`)
      : null;
    this.sheetBody.replaceChildren(template ? template.content.cloneNode(true) : "");
    this.liftForSheet(true);
  }

  /** Raise the photo just enough to clear the sheet, never past the top inset. */
  private liftForSheet(animate: boolean): void {
    const { y, h } = this.current.rect;
    const room = this.H - this.sheet.offsetHeight - 16;
    const lift = this.sheetOpen ? Math.max(0, Math.min(y + h - room, y - 16)) : 0;
    const from = freeze(this.stage);
    const to = lift ? tx(0, -lift) : "none";
    if (animate) this.play(this.stage, from.isIdentity ? "none" : from.toString(), to, springs.sheet);
    else this.stage.style.transform = to === "none" ? "" : to;
  }

  private toggleSheet(on: boolean): void {
    if (!this.open || this.closing || on === this.sheetOpen) return;
    this.sheetOpen = on;
    this.info.setAttribute("aria-expanded", String(on));
    if (on) {
      if (this.zoom.z > 1.01) this.setZoom({ z: 1, x: 0, y: 0 });
      this.sheet.inert = false;
      this.fillSheet();
    } else {
      this.sheet.inert = true;
      this.liftForSheet(true);
    }
    const from = freeze(this.sheet);
    this.play(this.sheet, from.isIdentity ? "none" : from.toString(), on ? "none" : "translate3d(0, calc(100% + 32px), 0)", springs.sheet);
    this.fade(this.caption, on ? 0 : 1, on ? 120 : 220, on ? EXIT : ENTER);
  }

  private dragSheet(dy: number): void {
    const travel = Math.max(0, dy);
    this.sheet.getAnimations().forEach((animation) => animation.cancel());
    this.sheet.style.transform = tx(0, dy < 0 ? rubber(dy, this.H) * 0.3 : travel);
  }
}

function enhanceViewer(): void {
  const dialog = document.querySelector<HTMLDialogElement>("[data-pv]");
  const wall = document.querySelector<HTMLElement>("[data-photo-wall-root]");
  if (!dialog || !wall || dialog.dataset.ready === "true") return;
  const signal = pageSignal();
  dialog.dataset.ready = "true";
  new PhotoViewer(wall, dialog, signal);
  onPageCleanup(() => {
    delete dialog.dataset.ready;
  }, signal);
}

enhanceViewer();
document.addEventListener("astro:page-load", enhanceViewer);
