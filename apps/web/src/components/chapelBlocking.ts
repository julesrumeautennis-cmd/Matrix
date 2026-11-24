import { CatmullRomCurve3, Vector3 } from 'three';

export type Shot = 'wide' | 'pulpit' | 'front_row' | 'testimony';
export type Beat = 'approach' | 'speak' | 'return' | 'silence' | 'pause';
// The extra places are on the ends of the existing pews. The last one is for
// a spouse met later in life when all five named guests are already present.
export const seatPositions = [-2.65, -1.45, 1.45, 2.65, -3.52, 3.52];
export const lectern = new Vector3(1.27, 0, -2.84);
export const presiderAside = new Vector3(2.32, 0, -3.18);
export const riseSeconds = 1;
export const sitSeconds = 1.29;
export const turnSeconds = 0.52;
export const pace = 1.6;

// Clear the first pew, follow the aisle, then enter behind the lectern from its left.
export const aisleRoutes = seatPositions.map((x) => {
  const path = new CatmullRomCurve3([
    new Vector3(x, 0, 1.24),
    new Vector3(x, 0, 0.71),
    new Vector3(x * 0.52, 0, 0.19),
    new Vector3(0.15, 0, -0.56),
    new Vector3(0.22, 0, -1.84),
    new Vector3(0.5, 0, -2.77),
    lectern.clone(),
  ]);
  return { path, travel: path.getLength() / pace };
});
export function movementDuration(index: number, beat: 'approach' | 'return') {
  const travel = aisleRoutes[index]?.travel ?? 0;
  return 1000 * (travel + turnSeconds + (beat === 'approach' ? riseSeconds : sitSeconds));
}
