import { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import {
  BarChart3, Code, Download, FileText, GitBranch, Inbox, LayoutDashboard, Loader2,
  LogOut, Plus, Search, ShieldCheck, Sparkles, Target, Trash2, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const ROLES = ["Frontend Engineer", "Full Stack Engineer", "Backend Engineer", "Data Engineer", "ML Engineer"];

const emptyCandidate = {
  name: "", role: "Full Stack Engineer", githubUser: "", leetcodeUser: "",
  leetcodeSolved: 0, leetcodeAcceptance: 0, resumeText: ""
};

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Request failed.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

/* ---------- helpers ---------- */
const STOPS = [[239, 68, 68], [245, 158, 11], [16, 185, 129]]; // red -> amber -> emerald

function heat(value) {
  const t = Math.min(Math.max(value, 0), 100) / 100;
  const [from, to, k] = t < 0.5 ? [STOPS[0], STOPS[1], t * 2] : [STOPS[1], STOPS[2], (t - 0.5) * 2];
  const rgb = from.map((c, i) => Math.round(c + (to[i] - c) * k));
  const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return { bg: `rgb(${rgb.join(",")})`, fg: luminance > 150 ? "#1c1917" : "#ffffff" };
}

const tone = (score) =>
  score >= 75 ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
  : score >= 55 ? "bg-amber-50 text-amber-800 ring-amber-600/25"
  : "bg-rose-50 text-rose-700 ring-rose-600/20";

const AVATAR_TONES = [
  "bg-indigo-100 text-indigo-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-700", "bg-sky-100 text-sky-700", "bg-violet-100 text-violet-700"
];

const initials = (name = "") =>
  name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";

/* ---------- small building blocks ---------- */
function Avatar({ name, className }) {
  const seed = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return (
    <div className={cn("grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold", AVATAR_TONES[seed % AVATAR_TONES.length], className)}>
      {initials(name)}
    </div>
  );
}

function Pill({ score, children, className }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", tone(score), className)}>
      {children}
    </span>
  );
}

function Ring({ value, size = 44, stroke = 5, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={heat(value).bg} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${(c * value) / 100} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

function Bar({ value }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: heat(value).bg }} />
    </div>
  );
}

