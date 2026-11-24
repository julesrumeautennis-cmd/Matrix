import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { AnimationMixer, Group, MathUtils, Mesh, Vector3 } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { chapelModel, type ChapelGuest } from '../data/funeralCast';
import { costumeAnchor, Tears, Vestments } from './ChapelCostume';
import {
  chapelSeat,
  lectern,
  presiderAside,
  riseSeconds,
  sitSeconds,
  turnSeconds,
  type Beat,
} from './chapelBlocking';

const clipNames = ['seated', 'stand', 'walk', 'idle', 'speak', 'sit'] as const;
type Motion = (typeof clipNames)[number];
type Face = {
  weights: number[];
  jaw?: number;
  left?: number;
  right?: number;
  brow?: number;
  frown?: number[];
};
const smooth = (t: number) => MathUtils.smoothstep(t, 0, 1);
const nearestAngle = (a: number, b: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a));
type Props = {
  profileId: string;
  relative?: ChapelGuest;
  index: number;
  active: boolean;
  yieldLectern?: boolean;
  tearful?: boolean;
  beat: Beat;
  reduced: boolean;
  level: () => number | null;
};

export function ChapelActor({
  profileId,
  relative,
  index,
  active,
  yieldLectern,
  tearful,
  beat,
  reduced,
  level,
}: Props) {
  const presider = !relative;
  const model = chapelModel(profileId, relative, index);
  const asset = model === 'mourner' || model === 'visitor' ? model : 'cast/' + model;
  const { scene } = useGLTF('/avatars/' + asset + '.glb');
  const { animations } = useGLTF('/avatars/motion/' + model + '.glb');
  const rig = useMemo(() => {
    const body = clone(scene);
    const faces: Face[] = [];
    const clothing: Mesh[] = [];
    body.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      o.frustumCulled = false;
      if (presider && o.name.startsWith('Wolf3D_Outfit_')) clothing.push(o);
      const dictionary = o.morphTargetDictionary;
      if (dictionary && o.morphTargetInfluences)
        faces.push({
          weights: o.morphTargetInfluences,
          jaw: dictionary.mouthOpen ?? dictionary.jawOpen ?? dictionary.viseme_aa,
          left: dictionary.eyeBlinkLeft ?? dictionary.eyesClosed,
          right: dictionary.eyeBlinkRight,
          brow: dictionary.browInnerUp,
          frown: [dictionary.mouthFrownLeft, dictionary.mouthFrownRight].filter(
            (n): n is number => n !== undefined,
          ),
        });
    });
    const mixer = new AnimationMixer(body);
    const actions = new Map(
      animations.map((clip) => {
        const action = mixer.clipAction(clip);
        action.play();
        action.paused = true;
        action.setEffectiveWeight(0);
        return [clip.name, action] as const;
      }),
    );
    body.updateMatrixWorld(true);
    const vestment = presider ? costumeAnchor(body, 'Spine2') : null;
    const left = body.getObjectByName('LeftEye'),
      right = body.getObjectByName('RightEye');
    const eyes =
      model === 'mourner' && left && right
        ? costumeAnchor(
            body,
            'Head',
            left.getWorldPosition(new Vector3()).lerp(right.getWorldPosition(new Vector3()), 0.5),
          )
        : null;
    return {
      body,
      faces,
      mixer,
      actions,
      clothing,
      vestment,
      eyes,
      head: body.getObjectByName('Head'),
    };
  }, [scene, animations, presider, model]);
  useEffect(() => {
    for (const action of rig.actions.values()) {
      action.reset().play();
      action.paused = true;
    }
    return () => {
      rig.mixer.stopAllAction();
    };
  }, [rig]);
  const root = useRef<Group>(null);
  const elapsed = useRef(0),
    previous = useRef(''),
    jaw = useRef(0);
  const aside = useRef(0),
    bow = useRef(0);
  const point = useMemo(() => new Vector3(), []),
    tangent = useMemo(() => new Vector3(), []);
  const seat = chapelSeat(index);
  useFrame(({ clock }, dt) => {
    const actor = root.current;
    if (!actor) return;
    const state = active ? beat : 'seated';
    if (state !== previous.current) {
      elapsed.current = 0;
      previous.current = state;
    } else elapsed.current += dt;
    const t = elapsed.current,
      time = clock.elapsedTime,
      idleTime = time + index * 0.41;
    function set(name: Motion, seconds: number, weight: number, loop = true) {
      const action = rig.actions.get(name);
      if (!action) return;
      const duration = action.getClip().duration;
      action.time = loop ? seconds % duration : MathUtils.clamp(seconds, 0, duration);
      action.setEffectiveWeight(weight);
    }
    for (const name of clipNames) rig.actions.get(name)?.setEffectiveWeight(0);
    function standing(weight: number, talking = false) {
      const gesture = talking ? 0.5 : 0;
      set('idle', idleTime, weight * (1 - gesture));
      set('speak', idleTime * 0.91, weight * gesture);
    }
    let yaw = Math.PI;
    point.copy(seat.position);
    if (presider) {
      const target = yieldLectern ? 1 : 0;
      const old = aside.current;
      aside.current = reduced ? target : MathUtils.damp(old, target, 4, dt);
      point.lerpVectors(lectern, presiderAside, aside.current);
      yaw = -0.75 * aside.current;
      const stride = reduced ? 0 : Math.min(0.64, Math.abs(target - old) * 2);
      set('walk', time * 0.95, stride);
      standing(1 - stride, active && beat === 'speak');
    } else if (state === 'speak' || (reduced && state === 'approach')) {
      point.copy(lectern);
      yaw = 0;
      standing(1, state === 'speak');
    } else if (state === 'approach' && t < riseSeconds) {
      const mix = smooth(t / 0.16);
      set('seated', idleTime, 1 - mix);
      set('stand', t, mix, false);
    } else if (
      state === 'approach' ||
      (state === 'return' && !reduced && t < turnSeconds + seat.travel)
    ) {
      const forward = state === 'approach';
      const walkTime = MathUtils.clamp(t - (forward ? riseSeconds : turnSeconds), 0, seat.travel);
      const u = walkTime / seat.travel;
      const distance = forward ? u : 1 - u;
      seat.path.getPointAt(distance, point);
      seat.path.getTangentAt(distance, tangent);
      if (!forward) tangent.negate();
      const angle = Math.atan2(tangent.x, tangent.z);
      yaw = angle;
      const blend = Math.min(smooth(walkTime / 0.22), smooth((seat.travel - walkTime) / 0.25));
      set('walk', walkTime * 1.22 + index * 0.11, blend);
      standing(1 - blend);
      if (forward && u === 1)
        yaw =
          angle +
          (nearestAngle(angle, 0) - angle) * smooth((t - riseSeconds - seat.travel) / turnSeconds);
      if (!forward && t < turnSeconds) yaw = nearestAngle(0, angle) * smooth(t / turnSeconds);
    } else if (!reduced && state === 'return') {
      const sitTime = t - turnSeconds - seat.travel,
        mix = smooth((sitTime - sitSeconds + 0.22) / 0.22);
      set('sit', sitTime, 1 - mix, false);
      set('seated', idleTime, mix);
    } else {
      set('seated', idleTime, 1);
    }
    if (rig.head && bow.current) rig.head.rotateX(-bow.current);
    rig.mixer.update(0);
    const grief = tearful && state === 'speak' ? smooth(t / 0.65) : 0;
    bow.current =
      grief * (reduced ? 0.12 : 0.16 + Math.sin(t * 2.5) * 0.045 + Math.sin(t * 11) * 0.013);
    if (rig.head && bow.current) rig.head.rotateX(bow.current);
    actor.position.copy(point);
    const turn = reduced ? 1 : 1 - Math.exp(-11 * Math.min(dt, 0.12));
    actor.rotation.y = MathUtils.lerp(actor.rotation.y, nearestAngle(actor.rotation.y, yaw), turn);
    const speaking = state === 'speak';
    const measured = speaking ? level() : 0;
    const target = measured ?? 0.19 + 0.16 * Math.sin(time * 15.4) * Math.sin(time * 8.1);
    jaw.current = MathUtils.damp(jaw.current, target, 20, Math.min(dt, 0.1));
    const blinkTime = (time + index * 0.81) % (3.8 + index * 0.13);
    const blink = blinkTime < 0.16 ? Math.sin((Math.PI * blinkTime) / 0.16) : 0;
    for (const face of rig.faces) {
      if (face.jaw !== undefined) face.weights[face.jaw] = jaw.current;
      const lids = Math.max(blink, grief * 0.32);
      if (face.left !== undefined) face.weights[face.left] = lids;
      if (face.right !== undefined) face.weights[face.right] = lids;
      if (face.brow !== undefined) face.weights[face.brow] = grief * 0.76;
      for (const frown of face.frown ?? []) face.weights[frown] = grief * 0.48;
    }
  });
  return (
    <group
      ref={root}
      name={relative ? 'Guest ' + relative.id : 'Priest'}
      position={presider ? lectern : seat.position}
      rotation={[0, presider ? 0 : Math.PI, 0]}
    >
      <primitive object={rig.body} dispose={null} />
      {rig.vestment && <Vestments anchor={rig.vestment} clothing={rig.clothing} />}
      {rig.eyes && tearful && active && beat === 'speak' && (
        <Tears anchor={rig.eyes} reduced={reduced} />
      )}
    </group>
  );
}
