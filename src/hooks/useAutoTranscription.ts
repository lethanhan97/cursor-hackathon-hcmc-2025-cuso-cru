import { useScribe } from "@elevenlabs/react";

export function useAutoTranscription() {
  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    onPartialTranscript: (data) => {
      console.log("Partial:", data.text);
    },
    onCommittedTranscript: (data) => {
      console.log("Committed:", data.text);
    },
    onCommittedTranscriptWithTimestamps: (data) => {
      console.log("Committed with timestamps:", data.text);
      console.log("Timestamps:", data.timestamps);
    },
  });

  const getScribeToken = async () => {
    const response = await fetch("http://localhost:3000/scribe-token");
    const data = await response.json();
    return data.token;
  };

  const startTranscribing = async () => {
    const token = await getScribeToken();
    await scribe.connect({
      token,
      microphone: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
  };

  const stopTranscribing = () => {
    scribe.disconnect();
  };

  return {
    startTranscribing,
    stopTranscribing,
    scribe,
  };
}
