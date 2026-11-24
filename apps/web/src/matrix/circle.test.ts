import { describe, expect, it } from 'vitest';
import { ProfileSchema } from '@eulogy/shared';
import { exampleThreads } from '../../../../packages/shared/src/conversations';
import { InputProfile } from '../../api/contracts';
import { assignAgents, demoRecipe, RecipeSchema, sampleTemplates } from './analysis';
import { initialProfile, MatrixProfile, upgradeProfile } from './profile';
import { simulate } from './simulation';

describe('an editable inner circle', () => {
  it('retains an empty saved draft and keeps it out of active simulations', () => {
    const draft = MatrixProfile.parse({ ...initialProfile, relatives: [] });
    expect(upgradeProfile(draft).relatives).toEqual([]);
    expect(ProfileSchema.safeParse(draft).success).toBe(false);
    expect(RecipeSchema.safeParse({ ...demoRecipe, profile: draft, agents: [] }).success).toBe(
      false,
    );
    expect(InputProfile.safeParse(draft).success).toBe(false);
  });

  it('keeps each original person’s conversations when others are removed or reordered', () => {
    const previous = exampleThreads('snapchat');
    const profile = {
      ...initialProfile,
      relatives: [initialProfile.relatives[3]!, initialProfile.relatives[1]!],
    };
    const threads = exampleThreads('snapchat', sampleTemplates(profile));
    expect(threads.map((t) => t.messages)).toEqual([previous[3]!.messages, previous[1]!.messages]);
    expect(upgradeProfile(profile).relatives).toEqual(profile.relatives);
  });

  it.each([1, 6, 8])(
    'assigns a voice, six chapters of actions, and a farewell to every person in a circle of %i',
    (size) => {
      const relatives = Array.from(
        { length: size },
        (_, i) =>
          initialProfile.relatives[i] ?? {
            id: 'other-' + i,
            name: 'Friend ' + i,
            relation: 'friend' as const,
            age: 25,
            relationshipState: '',
            grievance: '',
          },
      );
      const profile = MatrixProfile.parse({ ...initialProfile, relatives });
      expect(InputProfile.safeParse(profile).success).toBe(true);
      const threads = exampleThreads('gmail', sampleTemplates(profile));
      const agents = assignAgents(profile, [{ source: 'gmail', threads }]);
      const recipe = RecipeSchema.parse({ ...demoRecipe, profile, agents });
      expect(RecipeSchema.safeParse({ ...recipe, agents: [...agents, agents[0]!] }).success).toBe(
        false,
      );
      expect(agents.every((a) => a.excerpts > 0 && a.quote)).toBe(true);
      const life = simulate(recipe)[0]!;
      const ids = [profile.id, ...relatives.map((p) => p.id)];
      expect(life.eulogies.map((e) => e.relative_id)).toEqual(ids.slice(1));
      for (const chapter of life.years) {
        expect(chapter.decisions.map((d) => d.actor)).toEqual(ids);
        for (const message of chapter.private_messages) {
          expect(ids).toContain(message.from);
          expect(ids).toContain(message.to);
          expect(message.from).not.toBe(message.to);
        }
      }
    },
  );
});
