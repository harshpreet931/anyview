import { useLayoutEffect, useRef, useState } from 'react';
import type { SampleFile } from '../samples';

interface Props {
  samples: SampleFile[];
  active: number | null;
  onPick: (index: number) => void;
}

/** Hark-style segmented pill: frosted track, one black pill that glides to the active format. */
export function SamplePicker({ samples, active, onPick }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const btn = active === null ? null : track.querySelectorAll<HTMLButtonElement>('.pg-sample-chip')[active];
      setThumb(btn ? { x: btn.offsetLeft, w: btn.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [active]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      track.dataset.fadeStart = String(max > 1 && track.scrollLeft > 1);
      track.dataset.fadeEnd = String(max > 1 && track.scrollLeft < max - 1);
    };
    update();
    track.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(track);
    return () => {
      track.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);

  // Keep the chosen format in view when the track scrolls (narrow screens).
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || !thumb || track.scrollWidth <= track.clientWidth) return;
    const left = thumb.x - (track.clientWidth - thumb.w) / 2;
    track.scrollTo({ left, behavior: 'smooth' });
  }, [thumb]);

  return (
    <div className="pg-segment">
      <div ref={trackRef} className="pg-segment-track" role="group" aria-label="Sample documents">
        <span
          className="pg-segment-thumb"
          aria-hidden="true"
          data-visible={!!thumb}
          style={thumb ? { transform: `translateX(${thumb.x}px)`, width: thumb.w } : undefined}
        />
        {samples.map((sample, i) => (
          <button
            key={sample.fileName}
            type="button"
            className="pg-sample-chip"
            data-active={active === i}
            aria-pressed={active === i}
            onClick={() => onPick(i)}
          >
            {sample.label}
          </button>
        ))}
      </div>
    </div>
  );
}
