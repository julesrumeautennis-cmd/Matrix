import { Fragment, useMemo, useRef } from 'react';
import { createPortal, useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  Object3D,
  Vector3,
} from 'three';

// Work in the avatar's bind pose so the collar and fabric follow its baked gestures.
export function costumeAnchor(body: Object3D, joint: string, origin = new Vector3()) {
  const bone = body.getObjectByName(joint);
  if (!bone) return null;
  const anchor = new Group();
  anchor.position.copy(origin);
  bone.attach(anchor);
  return anchor;
}

function stolePanel(side: number) {
  const rows = [
    // Height, distance from the centre of the chest, depth and half-width in metres.
    [1.546, 0.074, 0.018, 0.019],
    [1.505, 0.082, 0.086, 0.023],
    [1.441, 0.092, 0.12, 0.025],
    [1.335, 0.098, 0.14, 0.027],
    [1.206, 0.1, 0.151, 0.029],
    [1.067, 0.103, 0.154, 0.03],
    [0.996, 0.102, 0.15, 0.03],
  ] as const;
  const positions = rows.flatMap(([y, x, z, width]) => [
    side * x - width,
    y,
    z,
    side * x + width,
    y,
    z,
  ]);
  const indices = rows.slice(1).flatMap((_, i) => {
    const a = i * 2;
    return [a, a + 2, a + 1, a + 1, a + 2, a + 3];
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function Vestments({ anchor, clothing }: { anchor: Group; clothing: Mesh[] }) {
  const panels = useMemo(() => [-1, 1].map(stolePanel), []);
  return (
    <>
      {clothing.map((mesh) => (
        <Fragment key={mesh.uuid}>
          {createPortal(<meshStandardMaterial color="#24232a" roughness={0.9} />, mesh)}
        </Fragment>
      ))}
      {createPortal(
        <>
          <mesh position={[0, 1.556, 0.006]} scale={[1, 1, 0.86]}>
            <cylinderGeometry args={[0.068, 0.084, 0.039, 24]} />
            <meshStandardMaterial color="#24232a" roughness={0.92} />
          </mesh>
          <mesh position={[0, 1.555, 0.073]}>
            <boxGeometry args={[0.034, 0.029, 0.008]} />
            <meshStandardMaterial color="#f4ecdc" roughness={0.82} />
          </mesh>
          {panels.map((geometry, i) => (
            <group key={i}>
              <mesh geometry={geometry}>
                <meshStandardMaterial color="#635069" roughness={0.94} side={DoubleSide} />
              </mesh>
              <group position={[(i === 0 ? -1 : 1) * 0.099, 1.315, 0.146]}>
                <mesh>
                  <boxGeometry args={[0.005, 0.047, 0.003]} />
                  <meshStandardMaterial color="#d8bb79" />
                </mesh>
                <mesh position={[0, 0.007, 0]}>
                  <boxGeometry args={[0.025, 0.005, 0.003]} />
                  <meshStandardMaterial color="#d8bb79" />
                </mesh>
              </group>
            </group>
          ))}
        </>,
        anchor,
      )}
    </>
  );
}

export function Tears({ anchor, reduced }: { anchor: Group; reduced: boolean }) {
  const drops = useRef<Group>(null);
  useFrame(({ clock }) => {
    drops.current?.children.forEach((drop, index) => {
      const t = reduced ? 0.45 : (clock.elapsedTime * 0.34 + index * 0.46) % 1;
      drop.position.y = -0.009 - t * 0.048;
      drop.scale.set(0.0025, 0.003 + Math.sin(t * Math.PI) * 0.008, 0.0023);
    });
  });
  return createPortal(
    <group ref={drops}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.041, -0.015, 0.03]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#d5e2e5" roughness={0.1} transparent opacity={0.78} />
        </mesh>
      ))}
    </group>,
    anchor,
  );
}
