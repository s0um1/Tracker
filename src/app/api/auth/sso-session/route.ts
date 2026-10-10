import { NextRequest } from "next/server";
import { SESSION_COOKIE, createSessionToken, verifySessionToken } from "@/lib/session";
import { jsonOk, jsonError } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const userId = await verifySessionToken(token);
    if (!userId) {
      return jsonError("Unauthorized", 401);
    }
    const session = await createSessionToken(userId);
    return jsonOk({ session });
  } catch {
    return jsonError("Unauthorized", 401);
  }
}
