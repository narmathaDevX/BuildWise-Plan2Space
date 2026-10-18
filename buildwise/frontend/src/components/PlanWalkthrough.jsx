import { useEffect, useState, useCallback } from "react";
import {
  Compass,
  Volume2,
  VolumeX,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ArrowRight,
  Footprints,
  Eye,
  Layers,
} from "lucide-react";
import { useSpeech } from "../hooks/useSpeech";
import { getPlanWalkthrough } from "../services/api";

export default function PlanWalkthrough({ plan, form, planId = "active" }) {
  const [language, setLanguage] = useState("en"); // "en" | "ta"
  const [walkthrough, setWalkthrough] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    speak,
    pauseSpeech,
    resumeSpeech,
    stopSpeech,
    changeSpeed,
    isSpeaking,
    isPaused,
    speechRate,
  } = useSpeech({ defaultLang: language });

  const fetchWalkthrough = useCallback(
    async (lang = language) => {
      if (!plan) return;
      setLoading(true);
      setError(null);
      try {
        const res = await getPlanWalkthrough({
          planId: plan?.id || plan?.plan_id || planId,
          language: lang,
          planData: plan,
          formData: form,
        });
        setWalkthrough(res?.walkthrough || null);
      } catch (err) {
        console.warn("Failed to load walkthrough:", err);
        setError("Unable to generate spatial walkthrough. Please retry.");
      } finally {
        setLoading(false);
      }
    },
    [plan, form, planId, language]
  );

  useEffect(() => {
    fetchWalkthrough(language);
    return () => {
      stopSpeech();
    };
  }, [plan?.id, plan?.plan_id, language]);

  const handleLanguageChange = (newLang) => {
    if (newLang === language) return;
    stopSpeech();
    setLanguage(newLang);
    fetchWalkthrough(newLang);
  };

  const handleListenClick = () => {
    if (isSpeaking) {
      if (isPaused) {
        resumeSpeech();
      } else {
        pauseSpeech();
      }
    } else {
      const script = walkthrough?.spoken_script || walkthrough?.overview || "";
      speak(script, language);
    }
  };

  const handleCopy = () => {
    const text = walkthrough?.spoken_script || walkthrough?.overview || "";
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = walkthrough?.walkthrough_steps || [];

  return (
    <section
      className="plan-card walkthrough-card"
      style={{
        margin: "0 0 24px 0",
        border: "1px solid var(--gp-border)",
        background: "var(--gp-panel)",
        borderRadius: "13px",
        overflow: "hidden",
        transition: "border-color 0.2s ease",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "14px",
          padding: "20px 24px",
          borderBottom: isCollapsed ? "none" : "1px solid var(--gp-border)",
          background: "var(--gp-panel)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <div
            style={{
              display: "grid",
              width: "40px",
              height: "40px",
              placeItems: "center",
              borderRadius: "10px",
              background: "var(--gp-panel-light)",
              border: "1px solid var(--gp-border)",
              color: "var(--gp-accent)",
              flexShrink: 0,
            }}
          >
            <Footprints size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span className="eyebrow" style={{ margin: 0 }}>
                SPATIAL CIRCULATION & FLOW
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                  background: "rgba(223, 189, 136, 0.15)",
                  color: "var(--gp-accent)",
                  border: "1px solid rgba(223, 189, 136, 0.3)",
                }}
              >
                <Sparkles size={11} /> Gemini AI
              </span>
            </div>
            <h2
              style={{
                margin: "4px 0 0 0",
                fontSize: "19px",
                fontWeight: 650,
                color: "var(--gp-text)",
                letterSpacing: "-0.5px",
              }}
            >
              Architectural Room-to-Room Walkthrough
            </h2>
          </div>
        </div>

        {/* CONTROLS: LANGUAGE & COLLAPSE */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <div
            style={{
              display: "inline-flex",
              borderRadius: "8px",
              border: "1px solid var(--gp-border)",
              background: "var(--gp-panel-light)",
              padding: "2px",
            }}
          >
            <button
              type="button"
              onClick={() => handleLanguageChange("en")}
              style={{
                border: "none",
                background: language === "en" ? "var(--gp-panel)" : "transparent",
                color: language === "en" ? "var(--gp-accent)" : "var(--gp-muted)",
                fontWeight: language === "en" ? 700 : 500,
                padding: "5px 11px",
                borderRadius: "6px",
                fontSize: "11px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange("ta")}
              style={{
                border: "none",
                background: language === "ta" ? "var(--gp-panel)" : "transparent",
                color: language === "ta" ? "var(--gp-accent)" : "var(--gp-muted)",
                fontWeight: language === "ta" ? 700 : 500,
                padding: "5px 11px",
                borderRadius: "6px",
                fontSize: "11px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              தமிழ்
            </button>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={() => setIsCollapsed((v) => !v)}
            title={isCollapsed ? "Expand Walkthrough" : "Collapse Walkthrough"}
            style={{ width: "36px", height: "36px" }}
          >
            {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div style={{ padding: "20px 24px" }}>
          {/* AUDIO PLAYER & CONTROLS TOOLBAR */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
              padding: "12px 18px",
              borderRadius: "10px",
              background: "var(--gp-panel-light)",
              border: "1px solid var(--gp-border)",
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleListenClick}
                disabled={loading || !walkthrough}
                className="primary-button"
                style={{
                  minHeight: "36px",
                  padding: "6px 16px",
                  fontSize: "12px",
                  borderRadius: "8px",
                  gap: "7px",
                }}
              >
                {isSpeaking ? (
                  isPaused ? (
                    <>
                      <Play size={14} /> Resume Voice
                    </>
                  ) : (
                    <>
                      <Pause size={14} /> Pause Voice
                    </>
                  )
                ) : (
                  <>
                    <Volume2 size={15} /> 🔊 Listen to Walkthrough
                  </>
                )}
              </button>

              {isSpeaking && (
                <button
                  type="button"
                  onClick={stopSpeech}
                  className="secondary-button"
                  style={{ minHeight: "36px", padding: "6px 12px", fontSize: "11px", borderRadius: "8px" }}
                  title="Stop Audio"
                >
                  <VolumeX size={14} /> Stop
                </button>
              )}

              {/* Speed Controller */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  padding: "2px 4px",
                  borderRadius: "6px",
                  border: "1px solid var(--gp-border)",
                  background: "var(--gp-panel)",
                }}
              >
                <span style={{ fontSize: "10px", color: "var(--gp-muted)", padding: "0 4px" }}>Speed:</span>
                {[0.8, 1.0, 1.2].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => changeSpeed(spd)}
                    style={{
                      border: "none",
                      background: speechRate === spd ? "var(--gp-accent)" : "transparent",
                      color: speechRate === spd ? "#ffffff" : "var(--gp-text)",
                      padding: "2px 7px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              {isSpeaking && (
                <div style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "6px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: "6px",
                      height: "16px",
                      borderRadius: "2px",
                      background: "var(--gp-accent)",
                      animation: "spin 1s infinite alternate",
                    }}
                  />
                  <span
                    style={{
                      display: "inline-block",
                      width: "6px",
                      height: "22px",
                      borderRadius: "2px",
                      background: "var(--gp-accent)",
                      animation: "spin 0.8s infinite alternate",
                    }}
                  />
                  <span
                    style={{
                      display: "inline-block",
                      width: "6px",
                      height: "14px",
                      borderRadius: "2px",
                      background: "var(--gp-accent)",
                      animation: "spin 1.2s infinite alternate",
                    }}
                  />
                  <span style={{ fontSize: "11px", color: "var(--gp-accent)", fontWeight: 600, marginLeft: "4px" }}>
                    Speaking flow...
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={handleCopy}
                className="secondary-button"
                style={{ minHeight: "34px", padding: "5px 12px", fontSize: "11px", gap: "6px" }}
                title="Copy walkthrough text"
              >
                {copied ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                {copied ? "Copied" : "Copy"}
              </button>

              <button
                type="button"
                onClick={() => fetchWalkthrough(language)}
                disabled={loading}
                className="secondary-button"
                style={{ minHeight: "34px", padding: "5px 12px", fontSize: "11px", gap: "6px" }}
                title="Regenerate walkthrough analysis"
              >
                <RotateCcw size={13} className={loading ? "spin" : ""} />
                {loading ? "Analyzing..." : "Refresh"}
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--gp-muted)" }}>
              <RotateCcw size={24} className="spin" style={{ margin: "0 auto 12px auto", display: "block", color: "var(--gp-accent)" }} />
              <strong style={{ display: "block", color: "var(--gp-text)", fontSize: "14px", marginBottom: "4px" }}>
                Analyzing Spatial Circulation with Gemini...
              </strong>
              <span style={{ fontSize: "12px" }}>
                Tracing room transitions, verandahs, balcony linkages, and vertical stairways.
              </span>
            </div>
          ) : error ? (
            <div className="inline-alert" style={{ margin: "0 0 16px 0" }}>
              {error}
            </div>
          ) : walkthrough ? (
            <>
              {/* HEADLINE & OVERVIEW */}
              <div style={{ marginBottom: "20px" }}>
                <h3
                  style={{
                    margin: "0 0 6px 0",
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "var(--gp-text)",
                  }}
                >
                  {walkthrough.headline}
                </h3>
                <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.6, color: "var(--gp-muted)" }}>
                  {walkthrough.overview}
                </p>
              </div>

              {/* SEQUENTIAL FLOW BREADCRUMBS / PATHWAY */}
              <div style={{ marginBottom: "24px" }}>
                <span
                  style={{
                    display: "block",
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "1.5px",
                    color: "var(--gp-muted)",
                    marginBottom: "10px",
                  }}
                >
                  ROOM-TO-ROOM TRANSITION PATHWAY:
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    overflowX: "auto",
                    paddingBottom: "8px",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  {steps.map((st, idx) => {
                    const isCurrent = activeStep === idx;
                    return (
                      <div key={st.step || idx} style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => setActiveStep(idx)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 12px",
                            borderRadius: "20px",
                            border: isCurrent ? "1px solid var(--gp-accent)" : "1px solid var(--gp-border)",
                            background: isCurrent ? "rgba(223, 189, 136, 0.15)" : "var(--gp-panel-light)",
                            color: isCurrent ? "var(--gp-accent)" : "var(--gp-text)",
                            fontWeight: isCurrent ? 700 : 500,
                            fontSize: "11px",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-grid",
                              width: "18px",
                              height: "18px",
                              placeItems: "center",
                              borderRadius: "50%",
                              background: isCurrent ? "var(--gp-accent)" : "var(--gp-border)",
                              color: isCurrent ? "#ffffff" : "var(--gp-text)",
                              fontSize: "10px",
                              fontWeight: 700,
                            }}
                          >
                            {st.step || idx + 1}
                          </span>
                          <span>{st.zone}</span>
                        </button>
                        {idx < steps.length - 1 && (
                          <ArrowRight size={13} color="var(--gp-muted)" style={{ flexShrink: 0 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* STEP CARDS */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "12px",
                  marginBottom: "20px",
                }}
              >
                {steps.map((st, idx) => {
                  const isCurrent = activeStep === idx;
                  return (
                    <div
                      key={st.step || idx}
                      onClick={() => setActiveStep(idx)}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "10px",
                        border: isCurrent ? "1px solid var(--gp-accent)" : "1px solid var(--gp-border)",
                        background: isCurrent ? "rgba(223, 189, 136, 0.08)" : "var(--gp-panel-light)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "8px",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-grid",
                            width: "22px",
                            height: "22px",
                            placeItems: "center",
                            borderRadius: "6px",
                            background: isCurrent ? "var(--gp-accent)" : "var(--gp-border)",
                            color: isCurrent ? "#ffffff" : "var(--gp-text)",
                            fontSize: "11px",
                            fontWeight: 700,
                          }}
                        >
                          {st.step || idx + 1}
                        </span>
                        <strong style={{ fontSize: "13px", color: "var(--gp-text)" }}>{st.zone}</strong>
                      </div>
                      <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.6, color: "var(--gp-muted)" }}>
                        {st.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* SPOKEN SCRIPT TRANSCRIPT */}
              <div
                style={{
                  padding: "14px 18px",
                  borderRadius: "10px",
                  background: "var(--gp-panel-light)",
                  border: "1px solid var(--gp-border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <Volume2 size={13} color="var(--gp-accent)" />
                  <strong style={{ fontSize: "11px", color: "var(--gp-accent)", letterSpacing: "1px", textTransform: "uppercase" }}>
                    Voice Narrative Script:
                  </strong>
                </div>
                <p style={{ margin: 0, fontSize: "12.5px", lineHeight: 1.65, color: "var(--gp-text)" }}>
                  "{walkthrough.spoken_script}"
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: "14px",
                  fontSize: "10px",
                  color: "var(--gp-muted)",
                }}
              >
                <span>
                  Source: {walkthrough.source === "gemini" ? "Gemini 3.1 Flash Spatial Circulation" : "BuildWise Deterministic Spatial Rule Engine"}
                </span>
                <span>Ground & Upper Floor Spatial Linkages</span>
              </div>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
