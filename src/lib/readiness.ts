export function getInterviewCountdown(interviewDate?: string | Date | null) {
  if (!interviewDate) {
    return { days: 0, hours: 0, totalHours: 0, isPast: false, hasDate: false };
  }
  const target = new Date(interviewDate);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { days: 0, hours: 0, totalHours: 0, isPast: true, hasDate: true };
  }

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  return { days, hours, totalHours, isPast: false, hasDate: true };
}
