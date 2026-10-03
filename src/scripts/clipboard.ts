import { pageSignal } from "./lifecycle";

export async function copyToClipboard(value: string, signal = pageSignal()): Promise<boolean> {
  if (signal.aborted) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
  }

  if (signal.aborted) return false;
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "true");
  area.style.position = "fixed";
  area.style.opacity = "0";
  try {
    document.body.append(area);
    area.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
