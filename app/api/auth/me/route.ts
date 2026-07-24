import { handler, ok } from "@/lib/http";
import { getAuth } from "@/lib/auth/guard";

export const GET = handler(async () => {
  const a = await getAuth();
  if (!a) return ok({ user: null });
  return ok({
    user: {
      id: a.userId,
      roles: a.roles,
      email: a.email,
      phone: a.phone,
      firstName: a.profile?.firstName ?? "",
      lastName: a.profile?.lastName ?? "",
      locale: a.profile?.locale ?? "kk",
    },
  });
});
