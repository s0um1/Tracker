import mongoose from "mongoose";
import User from "@/models/User";
import Group from "@/models/Group";
import Subject from "@/models/Subject";
import Topic from "@/models/Topic";
import TopicProgress from "@/models/TopicProgress";
import PrepTask from "@/models/PrepTask";
import PracticeQuestion from "@/models/PracticeQuestion";
import QuestionProgress from "@/models/QuestionProgress";
import MockInterview from "@/models/MockInterview";
import MockInterviewSession from "@/models/MockInterviewSession";
import MockInterviewSlot from "@/models/MockInterviewSlot";
import MockInterviewRound from "@/models/MockInterviewRound";
import StudySession from "@/models/StudySession";
import PreparationPlan from "@/models/PreparationPlan";
import {
  addIstDays,
  istDateFromParts,
  joinCodeExpiryDate,
  startOfDay,
  toDateInputValue,
} from "@/lib/utils";
import { hashAuthCode } from "@/lib/auth";

export const GUEST_USERNAME = "guest_demo";
// ponytail: unusable placeholder — guest login uses /api/auth/guest only
const GUEST_AUTH_HASH = hashAuthCode("000000");

const SUBJECT_TOPICS: Record<string, { topics: string[]; statuses: string[]; confidences: string[] }> = {
  DSA: {
    topics: ["Arrays & Hashing", "Trees & Graphs", "Dynamic Programming", "Sliding Window"],
    statuses: ["interview_ready", "revised", "practiced", "learning"],
    confidences: ["strong", "okay", "weak", "okay"],
  },
  "System Design": {
    topics: ["URL Shortener", "Rate Limiter", "Notification System", "Distributed Cache"],
    statuses: ["revised", "practiced", "learning", "not_started"],
    confidences: ["okay", "weak", "weak", "weak"],
  },
  DBMS: {
    topics: ["Indexing", "Transactions & ACID", "Query Optimization"],
    statuses: ["practiced", "revised", "learning"],
    confidences: ["strong", "okay", "weak"],
  },
  OS: {
    topics: ["Process Scheduling", "Memory Management", "Deadlocks"],
    statuses: ["interview_ready", "practiced", "learning"],
    confidences: ["strong", "okay", "weak"],
  },
};

const GROUP_QUESTIONS: Record<string, string[]> = {
  DSA: [
    "Two Sum — return indices of two numbers that add to target",
    "Longest Substring Without Repeating Characters",
    "Merge K Sorted Lists",
  ],
  "System Design": [
    "Design a URL shortener like bit.ly",
    "Design a notification system for 10M users",
  ],
  DBMS: ["Explain B+ tree indexing vs hash indexing", "Design schema for an e-commerce order system"],
  OS: ["Explain process vs thread with real examples", "How does virtual memory work?"],
};

const MEMBER_NAMES = ["Alex Chen", "Priya Sharma", "Rahul Mehta"];
const EXPECTED_GROUP_QUESTION_COUNT = Object.values(GROUP_QUESTIONS).reduce(
  (count, questions) => count + questions.length,
  0
);

function daysFromNow(days: number): Date {
  return addIstDays(new Date(), days);
}

function isInterviewTrack(subject: { name: string; useForMockInterview?: boolean }): boolean {
  return subject.useForMockInterview !== false && subject.name !== "System Design";
}

function sessionQuestionsForUser(
  subjects: InstanceType<typeof Subject>[],
  questions: InstanceType<typeof PracticeQuestion>[],
  doneQuestionIds: Set<string>
) {
  return subjects
    .filter(isInterviewTrack)
    .map((subject) => {
      const pool = questions.filter(
        (q) => String(q.subjectId) === String(subject._id) && doneQuestionIds.has(String(q._id))
      );
      const q = pool[0];
      if (!q) return null;
      return {
        subjectId: subject._id,
        subjectName: subject.name,
        topicId: q.topicId,
        questionId: q._id,
        question: q.content,
        source: "practice" as const,
      };
    })
    .filter(Boolean) as {
      subjectId: mongoose.Types.ObjectId;
      subjectName: string;
      topicId?: mongoose.Types.ObjectId;
      questionId: mongoose.Types.ObjectId;
      question: string;
      source: "practice";
    }[];
}

