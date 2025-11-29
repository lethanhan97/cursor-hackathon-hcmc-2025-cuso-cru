import { useRef, useState } from "react";
import "./App.css";
import * as faceapi from "@vladmandic/face-api";

await faceapi.nets.ssdMobilenetv1.loadFromUri("/model");
await faceapi.nets.faceExpressionNet.loadFromUri("/model");

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
  const moodIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [mood, setMood] = useState<Mood | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const getMood = async () => {
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

    setInterval(getMood, 1000);
    setIsStreaming(true);
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
    </section>
  );
}

export default App;
