import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Speaking to the tutor, and hearing it answer.
 *
 * Both halves are browser APIs rather than anything sent to a server: the
 * microphone is transcribed on the device by SpeechRecognition, and the reply
 * is read out by speechSynthesis. Nothing extra is uploaded, and it costs no
 * AI quota — the transcript goes to the same tutor endpoint a typed question
 * would.
 *
 * Support is uneven (Chrome and Edge have both; Firefox has neither), so the
 * hook reports what it can do and the interface hides what is unavailable
 * rather than offering a button that does nothing.
 */

const Recognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition ?? window.webkitSpeechRecognition
    : null;

export const canListen = Boolean(Recognition);
export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

export function useVoice({ onTranscript, language = 'en-IN' } = {}) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  // Kept in a ref so restarting recognition never revives a stale callback.
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    if (!canListen) return undefined;

    const recognition = new Recognition();
    recognition.lang = language;
    recognition.continuous = false;
    // Interim results are what make it feel alive — words appear as they are
    // spoken instead of after a silence.
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalText = '';
      let pending = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else pending += result[0].transcript;
      }

      setInterim(pending);

      if (finalText.trim()) {
        setInterim('');
        onTranscriptRef.current?.(finalText.trim());
      }
    };

    recognition.onerror = (event) => {
      // Someone releasing the button before speaking is not worth an error.
      if (event.error === 'aborted' || event.error === 'no-speech') {
        setError(null);
      } else if (event.error === 'not-allowed') {
        setError('Microphone access was blocked. Allow it in your browser settings to speak.');
      } else {
        setError("We couldn't hear that. Try again, or type the question instead.");
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setInterim('');
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // Already stopped; nothing to unwind.
      }
    };
  }, [language]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || listening) return;
    setError(null);
    setInterim('');

    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {
      // start() throws if it is already running; the state below keeps in step.
      setListening(false);
    }
  }, [listening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // Nothing to stop.
    }
    setListening(false);
  }, []);

  /**
   * Never throws. Reading an answer aloud is a convenience on top of the
   * answer itself — if the browser refuses, the student should still have
   * their reply on screen rather than an error saying it failed to send.
   */
  const speak = useCallback((text) => {
    if (!canSpeak || !text) return;

    try {
      speakOrThrow(text, setSpeaking);
    } catch {
      setSpeaking(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (!canSpeak) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Nothing was speaking.
    }
    setSpeaking(false);
  }, []);

  // Leaving the page mid-sentence should not leave a voice talking to an empty
  // room — browsers keep speaking after the component is gone otherwise.
  useEffect(() => () => {
    if (!canSpeak) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Nothing to cancel.
    }
  }, []);

  return {
    canListen,
    canSpeak,
    listening,
    speaking,
    interim,
    error,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}

/** Does the actual speaking. Separated so the caller can swallow failures. */
function speakOrThrow(text, setSpeaking) {
  window.speechSynthesis.cancel();

  // The tutor writes for the eye — headings, bullets, emphasis marks.
  // Read aloud those become noise, so they are stripped first.
  const spoken = text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[*_`]/g, '')
    .replace(/^[-•]\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

  const utterance = new SpeechSynthesisUtterance(spoken);
  utterance.lang = 'en-IN';
  utterance.onend = () => setSpeaking(false);
  utterance.onerror = () => setSpeaking(false);

  setSpeaking(true);
  window.speechSynthesis.speak(utterance);
}
