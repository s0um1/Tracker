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
];

const DEMOTIVATIONAL: InspirationMessage[] = [
  { text: "Scrolling LeetCode discussions isn't studying. You know this.", tone: "demotivational" },
  { text: "Your target company won't hire the version of you that 'will start tomorrow.'", tone: "demotivational" },
  { text: "Watching system design videos without taking notes is just entertainment.", tone: "demotivational" },
  { text: "That topic you've been avoiding? It's definitely coming up in the interview.", tone: "demotivational" },
  { text: "Zero study streak. Your future self is taking notes.", tone: "demotivational" },
  { text: "Readiness below 50% and the interview is approaching. Math doesn't care about your feelings.", tone: "demotivational" },
  { text: "You don't need another roadmap. You need to finish the one you're on.", tone: "demotivational" },
  { text: "Collecting resources is procrastination with good PR.", tone: "demotivational" },
  { text: "The interviewer won't accept 'I was going to revise that' as an answer.", tone: "demotivational" },
  { text: "Your group is progressing. Are you keeping up or making excuses?", tone: "demotivational" },
  { text: "Comfort zone: population — you, right now, probably.", tone: "demotivational" },
  { text: "Adding questions to the bank without solving them is just hoarding.", tone: "demotivational" },
  { text: "Your accountability group can see the leaderboard. Act accordingly.", tone: "demotivational" },
  { text: "Another day, another unchecked task. The interview date didn't move.", tone: "demotivational" },
  { text: "You marked it 'practiced' but couldn't explain it out loud. Fix that.", tone: "demotivational" },
  { text: "Motivation is optional. Discipline is what gets you the offer.", tone: "demotivational" },
  { text: "Your group logged study hours. Your dashboard says otherwise.", tone: "demotivational" },
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
    { text: `₹${monthly}K/mo post-tax won't come from hope. It comes from readiness.`, tone: "ctc" },
  ];
}

export interface InspirationContext {
  readiness: number;
  studyStreak: number;
  daysToInterview: number;
  targetCtcLpa?: number;
  seed?: number;
}

function hashSeed(ctx: InspirationContext): number {
  const now = new Date();
  const day = toDateInputValue(now);
  const base = `${day}:${ctx.readiness}:${ctx.studyStreak}:${ctx.seed ?? 0}`;
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

  const slacking =
    ctx.readiness < 45 ||
    ctx.studyStreak < 2 ||
    (ctx.daysToInterview <= 14 && ctx.readiness < 60);

  if (slacking && seed % 3 !== 0) {
    pool.push(...DEMOTIVATIONAL, ...DEMOTIVATIONAL);
  }

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
