/** User-created personal questions — excludes copies synced from group questions. */
export const NATIVE_PERSONAL_QUESTION_FILTER = {
  $or: [{ sourceGroupQuestionId: { $exists: false } }, { sourceGroupQuestionId: null }],
};