function Panel({ title, description, action, children, className }) {
  return (
    <section className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h3 className="font-semibold text-slate-900">{title}</h3>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/* ---------- app ---------- */
export default function App() {
  const [user, setUser] = useState(undefined);
  const [candidate, setCandidate] = useState(emptyCandidate);
  const [evaluation, setEvaluation] = useState(null);
  const [shortlist, setShortlist] = useState([]);
  const [tab, setTab] = useState("evaluate");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiRequest("/api/auth/me").then((p) => setUser(p.user)).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!user) return;
    apiRequest("/api/shortlist")
      .then((payload) => {
        setShortlist(payload.shortlist);
        if (payload.shortlist.length) {
          setEvaluation(payload.shortlist[0]);
          setTab("results");
        }
      })
      .catch((error) => {
        if (error.status === 401) setUser(null);
        else toast.error(error.message);
      });
  }, [user]);

  function update(field, value) {
    const numeric = field === "leetcodeSolved" || field === "leetcodeAcceptance";
    setCandidate((current) => ({ ...current, [field]: numeric ? Number(value || 0) : value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = await apiRequest("/api/evaluate", { method: "POST", body: JSON.stringify({ candidate }) });
      setEvaluation(payload.evaluation);
      setShortlist(payload.shortlist);
      setTab("results");
      const warning = payload.evaluation.warnings?.[0];
      if (warning) toast.warning(`${warning} Fallback evidence used.`);
      else toast.success("Evaluation saved.");
    } catch (error) {
      if (error.status === 401) setUser(null);
      else toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  function selectRow(row) {
    setEvaluation(row);
    setCandidate(row.candidate);
    setTab("results");
  }

  async function removeRow(id) {
    try {
      const payload = await apiRequest(`/api/candidates/${encodeURIComponent(id)}`, { method: "DELETE" });
      setShortlist(payload.shortlist);
      if (evaluation?.id === id) {
        setEvaluation(null);
        setTab("evaluate");
      }
      toast.success("Candidate removed.");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function importResume(event) {
    const [file] = event.target.files;
    if (!file) return;
    update("resumeText", await file.text());
    toast.success("Resume text imported.");
  }

  function exportJson() {
    if (!evaluation) return;
    const blob = new Blob([JSON.stringify(evaluation, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${evaluation.candidate.name.replace(/\s+/g, "-").toLowerCase()}-evaluation.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function logout() {
    await apiRequest("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setShortlist([]);
    setEvaluation(null);
    setCandidate(emptyCandidate);
    setTab("evaluate");
  }

  if (user === undefined) return null;
  if (user === null) {
    return (
      <>
        <Toaster richColors position="top-right" />
        <AuthScreen onAuth={setUser} />
      </>
    );
  }

  return (
    <>
      <Toaster richColors position="top-right" />
      <div className="min-h-screen bg-slate-50 text-slate-900 lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <Sidebar user={user} tab={tab} hasResults={Boolean(evaluation)} onNav={setTab} onLogout={logout} />

      <div className="min-w-0">
        <header className="flex h-14 items-center justify-between border-b bg-white px-4 lg:hidden">
          <Brand dark={false} />
          <Button variant="outline" size="sm" onClick={logout}><LogOut className="size-4" /> Sign out</Button>
        </header>

        <main className="mx-auto grid max-w-6xl gap-6 p-4 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-indigo-600">Hiring dashboard</p>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                Welcome back, {user.name.split(" ")[0]}
              </h1>
              <p className="mt-1 text-sm text-slate-500">Evaluate candidates and see who is most likely to be recruited.</p>
            </div>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setTab("evaluate")}>
              <Plus className="size-4" /> New evaluation
            </Button>
          </div>

          <StatCards scores={evaluation?.scores} />

          <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <CandidateList rows={shortlist} activeId={evaluation?.id} onSelect={selectRow} onRemove={removeRow} />

            <Tabs value={tab} onValueChange={setTab} className="min-w-0">
              <TabsContent value="evaluate">
                <EvaluationForm candidate={candidate} busy={busy} onChange={update} onSubmit={submit} onResume={importResume} />
              </TabsContent>
              <TabsContent value="results">
                {evaluation && <Results evaluation={evaluation} onExport={exportJson} />}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
      </div>
    </>
  );
}

function Brand({ dark = true }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white shadow-lg shadow-indigo-500/30">E</div>
      <span className={cn("text-lg font-semibold tracking-tight", dark ? "text-white" : "text-slate-900")}>EvalFlow</span>
    </div>
  );
}

function Sidebar({ user, tab, hasResults, onNav, onLogout }) {
  const items = [
    { id: "results", label: "Overview", Icon: LayoutDashboard, disabled: !hasResults },
    { id: "evaluate", label: "New evaluation", Icon: Plus, disabled: false }
  ];
  return (
    <aside className="sticky top-0 hidden h-screen flex-col bg-slate-950 p-4 text-slate-300 lg:flex">
      <div className="px-2 py-3"><Brand /></div>
      <nav className="mt-6 grid gap-1" aria-label="Main">
        {items.map(({ id, label, Icon, disabled }) => (
          <button
            key={id} type="button" disabled={disabled} onClick={() => onNav(id)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-40",
              tab === id ? "bg-indigo-500/15 text-white ring-1 ring-indigo-400/30" : "hover:bg-white/5 hover:text-white"
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </nav>
      <div className="mt-auto rounded-xl bg-white/5 p-3">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} className="size-9 bg-indigo-500/20 text-indigo-200" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-slate-400">{user.email}</p>
          </div>
        </div>
        <button type="button" onClick={onLogout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white">
          <LogOut className="size-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}

function StatCards({ scores }) {
  const items = [
    ["Overall fit", scores?.overall, Target, "bg-indigo-50 text-indigo-600"],
    ["GitHub", scores?.github, GitBranch, "bg-violet-50 text-violet-600"],
    ["Problem solving", scores?.leetcode, Code, "bg-sky-50 text-sky-600"],
    ["Resume match", scores?.resume, FileText, "bg-emerald-50 text-emerald-600"]
  ];
  return (
    <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Score summary">
      {items.map(([label, value, Icon, iconTone]) => (
        <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">{label}</span>
            <span className={cn("grid size-8 place-items-center rounded-lg", iconTone)}><Icon className="size-4" /></span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-semibold tabular-nums tracking-tight">{value ?? "–"}</span>
            {value != null && <span className="text-sm text-slate-400">/ 100</span>}
          </div>
          <div className="mt-3"><Bar value={value ?? 0} /></div>
        </div>
      ))}
    </section>
  );
}

function CandidateList({ rows, activeId, onSelect, onRemove }) {
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () => rows.filter((row) => row.candidate.name.toLowerCase().includes(query.toLowerCase())),
    [rows, query]
  );
  return (
    <Panel title="Candidates" description={rows.length ? `${rows.length} evaluated` : "Nobody evaluated yet"}>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Search candidates" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {visible.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-slate-200 py-8 text-center">
          <Inbox className="size-6 text-slate-300" />
          <p className="text-sm text-slate-500">{rows.length ? "No match found" : "Submit a candidate to see them here."}</p>
        </div>
      ) : (
        <ul className="-mx-2 grid gap-1">
          {visible.map((row) => (
            <li key={row.id} className={cn("group flex items-center gap-1 rounded-xl pr-1 transition-colors", row.id === activeId ? "bg-indigo-50 ring-1 ring-indigo-200" : "hover:bg-slate-50")}>
              <button type="button" onClick={() => onSelect(row)} className="flex min-w-0 flex-1 items-center gap-3 p-2 text-left">
                <Avatar name={row.candidate.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{row.candidate.name}</span>
                  <span className="block truncate text-xs text-slate-500">{row.candidate.role}</span>
                </span>
                <Ring value={row.scores.overall} size={40} stroke={4}>
                  <span className="text-xs font-semibold tabular-nums">{row.scores.overall}</span>
                </Ring>
              </button>
              <button
                type="button" aria-label={`Remove ${row.candidate.name}`} onClick={() => onRemove(row.id)}
                className="grid size-8 place-items-center rounded-lg text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Field({ id, label, hint, children, className }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-slate-700">{label}</Label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function EvaluationForm({ candidate, busy, onChange, onSubmit, onResume }) {
  return (
    <Panel title="New evaluation" description="Submit the details to see how likely this candidate is to be recruited.">
      <form onSubmit={onSubmit} className="grid gap-6">
        <fieldset className="grid gap-4 md:grid-cols-2">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Profile</legend>
          <Field id="name" label="Candidate name">
            <Input id="name" required placeholder="e.g. Aarav Sharma" value={candidate.name} onChange={(e) => onChange("name", e.target.value)} />
          </Field>
          <Field id="role" label="Target role">
            <Select value={candidate.role} onValueChange={(value) => onChange("role", value)}>
              <SelectTrigger id="role" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </fieldset>

        <fieldset className="grid gap-4 md:grid-cols-2">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Coding signals</legend>
          <Field id="github" label="GitHub username" hint="Used to read public repos and activity.">
            <Input id="github" placeholder="octocat" value={candidate.githubUser} onChange={(e) => onChange("githubUser", e.target.value)} />
          </Field>
          <Field id="lcUser" label="LeetCode username">
            <Input id="lcUser" value={candidate.leetcodeUser} onChange={(e) => onChange("leetcodeUser", e.target.value)} />
          </Field>
          <Field id="solved" label="Problems solved">
            <Input id="solved" type="number" min="0" value={candidate.leetcodeSolved} onChange={(e) => onChange("leetcodeSolved", e.target.value)} />
          </Field>
          <Field id="accept" label="Acceptance rate (%)">
            <Input id="accept" type="number" min="0" max="100" value={candidate.leetcodeAcceptance} onChange={(e) => onChange("leetcodeAcceptance", e.target.value)} />
          </Field>
        </fieldset>

        <fieldset className="grid gap-4">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Resume</legend>
          <Field id="resume" label="Resume text or summary">
            <Textarea id="resume" required rows={7} placeholder="Paste skills, projects and experience..." value={candidate.resumeText} onChange={(e) => onChange("resumeText", e.target.value)} />
          </Field>
          <Field id="file" label="Or import a file" hint="TXT, MD, CSV or JSON.">
            <Input id="file" type="file" accept=".txt,.md,.csv,.json" onChange={onResume} />
          </Field>
        </fieldset>

        <Button type="submit" size="lg" disabled={busy} className="h-11 bg-indigo-600 text-white hover:bg-indigo-700">
          {busy ? <><Loader2 className="size-4 animate-spin" /> Analyzing candidate...</> : <><Sparkles className="size-4" /> Submit and view recruitment potential</>}
        </Button>
      </form>
    </Panel>
  );
}

function Results({ evaluation, onExport }) {
  const { candidate, scores, recommendation, ai, potential, github, matchedKeywords = [], warnings = [] } = evaluation;
  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-20 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500" />
        <div className="px-5 pb-5">
          <div className="-mt-8 flex flex-wrap items-end justify-between gap-3">
            <Avatar name={candidate.name} className="size-16 text-lg ring-4 ring-white" />
            <Button variant="outline" size="sm" onClick={onExport}><Download className="size-4" /> Export JSON</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">{candidate.name}</h2>
            <Pill score={scores.overall}>{recommendation}</Pill>
          </div>
          <p className="text-sm text-slate-500">{candidate.role}</p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">{ai?.summary}</p>
          {warnings.length > 0 && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{warnings[0]}</p>
          )}
        </div>
      </section>

      {potential && <PotentialHeatmap potential={potential} />}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Competency radar" description="Strength across key areas">
          <Radar data={scores.competencies} />
        </Panel>
        <Panel title="Scoring evidence" description="What the score is based on">
          <div className="grid gap-4">
            {[
              ["GitHub", scores.github, github.source === "github" ? `${github.repos} repos, ${github.followers} followers` : "Fallback profile used"],
              ["LeetCode", scores.leetcode, `${candidate.leetcodeSolved} solved, ${candidate.leetcodeAcceptance}% acceptance`],
              ["Resume", scores.resume, `${matchedKeywords.length} role keywords matched`]
            ].map(([label, value, detail]) => (
              <div key={label} className="grid gap-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{label}</span>
                  <span className="font-semibold tabular-nums">{value}</span>
                </div>
                <Bar value={value} />
                <span className="text-xs text-slate-500">{detail}</span>
              </div>
            ))}
          </div>
          {matchedKeywords.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5 border-t pt-4">
              {matchedKeywords.map((keyword) => (
                <span key={keyword} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{keyword}</span>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function PotentialHeatmap({ potential }) {
  const { score, probability, tier, targetRole, bestRole, columns, rows } = potential;
  const cols = "grid-cols-[minmax(150px,1.3fr)_repeat(4,minmax(0,1fr))]";
  return (
    <Panel
      title="Recruitment potential"
      description="How likely this candidate is to be recruited, by role"
      action={<Pill score={score}>{tier} potential</Pill>}
    >
      <div className="flex flex-wrap items-center gap-6">
        <Ring value={probability} size={136} stroke={12}>
          <div className="text-center">
            <div className="text-3xl font-semibold tabular-nums tracking-tight">{probability}%</div>
            <div className="text-[11px] text-slate-500">est. chance</div>
          </div>
        </Ring>
        <div className="max-w-md text-sm leading-relaxed text-slate-600">
          <p>
            Applied for <span className="font-semibold text-slate-900">{targetRole}</span>.{" "}
            {bestRole === targetRole ? "This is also the candidate's strongest fit." : <>Strongest fit overall: <span className="font-semibold text-slate-900">{bestRole}</span>.</>}
          </p>
          <p className="mt-1 text-slate-500">Scored from resume keywords, GitHub activity and LeetCode results.</p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <div className="min-w-[560px]">
          <div className={cn("grid gap-2 px-1.5 pb-2", cols)}>
            <div />
            {columns.map((column) => (
              <div key={column} className="text-center text-xs font-medium text-slate-500">{column}</div>
            ))}
          </div>
          <div className="grid gap-1.5">
            {rows.map((row) => {
              const isTarget = row.role === targetRole;
              return (
                <div key={row.role} className={cn("grid items-center gap-2 rounded-xl p-1.5", cols, isTarget && "bg-indigo-50 ring-1 ring-indigo-200")}>
                  <div className="flex items-center gap-2 pl-1 text-sm">
                    <span className={cn(isTarget ? "font-semibold text-slate-900" : "text-slate-600")}>{row.role}</span>
                    {isTarget && <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Applied</span>}
                  </div>
                  {row.values.map((value, index) => {
                    const color = heat(value);
                    return (
                      <div
                        key={columns[index]} title={`${columns[index]}: ${value}/100`}
                        className="flex h-11 items-center justify-center rounded-lg text-sm font-semibold tabular-nums shadow-sm transition-transform hover:scale-105"
                        style={{ background: color.bg, color: color.fg }}
                      >
                        {value}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-end gap-2 text-xs text-slate-500" aria-hidden="true">
            <span>Low</span>
            <span className="h-2 w-40 rounded-full" style={{ background: "linear-gradient(90deg,#ef4444,#f59e0b,#10b981)" }} />
            <span>High</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Radar({ data }) {
  const entries = Object.entries(data);
  const n = entries.length;
  const cx = 190, cy = 135, R = 90;
  const point = (i, v) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(angle) * (R * v) / 100, cy + Math.sin(angle) * (R * v) / 100];
  };
  const ring = (level) => entries.map((_, i) => point(i, level).join(",")).join(" ");
  return (
    <svg viewBox="0 0 380 270" className="mx-auto w-full max-w-md" role="img" aria-label="Competency radar chart">
      {[25, 50, 75, 100].map((level) => <polygon key={level} points={ring(level)} fill="none" stroke="#e2e8f0" />)}
      {entries.map((_, i) => {
        const [x, y] = point(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" />;
      })}
      <polygon points={entries.map(([, v], i) => point(i, v).join(",")).join(" ")} fill="rgb(79 70 229 / 0.18)" stroke="#4f46e5" strokeWidth="2" strokeLinejoin="round" />
      {entries.map(([label, value], i) => {
        const [x, y] = point(i, value);
        const [lx, ly] = point(i, 125);
        const anchor = lx < cx - 8 ? "end" : lx > cx + 8 ? "start" : "middle";
        return (
          <g key={label}>
            <circle cx={x} cy={y} r="3.5" fill="#4f46e5" />
            <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" className="fill-slate-600" fontSize="11">
              {label} <tspan fontWeight="600" className="fill-slate-900">{value}</tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = await apiRequest(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify(form) });
      onAuth(payload.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const features = [
    [BarChart3, "Recruitment heatmap", "See hiring potential across every role at a glance."],
    [Users, "Private shortlist", "Each recruiter only sees their own candidates."],
    [ShieldCheck, "Evidence based", "Scores come from GitHub, LeetCode and resume signals."]
  ];

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-12 text-slate-300 lg:flex">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="relative"><Brand /></div>
        <div className="relative">
          <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-tight text-white">Hire with evidence, not guesswork.</h2>
          <ul className="mt-10 grid gap-6">
            {features.map(([Icon, title, text]) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-indigo-300"><Icon className="size-5" /></span>
                <span><span className="block font-medium text-white">{title}</span><span className="text-sm text-slate-400">{text}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">EvalFlow recruiter workspace</p>
      </section>

      <section className="grid place-items-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Brand dark={false} /></div>
          <h1 className="text-2xl font-semibold tracking-tight">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-slate-500">{mode === "login" ? "Sign in to your workspace." : "Start evaluating candidates in minutes."}</p>
          <form onSubmit={submit} className="mt-8 grid gap-4">
            {mode === "register" && (
              <Field id="authName" label="Name">
                <Input id="authName" required autoComplete="name" value={form.name} onChange={set("name")} />
              </Field>
            )}
            <Field id="authEmail" label="Email">
              <Input id="authEmail" type="email" required autoComplete="email" value={form.email} onChange={set("email")} />
            </Field>
            <Field id="authPass" label="Password" hint={mode === "register" ? "At least 8 characters." : undefined}>
              <Input
                id="authPass" type="password" required minLength={mode === "register" ? 8 : undefined}
                autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={set("password")}
              />
            </Field>
            {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <Button type="submit" disabled={busy} className="h-11 bg-indigo-600 text-white hover:bg-indigo-700">
              {busy ? <><Loader2 className="size-4 animate-spin" /> Please wait...</> : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === "login" ? "New here?" : "Already registered?"}{" "}
            <button type="button" className="font-medium text-indigo-600 hover:underline" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}