async function syncDemoSubjectInterviewFlags(
  subjects: InstanceType<typeof Subject>[]
) {
  for (const subject of subjects) {
    const useForMockInterview = subject.name !== "System Design";
    if (subject.useForMockInterview !== useForMockInterview) {
      subject.useForMockInterview = useForMockInterview;
      await subject.save();
    }
  }
}

function demoInterviewSlot(baseDate: Date, index: number) {
  const [y, m, d] = toDateInputValue(baseDate).split("-").map(Number);
  return istDateFromParts(y, m, d, 10 + index);
}

function todayAt(hour: number) {
  const [y, m, d] = toDateInputValue(new Date()).split("-").map(Number);
  return istDateFromParts(y, m, d, hour);
}

async function ensureDemoRounds(groupId: mongoose.Types.ObjectId) {
  const round1Date = daysFromNow(-14);
  const round2Date = todayAt(14);

  // ponytail: wipe stray undated rounds from listMockRounds / addMockDate during dev
  await MockInterviewRound.deleteMany({ groupId });

  const [round1, round2] = await MockInterviewRound.create([
    {
      groupId,
      roundNumber: 1,
      interviewDate: round1Date,
      startsAt: round1Date,
      endsAt: round1Date,
    },
    {
      groupId,
      roundNumber: 2,
      interviewDate: round2Date,
      startsAt: round2Date,
      endsAt: round2Date,
    },
  ]);
  return [round1, round2];
}

async function syncDemoMockInterviews(
  groupId: mongoose.Types.ObjectId,
  guestId: mongoose.Types.ObjectId,
  memberIds: mongoose.Types.ObjectId[],
  subjects: InstanceType<typeof Subject>[],
  questions: InstanceType<typeof PracticeQuestion>[]
) {
  const allMemberIds = [guestId, ...memberIds];

  await Promise.all([
    MockInterview.deleteMany({ groupId }),
    MockInterviewSession.deleteMany({ groupId }),
    MockInterviewSlot.deleteMany({ groupId }),
  ]);

  const rounds = await ensureDemoRounds(groupId);
  const round1 = rounds[0];
  const round2 = rounds[1];
  if (!round1 || !round2) return;

  for (let i = 0; i < allMemberIds.length; i++) {
    await MockInterviewSlot.create({
      groupId,
      roundId: round2._id,
      intervieweeId: allMemberIds[i],
      scheduledAt: demoInterviewSlot(round2.startsAt, i),
      scheduledBy: guestId,
    });
    await MockInterviewSlot.create({
      groupId,
      roundId: round1._id,
      intervieweeId: allMemberIds[i],
      scheduledAt: demoInterviewSlot(round1.startsAt, i),
      scheduledBy: guestId,
    });
  }

  // Round 1 — completed mocks for guest
  const guestDoneIds = new Set(
    (
      await QuestionProgress.find({
        userId: guestId,
        status: "done",
        questionId: { $in: questions.map((q) => q._id) },
      }).lean()
    ).map((p) => String(p.questionId))
  );
  const guestR1Questions = sessionQuestionsForUser(subjects, questions, guestDoneIds);
  if (guestR1Questions.length > 0) {
    const guestR1Session = await MockInterviewSession.create({
      groupId,
      roundId: round1._id,
      intervieweeId: guestId,
      generatedBy: memberIds[0] ?? guestId,
      questions: guestR1Questions,
    });
    for (let i = 0; i < memberIds.length; i++) {
      await MockInterview.create({
        userId: guestId,
        groupId,
        sessionId: guestR1Session._id,
        interviewerId: memberIds[i],
        date: demoInterviewSlot(round1.startsAt, i + 1),
        score: [72, 68, 75][i] ?? 70,
        questionsAsked: guestR1Session.questions.map((q) => `${q.subjectName}: ${q.question}`),
        strengths: ["Clear communication"],
        weaknesses: ["Depth on caching"],
      });
    }
  }

  // Round 2 (today) — all members open for question generation on mock date
  const round2Mid = todayAt(10);
  for (let i = 0; i < allMemberIds.length; i++) {
    const userId = allMemberIds[i];
    const picks = questions.filter((_, idx) => idx % allMemberIds.length === i);
    for (const q of picks.slice(0, 2)) {
      await QuestionProgress.findOneAndUpdate(
        { userId, questionId: q._id },
        {
          userId,
          questionId: q._id,
          status: "done",
          confidence: "okay",
          lastPracticed: round2Mid,
        },
        { upsert: true }
      );
    }
  }
}

