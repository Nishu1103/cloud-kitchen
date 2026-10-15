import type { Coordinates } from '@/lib/geo';

interface Pin {
  coordinates?: Coordinates;
  kind: 'rider' | 'pickup' | 'drop';
}

/**
 * Dark schematic of the current run.
 *
 * Not a live map SDK: campus jobs are a few hundred metres, and embedding a third-party
 * map would track the rider for a pin they already have in their own maps app. When
 * coordinates exist they are projected honestly; when they do not, the same layout
 * still shows pickup → drop so the screen does not go blank.
 */
export function RouteMap({
  rider,
  pickup,
  drop,
  caption,
}: {
  rider?: Coordinates;
  pickup?: Coordinates;
  drop?: Coordinates;
  caption: string;
}) {
  const pins: Pin[] = [
    { coordinates: rider, kind: 'rider' },
    { coordinates: pickup, kind: 'pickup' },
    { coordinates: drop, kind: 'drop' },
  ];
  const placed = pins.filter((pin) => pin.coordinates);

  const xs = placed.map((pin) => pin.coordinates![0]);
  const ys = placed.map((pin) => pin.coordinates![1]);
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 1;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 1;
  const padX = Math.max((maxX - minX) * 0.28, 0.002);
  const padY = Math.max((maxY - minY) * 0.28, 0.002);

  const project = (point: Coordinates): { x: number; y: number } => {
    const x = ((point[0] - (minX - padX)) / (maxX - minX + padX * 2)) * 100;
    const y = (1 - (point[1] - (minY - padY)) / (maxY - minY + padY * 2)) * 100;
    return { x: Number.isFinite(x) ? x : 50, y: Number.isFinite(y) ? y : 50 };
  };

  const pickupPt = pickup ? project(pickup) : { x: 28, y: 38 };
  const dropPt = drop ? project(drop) : { x: 74, y: 68 };
  const riderPt = rider ? project(rider) : undefined;

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] bg-[#0B0B12]">
      <svg viewBox="0 0 100 72" className="h-56 w-full" role="img" aria-label={caption}>
        <defs>
          <pattern id="rider-grid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.4" />
          </pattern>
        </defs>
        <rect width="100" height="72" fill="url(#rider-grid)" />
        <path
          d={`M ${pickupPt.x} ${pickupPt.y} C ${pickupPt.x + 18} ${pickupPt.y - 8}, ${dropPt.x - 18} ${dropPt.y + 8}, ${dropPt.x} ${dropPt.y}`}
          fill="none"
          stroke="hsl(var(--info))"
          strokeWidth="1.2"
          strokeDasharray="2.4 2.2"
          strokeLinecap="round"
        />
        {riderPt ? (
          <circle cx={riderPt.x} cy={riderPt.y} r="2.4" className="fill-brand" />
        ) : null}
        <circle cx={pickupPt.x} cy={pickupPt.y} r="3.2" className="fill-info" />
        <circle cx={dropPt.x} cy={dropPt.y} r="3.2" className="fill-warning" />
      </svg>
    </div>
  );
}
