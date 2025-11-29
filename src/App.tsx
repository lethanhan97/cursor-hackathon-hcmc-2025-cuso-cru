import { useEffect, useRef, useState } from "react";
import "./App.css";
import * as faceapi from "@vladmandic/face-api";
import { useAutoTranscription } from "./hooks/useAutoTranscription";

await faceapi.nets.ssdMobilenetv1.loadFromUri("/model");
await faceapi.nets.faceExpressionNet.loadFromUri("/model");
await faceapi.nets.faceLandmark68Net.loadFromUri("/model");
await faceapi.nets.ageGenderNet.loadFromUri("/model");

const optionsSSDMobileNet = new faceapi.SsdMobilenetv1Options({
  minConfidence: 0.2,
  maxResults: 5,
});

const INTERVAL = 2_000;

type Mood =
  | "angry"
  | "disgusted"
  | "fearful"
  | "happy"
  | "neutral"
  | "sad"
  | "surprised";

// Helper function to draw detected faces on canvas
const drawFaces = (
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  // Using type assertion since face-api types are complex
  detections: Array<{
    detection: { box: { x: number; y: number; width: number; height: number } };
    expressions: faceapi.FaceExpressions;
    landmarks: { positions: Array<{ x: number; y: number }> };
    gender: string;
    genderProbability: number;
    age: number;
    angle: { roll: number; pitch: number; yaw: number };
  }>,
  fps: number
) => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Get the actual displayed video dimensions
  const videoRect = video.getBoundingClientRect();
  const displayedWidth = videoRect.width;
  const displayedHeight = videoRect.height;

  // Calculate the video's natural aspect ratio
  const videoAspect = video.videoWidth / video.videoHeight;
  const displayAspect = displayedWidth / displayedHeight;

  // Calculate actual visible video area (accounting for letterboxing/pillarboxing)
  let visibleWidth = displayedWidth;
  let visibleHeight = displayedHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (videoAspect > displayAspect) {
    // Video is wider - letterboxing (black bars top/bottom)
    visibleHeight = displayedWidth / videoAspect;
    offsetY = (displayedHeight - visibleHeight) / 2;
  } else {
    // Video is taller - pillarboxing (black bars left/right)
    visibleWidth = displayedHeight * videoAspect;
    offsetX = (displayedWidth - visibleWidth) / 2;
  }

  // Calculate scale factors based on visible area
  const scaleX = visibleWidth / video.videoWidth;
  const scaleY = visibleHeight / video.videoHeight;

  // Draw FPS
  ctx.font = 'small-caps 20px "Segoe UI"';
  ctx.fillStyle = "white";
  ctx.fillText(`FPS: ${fps.toFixed(1)}`, 10, 25);

  for (const person of detections) {
    // Scale detection box coordinates and add offset for letterboxing
    const box = {
      x: person.detection.box.x * scaleX + offsetX,
      y: person.detection.box.y * scaleY + offsetY,
      width: person.detection.box.width * scaleX,
      height: person.detection.box.height * scaleY,
    };

    // Draw box around each face
    ctx.lineWidth = 3;
    ctx.strokeStyle = "deepskyblue";
    ctx.fillStyle = "deepskyblue";
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.width, box.height);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Draw text labels
    const expression = Object.entries(person.expressions).sort(
      (a, b) => (b[1] as number) - (a[1] as number)
    ) as Array<[string, number]>;

    ctx.fillStyle = "black";
    ctx.fillText(
      `gender: ${Math.round(100 * person.genderProbability)}% ${person.gender}`,
      box.x,
      box.y - 59
    );
    ctx.fillText(
      `expression: ${Math.round(100 * expression[0][1])}% ${expression[0][0]}`,
      box.x,
      box.y - 41
    );
    ctx.fillText(`age: ${Math.round(person.age)} years`, box.x, box.y - 23);
    ctx.fillText(
      `roll:${person.angle.roll.toFixed(1)}° pitch:${person.angle.pitch.toFixed(
        1
      )}° yaw:${person.angle.yaw.toFixed(1)}°`,
      box.x,
      box.y - 5
    );

    ctx.fillStyle = "lightblue";
    ctx.fillText(
      `gender: ${Math.round(100 * person.genderProbability)}% ${person.gender}`,
      box.x,
      box.y - 60
    );
    ctx.fillText(
      `expression: ${Math.round(100 * expression[0][1])}% ${expression[0][0]}`,
      box.x,
      box.y - 42
    );
    ctx.fillText(`age: ${Math.round(person.age)} years`, box.x, box.y - 24);
    ctx.fillText(
      `roll:${person.angle.roll.toFixed(1)}° pitch:${person.angle.pitch.toFixed(
        1
      )}° yaw:${person.angle.yaw.toFixed(1)}°`,
      box.x,
      box.y - 6
    );

    // Draw face landmarks (scaled with offset)
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = "lightblue";
    const pointSize = 2;
    for (let i = 0; i < person.landmarks.positions.length; i++) {
      ctx.beginPath();
      ctx.arc(
        person.landmarks.positions[i].x * scaleX + offsetX,
        person.landmarks.positions[i].y * scaleY + offsetY,
        pointSize,
        0,
        2 * Math.PI
      );
      ctx.fill();
    }
  }
};

