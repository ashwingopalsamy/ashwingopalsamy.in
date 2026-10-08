// Injected by loaf.mjs: records long-animation-frame entries in window.__l and slow events in window.__e.
window.__l = []; window.__e = [];
new PerformanceObserver(function (l) {
  for (const e of l.getEntries()) {
    window.__l.push({ t: Math.round(e.startTime), d: Math.round(e.duration), block: Math.round(e.blockingDuration),
      scripts: e.scripts.map(function (s) { return (s.sourceURL || '').split('/').pop().slice(0, 45) + ':' + (s.sourceFunctionName || (s.invoker || '').slice(0, 40)) + ':' + Math.round(s.duration) + 'ms fsl=' + Math.round(s.forcedStyleAndLayoutDuration); }).slice(0, 4) });
  }
}).observe({ type: 'long-animation-frame', buffered: true });
new PerformanceObserver(function (l) {
  for (const e of l.getEntries()) {
    var t = e.target; var cls = t ? String((t.className && t.className.baseVal !== undefined) ? t.className.baseVal : (t.className || '')).slice(0, 30) : '';
    window.__e.push({ name: e.name, d: Math.round(e.duration), inDelay: Math.round(e.processingStart - e.startTime), proc: Math.round(e.processingEnd - e.processingStart), pres: Math.round(e.startTime + e.duration - e.processingEnd), tgt: t ? t.tagName + '.' + cls : '' });
  }
}).observe({ type: 'event', durationThreshold: 16, buffered: true });
