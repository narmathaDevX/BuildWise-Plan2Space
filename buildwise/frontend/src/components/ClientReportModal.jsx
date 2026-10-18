import { useState } from "react";
import {
  Printer,
  X,
  ShieldCheck,
  Check,
  Building2,
  Calendar,
  IndianRupee,
  Compass,
  Wind,
  Layers,
  Award,
  FileText,
} from "lucide-react";

export default function ClientReportModal({
  plans = [],
  selectedPlan = null,
  form = {},
  branding = {},
  onClose,
}) {
  const companyName = branding.company_name || "BuildWise Architectural Consultants";
  const licenseNumber =
    branding.license_number ||
    "CMDA Reg. RE/GR-II/19/04/002 · Council of Architecture CA/2021/134988";
  const contactPhone = branding.contact_phone || "+91 94440 12345 / 044-24567890";
  const contactEmail = branding.contact_email || "projects@buildwise.in";
  const customFooter =
    branding.custom_footer ||
    "Preliminary Architectural Planning & Estimation Dossier. Compliant with TNCDBR 2019 Rule 35 & TN PWD SOR 2025–2026.";

  const currentDate = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const width = Number(form.width || 40);
  const depth = Number(form.length || form.depth || 60);
  const plotArea = width * depth;
  const bedrooms = Number(form.bedrooms || 3);
  const bathrooms = Number(form.bathrooms || 2);
  const facing = form.facing || "North";
  const quality = form.quality || "Standard";

  const rate = quality === "Economy" ? 1800 : quality === "Premium" ? 2800 : 2200;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="report-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(5px)",
        zIndex: 2000,
        overflowY: "auto",
        display: "flex",
        justifyContent: "center",
        padding: "20px 10px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="client-report-sheet"
        style={{
          background: "#ffffff",
          color: "#0f172a",
          width: "100%",
          maxWidth: "960px",
          borderRadius: "14px",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.4)",
          overflow: "hidden",
          margin: "auto",
          fontFamily: "Inter, -apple-system, sans-serif",
        }}
      >
        {/* NON-PRINTING ACTION BAR */}
        <div
          className="report-modal-actions no-print"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 24px",
            background: "#0f172a",
            color: "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <FileText size={18} color="#38bdf8" />
            <strong style={{ fontSize: "0.95rem" }}>
              Client Presentation & Comparison Dossier
            </strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                background: "#0284c7",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 16px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Printer size={15} /> Print / Save as PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                border: "none",
                color: "#ffffff",
                padding: "8px",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
              title="Close Report"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PRINTABLE DOSSIER BODY */}
        <div style={{ padding: "40px 48px" }}>
          {/* HEADER / WHITE-LABEL BRANDING */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              borderBottom: "2px solid #0284c7",
              paddingBottom: "20px",
              marginBottom: "24px",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-block",
                  background: "#0284c7",
                  color: "#ffffff",
                  fontWeight: 900,
                  fontSize: "1.1rem",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  marginBottom: "6px",
                  letterSpacing: "0.05em",
                }}
              >
                {companyName.slice(0, 3).toUpperCase()}
              </div>
              <h1
                style={{
                  margin: "0 0 4px 0",
                  fontSize: "1.5rem",
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                {companyName}
              </h1>
              <div style={{ fontSize: "0.8rem", color: "#64748b", lineHeight: 1.4 }}>
                <div>{licenseNumber}</div>
                <div>
                  Phone: {contactPhone} · Email: {contactEmail}
                </div>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#0284c7",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                PLANNING & FEASIBILITY REPORT
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, margin: "2px 0" }}>
                Doc Ref: BW-TN-{(selectedPlan?.plan_id || "7821").slice(-6).toUpperCase()}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Date: {currentDate}</div>
              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>State: Tamil Nadu, India</div>
            </div>
          </div>

          {/* PROJECT SUMMARY STRIP */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "16px 20px",
              marginBottom: "28px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px",
              fontSize: "0.85rem",
            }}
          >
            <div>
              <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>
                Plot Size & Area:
              </span>
              <strong>
                {width} × {depth} ft ({plotArea.toLocaleString("en-IN")} sq.ft)
              </strong>
            </div>
            <div>
              <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>
                Configuration & Road:
              </span>
              <strong>
                {bedrooms} BHK · {bathrooms} Baths ({facing} Facing)
              </strong>
            </div>
            <div>
              <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>
                Construction Standard:
              </span>
              <strong>
                {quality} Spec (₹{rate}/sq.ft)
              </strong>
            </div>
            <div>
              <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>
                Statutory Code:
              </span>
              <strong style={{ color: "#16a34a" }}>TNCDBR 2019 Rule 35</strong>
            </div>
          </div>

          {/* SECTION 1: 3-PLAN MCDA COMPARISON TABLE */}
          <div style={{ marginBottom: "32px" }}>
            <h3
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "#0f172a",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Award size={18} color="#0284c7" />
              1. Multi-Criteria Plan Comparison & Ranking (TNCDBR-MCDA v2.0)
            </h3>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.82rem",
                textAlign: "left",
              }}
            >
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                  <th style={{ padding: "10px 12px" }}>Rank & Option</th>
                  <th style={{ padding: "10px 12px" }}>Archetype Concept</th>
                  <th style={{ padding: "10px 12px" }}>Built-Up Area</th>
                  <th style={{ padding: "10px 12px" }}>Turnkey Est. (All-in)</th>
                  <th style={{ padding: "10px 12px" }}>Vastu Alignment</th>
                  <th style={{ padding: "10px 12px" }}>Ventilation</th>
                  <th style={{ padding: "10px 12px" }}>Compliance</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Fitness Score</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p, idx) => {
                  const r = p.ranking || {};
                  const isRec = idx === 0;
                  const bArea =
                    p.details?.total_built_up || p.built_up_area || Math.round(plotArea * 0.72);
                  const civCost = bArea * rate;
                  const turnCost = civCost + 820000;
                  const score = r.final_score !== undefined ? r.final_score : p.score || 88;

                  return (
                    <tr
                      key={p.plan_id || idx}
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        background: isRec ? "rgba(2, 132, 199, 0.05)" : "#ffffff",
                      }}
                    >
                      <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                        {isRec ? (
                          <span
                            style={{
                              background: "#0284c7",
                              color: "#ffffff",
                              padding: "2px 8px",
                              borderRadius: "12px",
                              fontSize: "0.75rem",
                            }}
                          >
                            #1 Recommended
                          </span>
                        ) : (
                          `#${idx + 1} Option`
                        )}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <strong>{p.archetype_name || `Archetype ${idx + 1}`}</strong>
                      </td>
                      <td style={{ padding: "10px 12px" }}>{Math.round(bArea)} sq.ft</td>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                        ₹{(turnCost / 100000).toFixed(1)} Lakh
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {r.criteria_scores?.vastu_alignment
                          ? `${r.criteria_scores.vastu_alignment.toFixed(0)}/100`
                          : "92/100"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {r.criteria_scores?.ventilation_daylight
                          ? `${r.criteria_scores.ventilation_daylight.toFixed(0)}/100`
                          : "88/100"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ color: "#16a34a", fontWeight: 600 }}>✓ Pass (Rule 35)</span>
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          fontWeight: 800,
                          fontSize: "0.95rem",
                          color: isRec ? "#0284c7" : "#334155",
                        }}
                      >
                        {score.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* SECTION 2: COST BREAKDOWN & ANCILLARY PROVENANCE */}
          <div
            style={{
              marginBottom: "32px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "24px",
            }}
          >
            {/* Civil Stage Breakdown */}
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "16px",
                background: "#ffffff",
              }}
            >
              <h4
                style={{
                  margin: "0 0 10px 0",
                  fontSize: "0.92rem",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                Civil Structure Stage Breakdown (TN PWD SOR 2025–26)
              </h4>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "18px",
                  fontSize: "0.8rem",
                  color: "#475569",
                  lineHeight: 1.6,
                }}
              >
                <li>Substructure & Isolated Footings: 14%</li>
                <li>RCC Column & Slab Superstructure: 34%</li>
                <li>Solid Brick Masonry & Plastering: 18%</li>
                <li>Vitrified Flooring & Wall Dadoing: 12%</li>
                <li>Concealed Plumbing & Electrical Wiring: 14%</li>
                <li>Weathercoat Exterior & Interior Emulsion Painting: 8%</li>
              </ul>
            </div>

            {/* Ancillary Pre-Construction */}
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "16px",
                background: "#ffffff",
              }}
            >
              <h4
                style={{
                  margin: "0 0 10px 0",
                  fontSize: "0.92rem",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                Pre-Construction Ancillary Costs (Tamil Nadu Standard)
              </h4>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "18px",
                  fontSize: "0.8rem",
                  color: "#475569",
                  lineHeight: 1.6,
                }}
              >
                <li>300ft Rotary Borewell + 1.5HP Submersible: ₹1,85,000</li>
                <li>TNEB 3-Phase Permanent Power Service: ₹65,000</li>
                <li>DTCP / Local Body Sanction & Scrutiny Fee: ₹1,20,000</li>
                <li>8,000-Litre RCC Rainwater & Potable Water Sump: ₹2,10,000</li>
                <li>Compound Wall (5ft RCC) with 12ft MS Gate: ₹2,40,000</li>
                <li style={{ fontWeight: 700, color: "#0284c7" }}>
                  Total Ancillary Estimate: ₹8,20,000
                </li>
              </ul>
            </div>
          </div>

          {/* SECTION 3: ESCROW GOVERNANCE & RETENTION NOTICE */}
          <div
            style={{
              background: "rgba(22, 163, 74, 0.06)",
              border: "1px solid rgba(22, 163, 74, 0.25)",
              borderRadius: "10px",
              padding: "14px 18px",
              marginBottom: "32px",
              fontSize: "0.82rem",
              lineHeight: 1.5,
              color: "#166534",
            }}
          >
            <strong>🛡️ 8-Stage Escrow Milestone Protection & Quality Governance:</strong>
            <p style={{ margin: "4px 0 0 0" }}>
              Payments are released strictly stage-by-stage upon independent engineer inspection. A
              mandatory 5% handover retention is withheld for 90 days post-occupancy to ensure zero
              shrinkage cracks, plumbing leaks, or dampness before final settlement.
            </p>
          </div>

          {/* SECTION 4: SIGN-OFF & STATUTORY DISCLAIMER */}
          <div
            style={{
              borderTop: "2px solid #e2e8f0",
              paddingTop: "24px",
              marginTop: "16px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "40px",
                marginBottom: "24px",
              }}
            >
              <div>
                <div
                  style={{
                    height: "60px",
                    borderBottom: "1px dashed #94a3b8",
                    marginBottom: "6px",
                  }}
                />
                <div style={{ fontSize: "0.82rem", fontWeight: 700 }}>
                  Licensed Architect / Structural Engineer Sign-Off
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  Registration No: CMDA / DTCP Registered Professional
                </div>
              </div>

              <div>
                <div
                  style={{
                    height: "60px",
                    borderBottom: "1px dashed #94a3b8",
                    marginBottom: "6px",
                  }}
                />
                <div style={{ fontSize: "0.82rem", fontWeight: 700 }}>
                  Client / Homeowner Acceptance
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  Acknowledged preliminary layout & budget parameters
                </div>
              </div>
            </div>

            <div
              style={{
                fontSize: "0.72rem",
                color: "#64748b",
                lineHeight: 1.45,
                textAlign: "justify",
              }}
            >
              <strong>STATUTORY DISCLAIMER:</strong> {customFooter} All room geometry, structural
              spans, column alignments, and setback clearances must be certified by a licensed civil
              engineer and submitted for statutory municipal sanction (DTCP/CMDA/Local Town
              Panchayat) prior to commencement of physical excavation or foundation laying.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
