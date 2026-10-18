import { useState, useEffect } from "react";
import { Building2, Check, X, Shield, Phone, Mail, FileText } from "lucide-react";
import { getBranding, updateBranding } from "../services/api";

export default function BrandingModal({ onClose, onBrandingUpdated }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [customFooter, setCustomFooter] = useState("");

  useEffect(() => {
    let active = true;
    getBranding()
      .then((res) => {
        if (!active || !res?.branding) return;
        const b = res.branding;
        setCompanyName(b.company_name || "");
        setLicenseNumber(b.license_number || "");
        setContactPhone(b.contact_phone || "");
        setContactEmail(b.contact_email || "");
        setCustomFooter(b.custom_footer || "");
      })
      .catch((err) => {
        console.warn("Failed to fetch branding:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    const payload = {
      company_name: companyName,
      license_number: licenseNumber,
      contact_phone: contactPhone,
      contact_email: contactEmail,
      custom_footer: customFooter,
    };

    try {
      const res = await updateBranding(payload);
      setSavedSuccess(true);
      if (onBrandingUpdated) {
        onBrandingUpdated(res.branding || payload);
      }
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      alert("Failed to save branding: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
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
          maxWidth: "520px",
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
                background: "rgba(99, 102, 241, 0.12)",
                color: "#6366f1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Building2 size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                White-Label Contractor & Architect Branding
              </h3>
              <small style={{ color: "var(--text-muted, #64748b)", fontSize: "0.8rem" }}>
                Add your business credentials to client PDFs and exports
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
            Loading branding settings...
          </div>
        ) : (
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
                Company / Firm Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Sree Murugan Builders & Architects"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, #cbd5e1)",
                  background: "var(--card-bg, #ffffff)",
                  color: "inherit",
                  fontSize: "0.88rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
                Registration / Council of Architecture License
              </label>
              <input
                type="text"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="e.g. CMDA Reg: RE/GR-II/19/04/002 · COA: CA/2021/134988"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, #cbd5e1)",
                  background: "var(--card-bg, #ffffff)",
                  color: "inherit",
                  fontSize: "0.88rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
                  Phone / WhatsApp
                </label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+91 94440 12345"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color, #cbd5e1)",
                    background: "var(--card-bg, #ffffff)",
                    color: "inherit",
                    fontSize: "0.88rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contact@builder.in"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color, #cbd5e1)",
                    background: "var(--card-bg, #ffffff)",
                    color: "inherit",
                    fontSize: "0.88rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
                Custom Footer Notice / Terms
              </label>
              <textarea
                value={customFooter}
                onChange={(e) => setCustomFooter(e.target.value)}
                rows={2}
                placeholder="e.g. Turnkey estimation valid for 30 days based on TN PWD Schedule of Rates 2025-26."
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, #cbd5e1)",
                  background: "var(--card-bg, #ffffff)",
                  color: "inherit",
                  fontSize: "0.85rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={saving}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                {savedSuccess ? <Check size={16} /> : null}
                <span>{saving ? "Saving..." : savedSuccess ? "Saved!" : "Save Branding"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
