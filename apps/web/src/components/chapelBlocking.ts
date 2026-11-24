import { CatmullRomCurve3, Vector3 } from 'three';

export type Shot = 'wide' | 'pulpit' | 'front_row' | 'testimony';
export type Beat = 'approach' | 'speak' | 'return' | 'silence' | 'pause';
export const lectern = new Vector3(1.27, 0, -2.84);
export const presiderAside = new Vector3(2.32, 0, -3.18);
export const riseSeconds = 1;
export const sitSeconds = 1.29;
export const turnSeconds = 0.52;
export const pace = 1.6;

const frontRow = [-2.65, -1.45, 1.45, 2.65, -3.52, 3.52];
const rowSpacing = 1.83;
const pewRows = 5;
export const seatsPerView = frontRow.length * pewRows;

const seats = Array.from({ length: seatsPerView }, (_, index) => {
  const row = Math.floor(index / frontRow.length);
  const x = frontRow[index % frontRow.length]!;
  const z = 1.24 + row * rowSpacing;
  const position = new Vector3(x, 0, z);
  // Leave a rear pew through its own row gap before walking down the central aisle.
  const intoAisle =
    row === 0
      ? [new Vector3(x * 0.52, 0, 0.19)]
      : [
          new Vector3(x * 0.52, 0, z - 0.75),
          new Vector3(Math.sign(x) * 0.16, 0, z - 0.75),
          new Vector3(0.1, 0, z - 1.25),
        ];
  const path = new CatmullRomCurve3([
    position.clone(),
    new Vector3(x, 0, z - 0.53),
    ...intoAisle,
    new Vector3(0.15, 0, -0.56),
    new Vector3(0.22, 0, -1.84),
    new Vector3(0.5, 0, -2.77),
    lectern.clone(),
  ]);
  return { row, position, path, travel: path.getLength() / pace };
});
export type ChapelSeat = (typeof seats)[number];

// The roster can span several views of the five rows in the nave.
export function chapelSeat(guestIndex: number): ChapelSeat {
  return seats[guestIndex % seatsPerView]!;
}

export function movementDuration(guestIndex: number, beat: 'approach' | 'return') {
  return (
    1000 *
    (chapelSeat(guestIndex).travel + turnSeconds + (beat === 'approach' ? riseSeconds : sitSeconds))
  );
}
