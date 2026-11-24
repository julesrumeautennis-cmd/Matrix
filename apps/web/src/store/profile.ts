import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProfileSchema, type Profile } from '@eulogy/shared';
import { z } from 'zod';
import { SourceSchema, type Source } from '../../../../packages/shared/src/conversations';
import { initialProfile, MatrixProfile, upgradeProfile } from '../matrix/profile';

const sources = z.record(SourceSchema, z.string().max(180));
type Links = Partial<Record<Source, string>>;
interface ProfileState {
  profile: Profile;
  links: Links;
  setProfile: (profile: Profile) => void;
  setLink: (source: Source, value?: string) => void;
  reset: () => void;
}
export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: initialProfile,
      links: {},
      setProfile: (profile) => set({ profile: MatrixProfile.parse(profile) }),
      setLink: (source, value) =>
        set((state) => {
          const links = { ...state.links };
          if (value) links[source] = value;
          else delete links[source];
          return { links };
        }),
      reset: () => set({ profile: initialProfile, links: {} }),
    }),
    {
      name: 'matrix.profile',
      merge: (raw, current) => {
        const saved = z
          .object({ profile: ProfileSchema, links: sources.optional() })
          .safeParse(raw);
        if (!saved.success) return current;
        const profile = MatrixProfile.safeParse(upgradeProfile(saved.data.profile));
        return {
          ...current,
          profile: profile.success ? profile.data : initialProfile,
          links: saved.data.links ?? {},
        };
      },
    },
  ),
);
