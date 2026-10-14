import { useState } from "react";
import { X, Lock, Mail, User as UserIcon, LogIn, UserPlus, CheckCircle2, AlertCircle } from "lucide-react";
import { loginUser, registerUser } from "../services/api";

export default function AuthModal({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode = "login",
  customNotice = null,
}) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      let res;
      if (mode === "login") {
        res = await loginUser(email, password);
        setSuccessMsg("Signed in successfully!");
      } else {
        res = await registerUser(email, password, name || "Builder");
        setSuccessMsg("Account created and signed in!");
      }

      setTimeout(() => {
        if (onAuthSuccess) {
          onAuthSuccess(res?.user);
        }
        onClose();
      }, 600);
    } catch (err) {
      console.error("Auth error:", err);
      setError(err.message || "Authentication failed. Please check your details.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setEmail("guest@buildwise.local");
    setPassword("buildwise_guest_pass_2026");
    setError(null);
    setLoading(true);

    try {
      const res = await loginUser("guest@buildwise.local", "buildwise_guest_pass_2026");
      setSuccessMsg("Signed in as Demo User (Narmathan)!");
      setTimeout(() => {
        if (onAuthSuccess) {
          onAuthSuccess(res?.user);
        }
        onClose();
      }, 600);
    } catch (err) {
      setError(err.message || "Failed to sign in with demo credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          maxWidth: "440px",
          width: "100%",
          padding: "32px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
          position: "relative",
          animation: "fadeIn 0.2s ease-out",
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "transparent",
            border: "none",
            color: "var(--text-soft)",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "var(--accent)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
              fontWeight: 700,
              fontSize: "18px",
            }}
          >
            B
          </div>
          <h2 style={{ fontSize: "22px", margin: "0 0 6px", fontWeight: 700 }}>
            {mode === "login" ? "Welcome Back to BuildWise" : "Create Your BuildWise Account"}
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-soft)", margin: 0 }}>
            {mode === "login"
              ? "Sign in to access your projects, estimates & floor plans"
              : "Register to manage construction milestones & material schedules"}
          </p>
          {customNotice && (
            <div
              style={{
                marginTop: "12px",
                padding: "10px 12px",
                background: "rgba(22, 163, 74, 0.1)",
                border: "1px solid rgba(22, 163, 74, 0.25)",
                borderRadius: "6px",
                color: "var(--text)",
                fontSize: "12px",
                lineHeight: "1.4",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0 }} />
              <span>{customNotice}</span>
            </div>
          )}
        </div>

        {/* Tab Toggle */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            background: "var(--surface-2)",
            padding: "4px",
            marginBottom: "20px",
            border: "1px solid var(--border)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            style={{
              padding: "8px",
              border: "none",
              background: mode === "login" ? "var(--surface)" : "transparent",
              color: mode === "login" ? "var(--text)" : "var(--text-soft)",
              fontWeight: mode === "login" ? 600 : 400,
              cursor: "pointer",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "0.2s",
            }}
          >
            <LogIn size={15} /> Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            style={{
              padding: "8px",
              border: "none",
              background: mode === "register" ? "var(--surface)" : "transparent",
              color: mode === "register" ? "var(--text)" : "var(--text-soft)",
              fontWeight: mode === "register" ? 600 : 400,
              cursor: "pointer",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "0.2s",
            }}
          >
            <UserPlus size={15} /> Create Account
          </button>
        </div>

        {/* Error / Success Notifications */}
        {error && (
          <div
            style={{
              padding: "10px 14px",
              marginBottom: "16px",
              background: "rgba(220, 38, 38, 0.1)",
              border: "1px solid rgba(220, 38, 38, 0.3)",
              color: "#ef4444",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div
            style={{
              padding: "10px 14px",
              marginBottom: "16px",
              background: "rgba(101, 116, 91, 0.15)",
              border: "1px solid var(--green)",
              color: "var(--green)",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <div style={{ marginBottom: "14px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--text)",
                  marginBottom: "6px",
                }}
              >
                Full Name
              </label>
              <div style={{ position: "relative" }}>
                <UserIcon
                  size={16}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-soft)",
                  }}
                />
                <input
                  type="text"
                  placeholder="e.g. Narmathan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 38px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ marginBottom: "14px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text)",
                marginBottom: "6px",
              }}
            >
              Email Address
            </label>
            <div style={{ position: "relative" }}>
              <Mail
                size={16}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-soft)",
                }}
              />
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 38px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text)",
                marginBottom: "6px",
              }}
            >
              Password
            </label>
            <div style={{ position: "relative" }}>
              <Lock
                size={16}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-soft)",
                }}
              />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 38px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="primary-button"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        {/* Demo User Fast Track */}
        <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="outline-button"
            style={{
              width: "100%",
              padding: "9px",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            ⚡ Quick Demo Sign In (Narmathan / Local Project)
          </button>
        </div>
      </div>
    </div>
  );
}
