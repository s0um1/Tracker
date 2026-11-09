import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  username?: string;
  authCodeHash?: string;
  name: string;
  email?: string;
  avatar?: string;
  googleId?: string;
  onboardingComplete: boolean;
  preparationLevel: "beginner" | "intermediate" | "advanced";
  dailyStudyMinutes: number;
  activeGroupId?: mongoose.Types.ObjectId;
  theme: "light" | "dark" | "system";
  studyStreak: number;
  lastStudyDate?: Date;
  lastSeenAt?: Date;
  targetCtcLpa?: number;
  targetCompany?: string;
  targetRole?: string;
  isGuest?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    authCodeHash: { type: String, select: false },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    avatar: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    onboardingComplete: { type: Boolean, default: false },
    preparationLevel: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "intermediate",
    },
    dailyStudyMinutes: { type: Number, default: 120 },
    activeGroupId: { type: Schema.Types.ObjectId, ref: "Group" },
    theme: { type: String, enum: ["light", "dark", "system"], default: "system" },
    studyStreak: { type: Number, default: 0 },
    lastStudyDate: { type: Date },
    lastSeenAt: { type: Date },
    targetCtcLpa: { type: Number, min: 0 },
    targetCompany: { type: String, trim: true, maxlength: 120 },
    targetRole: { type: String, trim: true, maxlength: 120 },
    isGuest: { type: Boolean, default: false },
  },
  { timestamps: true }
);

UserSchema.index({ activeGroupId: 1 });

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
