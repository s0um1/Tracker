import { toDateInputValue } from "@/lib/utils";

export type InspirationTone = "motivational" | "demotivational" | "ctc";

export interface InspirationMessage {
  text: string;
  tone: InspirationTone;
  author?: string;
}

const MOTIVATIONAL: InspirationMessage[] = [
  { text: "The interview is just a conversation. You've had harder ones with yourself.", tone: "motivational" },
  { text: "Every topic you revise today is a question you won't blank on tomorrow.", tone: "motivational" },
  { text: "Consistency beats intensity. Show up today — even 30 minutes counts.", tone: "motivational" },
  { text: "You're not behind. You're building. Brick by brick.", tone: "motivational" },
  { text: "The gap between where you are and where you want to be is called work. You're doing it.", tone: "motivational" },
  { text: "Mock interviews hurt. Rejections sting. Growth lives in both.", tone: "motivational" },
  { text: "Someone with your exact background got the offer. The only variable left is preparation.", tone: "motivational" },
  { text: "Discipline is choosing between what you want now and what you want most.", tone: "motivational", author: "Abraham Lincoln" },
  { text: "It always seems impossible until it's done.", tone: "motivational", author: "Nelson Mandela" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", tone: "motivational", author: "Robert Collier" },
  { text: "Your competition is studying right now. So are you. That's the difference.", tone: "motivational" },
  { text: "One strong mock interview is worth ten hours of passive reading.", tone: "motivational" },
  { text: "GrowthHub exists because solo prep is a trap. Your group is your edge.", tone: "motivational" },
  { text: "Every question you log is proof you're not winging it.", tone: "motivational" },
  { text: "Accountability isn't pressure — it's proof someone believes you can do this.", tone: "motivational" },
  { text: "Small wins compound. One solved question today beats ten bookmarked tomorrow.", tone: "motivational" },
  { text: "The best version of you isn't found — it's built, one study session at a time.", tone: "motivational" },
  { text: "Your future self is counting on the reps you put in today.", tone: "motivational" },
  { text: "Confidence in interviews comes from evidence, not affirmations. Keep collecting evidence.", tone: "motivational" },
  { text: "You don't need to feel ready. You need to be prepared. Preparation is in your control.", tone: "motivational" },
  { text: "When your group shows up, you show up. That's the whole point of GrowthHub.", tone: "motivational" },
  { text: "Hard topics become easy topics after enough honest attempts.", tone: "motivational" },
  { text: "Progress isn't linear, but it is inevitable if you keep showing up.", tone: "motivational" },
  { text: "Think of each solved question as a tiny dragon slain. Tonight, you're a hero.", tone: "motivational" },
  { text: "Even a stack overflow was once just one frame. Solve one question.", tone: "motivational" },
  { text: "Future you has a great job and low blood pressure. Go be nice to them.", tone: "motivational" },
  { text: "Fun fact: nobody has ever said 'I regret solving one more question.'", tone: "motivational" },
  { text: "Debug your habits the way you debug code: calmly, then with strong coffee.", tone: "motivational" },
  { text: "You can't Ctrl+Z a missed day, but you can git commit to a good one.", tone: "motivational" },
  { text: "Interviews are just rubber duck debugging, with a very serious duck.", tone: "motivational" },
  { text: "Small wins compile into big offers. Hit run.", tone: "motivational" },
  { text: "Your brain is a muscle. Question by question, it's getting those gains.", tone: "motivational" },
  { text: "The best time to start was yesterday. The second best time is right after you close this card.", tone: "motivational" },
];

const DEMOTIVATIONAL: InspirationMessage[] = [
  { text: "Scrolling LeetCode discussions isn't studying. You know this.", tone: "demotivational" },
  { text: "Your target company won't hire the version of you that 'will start tomorrow.'", tone: "demotivational" },
  { text: "Watching system design videos without taking notes is just entertainment.", tone: "demotivational" },
  { text: "That topic you've been avoiding? It's definitely coming up in the interview.", tone: "demotivational" },
  { text: "Zero study streak. Your future self is taking notes.", tone: "demotivational" },
  { text: "The interview is approaching. Math doesn't care about your feelings.", tone: "demotivational" },
  { text: "You don't need another roadmap. You need to finish the one you're on.", tone: "demotivational" },
  { text: "Collecting resources is procrastination with good PR.", tone: "demotivational" },
  { text: "The interviewer won't accept 'I was going to revise that' as an answer.", tone: "demotivational" },
  { text: "Your group is progressing. Are you keeping up or making excuses?", tone: "demotivational" },
  { text: "Comfort zone: population — you, right now, probably.", tone: "demotivational" },
  { text: "Adding questions to the bank without solving them is just hoarding.", tone: "demotivational" },
  { text: "Your accountability group can see the leaderboard. Act accordingly.", tone: "demotivational" },
  { text: "Another day, another unchecked task. The interview date didn't move.", tone: "demotivational" },
  { text: "Someone with half your talent is solving the question you skipped today. They'll get the offer.", tone: "demotivational" },
  { text: "Everyone in your group got better today. Check whether that includes you.", tone: "demotivational" },
  { text: "You said \"just five minutes\" an hour ago. The timer never started.", tone: "demotivational" },
  { text: "Your resume says hard-working. Your activity graph says otherwise.", tone: "demotivational" },
  { text: "The offer letter isn't coming for the person who \"was planning to start.\"", tone: "demotivational" },
  { text: "Nobody is impressed by how much you intend to study.", tone: "demotivational" },
  { text: "Your teammates' heatmaps are filling up. Yours is a graveyard of empty squares.", tone: "demotivational" },
  { text: "Being smart doesn't matter if you never show up. Right now, you're not showing up.", tone: "demotivational" },
  { text: "The rejection email will be polite. It'll still say they chose someone who prepared.", tone: "demotivational" },
  { text: "Every skipped day is a vote for staying exactly where you are. You keep winning that election.", tone: "demotivational" },
  { text: "You'll remember this week when the interviewer asks something you've seen and can't answer.", tone: "demotivational" },
  { text: "Your future salary is being decided by the days you're deciding to skip.", tone: "demotivational" },
  { text: "You don't have a motivation problem. You have a starting problem. Start.", tone: "demotivational" },
  { text: "Your competition isn't resting. They're not even thinking about you.", tone: "demotivational" },
  { text: "If you're reading this instead of solving a question, that's the whole story right there.", tone: "demotivational" },
  { text: "In six months you'll wish you'd begun today. Begin today.", tone: "demotivational" },
  { text: "You marked it 'practiced' but couldn't explain it out loud. Fix that.", tone: "demotivational" },
  { text: "Motivation is optional. Discipline is what gets you the offer.", tone: "demotivational" },
  { text: "Your group logged study hours. Your dashboard says otherwise.", tone: "demotivational" },
  { text: "You've opened this app more times than you've opened a question. Impressive commitment to the wrong thing.", tone: "demotivational" },
  { text: "Your to-do list isn't long. You're just not doing anything on it.", tone: "demotivational" },
  { text: "The only thing you've revised today is the excuse you'll give tomorrow.", tone: "demotivational" },
  { text: "Bookmarking 40 tutorials is not 40 tutorials of progress. It's 40 bookmarks.", tone: "demotivational" },
  { text: "You have 'learn DSA' on your list. DSA has you on its list too, as 'easy rejection'.", tone: "demotivational" },
  { text: "Your brain: 'I'll start after this one video.' It's been eleven videos.", tone: "demotivational" },
  { text: "Coding interviews are just LeetCode with consequences. You've skipped the LeetCode.", tone: "demotivational" },
  { text: "Your laptop fan works harder watching reels than you do on problems.", tone: "demotivational" },
  { text: "You're not procrastinating, you're 'strategically delaying'. The recruiter calls it unemployment.", tone: "demotivational" },
  { text: "Bold plan: wing the interview. Bolder plan: stop pretending that's a plan.", tone: "demotivational" },
  { text: "At this pace, you'll be job-ready right after the company stops hiring.", tone: "demotivational" },
  { text: "Day 1 of 'starting fresh' has been running for three weeks now.", tone: "demotivational" },
  { text: "Your future self sent a message. It says: 'Why didn't you just do one question?'", tone: "demotivational" },
  { text: "Your streak is so thin it needs a nap. Wake it up with a question.", tone: "demotivational" },
];

function ctcMessages(target: number): InspirationMessage[] {
  const monthly = Math.round((target * 100000) / 12 / 1000);
  const annual = target * 100000;
  return [
    { text: `${target} LPA doesn't chase people who scroll LinkedIn all day.`, tone: "ctc" },
    { text: `You're not grinding for your manager. You're grinding for ${target} LPA.`, tone: "ctc" },
    { text: `Every hour of focused prep is an investment toward ₹${monthly}K/mo.`, tone: "ctc" },
    { text: `The offer letter at ${target} LPA is written in the topics you revise today.`, tone: "ctc" },
    { text: `Rejections at 12 LPA hurt less when you're prepared for ${target}.`, tone: "ctc" },
    { text: `${target} LPA is not a lottery ticket. It's a skill stack you're building.`, tone: "ctc" },
    { text: `Your CTC jump to ${target} LPA starts with the next mock interview you ace.`, tone: "ctc" },
    { text: `They'll negotiate your ${target} LPA offer. First, earn the interview.`, tone: "ctc" },
    { text: `₹${annual.toLocaleString("en-IN")}/year is the number. Today's prep is the deposit.`, tone: "ctc" },
    { text: `At ${target} LPA, one month of salary covers a year of courses. Earn it first.`, tone: "ctc" },
    { text: `Your ${target} LPA target isn't ambitious — it's a line item in your future budget.`, tone: "ctc" },
    { text: `Every mastered question moves you closer to signing at ${target} LPA.`, tone: "ctc" },
    { text: `The gap between your current CTC and ${target} LPA closes with deliberate practice.`, tone: "ctc" },
    { text: `${target} LPA means negotiating from strength. Build that strength now.`, tone: "ctc" },
    { text: `Set your CTC target, then let every study session answer: "Am I worth ${target}?"`, tone: "ctc" },
    { text: `₹${monthly}K/mo post-tax won't come from hope. It comes from preparation.`, tone: "ctc" },
    { text: `${target} LPA won't appear because you stared at the number really hard.`, tone: "ctc" },
    { text: `Your future ${target} LPA self is begging you to solve one question. Be nice to them.`, tone: "ctc" },
    { text: `The gap between you and ${target} LPA is about 50 unsolved questions. Funny how that works.`, tone: "ctc" },
    { text: `${target} LPA doesn't come from vibes, though the vibes are lovely.`, tone: "ctc" },
    { text: `Nobody ever got a ${target} LPA offer by 'planning to start soon'.`, tone: "ctc" },
  ];
}

export interface InspirationContext {
  studyStreak: number;
  daysToInterview: number;
  targetCtcLpa?: number;
  seed?: number;
}

function hashSeed(ctx: InspirationContext): number {
  const now = new Date();
  const day = toDateInputValue(now);
  const base = `${day}:${ctx.studyStreak}:${ctx.seed ?? 0}`;
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0;
  return h;
}

function pickFrom<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

/** Context-aware quote: roast when slacking, hype when earning it, CTC when target is set. */
export function pickInspiration(ctx: InspirationContext): InspirationMessage {
  const seed = hashSeed(ctx);
  const pool: InspirationMessage[] = [...MOTIVATIONAL];

  // Tough-love quotes are in the mix for everyone, whatever the streak or today's progress.
  pool.push(...DEMOTIVATIONAL, ...DEMOTIVATIONAL);

  if (ctx.targetCtcLpa && ctx.targetCtcLpa > 0) {
    pool.push(...ctcMessages(ctx.targetCtcLpa));
    if (seed % 4 === 0) return pickFrom(ctcMessages(ctx.targetCtcLpa), seed);
  }

  return pickFrom(pool, seed);
}

/** Pick a CTC-focused quote for settings preview. */
export function pickCtcMotivation(targetLpa: number, seed = 0): InspirationMessage {
  const messages = ctcMessages(targetLpa);
  return pickFrom(messages, seed);
}

export function formatCtcTarget(lpa: number): string {
  return `${lpa} LPA`;
}
