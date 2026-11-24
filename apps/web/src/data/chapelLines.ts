// Fixed passages can be recorded once and reused for every life that contains that event.
export const homily = {
  fulfilled:
    'Ask the people in the front row if this was a happy life. They’ll tell you yes. Then they’ll ask how much time you have.',
  content:
    'Listen to this room. Somebody just laughed at a memory and then apologized. Please, keep the laugh.',
  restless:
    'Some people spend a lifetime saying, “When things settle down.” Look at this room. Things finally settled down.',
  protagonistAffair:
    'There was a wedding. There was a promise. And the person we came to bury broke it with somebody else.',
  spouseAffair:
    'There were two people in that marriage. Then there were three. The one who broke the vow is still alive.',
  divorce:
    'The marriage ended before this life did. Funny how a signature can settle the house and leave the heart exactly where it was.',
  marriage:
    'There’s a word in the wedding vows that nobody hears properly until a day like today. It’s the word “until.”',
  daughterClose:
    'Their daughter stayed close. Everybody keeps asking what this life amounted to. Ask her. See how long it takes her to answer.',
  sonClose:
    'Through all of it, one son stayed close. When someone asks what this life amounted to, I’d start with him.',
  daughterDistant:
    'There was a daughter, too. The distance between them is part of her story to tell, if she ever chooses to.',
  sonDistant:
    'There was a son, too. They grew apart. Imagine all the things that never quite made it into a phone call.',
  archiveOpening:
    'People tell me to keep these things short. I’ll be brief. I won’t tidy up somebody’s whole life just to make it fit on this card.',
  archiveWitness:
    'You can read every date on this program and still miss the whole person. Someone who was there can tell it better.',
  silence:
    'I’m going to leave a little room here. Love can make a person stand up. It can also make it impossible to speak.',
  blessing:
    'Take a moment. Think of the person you nearly called on the way here. When you get outside, make the call.',
} as const;

export const missedCalls = [
  'once',
  'twice',
  'three times',
  'four times',
  'five times',
  'six times',
].map(
  (count) =>
    `I went back through these pages. The words “let the call go to voicemail” came up ${count}. Somebody was on the other end.`,
);

export const testimony = {
  protagonistAffair:
    'You cheated on me. I practiced saying that without crying. Look at me. I still can’t.',
  spouseAffair:
    'It was me. I cheated. I thought I could stand up here and just say I missed you. I do. Both things are true.',
  divorce:
    'We got divorced. I thought that meant I’d already done the losing part. Then I walked in here.',
  marriage:
    'We said “until death.” I had the words memorized. I never practiced what to say the day after.',
} as const;
