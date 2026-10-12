/**
 * pointer-fx - pointer-led spotlight and magnet for opted-in elements.
 *
 * [data-fx~="spot"]   writes --mx/--my: pointer px from the element's top-left.
 * [data-fx~="magnet"] writes --tx/--ty: drift toward the pointer, within
 *                     --magnet-max over a field of the element + 12px, and
 *                     --lx/--ly: the label's extra drift, within --magnet-label.
 *
 * Delegated, so elements the page store swaps in need no binding. Only the
 * hovered element is written, at most once per frame. Its rect is read on
 * enter and in scroll-scheduler measure passes, never in a move handler.
 * Active only for a fine hovering pointer without reduced motion.
 */

import { onScrollFrame } from "./scroll-scheduler";

const FIELD = 12;
const MAGNET_PROPS = ["--tx", "--ty", "--lx", "--ly"];

let enabled: AbortController | null = null;
let active: HTMLElement | null = null;
let rect: DOMRect | null = null;
let spot = false;
let magnet = false;
let max = 3;
let label = 1.5;
let x = 0;
let y = 0;
let frame = 0;

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

function lengthProp(el: HTMLElement, name: string, fallback: number): number {
  const value = parseFloat(getComputedStyle(el).getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
}

/* Spot props stay behind so the light fades where it was; magnet props go,
   so the element springs back to rest. */
function leave() {
  if (active && magnet) {
    for (const name of MAGNET_PROPS) active.style.removeProperty(name);
  }
  active = null;
  rect = null;
}

function paint() {
  frame = 0;
  if (!active || !rect) return;
  if (!active.isConnected) {
    leave();
    return;
  }
  const { style } = active;
  if (spot) {
    style.setProperty("--mx", `${(x - rect.left).toFixed(1)}px`);
    style.setProperty("--my", `${(y - rect.top).toFixed(1)}px`);
  }
  if (magnet) {
    const nx = clamp((x - rect.left - rect.width / 2) / (rect.width / 2 + FIELD));
    const ny = clamp((y - rect.top - rect.height / 2) / (rect.height / 2 + FIELD));
    style.setProperty("--tx", `${(nx * max).toFixed(2)}px`);
    style.setProperty("--ty", `${(ny * max).toFixed(2)}px`);
    style.setProperty("--lx", `${(nx * label).toFixed(2)}px`);
    style.setProperty("--ly", `${(ny * label).toFixed(2)}px`);
  }
}

function schedule() {
  if (active && !frame) frame = requestAnimationFrame(paint);
}

function onMove(event: PointerEvent) {
  if (!active || event.pointerType === "touch") return;
  x = event.clientX;
  y = event.clientY;
  schedule();
}

function onOver(event: PointerEvent) {
  if (event.pointerType === "touch") return;
  const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-fx]") : null;
  if (target === active) return;
  leave();
  if (!target) return;
  const fx = (target.dataset.fx ?? "").split(/\s+/);
  spot = fx.includes("spot");
  magnet = fx.includes("magnet");
  if (!spot && !magnet) return;
  active = target;
  rect = target.getBoundingClientRect();
  if (magnet) {
    max = lengthProp(target, "--magnet-max", 3);
    label = lengthProp(target, "--magnet-label", 1.5);
  }
  onMove(event);
}

function onOut(event: PointerEvent) {
  if (active && !(event.relatedTarget instanceof Node && active.contains(event.relatedTarget))) leave();
}

function enable() {
  if (enabled) return;
  enabled = new AbortController();
  const options = { passive: true, signal: enabled.signal };
  document.addEventListener("pointerover", onOver, options);
  document.addEventListener("pointerout", onOut, options);
  document.addEventListener("pointermove", onMove, options);
  onScrollFrame(schedule, enabled.signal, () => {
    if (active?.isConnected) rect = active.getBoundingClientRect();
  });
}

function disable() {
  enabled?.abort();
  enabled = null;
  cancelAnimationFrame(frame);
  frame = 0;
  leave();
}

if (typeof window !== "undefined") {
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const sync = () => (fine.matches && !reduce.matches ? enable() : disable());
  fine.addEventListener("change", sync);
  reduce.addEventListener("change", sync);
  sync();
}