// Continuous face detection using requestAnimationFrame
const createDetectVideo = (
  getIsStreaming: () => boolean,
  setFrameRef: (frame: number | null) => void
) => {
  return async (video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    if (!video || video.paused || !getIsStreaming()) {
      setFrameRef(null);
      return false;
    }

    const t0 = performance.now();

    try {
      const detections = await faceapi
        .detectAllFaces(video, optionsSSDMobileNet)
        .withFaceLandmarks()
        .withFaceExpressions()
        .withAgeAndGender();

      const t1 = performance.now();
      const fps = 1000 / (t1 - t0);
      drawFaces(
        canvas,
        video,
        detections as Parameters<typeof drawFaces>[2],
        fps
      );

      // Continue detection loop
      const frameId = requestAnimationFrame(() => {
        const detectFn = createDetectVideo(getIsStreaming, setFrameRef);
        detectFn(video, canvas);
      });
      setFrameRef(frameId);
      return true;
    } catch (err) {
      console.error("Detect Error:", err);
      setFrameRef(null);
      return false;
    }
  };
};

function App() {
  const localVideoRef = useRef<
    HTMLVideoElement & { srcObject: MediaStream | null }
  >(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const moodIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const moodHistoryRef = useRef<Mood[]>([]);
  const detectionFrameRef = useRef<number | null>(null);
  const isStreamingRef = useRef(false);
  const { startTranscribing, stopTranscribing, scribe } =
    useAutoTranscription();

  const [mood, setMood] = useState<Mood | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  // Helper function to update canvas size to match video display size
  const updateCanvasSize = () => {
    if (localVideoRef.current && canvasRef.current) {
      const video = localVideoRef.current;
      const canvas = canvasRef.current;

      // Use getBoundingClientRect to get exact pixel dimensions
      const rect = video.getBoundingClientRect();
      const displayWidth = Math.round(rect.width);
      const displayHeight = Math.round(rect.height);

      if (displayWidth > 0 && displayHeight > 0) {
        // Set canvas internal resolution to match displayed size exactly
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        // Canvas CSS size should match the video's CSS size
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
      }
    }
  };

  // Handle window resize to update canvas size
  useEffect(() => {
    if (!isStreaming) return;

    const handleResize = () => {
      updateCanvasSize();
    };

    window.addEventListener("resize", handleResize);
    // Also check periodically in case video size changes
    const interval = setInterval(updateCanvasSize, 100);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearInterval(interval);
    };
  }, [isStreaming]);

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
    await startTranscribing();

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = media;
    }

    setIsStreaming(true);
    isStreamingRef.current = true;

    // Wait for video to be ready, then setup canvas and start detection
    if (localVideoRef.current && canvasRef.current) {
      const video = localVideoRef.current;
      const canvas = canvasRef.current;

      const setupCanvas = () => {
        if (video.readyState >= 2) {
          // Wait for video to be rendered to get actual display dimensions
          const initCanvas = () => {
            updateCanvasSize();
            video.play();
            // Start continuous face detection
            const detectFn = createDetectVideo(
              () => isStreamingRef.current,
              (frame) => {
                detectionFrameRef.current = frame;
              }
            );
            const frameId = requestAnimationFrame(() =>
              detectFn(video, canvas)
            );
            detectionFrameRef.current = frameId;
          };

          // Use requestAnimationFrame to ensure video is rendered
          requestAnimationFrame(() => {
            requestAnimationFrame(initCanvas);
          });
        } else {
          video.addEventListener("loadeddata", setupCanvas, { once: true });
        }
      };

      setupCanvas();
    }
    moodIntervalRef.current = setInterval(handleMoodChange, INTERVAL);
  };
  const stop = async () => {
    stopTranscribing();
    // Stop face detection animation frame
    if (detectionFrameRef.current !== null) {
      cancelAnimationFrame(detectionFrameRef.current);
      detectionFrameRef.current = null;
    }

    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject;
      const tracks = stream.getTracks();

      tracks.forEach((track) => track.stop());

      localVideoRef.current.srcObject = null;
    }

    setIsStreaming(false);
    isStreamingRef.current = false;

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
      {/* Temporarily disabled audio so it s not too noisy at venue */}
      {/* <audio ref={audioRef} loop>
        <source type="audio/mpeg" />
      </audio> */}
    </section>
  );
}

export default App;