async function ensureMemberDoneQuestions(
  memberIds: mongoose.Types.ObjectId[],
  subjects: InstanceType<typeof Subject>[],
  questions: InstanceType<typeof PracticeQuestion>[]
) {
  for (const userId of memberIds) {
    for (const subject of subjects.filter(isInterviewTrack)) {
      const subjectQuestions = questions.filter((q) => String(q.subjectId) === String(subject._id));
      if (subjectQuestions.length === 0) continue;
      const first = subjectQuestions[0];
      await QuestionProgress.findOneAndUpdate(
        { userId, questionId: first._id },
        {
          userId,
          questionId: first._id,
          status: "done",
          confidence: "okay",
          lastPracticed: daysFromNow(-2),
        },
        { upsert: true }
      );
    }
  }
}

async function ensureMemberUsers(): Promise<mongoose.Types.ObjectId[]> {
  const ids: mongoose.Types.ObjectId[] = [];
  for (let i = 0; i < MEMBER_NAMES.length; i++) {
    const username = `demo_member_${i + 1}`;
    let user = await User.findOne({ username });
    if (!user) {
      user = await User.create({
        username,
        authCodeHash: GUEST_AUTH_HASH,
        name: MEMBER_NAMES[i],
        onboardingComplete: true,
        preparationLevel: "intermediate",
        dailyStudyMinutes: 90 + i * 30,
        studyStreak: 5 + i * 3,
        lastStudyDate: new Date(),
      });
    }
    ids.push(user._id);
  }
  return ids;
}

