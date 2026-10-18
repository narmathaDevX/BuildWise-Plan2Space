import { useState, useRef } from "react";
import {
  Wand2,
  Sparkles,
  Mic,
  MicOff,
  Send,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Undo2,
  Sliders,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useSpeech } from "../hooks/useSpeech";
import { modifyPlanWithAI } from "../services/api";

const QUICK_SUGGESTIONS = [
  { label: "✨ Add Pooja Room", text: "Add a dedicated pooja room in the north-east" },
  { label: "🏡 Make G+1 Duplex", text: "Make it a 2-storey G+1 duplex home" },
  { label: "🚗 Add Car Parking", text: "Add a covered car parking porch" },
  { label: "🌅 Add Front Balcony", text: "Add a front balcony on the first floor" },
  { label: "🛏️ Add 1 More Bedroom", text: "Add one more bedroom" },
  { label: "🍳 Add Utility Wash", text: "Add a rear kitchen utility wash area" },
  { label: "🧭 Face East", text: "Change facing to East" },
  { label: "💎 Luxury Specs", text: "Upgrade specifications to Luxury" },
];

export default function AIPlanModifier({
  currentForm,
  currentPlan,
  onPlanUpdated,
  onUndo,
  canUndo = false,
}) {
  const [instruction, setInstruction] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [lastRevision, setLastRevision] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const {
    startListening,
    stopListening,
    isListening,
    micSupported,
  } = useSpeech({ defaultLang: "en" });

  const inputRef = useRef(null);

  const handleMicToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening(
        "en",
        (interim) => setInstruction(interim),
        (final) => setInstruction(final)
      );
    }
  };

  const handleApply = async (overrideText = null) => {
    const textToRun = (overrideText || instruction).trim();
    if (!textToRun || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await modifyPlanWithAI({
        instruction: textToRun,
        currentForm,
        currentPlan,
      });

      if (res?.status === "success" && Array.isArray(res.plans) && res.plans.length > 0) {
        setLastRevision({
          instruction: textToRun,
          explanation: res.explanation,
          changesApplied: res.changes_applied || [],
        });
        setInstruction("");
        if (onPlanUpdated) {
          onPlanUpdated(res.plans, res.updated_form, res.ranking);
        }
      } else {
        throw new Error(res?.detail || "Could not generate plans for the requested modifications.");
      }
    } catch (err) {
      console.error("Plan revision error:", err);
      setError(err?.message || "Failed to modify plan. Please try rephrasing your request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuggestionClick = (sugText) => {
    setInstruction(sugText);
    handleApply(sugText);
  };

  return (
    <section
      className="plan-card"
      style={{
        margin: "0 0 24px 0",
        border: "1px solid var(--gp-border)",
        background: "var(--gp-panel)",
        borderRadius: "13px",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "14px",
          padding: "18px 24px",
          borderBottom: isCollapsed ? "none" : "1px solid var(--gp-border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <div
            style={{
              display: "grid",
              width: "38px",
              height: "38px",
              placeItems: "center",
              borderRadius: "10px",
              background: "rgba(223, 189, 136, 0.15)",
              border: "1px solid rgba(223, 189, 136, 0.3)",
              color: "var(--gp-accent)",
              flexShrink: 0,
            }}
          >
            <Wand2 size={19} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="eyebrow" style={{ margin: 0 }}>
                INTERACTIVE AI PLAN REVISIONS
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "1px 7px",
                  borderRadius: "10px",
                  fontSize: "10px",
                  fontWeight: 700,
                  background: "var(--gp-panel-light)",
                  color: "var(--gp-accent)",
                  border: "1px solid var(--gp-border)",
                }}
              >
                <Sparkles size={10} /> Auto-Solve
              </span>
            </div>
            <h2
              style={{
                margin: "3px 0 0 0",
                fontSize: "18px",
                fontWeight: 650,
                color: "var(--gp-text)",
                letterSpacing: "-0.5px",
              }}
            >
              Suggest Changes to Gemini
            </h2>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {canUndo && (
            <button
              type="button"
              onClick={onUndo}
              className="secondary-button"
              style={{ minHeight: "34px", padding: "6px 12px", fontSize: "11px", gap: "6px" }}
              title="Undo last AI revision and revert to previous plan"
            >
              <Undo2 size={13} /> Undo Revision
            </button>
          )}

          <button
            type="button"
            className="icon-button"
            onClick={() => setIsCollapsed((v) => !v)}
            title={isCollapsed ? "Expand Revision Panel" : "Collapse Revision Panel"}
            style={{ width: "36px", height: "36px" }}
          >
            {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div style={{ padding: "20px 24px" }}>
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "var(--gp-muted)", lineHeight: 1.6 }}>
            Ask Gemini to change anything in plain language (e.g. <em>"Add a pooja room in the NE corner"</em>,{" "}
            <em>"Make it a G+1 duplex with 3 bedrooms"</em>, <em>"Add covered car parking and a balcony"</em>).
            The constraint solver will re-generate the floor plans and re-calculate all costs and statutory compliance immediately.
          </p>

          {/* INPUT FORM WITH MIC & SEND BUTTONS */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "6px 8px 6px 16px",
              borderRadius: "10px",
              background: "var(--gp-panel-light)",
              border: "1px solid var(--gp-border)",
              marginBottom: "14px",
              transition: "border-color 0.15s ease",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleApply();
                }
              }}
              placeholder="e.g. Add a pooja room, make kitchen larger, and add car parking..."
              disabled={submitting}
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                color: "var(--gp-text)",
                fontSize: "13px",
                outline: "none",
                padding: "8px 0",
              }}
            />

            {micSupported && (
              <button
                type="button"
                onClick={handleMicToggle}
                className="icon-button"
                title={isListening ? "Stop listening" : "Speak your changes"}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  border: isListening ? "1px solid #ef4444" : "1px solid var(--gp-border)",
                  color: isListening ? "#ef4444" : "var(--gp-muted)",
                  background: isListening ? "rgba(239, 68, 68, 0.1)" : "var(--gp-panel)",
                }}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            )}

            <button
              type="button"
              onClick={() => handleApply()}
              disabled={submitting || !instruction.trim()}
              className="primary-button"
              style={{
                minHeight: "36px",
                padding: "6px 16px",
                fontSize: "12px",
                borderRadius: "8px",
                gap: "7px",
              }}
            >
              {submitting ? (
                <>
                  <RotateCcw size={14} className="spin" /> Solving...
                </>
              ) : (
                <>
                  <Send size={13} /> Apply Changes
                </>
              )}
            </button>
          </div>

          {/* QUICK SUGGESTIONS CHIPS */}
          <div style={{ marginBottom: "16px" }}>
            <span
              style={{
                display: "block",
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "var(--gp-muted)",
                marginBottom: "8px",
              }}
            >
              Quick suggestions:
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {QUICK_SUGGESTIONS.map((sug, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSuggestionClick(sug.text)}
                  disabled={submitting}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "20px",
                    border: "1px solid var(--gp-border)",
                    background: "var(--gp-panel-light)",
                    color: "var(--gp-text)",
                    fontSize: "11px",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--gp-accent)";
                    e.currentTarget.style.color = "var(--gp-accent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--gp-border)";
                    e.currentTarget.style.color = "var(--gp-text)";
                  }}
                >
                  {sug.label}
                </button>
              ))}
            </div>
          </div>

          {/* ERROR ALERT */}
          {error && (
            <div className="inline-alert" style={{ margin: "0 0 16px 0" }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* LAST REVISION SUCCESS FEEDBACK */}
          {lastRevision && (
            <div
              style={{
                padding: "14px 18px",
                borderRadius: "10px",
                background: "rgba(34, 197, 94, 0.08)",
                border: "1px solid rgba(34, 197, 94, 0.25)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <CheckCircle2 size={16} color="#16a34a" />
                <strong style={{ fontSize: "12px", color: "#16a34a" }}>
                  Revision Successfully Applied:
                </strong>
                {canUndo && (
                  <button
                    type="button"
                    onClick={onUndo}
                    style={{
                      marginLeft: "auto",
                      border: "none",
                      background: "transparent",
                      color: "#16a34a",
                      fontSize: "11px",
                      fontWeight: 700,
                      textDecoration: "underline",
                      cursor: "pointer",
                    }}
                  >
                    Undo and revert
                  </button>
                )}
              </div>
              <p style={{ margin: "0 0 6px 0", fontSize: "12.5px", color: "var(--gp-text)", lineHeight: 1.5 }}>
                {lastRevision.explanation}
              </p>
              {lastRevision.changesApplied?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                  {lastRevision.changesApplied.map((ch, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        background: "rgba(34, 197, 94, 0.15)",
                        color: "#16a34a",
                        fontWeight: 600,
                      }}
                    >
                      ✓ {ch}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
