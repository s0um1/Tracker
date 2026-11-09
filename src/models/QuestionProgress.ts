import mongoose, { Schema, Document, Model } from "mongoose";

export interface IQuestionProgress extends Document {
  userId: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  status: "not_started" | "add_to_todo" | "in_progress" | "revised" | "done";
  confidence: "weak" | "okay" | "strong";
  lastPracticed?: Date;
  firstCompletedAt?: Date;
  pointsAwarded?: number;
  notes?: string;
  lastReviewedAt?: Date;
  lastTimeSpentSec?: number;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionProgressSchema = new Schema<IQuestionProgress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    questionId: { type: Schema.Types.ObjectId, ref: "PracticeQuestion", required: true },
    status: {
      type: String,
      enum: ["not_started", "add_to_todo", "in_progress", "revised", "done"],
      default: "not_started",
    },
    confidence: { type: String, enum: ["weak", "okay", "strong"], default: "weak" },
    lastPracticed: { type: Date },
    firstCompletedAt: { type: Date },
    pointsAwarded: { type: Number, min: 0 },
    notes: { type: String, trim: true },
    lastReviewedAt: { type: Date },
    lastTimeSpentSec: { type: Number, min: 0 },
  },
  { timestamps: true }
);

QuestionProgressSchema.index({ userId: 1, questionId: 1 }, { unique: true });

const QuestionProgress: Model<IQuestionProgress> =
  mongoose.models.QuestionProgress ||
  mongoose.model<IQuestionProgress>("QuestionProgress", QuestionProgressSchema);

export default QuestionProgress;
