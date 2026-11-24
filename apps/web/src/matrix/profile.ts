import { ProfileSchema, type Profile } from '@eulogy/shared';
import { z } from 'zod';
import jules from '../../../../data/profiles/jules.json';

const extra = {
  id: 'camille',
  name: 'Camille',
  relation: 'friend' as const,
  age: 21,
  relationshipState: 'The friend who gets everyone around the same table.',
  grievance: 'Sometimes I wish you would make the plans first.',
};
export const initialProfile = ProfileSchema.parse({
  ...jules,
  habits: { ...jules.habits, heightCm: 180, weightKg: 74, sugar: 4 },
  relatives: [...jules.relatives, extra],
});
const line = z.string().trim().min(1, 'This field is required.').max(800);
export const MatrixProfile = ProfileSchema.extend({
  name: line.max(80),
  age: z.number().int().min(16).max(70),
  city: line,
  currentActivity: line,
  ambition10y: line,
  fear: line,
  flaw: line,
  traits: z.array(line).length(3, 'Choose three traits.'),
  relatives: z
    .array(
      ProfileSchema.shape.relatives.element.extend({
        name: line.max(80),
        age: z.number().int().min(0).max(125),
        relationshipState: line,
        grievance: line,
      }),
    )
    .length(5),
}).refine(
  (p) => new Set(p.relatives.map((r) => r.id)).size === 5,
  'Each person needs their own ID.',
);

export function upgradeProfile(profile: Profile): Profile {
  const relatives = [...profile.relatives];
  for (const person of initialProfile.relatives) {
    if (relatives.length === 5) break;
    if (!relatives.some((r) => r.id === person.id)) relatives.push(person);
  }
  return { ...profile, habits: { ...initialProfile.habits, ...profile.habits }, relatives };
}
