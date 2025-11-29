import { useRef, useState } from "react";
import "./App.css";
import * as faceapi from "@vladmandic/face-api";

await faceapi.nets.ssdMobilenetv1.loadFromUri("/model");
await faceapi.nets.faceExpressionNet.loadFromUri("/model");

const INTERVAL = 2_000;

type Mood =
  | "angry"
  | "disgusted"
  | "fearful"
  | "happy"
  | "neutral"
  | "sad"
  | "surprised";

function App() {
  const localVideoRef = useRef<
    HTMLVideoElement & { srcObject: MediaStream | null }
  >(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const moodIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const moodHistoryRef = useRef<Mood[]>([]);

  const [mood, setMood] = useState<Mood | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const handleMoodChange = async () => {
    if (!localVideoRef.current) return;
    const detections = await faceapi
      .detectAllFaces(localVideoRef.current)
      .withFaceExpressions();

    if (detections) {
      const moods = detections.map(({ expressions }) => {
        return expressions.asSortedArray()[0];
      });

      const mostLikelyMood = moods.sort(
        (a, b) => b.probability - a.probability
      )[0];
      setMood(mostLikelyMood?.expression ?? "neutral");

      const newMood = mostLikelyMood?.expression || "neutral";
      const latestMood =
        moodHistoryRef.current[moodHistoryRef.current.length - 1];

      if (audioRef.current && newMood !== latestMood) {
        audioRef.current.src = `/sounds/${newMood}.mp3`;
        audioRef.current.play().catch((error) => {
          console.error("Error playing audio:", error);
        });
      }

      moodHistoryRef.current.push(newMood);
    }

    return null;
  };

  const start = async () => {
    const media = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = media;
    }

    setIsStreaming(true);
    moodIntervalRef.current = setInterval(handleMoodChange, INTERVAL);
  };
  const stop = async () => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject;
      const tracks = stream.getTracks();

      tracks.forEach((track) => track.stop());

      localVideoRef.current.srcObject = null;
    }
    setIsStreaming(false);

    if (moodIntervalRef.current) {
      clearInterval(moodIntervalRef.current);
      moodIntervalRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const toggle = () => {
    if (isStreaming) {
      stop();
    } else {
      start();
    }
  };

  return (
    <section className="app">
      <h1>Bg Muzike CUSO CRU 2025 SUPER COOL</h1>
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className="preview"
      />
      {mood && <p>Mood: {mood}</p>}
      <button onClick={toggle}>
        {isStreaming ? "Stop Streaming" : "Start Streaming"}
      </button>
      <audio ref={audioRef} loop>
        <source type="audio/mpeg" />
      </audio>
    </section>
  );
}

export default App;
