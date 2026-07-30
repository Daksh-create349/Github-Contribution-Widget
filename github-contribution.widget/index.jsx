// ─────────────────────────────────────────────────────────────
//  github-contribution.widget/index.jsx
//  Übersicht widget — GitHub Contribution Heatmap
//  Battery-optimised, zero-rerender drag.
// ─────────────────────────────────────────────────────────────
import { React } from "uebersicht";
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ── CONFIG ────────────────────────────────────────────────────
const GITHUB_USERNAME = "ENTER_YOUR_USERNAME";   // ← your GitHub username
const DEFAULT_X = 20;          // starting X (pixels from left)
const DEFAULT_Y = 20;          // starting Y (pixels from top)
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "github-widget-pos-v1";

// 4-hour refresh — contributions don't update frequently.
// Changing this to a lower value wastes battery.
export const refreshFrequency = 4 * 60 * 60 * 1000;

// Shell command: fetch contributions from public API + avatar from GitHub API
export const command = `curl -sf --max-time 10 "https://github-contributions-api.jogruber.de/v4/${GITHUB_USERNAME}?y=last" && echo "==WIDGET_SEPARATOR==" && (curl -sf --max-time 10 "https://api.github.com/users/${GITHUB_USERNAME}" || true)`;

// Shell command: fetch GitHub user profile for avatar
export const command2 = `curl -sf --max-time 10 "https://api.github.com/users/${GITHUB_USERNAME}"`;

// Color palette
const COLORS = ["rgba(22,27,34,0.85)", "#0e4429", "#006d32", "#26a641", "#39d353"];

// Full-screen transparent overlay — pointer-events:none so we
// don't block desktop clicks. Only the card has pointer-events:auto.
export const className = {
  position: "fixed",
  top: 0, left: 0,
  width: "100vw",
  height: "100vh",
  pointerEvents: "none",
  zIndex: 1,
  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
  WebkitFontSmoothing: "antialiased",
};

// ── Pure helpers (no side-effects, safe to useMemo) ──────────
function getLevelColor(count) {
  if (count <= 0) return COLORS[0];
  if (count <= 4) return COLORS[1];
  if (count <= 9) return COLORS[2];
  if (count <= 19) return COLORS[3];
  return COLORS[4];
}

function buildWeeks(days) {
  if (!days.length) return [];
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const startDay = new Date(sorted[0].date + "T00:00:00Z").getUTCDay();
  const cells = Array(startDay).fill(null).concat(sorted);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7)
    weeks.push(cells.slice(i, Math.min(i + 7, cells.length)));
  return weeks;
}

function computeStreaks(days) {
  if (!days.length) return { current: 0, longest: 0, total: 0 };
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const total = sorted.reduce((s, d) => s + d.count, 0);
  let longest = 0, temp = 0;
  for (const d of sorted) {
    if (d.count > 0) { temp++; if (temp > longest) longest = temp; }
    else temp = 0;
  }
  let idx = sorted.length - 1;
  if (sorted[idx]?.count === 0 && idx > 0) idx--;
  let current = 0;
  while (idx >= 0 && sorted[idx].count > 0) { current++; idx--; }
  return { current, longest, total };
}

function formatDate(dateStr) {
  return new Date(dateStr + "T00:00:00Z")
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function loadSavedPos() {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (typeof p.x === "number" && typeof p.y === "number") return p;
  } catch (_) { }
  return { x: DEFAULT_X, y: DEFAULT_Y };
}

