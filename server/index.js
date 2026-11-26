import cors from "cors";
import express from "express";
import { opponentForRound, parseRound } from "./opponents.js";
import { getHallEntries, submitHallRun } from "./hallOfFame.js";

const app = express();
const port = Number(process.env.PORT ?? 4200);

app.use(cors());
app.use(express.json());
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "backpack-brawl" }));

app.get("/api/opponents", (req, res) => {
  const requested = Number(req.query.latency ?? process.env.API_LATENCY ?? 1200);
  const latency = Number.isFinite(requested) ? Math.max(0, Math.min(5000, requested)) : 1200;
  setTimeout(() => {
    const round = parseRound(req.query.round);
    if (round === null) return res.status(400).json({ error: "round must be a positive whole number" });
    if (req.query.fail === "true" || process.env.API_FAIL === "true") {
      return res.status(503).json({ error: "The arena gates are shut. No challenger answered the call." });
    }
    res.json(opponentForRound(round));
  }, latency);
});

app.get("/api/hall-of-fame", (_req, res) => {
  res.json({ entries: getHallEntries() });
});

app.post("/api/hall-of-fame", (req, res) => {
  const result = submitHallRun(req.body);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.status(result.duplicate ? 200 : 201).json({ entry: result.entry, duplicate: result.duplicate });
});

// Errors Express throws itself, e.g. a body that isn't valid JSON: answer with a clear JSON error
// instead of Express's default HTML page (which would also show server file paths).
app.use((error, _req, res, _next) => {
  if (error.type === "entity.parse.failed") return res.status(400).json({ error: "The request body must be valid JSON." });
  console.error(error);
  res.status(500).json({ error: "Something went wrong on the server." });
});

app.listen(port, () => console.log(`Backpack Brawl API listening on http://localhost:${port}`));
