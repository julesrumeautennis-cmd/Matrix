import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Center, Resize, useGLTF, useTexture } from '@react-three/drei';
import { Vector3 } from 'three';
import type { Profile } from '@eulogy/shared';
import type { ChapelGuest } from '../data/funeralCast';
import ChapelArchitecture from './ChapelArchitecture';
import { ChapelActor } from './ChapelActor';
import { chapelSeat, lectern, type ChapelSeat, type Beat, type Shot } from './chapelBlocking';

const cameraAngles = {
  wide: { eye: [0, 2.6, 9.35], aim: [0, 2.55, -3.9], fov: 48 },
  pulpit: { eye: [-0.78, 1.78, 0.3], aim: [1.23, 1.41, -2.64], fov: 33 },
  testimony: { eye: [0.61, 1.72, -1.22], aim: [1.27, 1.52, -2.84], fov: 30 },
  front_row: { eye: [0, 1.39, -2.0], aim: [0, 1.03, 1.4], fov: 55 },
} as const;

function Camera({
  shot,
  seat,
  lastSeat,
  reduced,
}: {
  shot: Shot;
  seat: ChapelSeat | undefined;
  lastSeat: ChapelSeat;
  reduced: boolean;
}) {
  const look = useRef(new Vector3(0, 2.55, -3.9));
  const framed = useRef(false);
  const { eye, target, fov, halfWidth } = useMemo(() => {
    const a = cameraAngles[shot];
    const target = new Vector3(...a.aim),
      eye = new Vector3(...a.eye);
    let halfWidth = 0.5;
    if (shot === 'front_row' && seat) {
      target.x = seat.position.x;
      target.z = seat.position.z + 0.16;
      eye.x = seat.position.x * (seat.row ? 0.9 : 0.72);
      eye.z = seat.row ? seat.position.z - 1.2 : -1.55;
      if (seat.row) eye.y = 1.68;
    }
    if (shot === 'wide' && lastSeat.row > 0) {
      // Frame the heads in the nearest pew and the priest while staying inside the rear wall.
      eye.z = Math.min(11.65, eye.z + lastSeat.row * 1.25);
      eye.y += lastSeat.row * 0.55;
      const rearDistance = eye.z - lastSeat.position.z;
      const rearAngle = Math.atan2(eye.y - 1.08, rearDistance);
      const altarAngle = Math.atan2(eye.y - 1.65, eye.z - lectern.z);
      const pitch = (rearAngle + altarAngle) / 2;
      target.y = eye.y - Math.tan(pitch) * (eye.z - target.z);
      const depth = rearDistance * Math.cos(pitch) + (eye.y - 1.08) * Math.sin(pitch);
      halfWidth = Math.max(halfWidth, 4.05 / depth);
    }
    return { eye, target, fov: a.fov, halfWidth };
  }, [shot, seat, lastSeat]);
  useFrame(({ camera }, dt) => {
    const factor = reduced || !framed.current ? 1 : 1 - Math.exp(-4.1 * Math.min(dt, 0.16));
    framed.current = true;
    camera.position.lerp(eye, factor);
    look.current.lerp(target, factor);
    camera.lookAt(look.current);
    if ('fov' in camera) {
      const frameFov =
        shot === 'wide'
          ? Math.max(fov, (2 * Math.atan(halfWidth / camera.aspect) * 180) / Math.PI)
          : fov;
      if (Math.abs(camera.fov - frameFov) <= 0.02) return;
      camera.fov += (frameFov - camera.fov) * factor;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
function Monument({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return (
    <group position={[-2.4, 1.0, -3.3]}>
      <Resize scale={0.85}>
        <Center>
          <primitive object={scene} />
        </Center>
      </Resize>
    </group>
  );
}
function Portrait({ url }: { url: string }) {
  const image = useTexture(url);
  return (
    <mesh position={[-2.4, 1.4, -3.22]}>
      <planeGeometry args={[0.65, 0.82]} />
      <meshBasicMaterial map={image} />
    </mesh>
  );
}
export default function ChapelScene({
  profile,
  guests,
  firstGuest,
  onReady,
  speaker,
  priestSpeaking,
  tearful,
  focus,
  shot,
  beat,
  reduced,
  level,
}: {
  profile: Profile;
  guests: ChapelGuest[];
  firstGuest: number;
  onReady: () => void;
  speaker: string | undefined;
  priestSpeaking: boolean;
  tearful: boolean;
  focus: string | undefined;
  shot: Shot;
  beat: Beat;
  reduced: boolean;
  level: () => number | null;
}) {
  useEffect(onReady, [onReady]);
  const focused = guests.findIndex((relative) => relative.id === focus);
  const seat = focused < 0 ? undefined : chapelSeat(firstGuest + focused);
  const lastSeat = chapelSeat(firstGuest + Math.max(0, guests.length - 1));
  return (
    <>
      <ChapelArchitecture />
      <ChapelActor
        profileId={profile.id}
        index={0}
        active={priestSpeaking}
        yieldLectern={speaker !== undefined}
        beat={beat}
        reduced={reduced}
        level={level}
      />
      {guests.map((relative, index) => (
        <ChapelActor
          key={relative.id}
          profileId={profile.id}
          relative={relative}
          index={firstGuest + index}
          active={speaker === relative.id}
          tearful={tearful && speaker === relative.id}
          beat={beat}
          reduced={reduced}
          level={level}
        />
      ))}
      {(profile.bustUrl || profile.portraits?.[2]) && (
        <>
          <mesh position={[-2.4, 0.5, -3.3]}>
            <boxGeometry args={[0.68, 1, 0.6]} />
            <meshStandardMaterial color="#70675c" />
          </mesh>
          {profile.bustUrl ? (
            <Monument url={profile.bustUrl} />
          ) : (
            <Portrait url={profile.portraits![2]!} />
          )}
        </>
      )}
      <Camera shot={shot} seat={seat} lastSeat={lastSeat} reduced={reduced} />
    </>
  );
}
