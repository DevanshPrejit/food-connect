import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Clock, Utensils, TrendingUp, Loader2, WifiOff, Sparkles, MapPin } from "lucide-react";
import type { ScoredNGO } from "@/lib/ml-api";

interface SmartMatchProps {
  results: ScoredNGO[] | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onDispatch?: () => void;
}

const MEDALS = ["🥇", "🥈", "🥉"];

function scoreColor(score: number): string {
  if (score >= 0.7) return "from-emerald-500 to-green-400";
  if (score >= 0.4) return "from-amber-500 to-yellow-400";
  return "from-rose-500 to-red-400";
}

function compatLabel(c: number): string {
  if (c >= 1) return "Perfect";
  if (c >= 0.5) return "Partial";
  return "None";
}

export default function SmartMatch({
  results,
  loading,
  error,
  onClose,
  onDispatch,
}: SmartMatchProps) {
  const [dispatched, setDispatched] = useState(false);

  const handleDispatch = () => {
    setDispatched(true);
    onDispatch?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-600/10 to-fuchsia-600/10 border-b border-border">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-violet-500" />
          <h2 className="text-lg font-bold text-foreground">Smart Match</h2>
          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-500 uppercase tracking-wider">
            ML Powered
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="p-6">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
            <p className="text-sm">Analyzing NGOs with ML model…</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <WifiOff className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={onClose}
              className="mt-2 rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80 transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Results */}
        {!loading && !error && results && (
          <>
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <MapPin className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">No NGOs found nearby</p>
                <p className="text-xs text-muted-foreground text-center">
                  There are no registered NGOs within 50km of your pickup location.
                  <br />
                  Try a different pickup address or check back later.
                </p>
              </div>
            ) : (
              <AnimatePresence>
                <div className="space-y-3">
                  {results.map((ngo, i) => (
                    <motion.div
                      key={ngo.ngo_name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="group relative rounded-xl border border-border bg-background p-4 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: rank + name */}
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl leading-none select-none">
                            {i < 3 ? MEDALS[i] : `#${ngo.rank}`}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">
                              {ngo.ngo_name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {ngo.ngo_contact}
                            </p>
                          </div>
                        </div>

                        {/* Right: score */}
                        <div className="text-right shrink-0">
                          <p className="text-2xl font-extrabold tabular-nums bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
                            {(ngo.final_score * 100).toFixed(0)}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Score
                          </p>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {/* Travel time */}
                        <div className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5">
                          <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-foreground">
                              {ngo.predicted_time_min} min
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Travel
                            </p>
                          </div>
                        </div>

                        {/* Urgency */}
                        <div className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5">
                          <TrendingUp className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-foreground">
                              {(ngo.urgency_score * 100).toFixed(0)}%
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Urgency
                            </p>
                          </div>
                        </div>

                        {/* Compatibility */}
                        <div className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5">
                          <Utensils className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-foreground">
                              {compatLabel(ngo.compatibility)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Compat
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Score bar */}
                      <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full bg-gradient-to-r ${scoreColor(ngo.final_score)}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${ngo.final_score * 100}%` }}
                          transition={{ duration: 0.6, delay: i * 0.08 + 0.2 }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </AnimatePresence>
            )}

            {/* Dispatch button */}
            {results.length > 0 && onDispatch && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleDispatch}
                  disabled={dispatched}
                  className={`group flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all ${dispatched
                    ? "bg-emerald-500/15 text-emerald-500 cursor-default"
                    : "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98]"
                    }`}
                >
                  <Sparkles
                    className={`h-4 w-4 ${dispatched ? "" : "group-hover:animate-pulse"}`}
                  />
                  {dispatched
                    ? "Notifications Dispatched ✓"
                    : "Dispatch Notifications to Top NGOs"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
