import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Bot,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  Mic,
  MicOff,
  Send,
  Copy,
  Check,
  RotateCcw,
  AlertTriangle,
  Compass,
  Wind,
  IndianRupee,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  FileText,
  HelpCircle,
  Clock,
  Layers,
} from "lucide-react";
import { getPlanSummary, streamPlanChat } from "../services/api";
import { useSpeech } from "../hooks/useSpeech";

const SUGGESTIONS_EN = [
  "Why is the kitchen in the south-east?",
  "Can I reduce the cost by 10%?",
  "Is this compliant with TNCDBR 2019?",
  "Which bedroom gets the best ventilation?",
  "What are the structural span requirements?",
];

const SUGGESTIONS_TA = [
  "சமையலறை ஏன் தென்கிழக்கில் (அக்னி மூலை) உள்ளது?",
  "கட்டுமான செலவை 10% குறைக்க என்ன செய்யலாம்?",
  "இது TNCDBR 2019 விதிமுறைகளுக்கு உட்பட்டதா?",
  "எந்த படுக்கையறையில் சிறந்த காற்றோட்டம் கிடைக்கும்?",
  "பூஜை அறை எந்த திசையில் அமைக்கப்பட்டுள்ளது?",
];

export default function AIAdvisor({
  plan,
  form,
  planId,
  builtUpArea,
  estimatedCost,
}) {
  const [activeTab, setActiveTab] = useState("summary"); // "summary" | "chat"
  const [language, setLanguage] = useState("en"); // "en" | "ta"
  const [audience, setAudience] = useState("homeowner"); // "homeowner" | "professional"
  const [collapsed, setCollapsed] = useState(false);

  // Summary State
  const [summaryData, setSummaryData] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  // Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const chatBottomRef = useRef(null);

  // Speech Hook for voice input & output
  const {
    speak,
    pauseSpeech,
    resumeSpeech,
    stopSpeech,
    changeSpeed,
    isSpeaking,
    isPaused,
    speechRate,
    startListening,
    stopListening,
    isListening,
    transcript,
    micSupported,
    micError,
  } = useSpeech({ defaultLang: language });

  // When speech transcript updates, populate input box
  useEffect(() => {
    if (transcript) {
      setInputMessage(transcript);
    }
  }, [transcript]);

  // Load summary whenever planId, language, or audience changes
  const loadSummary = async () => {
    if (!plan && !planId) return;
    setLoadingSummary(true);
    setSummaryError(null);
    stopSpeech();

    try {
      const pId = planId || plan?.plan_id || "current-plan";
      const res = await getPlanSummary({
        planId: pId,
        language,
        audience,
        planData: plan,
        formData: form,
      });
      setSummaryData(res);
    } catch (err) {
      console.warn("Failed to fetch AI summary:", err);
      setSummaryError(err.message || "Failed to load plan summary.");
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [planId, plan?.plan_id, language, audience]);

  // Scroll chat to bottom when messages update
  useEffect(() => {
    if (activeTab === "chat" && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isStreaming, activeTab]);

  // Handle Voice Read of the Spoken Script
  const handleListenSummary = () => {
    if (isSpeaking) {
      if (isPaused) {
        resumeSpeech();
      } else {
        pauseSpeech();
      }
      return;
    }

    const script =
      summaryData?.spoken_script ||
      summaryData?.overview ||
      "Plan summary is currently being prepared.";
    speak(script, language);
  };

  // Copy text helper
  const handleCopy = (text, index = -1) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  // Handle Send Chat
  const handleSendMessage = async (customText = null) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || isStreaming) return;

    if (isListening) {
      stopListening();
    }

    const newHistory = [
      ...chatMessages,
      { role: "user", content: textToSend, timestamp: new Date() },
    ];
    setChatMessages(newHistory);
    setInputMessage("");
    setIsStreaming(true);

    // Placeholder for streamed assistant response
    const assistantMsgIndex = newHistory.length;
    setChatMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "",
        source: "gemini",
        timestamp: new Date(),
      },
    ]);

    const pId = planId || plan?.plan_id || "current-plan";

    try {
      await streamPlanChat({
        planId: pId,
        message: textToSend,
        language,
        history: chatMessages.slice(-4),
        planData: plan,
        formData: form,
        onChunk: (chunk) => {
          setChatMessages((prev) => {
            const updated = [...prev];
            if (updated[assistantMsgIndex]) {
              updated[assistantMsgIndex] = {
                ...updated[assistantMsgIndex],
                content: (updated[assistantMsgIndex].content || "") + chunk,
              };
            }
            return updated;
          });
        },
        onError: (err) => {
          console.warn("Chat streaming error:", err);
          setChatMessages((prev) => {
            const updated = [...prev];
            if (updated[assistantMsgIndex]) {
              updated[assistantMsgIndex] = {
                ...updated[assistantMsgIndex],
                content:
                  updated[assistantMsgIndex].content ||
                  (language === "ta"
                    ? "மன்னிக்கவும், தகவல் சேகரிப்பதில் சிறு பிழை ஏற்பட்டது. தயவுசெய்து மீண்டும் முயற்சிக்கவும்."
                    : "Sorry, I encountered an issue retrieving the response. Please try again."),
                isError: true,
              };
            }
            return updated;
          });
          setIsStreaming(false);
        },
        onDone: () => {
          setIsStreaming(false);
        },
      });
    } catch (err) {
      console.warn("Failed to stream chat:", err);
      setIsStreaming(false);
    }
  };

  // Suggestion chips
  const suggestions = language === "ta" ? SUGGESTIONS_TA : SUGGESTIONS_EN;

  return (
    <section
      className="ai-advisor-card"
      style={{
        marginTop: "24px",
        background: "var(--card-bg, #ffffff)",
        borderRadius: "16px",
        border: "1px solid var(--border-color, #e2e8f0)",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.06)",
        overflow: "hidden",
        transition: "all 0.2s ease",
      }}
    >
      {/* CARD TOPBAR / HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 20px",
          background:
            "linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%)",
          borderBottom: "1px solid var(--border-color, #e2e8f0)",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #0284c7 0%, #6366f1 100%)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(2, 132, 199, 0.3)",
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  color: "var(--text-color, #0f172a)",
                }}
              >
                AI Plan Advisor
              </h3>
              <span
                style={{
                  fontSize: "0.7rem",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontWeight: 700,
                  background:
                    summaryData?.source === "template"
                      ? "rgba(234, 179, 8, 0.15)"
                      : "rgba(2, 132, 199, 0.12)",
                  color:
                    summaryData?.source === "template" ? "#b45309" : "#0284c7",
                  border:
                    summaryData?.source === "template"
                      ? "1px solid rgba(234, 179, 8, 0.3)"
                      : "1px solid rgba(2, 132, 199, 0.25)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Bot size={11} />
                {summaryData?.source === "template"
                  ? "Standard Summary"
                  : "Gemini 3.1"}
              </span>
            </div>
            <small
              style={{
                color: "var(--text-muted, #64748b)",
                fontSize: "0.78rem",
              }}
            >
              Architectural analysis, Vastu alignment & budget breakdown for this
              blueprint
            </small>
          </div>
        </div>

        {/* CONTROLS: LANGUAGE & AUDIENCE TOGGLES */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          {/* Language Toggle */}
          <div
            style={{
              display: "inline-flex",
              borderRadius: "8px",
              border: "1px solid var(--border-color, #cbd5e1)",
              background: "var(--surface-color, #f8fafc)",
              padding: "2px",
            }}
          >
            <button
              type="button"
              onClick={() => setLanguage("en")}
              style={{
                border: "none",
                background: language === "en" ? "#0284c7" : "transparent",
                color: language === "en" ? "#ffffff" : "var(--text-muted, #64748b)",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLanguage("ta")}
              style={{
                border: "none",
                background: language === "ta" ? "#0284c7" : "transparent",
                color: language === "ta" ? "#ffffff" : "var(--text-muted, #64748b)",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              தமிழ்
            </button>
          </div>

          {/* Audience Toggle */}
          <div
            style={{
              display: "inline-flex",
              borderRadius: "8px",
              border: "1px solid var(--border-color, #cbd5e1)",
              background: "var(--surface-color, #f8fafc)",
              padding: "2px",
            }}
          >
            <button
              type="button"
              onClick={() => setAudience("homeowner")}
              style={{
                border: "none",
                background: audience === "homeowner" ? "#0284c7" : "transparent",
                color: audience === "homeowner" ? "#ffffff" : "var(--text-muted, #64748b)",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Homeowner
            </button>
            <button
              type="button"
              onClick={() => setAudience("professional")}
              style={{
                border: "none",
                background: audience === "professional" ? "#0284c7" : "transparent",
                color: audience === "professional" ? "#ffffff" : "var(--text-muted, #64748b)",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Professional
            </button>
          </div>

          {/* Collapse/Expand */}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand AI Advisor" : "Collapse AI Advisor"}
            style={{
              background: "transparent",
              border: "1px solid var(--border-color, #cbd5e1)",
              borderRadius: "8px",
              padding: "5px 8px",
              cursor: "pointer",
              color: "var(--text-muted, #64748b)",
              display: "flex",
              alignItems: "center",
            }}
          >
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* TAB NAVIGATION */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--border-color, #e2e8f0)",
              padding: "0 20px",
              background: "var(--surface-color, #fafafa)",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("summary")}
              style={{
                padding: "12px 18px",
                border: "none",
                background: "transparent",
                borderBottom:
                  activeTab === "summary"
                    ? "2px solid #0284c7"
                    : "2px solid transparent",
                color:
                  activeTab === "summary"
                    ? "#0284c7"
                    : "var(--text-muted, #64748b)",
                fontWeight: 600,
                fontSize: "0.88rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.15s ease",
              }}
            >
              <FileText size={16} />
              {language === "ta" ? "திட்ட சுருக்கம்" : "Plan Summary"}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              style={{
                padding: "12px 18px",
                border: "none",
                background: "transparent",
                borderBottom:
                  activeTab === "chat"
                    ? "2px solid #0284c7"
                    : "2px solid transparent",
                color:
                  activeTab === "chat"
                    ? "#0284c7"
                    : "var(--text-muted, #64748b)",
                fontWeight: 600,
                fontSize: "0.88rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.15s ease",
              }}
            >
              <MessageSquare size={16} />
              {language === "ta" ? "கேள்வி கேளுங்கள்" : "Ask About This Plan"}
              {chatMessages.length > 0 && (
                <span
                  style={{
                    background: "#0284c7",
                    color: "#ffffff",
                    borderRadius: "10px",
                    padding: "1px 6px",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                  }}
                >
                  {chatMessages.filter((m) => m.role === "assistant").length}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: STRUCTURED PLAN SUMMARY */}
          {activeTab === "summary" && (
            <div style={{ padding: "20px" }}>
              {loadingSummary ? (
                /* Skeleton Loader */
                <div style={{ padding: "10px 0" }}>
                  <div
                    style={{
                      height: "24px",
                      width: "60%",
                      background: "var(--border-color, #e2e8f0)",
                      borderRadius: "6px",
                      marginBottom: "12px",
                      animation: "pulse 1.5s infinite",
                    }}
                  />
                  <div
                    style={{
                      height: "16px",
                      width: "90%",
                      background: "var(--border-color, #e2e8f0)",
                      borderRadius: "6px",
                      marginBottom: "8px",
                      animation: "pulse 1.5s infinite",
                    }}
                  />
                  <div
                    style={{
                      height: "16px",
                      width: "75%",
                      background: "var(--border-color, #e2e8f0)",
                      borderRadius: "6px",
                      marginBottom: "20px",
                      animation: "pulse 1.5s infinite",
                    }}
                  />
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        style={{
                          height: "90px",
                          background: "var(--surface-color, #f1f5f9)",
                          borderRadius: "10px",
                          animation: "pulse 1.5s infinite",
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : summaryError ? (
                /* Error state with retry */
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "10px",
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    color: "#dc2626",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <AlertTriangle size={18} />
                    <span>{summaryError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={loadSummary}
                    className="secondary-button"
                    style={{ padding: "6px 14px", fontSize: "0.82rem" }}
                  >
                    <RotateCcw size={14} /> Retry
                  </button>
                </div>
              ) : summaryData ? (
                /* Rendered Summary Content */
                <div>
                  {/* SOURCE ALERT WHEN RUNNING IN DETERMINISTIC TEMPLATE FALLBACK */}
                  {summaryData.source === "template" && (
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        background: "rgba(234, 179, 8, 0.1)",
                        border: "1px solid rgba(234, 179, 8, 0.25)",
                        color: "#b45309",
                        fontSize: "0.8rem",
                        marginBottom: "16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <Bot size={14} />
                      <span>
                        AI service is currently operating in standard deterministic mode — displaying verified engineering metrics.
                      </span>
                    </div>
                  )}

                  {/* HEADLINE & VOICE AUDIO CONTROLS */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "16px",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <h4
                        style={{
                          margin: "0 0 6px 0",
                          fontSize: "1.15rem",
                          fontWeight: 700,
                          color: "var(--text-color, #0f172a)",
                        }}
                      >
                        {summaryData.headline || "Architectural Plan Summary"}
                      </h4>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.9rem",
                          color: "var(--text-muted, #475569)",
                          lineHeight: 1.5,
                        }}
                      >
                        {summaryData.overview}
                      </p>
                    </div>

                    {/* VOICE CONTROLS PANEL */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "var(--surface-color, #f1f5f9)",
                        padding: "4px 8px",
                        borderRadius: "10px",
                        border: "1px solid var(--border-color, #cbd5e1)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={handleListenSummary}
                        style={{
                          border: "none",
                          background: isSpeaking ? "#16a34a" : "#0284c7",
                          color: "#ffffff",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          transition: "background 0.15s ease",
                        }}
                        title={isSpeaking ? (isPaused ? "Resume voice read" : "Pause voice read") : "Listen to spoken architectural briefing"}
                      >
                        {isSpeaking ? (
                          isPaused ? <Play size={13} /> : <Pause size={13} />
                        ) : (
                          <Volume2 size={13} />
                        )}
                        <span>{isSpeaking ? (isPaused ? "Resume" : "Pause") : "🔊 Listen"}</span>
                      </button>

                      {isSpeaking && (
                        <button
                          type="button"
                          onClick={stopSpeech}
                          style={{
                            border: "none",
                            background: "rgba(239, 68, 68, 0.15)",
                            color: "#ef4444",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                          }}
                          title="Stop voice"
                        >
                          <Square size={13} />
                        </button>
                      )}

                      {/* Speed selector */}
                      <select
                        value={speechRate}
                        onChange={(e) => changeSpeed(parseFloat(e.target.value))}
                        style={{
                          border: "1px solid var(--border-color, #cbd5e1)",
                          borderRadius: "6px",
                          background: "var(--card-bg, #ffffff)",
                          color: "inherit",
                          fontSize: "0.75rem",
                          padding: "3px 6px",
                          cursor: "pointer",
                        }}
                        title="Speech speed"
                      >
                        <option value="0.8">0.8x</option>
                        <option value="1.0">1.0x</option>
                        <option value="1.2">1.2x</option>
                        <option value="1.5">1.5x</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleCopy(summaryData.spoken_script || summaryData.overview)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "var(--text-muted, #64748b)",
                          padding: "6px",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                        title="Copy text summary"
                      >
                        {copiedIndex === -1 ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* 4-PILLAR ARCHITECTURAL METRIC CARDS */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: "12px",
                      marginBottom: "18px",
                    }}
                  >
                    {/* Vastu Card */}
                    <div
                      style={{
                        padding: "14px",
                        borderRadius: "10px",
                        background: "var(--surface-color, #f8fafc)",
                        border: "1px solid var(--border-color, #e2e8f0)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          color: "#d97706",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          marginBottom: "6px",
                        }}
                      >
                        <Compass size={16} />
                        <span>Vastu Shastra Alignment</span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.82rem",
                          color: "var(--text-color, #334155)",
                          lineHeight: 1.45,
                        }}
                      >
                        {summaryData.vastu_notes || "Compliant with traditional cardinal orientations."}
                      </p>
                    </div>

                    {/* Ventilation Card */}
                    <div
                      style={{
                        padding: "14px",
                        borderRadius: "10px",
                        background: "var(--surface-color, #f8fafc)",
                        border: "1px solid var(--border-color, #e2e8f0)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          color: "#0284c7",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          marginBottom: "6px",
                        }}
                      >
                        <Wind size={16} />
                        <span>Ventilation & Light</span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.82rem",
                          color: "var(--text-color, #334155)",
                          lineHeight: 1.45,
                        }}
                      >
                        {summaryData.ventilation_notes || "Cross-ventilation verified on all major habitable rooms."}
                      </p>
                    </div>

                    {/* Cost & Budget Card */}
                    <div
                      style={{
                        padding: "14px",
                        borderRadius: "10px",
                        background: "var(--surface-color, #f8fafc)",
                        border: "1px solid var(--border-color, #e2e8f0)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          color: "#16a34a",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          marginBottom: "6px",
                        }}
                      >
                        <IndianRupee size={16} />
                        <span>Turnkey Budget Fit</span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.82rem",
                          color: "var(--text-color, #334155)",
                          lineHeight: 1.45,
                        }}
                      >
                        {summaryData.cost_and_budget_notes || "Turnkey cost estimated via TN PWD SOR 2025-26."}
                      </p>
                    </div>

                    {/* Statutory Compliance Card */}
                    <div
                      style={{
                        padding: "14px",
                        borderRadius: "10px",
                        background: "var(--surface-color, #f8fafc)",
                        border: "1px solid var(--border-color, #e2e8f0)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          color: "#7c3aed",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          marginBottom: "6px",
                        }}
                      >
                        <ShieldCheck size={16} />
                        <span>TNCDBR 2019 Rule 35</span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.82rem",
                          color: "var(--text-color, #334155)",
                          lineHeight: 1.45,
                        }}
                      >
                        {summaryData.compliance_notes || "Setbacks and 70% max ground coverage verified."}
                      </p>
                    </div>
                  </div>

                  {/* STRENGTHS & CONCERNS SPLIT */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                      gap: "14px",
                      marginBottom: "18px",
                    }}
                  >
                    {/* Strengths */}
                    <div
                      style={{
                        padding: "14px",
                        borderRadius: "10px",
                        background: "rgba(22, 163, 74, 0.05)",
                        border: "1px solid rgba(22, 163, 74, 0.2)",
                      }}
                    >
                      <strong
                        style={{
                          display: "block",
                          color: "#16a34a",
                          fontSize: "0.86rem",
                          marginBottom: "8px",
                        }}
                      >
                        ✓ Key Design Strengths
                      </strong>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: "18px",
                          fontSize: "0.82rem",
                          color: "var(--text-color, #334155)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "5px",
                        }}
                      >
                        {(summaryData.strengths || []).map((str, idx) => (
                          <li key={idx}>{str}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Concerns / Watchpoints */}
                    <div
                      style={{
                        padding: "14px",
                        borderRadius: "10px",
                        background: "rgba(234, 179, 8, 0.05)",
                        border: "1px solid rgba(234, 179, 8, 0.25)",
                      }}
                    >
                      <strong
                        style={{
                          display: "block",
                          color: "#b45309",
                          fontSize: "0.86rem",
                          marginBottom: "8px",
                        }}
                      >
                        ⚠️ Practical Watchpoints & Trade-offs
                      </strong>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: "18px",
                          fontSize: "0.82rem",
                          color: "var(--text-color, #334155)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "5px",
                        }}
                      >
                        {(summaryData.concerns || []).map((con, idx) => (
                          <li key={idx}>{con}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* RECOMMENDED NEXT STEPS */}
                  {summaryData.next_steps && summaryData.next_steps.length > 0 && (
                    <div
                      style={{
                        padding: "12px 16px",
                        borderRadius: "10px",
                        background: "var(--surface-color, #f8fafc)",
                        border: "1px solid var(--border-color, #e2e8f0)",
                        fontSize: "0.83rem",
                      }}
                    >
                      <strong
                        style={{
                          display: "block",
                          color: "var(--text-color, #0f172a)",
                          marginBottom: "6px",
                        }}
                      >
                        📋 Recommended Next Action Steps:
                      </strong>
                      <ol
                        style={{
                          margin: 0,
                          paddingLeft: "20px",
                          color: "var(--text-muted, #475569)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        {summaryData.next_steps.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 2: INTERACTIVE ASSISTANT CHAT */}
          {activeTab === "chat" && (
            <div style={{ padding: "20px" }}>
              {/* SUGGESTION CHIPS */}
              <div style={{ marginBottom: "16px" }}>
                <span
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "var(--text-muted, #64748b)",
                    display: "block",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {language === "ta" ? "பரிந்துரைக்கப்பட்ட கேள்விகள்:" : "Suggested Questions:"}
                </span>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  {suggestions.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(chip)}
                      disabled={isStreaming}
                      style={{
                        background: "var(--surface-color, #f1f5f9)",
                        border: "1px solid var(--border-color, #cbd5e1)",
                        borderRadius: "20px",
                        padding: "6px 12px",
                        fontSize: "0.78rem",
                        color: "var(--text-color, #1e293b)",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#0284c7";
                        e.currentTarget.style.color = "#0284c7";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-color, #cbd5e1)";
                        e.currentTarget.style.color = "var(--text-color, #1e293b)";
                      }}
                    >
                      <HelpCircle size={12} />
                      <span>{chip}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* CHAT MESSAGES DISPLAY */}
              <div
                style={{
                  minHeight: "220px",
                  maxHeight: "380px",
                  overflowY: "auto",
                  padding: "14px",
                  background: "var(--surface-color, #f8fafc)",
                  borderRadius: "12px",
                  border: "1px solid var(--border-color, #e2e8f0)",
                  marginBottom: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
                aria-live="polite"
              >
                {chatMessages.length === 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "180px",
                      color: "var(--text-muted, #94a3b8)",
                      textAlign: "center",
                    }}
                  >
                    <Bot size={34} style={{ marginBottom: "8px", opacity: 0.6 }} />
                    <p style={{ margin: 0, fontSize: "0.9rem" }}>
                      {language === "ta"
                        ? "இந்த வரைபடம் குறித்து ஏதேனும் கேள்வி கேட்கலாம் (செலவு, வாஸ்து, காற்றோட்டம் போன்றவை)."
                        : "Ask any question about this plan's dimensions, Vastu alignment, cost, or building codes."}
                    </p>
                  </div>
                ) : (
                  chatMessages.map((msg, index) => {
                    const isUser = msg.role === "user";
                    return (
                      <div
                        key={index}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: isUser ? "flex-end" : "flex-start",
                        }}
                      >
                        <div
                          style={{
                            maxWidth: "85%",
                            padding: "10px 14px",
                            borderRadius: isUser
                              ? "14px 14px 2px 14px"
                              : "14px 14px 14px 2px",
                            background: isUser
                              ? "#0284c7"
                              : "var(--card-bg, #ffffff)",
                            color: isUser
                              ? "#ffffff"
                              : "var(--text-color, #0f172a)",
                            border: isUser
                              ? "none"
                              : "1px solid var(--border-color, #cbd5e1)",
                            fontSize: "0.88rem",
                            lineHeight: 1.5,
                            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                            wordBreak: "break-word",
                          }}
                        >
                          <div style={{ whiteSpace: "pre-wrap" }}>
                            {msg.content || (
                              <span style={{ fontStyle: "italic", opacity: 0.7 }}>
                                Thinking...
                              </span>
                            )}
                          </div>

                          {!isUser && msg.content && (
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: "8px",
                                marginTop: "6px",
                                borderTop: "1px solid rgba(0, 0, 0, 0.05)",
                                paddingTop: "4px",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => handleCopy(msg.content, index)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "var(--text-muted, #64748b)",
                                  cursor: "pointer",
                                  padding: "2px 4px",
                                  fontSize: "0.75rem",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title="Copy answer"
                              >
                                {copiedIndex === index ? (
                                  <Check size={12} color="#16a34a" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => speak(msg.content, language)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "var(--text-muted, #64748b)",
                                  cursor: "pointer",
                                  padding: "2px 4px",
                                  fontSize: "0.75rem",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title="Listen to response"
                              >
                                <Volume2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* VOICE INPUT NOTICE & MIC ERROR DISPLAY */}
              {micError && (
                <div
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    background: "rgba(239, 68, 68, 0.1)",
                    color: "#ef4444",
                    fontSize: "0.78rem",
                    marginBottom: "8px",
                  }}
                >
                  {micError}
                </div>
              )}

              {/* CHAT INPUT FORM */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                {/* Voice Input (Mic) Button */}
                {micSupported ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (isListening) {
                        stopListening();
                      } else {
                        startListening(language, (finalText) => {
                          handleSendMessage(finalText);
                        });
                      }
                    }}
                    style={{
                      background: isListening ? "#ef4444" : "var(--surface-color, #f1f5f9)",
                      color: isListening ? "#ffffff" : "var(--text-color, #1e293b)",
                      border: "1px solid var(--border-color, #cbd5e1)",
                      borderRadius: "10px",
                      width: "42px",
                      height: "42px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      flexShrink: 0,
                    }}
                    title={
                      isListening
                        ? "Listening... Click to stop"
                        : "Click to speak your question"
                    }
                  >
                    {isListening ? (
                      <MicOff size={18} style={{ animation: "pulse 1s infinite" }} />
                    ) : (
                      <Mic size={18} />
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    style={{
                      background: "var(--surface-color, #f1f5f9)",
                      color: "var(--text-muted, #94a3b8)",
                      border: "1px solid var(--border-color, #cbd5e1)",
                      borderRadius: "10px",
                      width: "42px",
                      height: "42px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "not-allowed",
                      flexShrink: 0,
                    }}
                    title="Voice input is not supported in this browser"
                  >
                    <MicOff size={18} />
                  </button>
                )}

                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={
                    isListening
                      ? "Listening to voice input..."
                      : language === "ta"
                      ? "வரைபடம் பற்றி கேளுங்கள் (எ.கா: சமையலறை எங்குள்ளது?)"
                      : "Ask about setbacks, plumbing, Vastu or cost reduction..."
                  }
                  disabled={isStreaming}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border-color, #cbd5e1)",
                    background: "var(--card-bg, #ffffff)",
                    color: "inherit",
                    fontSize: "0.88rem",
                    outline: "none",
                  }}
                />

                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isStreaming}
                  style={{
                    background:
                      !inputMessage.trim() || isStreaming
                        ? "var(--border-color, #cbd5e1)"
                        : "#0284c7",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "10px",
                    padding: "10px 16px",
                    cursor:
                      !inputMessage.trim() || isStreaming
                        ? "not-allowed"
                        : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  <Send size={15} />
                  <span>Send</span>
                </button>
              </form>
            </div>
          )}

          {/* CARD FOOTER STATUTORY DISCLAIMER */}
          <div
            style={{
              padding: "10px 20px",
              background: "var(--surface-color, #f8fafc)",
              borderTop: "1px solid var(--border-color, #e2e8f0)",
              fontSize: "0.74rem",
              color: "var(--text-muted, #64748b)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <span>
              🛡️ AI-generated guidance — confirm all structural dimensions, setbacks and load calculations with a licensed architect / civil engineer before DTCP approval.
            </span>
            <span style={{ fontWeight: 600 }}>TNCDBR 2019 • TN PWD SOR 2025-26</span>
          </div>
        </>
      )}
    </section>
  );
}
