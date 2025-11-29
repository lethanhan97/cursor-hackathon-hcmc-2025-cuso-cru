import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

// Configure CORS to accept requests from anywhere
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

const ELEVENLABS_API_KEY = "hehe you wish";

app.get("/scribe-token", async (c) => {
  const response = await fetch(
    "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
      },
    }
  );

  const data = await response.json();
  return c.json({ token: data.token });
});

export default app;
