import { useEffect, useRef, useState } from 'react';

/**
 * Avy, the anyview mascot. The real artwork lives in `/mascot.svg`; it is
 * fetched and inlined so its `#avy-eye-l` / `#avy-eye-r` groups can blink and
 * follow the cursor. Until it loads (or if it is missing) a placeholder blob
 * with the same eye ids stands in.
 */

const FALLBACK_SVG = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Avy">
  <defs>
    <linearGradient id="avyFbBody" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="#FF5A2E"/><stop offset="0.55" stop-color="#FF8A3D"/><stop offset="1" stop-color="#FFB547"/>
    </linearGradient>
    <radialGradient id="avyFbShine" cx="0.32" cy="0.22" r="0.7">
      <stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="M36 12h34c6 0 9 2 13 6l16 16c4 4 6 7 6 13v43c0 12-8 20-20 20H36c-12 0-20-8-20-20V32c0-12 8-20 20-20z" fill="url(#avyFbBody)"/>
  <path d="M36 12h34c6 0 9 2 13 6l16 16c4 4 6 7 6 13v43c0 12-8 20-20 20H36c-12 0-20-8-20-20V32c0-12 8-20 20-20z" fill="url(#avyFbShine)"/>
  <path d="M74 13v17c0 6 4 10 10 10h20" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="3" stroke-linecap="round"/>
  <g id="avy-eye-l"><rect x="47" y="52" width="10" height="24" rx="5" fill="#fff"/></g>
  <g id="avy-eye-r"><rect x="66" y="49" width="10" height="24" rx="5" fill="#fff"/></g>
</svg>`;

const LOOK_RATIO = 0.027; // eye travel as a share of the artwork's width

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Mascot({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [markup, setMarkup] = useState(FALLBACK_SVG);

  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}mascot.svg`)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((text) => {
        if (alive && text.includes('<svg') && text.includes('avy-eye')) setMarkup(text);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || prefersReducedMotion()) return;
    const eyes = ['#avy-eye-l', '#avy-eye-r']
      .map((s) => host.querySelector<SVGGElement>(s))
      .filter((el): el is SVGGElement => !!el);
    if (!eyes.length) return;
    const svg = host.querySelector('svg');
    const maxLook = (svg?.viewBox.baseVal?.width || 120) * LOOK_RATIO;

    let blinkTimer = 0;
    const blink = () => {
      host.dataset.blink = 'true';
      window.setTimeout(() => { delete host.dataset.blink; }, 150);
      const twice = Math.random() < 0.18;
      blinkTimer = window.setTimeout(blink, twice ? 280 : 2600 + Math.random() * 3800);
    };
    blinkTimer = window.setTimeout(blink, 1800);

    let raf = 0;
    let px = 0;
    let py = 0;
    const apply = () => {
      raf = 0;
      const r = host.getBoundingClientRect();
      const dx = px - (r.left + r.width / 2);
      const dy = py - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, dist / 420);
      const tx = (dx / dist) * maxLook * reach;
      const ty = (dy / dist) * maxLook * reach;
      for (const eye of eyes) eye.style.translate = `${tx.toFixed(2)}px ${ty.toFixed(2)}px`;
    };
    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => { for (const eye of eyes) eye.style.translate = ''; };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      window.clearTimeout(blinkTimer);
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [markup]);

  return (
    <div
      ref={hostRef}
      className={`pg-mascot${className ? ` ${className}` : ''}`}
      role="img"
      aria-label="Avy, the anyview mascot"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

/** Small logo for the round home button: the published logo, or Avy as a fallback. */
export function LogoMark() {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className="pg-logo-fallback" aria-hidden="true" dangerouslySetInnerHTML={{ __html: FALLBACK_SVG }} />;
  }
  return (
    <img
      className="pg-logo-img"
      src={`${import.meta.env.BASE_URL}mascot-mark.svg`}
      alt=""
      width={27}
      height={34}
      onError={() => setFailed(true)}
    />
  );
}
