'use client'
import Link from "next/link";
import axios from "axios";
import { useState } from "react";
export default function Nav() {
  const [logedin, setLogedin] = useState(false);
  async function handleSignOut() {
    await axios.post("/api/auth/logout");
    setLogedin(false);
  }
  return (
    <>
      <div className="">
        <header className="topbar">
          <Link
            className="brand"
            href="/"
            aria-label="Lendere home"
          >
            <span className="brand-mark">L</span>

            <span>
              lendere<span className="brand-dot">.</span>
            </span>
          </Link>

          <div className="topbar-status">
            {
              logedin ? <button onClick={() => { }}>Sign Out</button> : <Link href="/login">Sign In</Link>
            }
            <span className="status-dot" />
            Operations workspace
          </div>
        </header>
      </div>
    </>
  )
}