export async function ensureDemoData() {
  let guest = await User.findOne({ username: GUEST_USERNAME });
  if (guest?.activeGroupId) {
    const group = await Group.findById(guest.activeGroupId);
    const [subjectCount, questionCount] = await Promise.all([
      Subject.countDocuments({ groupId: guest.activeGroupId, scope: "group" }),
      PracticeQuestion.countDocuments({ groupId: guest.activeGroupId, scope: "group" }),
    ]);
    if (group && subjectCount > 0 && questionCount >= EXPECTED_GROUP_QUESTION_COUNT) {
      const memberIds = await ensureMemberUsers();
      const subjects = await Subject.find({ groupId: guest.activeGroupId, scope: "group" }).sort({ order: 1 });
      const questions = await PracticeQuestion.find({ groupId: guest.activeGroupId, scope: "group" });
      await syncDemoSubjectInterviewFlags(subjects);
      await ensureMemberDoneQuestions([guest._id, ...memberIds], subjects, questions);
      await syncDemoMockInterviews(guest.activeGroupId, guest._id, memberIds, subjects, questions);
      return guest;
    }
  }

  const memberIds = await ensureMemberUsers();

  if (!guest) {
    guest = await User.create({
      username: GUEST_USERNAME,
      authCodeHash: GUEST_AUTH_HASH,
      name: "Demo User",
      isGuest: true,
      onboardingComplete: true,
      preparationLevel: "intermediate",
      dailyStudyMinutes: 120,
      studyStreak: 12,
      lastStudyDate: new Date(),
      targetCtcLpa: 25,
    });
  } else {
    guest.isGuest = true;
    guest.onboardingComplete = true;
    guest.name = "Demo User";
    guest.authCodeHash = GUEST_AUTH_HASH;
    guest.studyStreak = 12;
    guest.lastStudyDate = new Date();
    guest.targetCtcLpa = 25;
    await guest.save();
  }

  const allMemberIds = [guest._id, ...memberIds];
  const interviewDate = daysFromNow(45);

  let group =
    (guest.activeGroupId ? await Group.findById(guest.activeGroupId) : null) ??
    (await Group.findOne({ ownerId: guest._id }));
  if (!group) {
    group = await Group.create({
      name: "SWITCH Prep Squad",
      description: "Demo prep group — explore all features",
      joinCode: "000001",
      joinCodeExpiresAt: joinCodeExpiryDate(),
      interviewDate,
      ownerId: guest._id,
      members: [
        { userId: guest._id, role: "owner", joinedAt: new Date() },
        ...memberIds.map((id, i) => ({
          userId: id,
          role: (i === 0 ? "admin" : "member") as "admin" | "member",
          joinedAt: new Date(),
        })),
      ],
    });
    guest.activeGroupId = group._id;
    await guest.save();
  }

  const groupId = group._id;
  let subjects = await Subject.find({ groupId, scope: "group" }).sort({ order: 1 });
  const existingQuestionCount = await PracticeQuestion.countDocuments({ groupId, scope: "group" });
  if (subjects.length > 0 && existingQuestionCount >= EXPECTED_GROUP_QUESTION_COUNT) {
    const questions = await PracticeQuestion.find({ groupId, scope: "group" });
    await syncDemoSubjectInterviewFlags(subjects);
    await ensureMemberDoneQuestions([guest._id, ...memberIds], subjects, questions);
    await syncDemoMockInterviews(groupId, guest._id, memberIds, subjects, questions);
    return guest;
  }

  let allTopics: InstanceType<typeof Topic>[] = [];
  const resumePartialSeed = subjects.length > 0 && existingQuestionCount < EXPECTED_GROUP_QUESTION_COUNT;

  if (resumePartialSeed) {
    allTopics = await Topic.find({ groupId }).sort({ order: 1 });
    const staleQuestionIds = await PracticeQuestion.find({ groupId }).distinct("_id");
    await Promise.all([
      PracticeQuestion.deleteMany({ groupId }),
      QuestionProgress.deleteMany({ questionId: { $in: staleQuestionIds } }),
      MockInterview.deleteMany({ groupId }),
      MockInterviewSession.deleteMany({ groupId }),
      MockInterviewSlot.deleteMany({ groupId }),
      MockInterviewRound.deleteMany({ groupId }),
      StudySession.deleteMany({ groupId }),
      PreparationPlan.deleteMany({ groupId, userId: guest._id }),
    ]);
  } else {
    const SUBJECT_TRACKS: Record<string, { totalQuestions: number; contentUnit: "questions" | "videos" }> = {
      DSA: { totalQuestions: 150, contentUnit: "questions" },
      "System Design": { totalQuestions: 100, contentUnit: "videos" },
      DBMS: { totalQuestions: 50, contentUnit: "questions" },
      OS: { totalQuestions: 80, contentUnit: "questions" },
    };

    const subjectNames = Object.keys(SUBJECT_TOPICS);
    subjects = [];
    for (let i = 0; i < subjectNames.length; i++) {
      const track = SUBJECT_TRACKS[subjectNames[i]];
      subjects.push(
        await Subject.create({
          groupId,
          scope: "group",
          name: subjectNames[i],
          priority: i < 2 ? "high" : "medium",
          order: i,
          totalQuestions: track?.totalQuestions ?? 20,
          contentUnit: track?.contentUnit ?? "questions",
          useForMockInterview: subjectNames[i] !== "System Design",
        })
      );
    }

    for (const subject of subjects) {
      const cfg = SUBJECT_TOPICS[subject.name];
      if (!cfg) continue;
      for (let i = 0; i < cfg.topics.length; i++) {
        const topic = await Topic.create({
          subjectId: subject._id,
          groupId,
          name: cfg.topics[i],
          status: cfg.statuses[i],
          confidence: cfg.confidences[i],
          priority: cfg.confidences[i] === "weak" ? "high" : "medium",
          studyMinutes: 30 + i * 20,
          lastStudied: cfg.statuses[i] !== "not_started" ? daysFromNow(-2 - i) : undefined,
          nextRevision: cfg.confidences[i] === "weak" ? daysFromNow(-1) : daysFromNow(3 + i),
          order: i,
        });
        allTopics.push(topic);
      }
    }

    for (const userId of allMemberIds) {
      const progressDocs = allTopics.map((t, i) => ({
        userId,
        topicId: t._id,
        status: SUBJECT_TOPICS[subjects.find((s) => String(s._id) === String(t.subjectId))?.name ?? ""]?.statuses[
          i % 4
        ] ?? "learning",
        confidence:
          SUBJECT_TOPICS[subjects.find((s) => String(s._id) === String(t.subjectId))?.name ?? ""]?.confidences[
            i % 4
          ] ?? "okay",
        studyMinutes: 20 + (i % 5) * 15,
        lastStudied: daysFromNow(-(i % 7)),
      }));
      await TopicProgress.insertMany(progressDocs);
    }
  }

  const taskDefs = [
    { title: "Revise DP patterns — knapsack & LCS", status: "in_progress", priority: "critical" },
    { title: "Mock: System Design URL shortener", status: "pending", priority: "high" },
    { title: "Solve 5 medium array problems", status: "completed", priority: "high" },
    { title: "Read Grokking SD — Notification System", status: "pending", priority: "medium" },
    { title: "Practice B+ tree vs hash index tradeoffs", status: "completed", priority: "medium" },
    { title: "Review OS scheduling algorithms", status: "pending", priority: "low" },
  ];

  if (!resumePartialSeed) {
    for (let i = 0; i < taskDefs.length; i++) {
      const topic = allTopics[i % allTopics.length];
      const subject = subjects.find((s) => String(s._id) === String(topic.subjectId));
      await PrepTask.create({
        groupId,
        userId: guest._id,
        subjectId: subject?._id,
        topicId: topic._id,
        title: taskDefs[i].title,
        priority: taskDefs[i].priority,
        status: taskDefs[i].status,
        dueDate: daysFromNow(i < 3 ? 0 : i),
        estimatedMinutes: 45,
        completedAt: taskDefs[i].status === "completed" ? daysFromNow(-1) : undefined,
      });
    }
  }

  const questions: InstanceType<typeof PracticeQuestion>[] = [];
  for (const subject of subjects) {
    const qs = GROUP_QUESTIONS[subject.name] ?? [];
    for (const content of qs) {
      const topic = allTopics.find((t) => String(t.subjectId) === String(subject._id));
      const q = await PracticeQuestion.create({
        userId: guest._id,
        groupId,
        scope: "group",
        subjectId: subject._id,
        topicId: topic?._id,
        practiceDate: new Date(),
        content,
        difficulty: "medium",
      });
      questions.push(q);
    }
  }

  for (const userId of allMemberIds) {
    for (const q of questions) {
      await QuestionProgress.create({
        userId,
        questionId: q._id,
        status: Math.random() > 0.4 ? "done" : "in_progress",
        confidence: Math.random() > 0.5 ? "okay" : "strong",
        lastPracticed: daysFromNow(-3),
      });
    }
  }

  await ensureMemberDoneQuestions(allMemberIds, subjects, questions);

  for (let i = 13; i >= 0; i--) {
    const day = addIstDays(new Date(), -i);
    const minutes = 45 + (i % 5) * 20;
    await StudySession.create({
      userId: guest._id,
      groupId,
      subjectId: subjects[i % subjects.length]._id,
      topicId: allTopics[i % allTopics.length]._id,
      durationMinutes: minutes,
      startedAt: day,
      completedAt: new Date(day.getTime() + minutes * 60000),
    });
  }

  const planStart = startOfDay(new Date());
  const planEnd = daysFromNow(14);
  const planDays = [];
  for (let d = 0; d < 7; d++) {
    const date = addIstDays(planStart, d);
    const subject = subjects[d % subjects.length];
    const topic = allTopics.filter((t) => String(t.subjectId) === String(subject._id))[0];
    planDays.push({
      dayNumber: d + 1,
      date,
      items: [
        {
          subjectId: subject._id,
          topicId: topic?._id,
          label: `${subject.name}: ${topic?.name ?? "Review"}`,
          estimatedMinutes: 90,
          completed: d < 2,
        },
      ],
    });
  }

  await PreparationPlan.create({
    groupId,
    userId: guest._id,
    startDate: planStart,
    endDate: planEnd,
    days: planDays,
  });

  for (const memberId of memberIds) {
    for (let i = 5; i >= 0; i--) {
      const day = addIstDays(new Date(), -i * 2);
      await StudySession.create({
        userId: memberId,
        groupId,
        subjectId: subjects[0]._id,
        durationMinutes: 30 + i * 10,
        startedAt: day,
        completedAt: new Date(day.getTime() + (30 + i * 10) * 60000),
      });
    }
  }

  await syncDemoMockInterviews(groupId, guest._id, memberIds, subjects, questions);

  return guest;
}
