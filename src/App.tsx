import "./App.css";
import * as faceapi from "@vladmandic/face-api";
import { useEffect, useRef, useState } from "react";
import { useAutoTranscription } from "./hooks/useAutoTranscription";
import { useFaceDetection } from "./hooks/useFaceDetection";
import { calculateMood, type Mood } from "./hooks/useMoodCalculation";
import Sentiment from "sentiment";

const sentiment = new Sentiment();
sentiment.registerLanguage("en", {
  labels: {
    like: 0,
    depressed: -5,
    crash: -5,
    excited: 5,
    love: 5,
    sad: -5,
    surprised: 5,
    angry: -5,
    disgusted: -5,
    fearful: -5,
  },
});

await faceapi.nets.ssdMobilenetv1.loadFromUri("/model");
await faceapi.nets.faceExpressionNet.loadFromUri("/model");
await faceapi.nets.faceLandmark68Net.loadFromUri("/model");
await faceapi.nets.ageGenderNet.loadFromUri("/model");

const INTERVAL = 1_000;

function App() {
  const localVideoRef = useRef<
    HTMLVideoElement & { srcObject: MediaStream | null }
  >(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const moodIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const moodHistoryRef = useRef<Mood[]>([]);
  const recentMoodsRef = useRef<Mood[]>([]);
  const { startTranscribing, stopTranscribing, scribe } =
    useAutoTranscription();
  const scribeRef = useRef(scribe);

  // Keep scribeRef updated with the latest scribe object
  useEffect(() => {
    scribeRef.current = scribe;
  }, [scribe]);

  const [isStreaming, setIsStreaming] = useState(false);
  const [mood, setMood] = useState<Mood | null>(null);

  // Configuration for mood detection smoothing
  const MOOD_WINDOW_SIZE = 3; // Number of recent detections to consider
  const MOOD_THRESHOLD = 2; // Minimum count required to switch mood

  const { startDetection, stopDetection } = useFaceDetection(
    localVideoRef,
    canvasRef,
    isStreaming
  );

  const handleMoodChange = async () => {
    if (!localVideoRef.current) return;

    const detections = await faceapi
      .detectAllFaces(localVideoRef.current)
      .withFaceExpressions();

    // Access the latest scribe value through ref to avoid stale closure
    const currentTranscript = scribeRef.current?.partialTranscript || "";
    const sentimentResult = sentiment.analyze(currentTranscript);
    const voiceScore = sentimentResult.score; // Range: -5 to 5

    // Calculate mood using pure function
    const currentMood =
      moodHistoryRef.current[moodHistoryRef.current.length - 1] || null;

    const result = calculateMood(
      {
        detections,
        voiceScore,
        recentMoods: recentMoodsRef.current,
        windowSize: MOOD_WINDOW_SIZE,
      },
      currentMood,
      MOOD_THRESHOLD
    );

    // Update recent moods window with calculated mood
    recentMoodsRef.current.push(result.calculatedMood);
    if (recentMoodsRef.current.length > MOOD_WINDOW_SIZE) {
      recentMoodsRef.current.shift();
    }

    // Always update the display with the smoothed mood
    setMood(result.smoothedMood);

    // Update audio if mood should change
    if (result.shouldUpdate && result.smoothedMood !== currentMood) {
      if (audioRef.current) {
        audioRef.current.src = `/sounds/${result.smoothedMood}.mp3`;
        audioRef.current.play().catch((error) => {
          console.error("Error playing audio:", error);
        });
      }

      moodHistoryRef.current.push(result.smoothedMood);
    }

    return null;
  };

  const start = async () => {
    const media = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    try {
      await startTranscribing();
    } catch (error) {
      console.error("Error starting transcription:", error);
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = media;
    }

    setIsStreaming(true);

    // Start face detection
    startDetection();

    moodIntervalRef.current = setInterval(handleMoodChange, INTERVAL);
  };

  const stop = async () => {
    stopTranscribing();

    // Stop face detection
    stopDetection();
    setMood(null);

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

    // Reset mood detection state
    moodHistoryRef.current = [];
    recentMoodsRef.current = [];

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
      <div style={{ position: "relative", width: "100%" }}>
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="preview"
        />
        <canvas ref={canvasRef} className="canvas"></canvas>
      </div>
      {mood && <p>Mood: {mood}</p>}
      <button onClick={toggle}>
        {isStreaming ? "Stop Streaming" : "Start Streaming"}
      </button>
      {scribe.partialTranscript && <p>Live: {scribe.partialTranscript}</p>}
      <audio ref={audioRef} loop>
        <source type="audio/mpeg" />
      </audio>
    </section>
  );
}

export default App;
