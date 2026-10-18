import { useState, useEffect } from "react";
import {
  Trophy,
  Award,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Volume2,
  VolumeX,
  Check,
  Info,
  ShieldCheck,
  Scale,
  Compass,
  Wind,
  Layers,
  Building,
  Wrench,
} from "lucide-react";
import { rankPlans, explainPlanRanking, selectCurrentProjectPlan } from "../services/api";
import { useSpeech } from "../hooks/useSpeech";

const CRITERIA_ICONS = {
  budget_fit: Scale,
  vastu_alignment: Compass,
  ventilation_daylight: Wind,
  space_efficiency: Layers,
  room_proportions: Building,
  regulatory_margin: ShieldCheck,
  buildability_plumbing: Wrench,
};

const PRESETS = [
  { id: "Balanced", label: "Balanced", desc: "Default optimal mix of budget, Vastu, and ventilation" },
  { id: "Budget-First", label: "Budget-First", desc: "40% weight on total turnkey expenditure & cash-flow" },
  { id: "Vastu-First", label: "Vastu-First", desc: "35% weight on Agni kitchen, Niruthi master & Ishanya pooja" },
  { id: "Comfort-First", label: "Comfort-First", desc: "Maximum weight on cross-ventilation, daylight & room sizing" },
];

export default function PlanRanking({
  plans = [],
  selectedIndex = 0,
  onSelectIndex,
  form = {},
  onPlanSelectedConfirm,
}) {
  const [preset, setPreset] = useState("Balanced");
  const [rankedPlans, setRankedPlans] = useState([]);
  const [loadingRank, setLoadingRank] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showFormulas, setShowFormulas] = useState(false);

  // AI Explanation State
  const [explaining, setExplaining] = useState(false);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [explainLanguage, setExplainLanguage] = useState("en");

  const { speak, stopSpeech, isSpeaking } = useSpeech();

  // Re-rank whenever plans, form or preset changes
  useEffect(() => {
    if (!plans || plans.length === 0) return;

    let active = true;
    setLoadingRank(true);

    rankPlans({ plans, form, preset })
      .then((res) => {
        if (!active) return;
        if (res?.ranked_plans && res.ranked_plans.length > 0) {
          setRankedPlans(res.ranked_plans);
        } else {
          setRankedPlans(plans);
        }
      })
      .catch((err) => {
        console.warn("Rank plans error:", err);
        if (active) setRankedPlans(plans);
      })
      .finally(() => {
        if (active) setLoadingRank(false);
      });

    return () => {
      active = false;
    };
  }, [plans, form, preset]);

  const activePlanList = rankedPlans.length > 0 ? rankedPlans : plans;

  const handleExplainWithAi = async () => {
    setExplaining(true);
    setAiExplanation(null);
    try {
      const res = await explainPlanRanking({
        plans: activePlanList,
        form,
        language: explainLanguage,
      });
      setAiExplanation(res);
    } catch (err) {
      console.error("AI explanation error:", err);
      setAiExplanation({
        explanation: "Unable to generate live AI explanation. Standard tradeoff comparison is shown above.",
        spoken_script: "Plan ranking comparison is available in the podium cards.",
      });
    } finally {
      setExplaining(false);
    }
  };

  const handleConfirmSelection = async (plan) => {
    if (!plan?.plan_id) return;
    try {
      await selectCurrentProjectPlan(plan.plan_id);
      window.dispatchEvent(new CustomEvent("buildwise:project-updated"));
      if (onPlanSelectedConfirm) onPlanSelectedConfirm(plan);
    } catch (err) {
      console.error("Failed to select plan:", err);
    }
  };

  if (!plans || plans.length === 0) return null;

  return (
    <section
      className="plan-ranking-section"
      style={{
        marginTop: "24px",
        marginBottom: "28px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "24px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "20px",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <Trophy size={20} color="var(--accent)" />
            <span className="eyebrow" style={{ margin: 0 }}>
              TRANSPARENT ENGINEERING RANKING
            </span>
          </div>
          <h2 style={{ fontSize: "1.4rem", margin: "2px 0 6px", fontWeight: 700 }}>
            Comparative Layout Ranking
          </h2>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-soft)" }}>
            Deterministically evaluated using Weighted Multi-Criteria Decision Analysis (MCDA). Zero black-box AI bias.
          </p>
        </div>

        {/* Preset Selector */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <SlidersHorizontal size={14} color="var(--text-soft)" />
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-soft)" }}>
              RANKING PRIORITY:
            </span>
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                title={p.desc}
                style={{
                  padding: "6px 12px",
                  fontSize: "0.78rem",
                  fontWeight: preset === p.id ? 700 : 500,
                  borderRadius: "6px",
                  border: "1px solid",
                  borderColor: preset === p.id ? "var(--accent)" : "var(--border)",
                  background: preset === p.id ? "rgba(180, 83, 9, 0.12)" : "var(--surface-2, transparent)",
                  color: preset === p.id ? "var(--accent)" : "var(--text)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Podium Cards Grid (Rank 1, 2, 3) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        {activePlanList.map((plan, idx) => {
          const rankMeta = plan.ranking || {};
          const rank = rankMeta.rank || idx + 1;
          const isRank1 = rank === 1;
          const isSelected = selectedIndex === idx;
          const fitnessScore = rankMeta.final_score || plan.score || 85.0;
          const totalCostLakhs = rankMeta.total_cost
            ? (rankMeta.total_cost / 100000).toFixed(2)
            : ((plan.built_up_area || 1850) * 2200 / 100000).toFixed(2);
          const builtUp = plan.built_up_area || plan.details?.built_up_area || 1850;

          return (
            <div
              key={plan.plan_id || idx}
              onClick={() => onSelectIndex && onSelectIndex(idx)}
              style={{
                borderRadius: "10px",
                border: "2px solid",
                borderColor: isRank1
                  ? "#16a34a"
                  : isSelected
                  ? "var(--accent)"
                  : "var(--border)",
                background: isSelected ? "rgba(180, 83, 9, 0.04)" : "var(--surface)",
                padding: "18px",
                cursor: "pointer",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: isRank1 ? "0 4px 16px rgba(22, 163, 74, 0.12)" : "none",
                transition: "all 0.2s ease",
              }}
            >
              <div>
                {/* Rank Badge */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "4px 9px",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      background: isRank1 ? "rgba(22, 163, 74, 0.15)" : "var(--surface-2)",
                      color: isRank1 ? "#16a34a" : "var(--text-soft)",
                      border: isRank1 ? "1px solid rgba(22, 163, 74, 0.3)" : "1px solid var(--border)",
                    }}
                  >
                    {isRank1 ? <Trophy size={13} color="#16a34a" /> : <Award size={13} />}
                    {isRank1 ? "🥇 #1 RECOMMENDED" : rank === 2 ? "🥈 #2 ALTERNATIVE" : `🥉 #${rank} ALTERNATIVE`}
                  </span>

                  <span
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 800,
                      color: isRank1 ? "#16a34a" : "var(--text)",
                    }}
                  >
                    {fitnessScore}
                    <small style={{ fontSize: "0.7rem", color: "var(--text-soft)", fontWeight: 500 }}>
                      {" "}/ 100
                    </small>
                  </span>
                </div>

                <h3 style={{ fontSize: "1.05rem", margin: "0 0 6px", fontWeight: 700 }}>
                  {plan.name || `Layout ${chr(ord('A')+idx)}`}
                </h3>

                {/* Specs Chips */}
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px", fontSize: "0.78rem" }}>
                  <span style={{ padding: "3px 8px", background: "var(--surface-2)", borderRadius: "4px" }}>
                    📐 {int_fmt(builtUp)} sq.ft
                  </span>
                  <span style={{ padding: "3px 8px", background: "var(--surface-2)", borderRadius: "4px" }}>
                    💰 ₹{totalCostLakhs}L Turnkey
                  </span>
                  {rankMeta.flags && rankMeta.flags.map((f, i) => (
                    <span
                      key={i}
                      style={{
                        padding: "3px 8px",
                        background: f.includes("Non-Compliant") ? "rgba(239, 68, 68, 0.12)" : "rgba(22, 163, 74, 0.12)",
                        color: f.includes("Non-Compliant") ? "#ef4444" : "#16a34a",
                        borderRadius: "4px",
                        fontWeight: 600,
                      }}
                    >
                      {f}
                    </span>
                  ))}
                </div>

                {/* Tradeoff summary */}
                <p style={{ fontSize: "0.82rem", color: "var(--text-soft)", lineHeight: "1.45", margin: "0 0 14px" }}>
                  {rankMeta.tradeoff_vs_next || (isRank1 ? "Highest combined score across budget, Vastu, and ventilation." : "Alternative spatial orientation.")}
                </p>

                {/* Compact Criteria Bars */}
                {rankMeta.criteria && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "16px" }}>
                    {rankMeta.criteria.slice(0, 4).map((c) => {
                      const Icon = CRITERIA_ICONS[c.key] || Info;
                      return (
                        <div key={c.key} style={{ fontSize: "0.73rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px", color: "var(--text-soft)" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              <Icon size={11} /> {c.label} ({c.weight}%)
                            </span>
                            <span style={{ fontWeight: 600, color: "var(--text)" }}>{c.score}</span>
                          </div>
                          <div style={{ height: "4px", background: "var(--border)", borderRadius: "2px", overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${Math.min(100, Math.max(0, c.score))}%`,
                                height: "100%",
                                background: c.score >= 85 ? "#16a34a" : c.score >= 70 ? "var(--accent)" : "#ef4444",
                                transition: "width 0.4s ease",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div style={{ display: "flex", gap: "8px", marginTop: "10px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                <button
                  type="button"
                  className={isSelected ? "primary-button" : "secondary-button"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectIndex) onSelectIndex(idx);
                  }}
                  style={{ flex: 1, padding: "7px 10px", fontSize: "0.8rem", justifyContent: "center" }}
                >
                  {isSelected ? "Viewing Blueprint" : "View Blueprint"}
                </button>
                <button
                  type="button"
                  className="outline-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleConfirmSelection(plan);
                  }}
                  style={{ padding: "7px 12px", fontSize: "0.8rem" }}
                  title="Select this plan as your active project layout"
                >
                  <Check size={14} style={{ marginRight: "4px" }} /> Select
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Explanation Trigger Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          background: "var(--surface-2)",
          padding: "12px 16px",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Sparkles size={17} color="var(--accent)" />
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            Want Gemini to explain the tradeoffs between these plans?
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              type="button"
              onClick={() => setExplainLanguage("en")}
              style={{
                padding: "4px 8px",
                fontSize: "0.74rem",
                borderRadius: "4px",
                border: "1px solid var(--border)",
                background: explainLanguage === "en" ? "var(--accent)" : "transparent",
                color: explainLanguage === "en" ? "#fff" : "var(--text)",
                cursor: "pointer",
              }}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setExplainLanguage("ta")}
              style={{
                padding: "4px 8px",
                fontSize: "0.74rem",
                borderRadius: "4px",
                border: "1px solid var(--border)",
                background: explainLanguage === "ta" ? "var(--accent)" : "transparent",
                color: explainLanguage === "ta" ? "#fff" : "var(--text)",
                cursor: "pointer",
              }}
            >
              தமிழ்
            </button>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={handleExplainWithAi}
            disabled={explaining}
            style={{ padding: "6px 14px", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Sparkles size={14} />
            {explaining ? "Consulting Gemini..." : "Explain ranking with AI"}
          </button>
        </div>
      </div>

      {/* AI Explanation Card (when generated) */}
      {aiExplanation && (
        <div
          style={{
            background: "rgba(180, 83, 9, 0.05)",
            border: "1px solid rgba(180, 83, 9, 0.25)",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Sparkles size={14} /> GEMINI PLAN TRADE-OFF ANALYSIS
            </span>
            <button
              type="button"
              onClick={() => {
                if (isSpeaking) {
                  stopSpeech();
                } else {
                  speak(aiExplanation.spoken_script || aiExplanation.explanation, explainLanguage);
                }
              }}
              className="outline-button"
              style={{ padding: "4px 10px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "5px" }}
            >
              {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
              {isSpeaking ? "Stop" : "🔊 Listen"}
            </button>
          </div>
          <p style={{ fontSize: "0.88rem", lineHeight: "1.55", margin: 0, color: "var(--text)", whiteSpace: "pre-line" }}>
            {aiExplanation.explanation}
          </p>
        </div>
      )}

      {/* Expandable "How We Ranked These Plans" Section */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
        <button
          type="button"
          onClick={() => setShowHowItWorks((prev) => !prev)}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-soft)",
            fontSize: "0.8rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: 0,
            fontWeight: 600,
          }}
        >
          {showHowItWorks ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          How we ranked these plans (Methodology & Formula Disclosures)
        </button>

        {showHowItWorks && (
          <div
            style={{
              marginTop: "12px",
              padding: "14px",
              background: "var(--surface-2)",
              borderRadius: "6px",
              fontSize: "0.8rem",
              lineHeight: "1.5",
              color: "var(--text-soft)",
            }}
          >
            <p style={{ margin: "0 0 10px" }}>
              <strong>Scientific & Deterministic Scoring:</strong> Scores are computed strictly by audited engineering rules derived from
              <strong> Tamil Nadu Combined Development and Building Rules (TNCDBR 2019)</strong>, <strong>TN PWD Schedule of Rates 2025–2026</strong>,
              and standard Vastu Shastra orientation norms. No neural networks, generative LLMs, or subjective opinions are involved in plan ranking.
            </p>

            <ul style={{ margin: "0 0 10px", paddingLeft: "18px" }}>
              <li><strong>Budget Fit (25%):</strong> Turnkey capital compared against user budget, factoring physical monthly cash-burn feasibility.</li>
              <li><strong>Vastu Alignment (15%):</strong> Cardinal quadrant checks for Agni kitchen, Niruthi master suite, Ishanya pooja, and zero toilets in Brahmasthan.</li>
              <li><strong>Ventilation & Daylight (15%):</strong> Percentage of habitable rooms touching perimeter walls with dedicated exterior windows and dual-wall cross ventilation.</li>
              <li><strong>Space Efficiency (15%):</strong> Usable room carpet area vs total built-up footprint (82%–88% benchmark).</li>
              <li><strong>Room Proportions (10%):</strong> Aspect ratio bounds (1.2 to 1.8) ensuring functional living flow.</li>
              <li><strong>Regulatory Margin (10%):</strong> Headroom under TNCDBR Rule 35. <em>Strict Rule:</em> Any plan failing mandatory setbacks or maximum 70% coverage cannot be ranked #1.</li>
              <li><strong>Buildability & Plumbing (10%):</strong> Clustered sanitary risers and clean structural columns.</li>
            </ul>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid var(--border)" }}>
              <span>Methodology: <code>{RANKING_CONFIG.version}</code></span>
              <button
                type="button"
                onClick={() => setShowFormulas((prev) => !prev)}
                style={{ background: "transparent", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600 }}
              >
                {showFormulas ? "Hide Mathematical Formulas" : "See Mathematical Formulas →"}
              </button>
            </div>

            {showFormulas && (
              <div style={{ marginTop: "10px", padding: "10px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "4px", fontFamily: "monospace", fontSize: "0.75rem" }}>
                <div>Final Score = Σ (Weight_i × Score_i) / 100</div>
                <div>Budget Score = 100 if Cost ≤ 0.90×Budget; max(0, 85 - (Cost/Budget - 1.0) × 283.3) if Cost &gt; Budget</div>
                <div>Ground Coverage % = (Ground Floor Built-up / Plot Area) × 100 ≤ 70.0% [TNCDBR Rule 35]</div>
                <div>Tie-breaker: Lower total turnkey cost automatically breaks identical final scores.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function chr(code) {
  return String.fromCharCode(code);
}
function ord(c) {
  return c.charCodeAt(0);
}
function int_fmt(num) {
  return Math.round(Number(num) || 0).toLocaleString("en-IN");
}
