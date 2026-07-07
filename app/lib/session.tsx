"use client";

// Auth session context: loads /api/me once, exposes user + helpers.
// Replaces the old localStorage store — all state now lives in the DB.

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, post } from "./api";
import type { Me } from "./types";

interface SessionCtx {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  owns: (courseId: string) => boolean;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<Me & { user: Me["user"] | null }>("/api/me");
      setMe(data.user ? (data as Me) : null);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await post("/api/auth/logout");
    setMe(null);
  }, []);

  const owns = useCallback(
    (courseId: string) => !!me?.enrolledCourseIds.includes(courseId),
    [me]
  );

  return (
    <Ctx.Provider value={{ me, loading, refresh, logout, owns }}>{children}</Ctx.Provider>
  );
}

export function useSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSession must be used within SessionProvider");
  return c;
}
