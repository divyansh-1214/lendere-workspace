"use client";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
} from "react";

type UserRole =
  | "ops_admin"
  | "lender_admin"
  | "lender_agent";

type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  lenderId?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        setUser(null);
        return;
      }

      const data = await response.json();
      if (data.success) {
        setUser(data.data);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to fetch current user:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (
    email: string,
    password: string
  ) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Login failed"
      );
    }
    setUser(data.data);
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
    }
  };

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      void refreshUser();
    }, 0);

    return () => window.clearTimeout(refreshTimer);
  }, [refreshUser]);

  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const publicRoutes = ["/",];
    if (!user) {
      if (!publicRoutes.includes(pathname)) {
        router.replace("/");
      }
      return;
    }

    if (publicRoutes.includes(pathname)) {
      router.replace(getHomeRoute(user.role));
      return;
    }

    if (!canAccessRoute(user.role, pathname)) {
      router.replace(getHomeRoute(user.role));
    }
  }, [loading, pathname, router, user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function getHomeRoute(role: UserRole) {
  switch (role) {
    case "ops_admin":
      return "/uplode/leads";
    case "lender_admin":
      return "/leads";
    case "lender_agent":
      return "/assigned";
  }
}

export function canAccessRoute(role: UserRole, pathname: string) {
  if (role === "ops_admin") {
    return [
      "/",
      "/leads",
      "/leads/assign",
      "/uplode/leads",
      "/uplode/leander",
      "/users/new",
      "/admin/users",
      "/assigned",
    ].includes(pathname);
  }

  if (role === "lender_admin") {
    return ["/leads", "/assigned", "/users/new"].includes(pathname);
  }

  return pathname === "/assigned";
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}
