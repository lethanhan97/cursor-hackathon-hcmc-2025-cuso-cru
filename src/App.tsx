import { useRef, useState } from "react";
import "./App.css";

function App() {
  const localVideoRef = useRef<
    HTMLVideoElement & { srcObject: MediaStream | null }
  >(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const start = async () => {
    const media = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = media;
    }

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
      <button onClick={toggle}>
        {isStreaming ? "Stop Streaming" : "Start Streaming"}
      </button>
    </section>
  );
}

export default App;
