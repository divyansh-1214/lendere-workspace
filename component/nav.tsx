"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, getHomeRoute } from "@/hooks/useAuth";

type NavItem = {
  href: string;
  label: string;
  eyebrow?: string;
};

const roleNav: Record<string, NavItem[]> = {
  ops_admin: [
    { href: "/uplode/leads", label: "Import leads", eyebrow: "01" },
    { href: "/uplode/leander", label: "Import lenders", eyebrow: "02" },
    { href: "/leads", label: "Lead directory", eyebrow: "03" },
    { href: "/users/new", label: "Add user", eyebrow: "04" },
  ],
  lender_admin: [
    { href: "/leads", label: "Lead directory", eyebrow: "01" },
    { href: "/assigned", label: "Assigned leads", eyebrow: "02" },
    { href: "/users/new", label: "Add agent", eyebrow: "03" },
  ],
  lender_agent: [
    { href: "/assigned", label: "My assigned leads", eyebrow: "01" },
  ],
};

const AUTH_PATHS = ["/login", "/signup", "/users/new", "/forgot-password", "/reset-password"];

export default function Nav() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();

  if (AUTH_PATHS.includes(pathname)) {
    return null;
  }

  const homeHref = user ? getHomeRoute(user.role) : "/";
  const items = user ? roleNav[user.role] ?? [] : [];

  const handleSignOut = async () => {
    await logout();
  };

  const roleLabel = user
    ? user.role === "ops_admin"
      ? "Operations admin"
      : user.role === "lender_admin"
      ? "Lender admin"
      : "Lender agent"
    : "";

  if(pathname === "/" || pathname === "/users/new") return null;
  return (
    <header className="topbar">
      <Link className="brand" href={homeHref} aria-label="Lendere home">
        <span className="brand-mark">L</span>
        <span>
          lendere<span className="brand-dot">.</span>
        </span>
      </Link>

      {!loading && user && items.length > 0 && (
        <nav className="topnav" aria-label="Primary">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`topnav-link ${pathname === item.href ? "is-active" : ""}`}
            >
              {item.eyebrow && <span className="topnav-eyebrow">{item.eyebrow}</span>}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      )}

      <div className="topbar-status">
        {!loading && (
          user ? (
            <>
              {user.name && <span className="topbar-user">{user.name}</span>}
              <span className="topbar-role">{roleLabel}</span>
              <button
                className="signout-button"
                type="button"
                onClick={() => void handleSignOut()}
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link href="/login">Sign In</Link>
          )
        )}
        <span className="status-dot" />
        {roleLabel ? roleLabel + " workspace" : "Operations workspace"}
      </div>
    </header>
  );
}
