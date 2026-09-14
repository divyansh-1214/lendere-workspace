"use client";

// id: "6aa39dbea2b759206252c1fe"
// email:"divyansh.sri23@gmail.com"
// lenderId: "6aa29d356172a6ff8a26e754"
// name:"Divyansh Srivastava"
// role: "lender_admin"
// expiresAt:"2026-09-21T16:20:32.322Z"

// id: "6aa39dbea2b759206252c1fe"
// email: "divyansh.sri23@gmail.com"
// lenderId: "6aa29d356172a6ff8a26e754"
// name: "Divyansh Srivastava"
// role: "lender_admin"
import {
  createContext,
  useContext,
  useEffect,
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
  lenderId: string
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

  const refreshUser = async () => {
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
  };

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
     refreshUser();
   }, []);

   // Watch user state changes
   // useEffect(() => {
   //   console.log("USER STATE CHANGED:", user);
   // }, [user]);

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

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}
