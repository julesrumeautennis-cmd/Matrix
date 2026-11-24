import { z } from 'zod';

const score0to10 = z.number().min(0).max(10);

export const RelationSchema = z.enum([
  'partner',
  'child',
  'parent',
  'sibling',
  'friend',
  'cofounder',
  'other',
]);

export const RelativeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  relation: RelationSchema,
  age: z.number().int().min(0),
  relationshipState: z.string(),
  grievance: z.string(),
});

export const ProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  age: z.number().int().min(0),
  city: z.string(),
  currentActivity: z.string(),
  ambition10y: z.string(),
  traits: z.array(z.string()).length(3),
  flaw: z.string(),
  fear: z.string(),
  habits: z.object({
    sport: score0to10,
    alcohol: score0to10,
    sleep: score0to10,
    heightCm: z.number().min(80).max(250).optional(),
    weightKg: z.number().min(25).max(350).optional(),
    sugar: z.number().min(0).max(30).optional(),
  }),
  relatives: z.array(RelativeSchema).min(1).max(5),
  bustUrl: z.string().url().optional(),
  photoUrl: z.string().optional(),
  portraits: z.array(z.string()).max(3).optional(),
});

export const EmotionSchema = z.object({
  valence: z.number().min(-1).max(1),
  arousal: z.number().min(0).max(1),
});

export const DecisionSchema = z.object({
  actor: z.string(),
  action: z.string(),
  reason: z.string(),
});

export const RelativeStateSchema = z.object({
  relative_id: z.string().min(1),
  emotion: EmotionSchema,
  relationship_score: z.number().min(0).max(100),
  memory_update: z.string(),
});

export const PrivateMessageSchema = z.object({
  from: z.string(),
  to: z.string(),
  text: z.string(),
});

export const ShockSourceSchema = z.enum(['telem', 'destiny']);

export const YearEventSchema = z.object({
  run_id: z.string().min(1),
  year_index: z.number().int().min(0),
  protagonist_age: z.number().int().min(0),
  shock: z.string(),
  shock_source: ShockSourceSchema.optional(),
  shock_key: z.string().optional(),
  source_url: z.string().url().optional(),
  generation: z.enum(['claude', 'fallback', 'mock', 'scripted']).optional(),
  decisions: z.array(DecisionSchema),
  relative_states: z.array(RelativeStateSchema),
  private_messages: z.array(PrivateMessageSchema),
});

export const EulogySchema = z.object({
  run_id: z.string().min(1),
  relative_id: z.string().min(1),
  speaks: z.boolean(),
  text: z.string(),
  sentiment: z.number().min(-1).max(1),
});

export const LifeOutcomeSchema = z.object({
  marriage_age: z.number().int().nullable(),
  divorce_age: z.number().int().nullable(),
  affair: z.enum(['protagonist', 'spouse', 'none']).optional(),
  children: z.array(
    z.object({
      kind: z.enum(['daughter', 'son']),
      birth_age: z.number().int(),
      bond: z.enum(['close', 'distant']),
    }),
  ),
  wellbeing: z.enum(['fulfilled', 'content', 'restless']),
  health_event: z.string(),
  health_age: z.number().int(),
  turning_point: z.string(),
});
export type LifeOutcome = z.infer<typeof LifeOutcomeSchema>;

export const RunSchema = z
  .object({
    run_id: z.string().min(1),
    profile_id: z.string().min(1),
    seed: z.number().int(),
    death_age: z.number().int().min(0),
    cause_of_death: z.string(),
    years: z.array(YearEventSchema),
    eulogies: z.array(EulogySchema),
    ending_cluster: z.string().optional(),
    life_outcome: LifeOutcomeSchema.optional(),
  })
  .superRefine((run, ctx) => {
    // Untagged screenings predate chapter provenance and can still be opened from storage.
    if (!run.years.some((year) => year.generation !== undefined)) return;
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    if (run.years.length !== 6) issue(['years'], 'A generated life has six chapters.');
    run.years.forEach((year, index) => {
      if (year.generation === undefined || year.run_id !== run.run_id || year.year_index !== index)
        issue(
          ['years', index],
          'The chapter must have provenance, its own run ID and its sequence index.',
        );
      if (index > 0 && year.protagonist_age <= run.years[index - 1]!.protagonist_age)
        issue(['years', index, 'protagonist_age'], 'Chapter ages must increase.');
    });
    const last = run.years.at(-1);
    if (!last) return;
    if (last.protagonist_age !== run.death_age)
      issue(['death_age'], 'The final chapter sets the death age.');
    const scores = new Map(
      last.relative_states.map((state) => [state.relative_id, state.relationship_score]),
    );
    const funeralIds = new Set(run.eulogies.map((e) => e.relative_id));
    if (
      !scores.size ||
      scores.size !== last.relative_states.length ||
      funeralIds.size !== run.eulogies.length ||
      funeralIds.size !== scores.size
    )
      issue(['eulogies'], 'Each relative needs one final state and one farewell.');
    run.eulogies.forEach((e, index) => {
      const score = scores.get(e.relative_id);
      if (
        e.run_id !== run.run_id ||
        score === undefined ||
        e.speaks !== score >= 55 ||
        !e.text.trim()
      )
        issue(
          ['eulogies', index],
          'Each farewell needs text, a matching final score, and speech eligibility at 55.',
        );
    });
  });

export const RunSummarySchema = z.object({
  n_runs: z.number().int().min(0),
  pct_daughter_speaks: z.number().min(0).max(100),
  pct_child_speaks: z.number().min(0).max(100).nullable().optional(),
  pct_partner_speaks: z.number().min(0).max(100).nullable().optional(),
  most_probable_run_id: z.string().optional(),
  best_run_id: z.string().optional(),
  generation: z.record(z.string(), z.number().int().nonnegative()).optional(),
  clusters: z.record(z.string(), z.number().int().min(0)),
});

export type Relation = z.infer<typeof RelationSchema>;
export type Relative = z.infer<typeof RelativeSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Emotion = z.infer<typeof EmotionSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
export type RelativeState = z.infer<typeof RelativeStateSchema>;
export type PrivateMessage = z.infer<typeof PrivateMessageSchema>;
export type ShockSource = z.infer<typeof ShockSourceSchema>;
export type YearEvent = z.infer<typeof YearEventSchema>;
export type Eulogy = z.infer<typeof EulogySchema>;
export type Run = z.infer<typeof RunSchema>;
export type RunSummary = z.infer<typeof RunSummarySchema>;
