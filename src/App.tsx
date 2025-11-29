import { useRef } from "react";
import "./App.css";

function App() {
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const start = async () => {
    const media = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = media;
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
      <button onClick={start}>Start WebRTC</button>
    </section>
  );
}

export default App;
