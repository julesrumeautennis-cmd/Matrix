import { z } from 'zod';

export const SourceSchema = z.enum(['whatsapp', 'instagram', 'imessage', 'snapchat', 'gmail']);
export type Source = z.infer<typeof SourceSchema>;
export const ThreadSchema = z.object({
  seat: z.number().int().min(0).max(4),
  messages: z.array(z.string().min(1)).min(1),
});
export const ThreadsSchema = z.array(ThreadSchema).length(5);
export type SampleThread = z.infer<typeof ThreadSchema>;

// Each row is a fictional contact. The columns are the five source adapters.
const library = [
  [
    ['Did you eat? I saved you a plate.', 'Call when you get home. I worry.'],
    ['Look at this old photo of us.', 'I saved the one with all of us in it.'],
    ['Are you home safe?', 'Take your time. I can wait up.'],
    ['Sunday dinner, your place is still here.'],
    ['I changed my train so I could stay an extra day.'],
  ],
  [
    ['I saved you a seat again.', 'Promise you will actually come this time?'],
    ['Made you a playlist for the ride.', 'Your name is still on the guest list.'],
    ['I miss you. I wish you would say it first.'],
    ['New song. You get the first listen.', 'Save this one for when you miss home.'],
    ['Here is the recording. I kept looking for you in the front row.'],
  ],
  [
    ['One more set? You always say that before we win.', 'Meet me at the court.'],
    ['That last point was unreal.', 'Rematch on Saturday?'],
    ['I dare you to send the pitch.', 'I will read it before practice.'],
    ['Race you to the courts.', 'Loser brings coffee.'],
    ['I pushed the first build. Your move.', 'Let’s take the risk together.'],
  ],
  [
    ['The bike is fixed if you still want it.'],
    ['Found our old map in the garage.', 'I kept it for you.'],
    ['No rush. Just let me know when you have a Sunday free.'],
    ['Still got your old racket.'],
    [
      'I have been trying to write this for a while.',
      'There are things I find easier to fix than to say.',
    ],
  ],
  [
    ['Dinner for six on Friday. I am booking it.', 'Tell me what time works.'],
    ['Group photo from last night. Come next time!'],
    ['I made a plan. Just show up.', 'We can talk it through in person.'],
    ['Everyone is here. Get over here!'],
    ['Calendar invite sent. We are keeping this Sunday free.'],
  ],
];

export function exampleThreads(source: Source): SampleThread[] {
  const column = SourceSchema.options.indexOf(source);
  return library.map((row, seat) => ({ seat, messages: [...row[column]!] }));
}
