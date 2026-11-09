import { withAuth } from "@/lib/api-handler";
import { jsonOk } from "@/lib/utils";
import User from "@/models/User";

/** Heartbeat: the client pings this while the app is open so teammates can see who is online. */
export const POST = withAuth(async (_request, { userId }) => {
  await User.updateOne({ _id: userId }, { $set: { lastSeenAt: new Date() } }, { timestamps: false });
  return jsonOk({ ok: true });
}, "Failed to update presence");
