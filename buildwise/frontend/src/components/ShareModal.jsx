import { useState, useEffect } from "react";
import { Share2, Copy, Check, X, ExternalLink, ShieldCheck, Clock } from "lucide-react";
import { createShareLink } from "../services/api";

export default function ShareModal({ planId = null, onClose }) {
  const [loading, setLoading] = useState(true);
  const [shareData, setShareData] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    createShareLink(planId)
      .then((res) => {
        if (!active) return;
        setShareData(res);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Failed to generate shareable link.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [planId]);

  const fullShareUrl = shareData?.share_token
    ? `${window.location.origin}/?share=${shareData.share_token}`
    : "";

  const handleCopy = () => {
    if (!fullShareUrl) return;
    navigator.clipboard.writeText(fullShareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--card-bg, #ffffff)",
          color: "var(--text-color, #0f172a)",
          border: "1px solid var(--border-color, #e2e8f0)",
          borderRadius: "16px",
          padding: "24px",
          maxWidth: "480px",
          width: "100%",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.25)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "rgba(2, 132, 199, 0.12)",
                color: "#0284c7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Share2 size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                Shareable Client Link
              </h3>
              <small style={{ color: "var(--text-muted, #64748b)", fontSize: "0.8rem" }}>
                Send a secure, read-only link to clients or family
              </small>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted, #64748b)",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "30px 0", textAlign: "center", color: "var(--text-muted, #64748b)" }}>
            Generating unique link...
          </div>
        ) : error ? (
          <div
            style={{
              padding: "12px",
              borderRadius: "8px",
              background: "rgba(239, 68, 68, 0.1)",
              color: "#dc2626",
              fontSize: "0.85rem",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        ) : (
          <div>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-color, #334155)",
                lineHeight: 1.5,
                margin: "0 0 16px 0",
              }}
            >
              Anyone with this link can view the generated blueprints, dimensions, cost estimates, and
              ranking without needing a password.
            </p>

            <div
              style={{
                display: "flex",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              <input
                type="text"
                readOnly
                value={fullShareUrl}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, #cbd5e1)",
                  background: "var(--surface-color, #f8fafc)",
                  color: "inherit",
                  fontSize: "0.82rem",
                }}
              />
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  background: copied ? "#16a34a" : "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 16px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "background 0.15s ease",
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? "Copied!" : "Copy"}</span>
              </button>
            </div>

            <div
              style={{
                background: "var(--surface-color, #f8fafc)",
                border: "1px solid var(--border-color, #e2e8f0)",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "0.78rem",
                color: "var(--text-muted, #64748b)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Clock size={14} color="#0284c7" />
              <span>Link is active for 30 days. Read-only permissions enforced.</span>
            </div>
          </div>
        )}

        <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            style={{ padding: "8px 18px", fontSize: "0.85rem" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
