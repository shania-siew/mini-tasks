"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, session } from "@/lib/api";

// mode is "login" or "signup"
export default function AuthForm({ mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const isLogin = mode === "login";

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    // Free-tier hosting sleeps when idle; tell the user why the first request is slow
    const slowTimer = setTimeout(() => setSlow(true), 4000);
    try {
      const res = await api(`/auth/${mode}`, "POST", { email, password });
      session.save(res.access_token, res.user);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      clearTimeout(slowTimer);
      setSlow(false);
      setBusy(false);
    }
  }

  return (
    <form className="card auth" onSubmit={onSubmit}>
      <h1>{isLogin ? "Sign in" : "Create account"}</h1>
      <label>
        Email
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Password
        <input
          type="password"
          required
          minLength={isLogin ? 1 : 8}
          maxLength={72}
          autoComplete={isLogin ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p role="alert" className="error">{error}</p>}
      {busy && slow && (
        <p className="muted" role="status">
          Waking up the server… the first request can take up to a minute.
        </p>
      )}
      <button className="primary" disabled={busy}>{busy ? "Please wait…" : isLogin ? "Sign in" : "Sign up"}</button>
      <p className="muted">
        {isLogin ? (
          <>No account? <Link href="/signup">Sign up</Link></>
        ) : (
          <>Already registered? <Link href="/login">Sign in</Link></>
        )}
      </p>
    </form>
  );
}
