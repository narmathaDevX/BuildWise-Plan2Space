import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Custom hook providing text-to-speech (Voice Output) and speech-to-text (Voice Input).
 * Supports English (en-IN) and Tamil (ta-IN).
 */
export function useSpeech({ defaultLang = "en" } = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [micSupported, setMicSupported] = useState(false);
  const [micError, setMicError] = useState(null);

  const synthRef = useRef(typeof window !== "undefined" ? window.speechSynthesis : null);
  const utteranceRef = useRef(null);
  const recognitionRef = useRef(null);

  // Check speech recognition support
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setMicSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognitionRef.current = recognition;
      } else {
        setMicSupported(false);
      }
    }
  }, []);

  // Cancel any ongoing speech on unmount
  useEffect(() => {
    return () => {
      if (synthRef.current && synthRef.current.speaking) {
        synthRef.current.cancel();
      }
      if (recognitionRef.current && isListening) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [isListening]);

  // Find preferred voice matching language
  const getPreferredVoice = useCallback((langCode) => {
    if (!synthRef.current) return null;
    const voices = synthRef.current.getVoices() || [];
    if (langCode === "ta") {
      // Look for Tamil voice
      return (
        voices.find((v) => v.lang.startsWith("ta") || v.name.toLowerCase().includes("tamil")) ||
        voices.find((v) => v.lang.includes("IN")) ||
        voices[0]
      );
    }
    // Look for Indian English or standard English
    return (
      voices.find((v) => v.lang === "en-IN" || v.name.includes("India")) ||
      voices.find((v) => v.lang.startsWith("en")) ||
      voices[0]
    );
  }, []);

  // Speak text using SpeechSynthesis API
  const speak = useCallback(
    (text, lang = defaultLang) => {
      if (!synthRef.current || !text) return;

      synthRef.current.cancel(); // Stop prior speech

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speechRate;
      utterance.pitch = 1.0;

      const langTag = lang === "ta" ? "ta-IN" : "en-IN";
      utterance.lang = langTag;

      const voice = getPreferredVoice(lang);
      if (voice) utterance.voice = voice;

      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
      };

      utterance.onpause = () => setIsPaused(true);
      utterance.onresume = () => setIsPaused(false);

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
      };

      utterance.onerror = (e) => {
        console.warn("Speech synthesis error:", e);
        setIsSpeaking(false);
        setIsPaused(false);
      };

      utteranceRef.current = utterance;
      synthRef.current.speak(utterance);
    },
    [defaultLang, speechRate, getPreferredVoice]
  );

  const pauseSpeech = useCallback(() => {
    if (synthRef.current && synthRef.current.speaking && !synthRef.current.paused) {
      synthRef.current.pause();
      setIsPaused(true);
    }
  }, []);

  const resumeSpeech = useCallback(() => {
    if (synthRef.current && synthRef.current.paused) {
      synthRef.current.resume();
      setIsPaused(false);
    }
  }, []);

  const stopSpeech = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    }
  }, []);

  const changeSpeed = useCallback(
    (newRate) => {
      setSpeechRate(newRate);
      if (utteranceRef.current && isSpeaking) {
        // Restart speech with new speed
        const currentText = utteranceRef.current.text;
        speak(currentText);
      }
    },
    [isSpeaking, speak]
  );

  // Start speech-to-text recording
  const startListening = useCallback(
    (lang = defaultLang, onFinalResult = null) => {
      setMicError(null);
      if (!recognitionRef.current) {
        setMicError("Speech recognition is not supported in this browser.");
        return;
      }

      const recognition = recognitionRef.current;
      recognition.lang = lang === "ta" ? "ta-IN" : "en-IN";

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript("");
      };

      recognition.onresult = (event) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
        if (event.results[0].isFinal && onFinalResult) {
          onFinalResult(currentTranscript);
        }
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setMicError("Microphone access was denied. Please allow microphone permissions.");
        } else {
          setMicError(`Voice input error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      try {
        recognition.start();
      } catch (err) {
        console.warn("Recognition already active:", err);
      }
    },
    [defaultLang]
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    }
  }, [isListening]);

  return {
    // Voice Output
    speak,
    pauseSpeech,
    resumeSpeech,
    stopSpeech,
    changeSpeed,
    isSpeaking,
    isPaused,
    speechRate,
    // Voice Input
    startListening,
    stopListening,
    isListening,
    transcript,
    micSupported,
    micError,
  };
}