// ── Main Component ────────────────────────────────────────────
const Widget = ({ output, error }) => {
  // Parse API output — only runs when `output` changes
  const { days, avatarUrl } = useMemo(() => {
    if (!output) return { days: [], avatarUrl: null };
    try {
      // Output contains two JSON responses separated by ==WIDGET_SEPARATOR==
      const parts = output.split('==WIDGET_SEPARATOR==');
      const contribData = JSON.parse(parts[0] || '{}');
      const userData = JSON.parse(parts[1] || '{}');

      if (contribData.error) return { days: [], avatarUrl: null };

      return {
        days: (contribData.contributions || []),
        avatarUrl: userData.avatar_url || null
      };
    } catch (_) { return { days: [], avatarUrl: null }; }
  }, [output]);

  const parseError = useMemo(() => {
    if (!output && !error) return null;
    if (error) return error;
    try {
      const parts = output.split('==WIDGET_SEPARATOR==');
      const contribData = JSON.parse(parts[0] || '{}');
      return contribData.error || null;
    } catch (_) { return "Invalid response"; }
  }, [output, error]);

  const weeks = useMemo(() => buildWeeks(days), [days]);
  const streaks = useMemo(() => computeStreaks(days), [days]);
  const timeStr = useMemo(() =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    [output]); // Only update timestamp when data refreshes

  // ── Drag — ZERO re-renders during move ─────────────────────
  // We use a ref to the card DOM node and mutate its style
  // directly, bypassing React entirely during the drag gesture.
  const cardRef = useRef(null);
  const posRef = useRef(loadSavedPos());
  const dragOffset = useRef({ x: 0, y: 0 });
  const rafId = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const applyPos = useCallback((x, y) => {
    if (cardRef.current) {
      cardRef.current.style.left = `${x}px`;
      cardRef.current.style.top = `${y}px`;
    }
  }, []);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    dragOffset.current = {
      x: e.clientX - posRef.current.x,
      y: e.clientY - posRef.current.y,
    };
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e) => {
      // RAF throttle: skip frame if one is already queued
      if (rafId.current) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        const x = Math.max(0, Math.min(window.innerWidth - 440, e.clientX - dragOffset.current.x));
        const y = Math.max(0, Math.min(window.innerHeight - 220, e.clientY - dragOffset.current.y));
        posRef.current = { x, y };
        applyPos(x, y); // direct DOM mutation — no setState, no re-render
      });
    };

    const onUp = () => {
      if (rafId.current) { cancelAnimationFrame(rafId.current); rafId.current = null; }
      setIsDragging(false);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(posRef.current)); } catch (_) { }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (rafId.current) { cancelAnimationFrame(rafId.current); rafId.current = null; }
    };
  }, [isDragging, applyPos]);

  const isLoading = !output && !error;
  const p = posRef.current;

  return (
    <div
      ref={cardRef}
      style={{
        ...S.card,
        left: `${p.x}px`,
        top: `${p.y}px`,
        cursor: isDragging ? "grabbing" : "default",
      }}
    >
      {/* Header / drag handle */}
      <div
        style={{ ...S.header, cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        title="Drag to move"
      >
        <div style={S.headerLeft}>
          <div style={S.dot} />
          {avatarUrl && <img src={avatarUrl} alt="" style={S.avatar} />}
          <span style={S.username}>@{GITHUB_USERNAME}</span>
          <span style={S.dragHint}>⠿</span>
        </div>
        <span style={S.timestamp}>{timeStr}</span>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={S.center}>
          <div style={S.spinner} />
          <span style={S.muted}>Loading…</span>
        </div>
      )}

      {/* Error */}
      {parseError && !isLoading && (
        <div style={S.center}>
          <span style={{ fontSize: 22 }}>⚠</span>
          <span style={{ ...S.muted, color: "#fca5a5", fontSize: 11 }}>{parseError}</span>
        </div>
      )}

      {/* Heatmap */}
      {!isLoading && !parseError && (
        <>
          <div style={S.grid}>
            {weeks.map((week, wi) => (
              <div key={wi} style={S.col}>
                {week.map((day, di) =>
                  !day
                    ? <div key={di} style={S.empty} />
                    : <div
                      key={di}
                      title={`${day.count} contribution${day.count !== 1 ? "s" : ""} · ${formatDate(day.date)}`}
                      style={{ ...S.cell, background: getLevelColor(day.count) }}
                    />
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={S.footer}>
            <div style={S.stats}>
              {[
                ["Total", streaks.total.toLocaleString()],
                ["Streak", `${streaks.current}d`],
                ["Best", `${streaks.longest}d`],
              ].map(([label, value]) => (
                <div key={label} style={S.stat}>
                  <span style={S.statLabel}>{label}</span>
                  <span style={S.statValue}>{value}</span>
                </div>
              ))}
            </div>
            <div style={S.legend}>
              <span style={S.muted}>Less</span>
              {COLORS.map((c, i) => <div key={i} style={{ ...S.legendCell, background: c }} />)}
              <span style={S.muted}>More</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const render = (props) => <Widget {...props} />;

// ── Styles ────────────────────────────────────────────────────
const CELL = 9, GAP = 2.5;

const S = {
  card: {
    position: "absolute",
    width: "420px",
    // Reduced blur radius vs before — still looks glass but less GPU load
    background: "rgba(13,17,23,0.92)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: "16px",
    boxShadow: "0 16px 40px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.05) inset",
    padding: "14px",
    overflow: "hidden",
    pointerEvents: "auto",
    userSelect: "none",
    // Hint to GPU to keep this layer composited — avoids repaint on drag
    willChange: "left, top",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: "10px", padding: "2px 0",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: "7px" },
  dot: {
    width: 7, height: 7, borderRadius: "50%",
    background: "#39d353", boxShadow: "0 0 7px #39d35399", flexShrink: 0,
  },
  avatar: { width: 20, height: 20, borderRadius: "50%", flexShrink: 0 },
  username: { fontSize: 12, fontWeight: 600, color: "#e6edf3", letterSpacing: "-0.01em" },
  dragHint: { fontSize: 11, color: "rgba(139,148,158,0.35)", letterSpacing: "-1px" },
  timestamp: { fontSize: 10, color: "rgba(139,148,158,0.65)" },

  grid: { display: "flex", flexDirection: "row", gap: `${GAP}px`, marginBottom: "10px" },
  col: { display: "flex", flexDirection: "column", gap: `${GAP}px` },
  cell: { width: CELL, height: CELL, borderRadius: 2, flexShrink: 0 },
  empty: { width: CELL, height: CELL, flexShrink: 0 },

  footer: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "8px",
  },
  stats: { display: "flex", gap: "16px" },
  stat: { display: "flex", flexDirection: "column", gap: 1 },
  statLabel: { fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(139,148,158,0.6)" },
  statValue: { fontSize: 14, fontWeight: 700, color: "#e6edf3", letterSpacing: "-0.02em" },
  legend: { display: "flex", alignItems: "center", gap: 3 },
  legendCell: { width: 8, height: 8, borderRadius: 2, flexShrink: 0 },
  muted: { fontSize: 9, color: "rgba(139,148,158,0.5)" },
  center: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "18px 0" },
  spinner: {
    width: 14, height: 14,
    border: "2px solid rgba(255,255,255,0.08)",
    borderTop: "2px solid #39d353",
    borderRadius: "50%",
    // Only animate during initial load — not a continuous background animation
    animation: "spin 1s linear infinite",
  },
};
