import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './lib/supabase';
import { DETAILS } from './config';

type Status = 'todo' | 'doing' | 'done' | 'blocked';
type Step = {
  id: number;
  title_en: string;
  owner: string;
  status: Status;
  checks: Record<string, boolean> | null;
  note: string | null;
};
type Patch = Partial<Pick<Step, 'status' | 'checks' | 'note'>>;

// The fifth displayed stage is the AIMA submission stage (original roadmap Stage 4).
// These are submission documents, even when obtained during an earlier stage.
// Store their ticks under namespaced keys in the existing steps.checks JSONB column.
const AIMA_DOCUMENTS = [
  {
    key: 'residence-permit',
    label: 'Residence permit for the citizen residing in Portugal',
  },
  { key: 'passport', label: 'Valid passport or other valid travel document' },
  { key: 'legal-entry', label: 'Proof of legal entry into Portugal' },
  {
    key: 'family-ties',
    label:
      'Properly authenticated proof of family ties (marriage certificate and applicable translation)',
  },
  {
    key: 'accommodation-declaration',
    label:
      'Declaration under oath of your residential address, stating the terms under which you live there (owner, tenant, subtenant, etc.)',
  },
  {
    key: 'property-proof',
    label:
      'If owner or usufructuary: land registry certificate or its access code',
  },
  {
    key: 'landlord-statement',
    label:
      'If tenant or otherwise accommodated: landlord/accommodation provider statement explaining your legal right to use the property',
  },
  { key: 'means', label: 'Proof of means of subsistence' },
  {
    key: 'criminal-record',
    label:
      'Duly authenticated criminal record from your wife’s country of nationality or a country where she resided for over one year before Portugal',
  },
] as const;

const statusOptions: { value: Status; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'doing', label: 'In progress' },
  { value: 'done', label: 'Completed' },
  { value: 'blocked', label: 'Blocked' },
];
const statusStyle: Record<Status, string> = {
  todo: 'bg-stone-100 text-stone-700 border-stone-200',
  doing: 'bg-sky-50 text-sky-800 border-sky-200',
  done: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  blocked: 'bg-rose-50 text-rose-800 border-rose-200',
};

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

/** Notes are deliberately local until Save is clicked. */
function NotesEditor({
  stepId,
  serverNote,
  save,
}: {
  stepId: number;
  serverNote: string | null;
  save: (id: number, patch: Patch) => Promise<Step>;
}) {
  const [draft, setDraft] = useState(serverNote ?? '');
  const [baseline, setBaseline] = useState(serverNote ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [remoteChanged, setRemoteChanged] = useState(false);
  const dirty = draft !== baseline;

  useEffect(() => {
    const incoming = serverNote ?? '';
    if (incoming === baseline) return;
    if (draft === baseline) {
      setDraft(incoming);
      setBaseline(incoming);
      setRemoteChanged(false);
      setSaved(false);
    } else if (incoming !== draft) {
      setRemoteChanged(true);
    } else {
      setBaseline(incoming);
      setRemoteChanged(false);
    }
  }, [serverNote, baseline, draft]);

  async function onSave() {
    if (!dirty || busy) return;
    setBusy(true);
    setError('');
    setSaved(false);
    const submitted = draft;
    try {
      const updated = await save(stepId, { note: submitted });
      const confirmed = updated.note ?? '';
      setBaseline(confirmed);
      setRemoteChanged(false);
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="mt-6 border-t border-stone-100 pt-5"
      aria-label="Stage notes"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <label
          htmlFor={`note-${stepId}`}
          className="text-sm font-semibold text-stone-800"
        >
          Private planning notes
        </label>
        <span
          aria-live="polite"
          className={`text-xs ${error ? 'text-rose-700' : 'text-stone-500'}`}
        >
          {busy
            ? 'Saving…'
            : error
              ? 'Save failed'
              : dirty
                ? 'Unsaved changes'
                : saved
                  ? 'Saved'
                  : 'Saved to cloud'}
        </span>
      </div>
      <textarea
        id={`note-${stepId}`}
        rows={3}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setSaved(false);
          setError('');
        }}
        placeholder="Add your notes, links and next actions…"
        className="w-full resize-y rounded-2xl border border-stone-200 bg-[#fdfcf9] px-4 py-3 text-sm leading-6 text-stone-800 outline-none transition focus:border-[#6e9274] focus:ring-4 focus:ring-[#6e9274]/10"
      />
      {remoteChanged && (
        <p role="alert" className="mt-2 text-xs text-amber-800">
          This note changed on another device. Saving will replace that version.
          Copy your draft first if needed.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-stone-500">
          Your typing stays on this device until you save.
        </p>
        <div className="flex items-center gap-2">
          {dirty && !busy && (
            <button
              type="button"
              onClick={() => {
                setDraft(serverNote ?? '');
                setBaseline(serverNote ?? '');
                setRemoteChanged(false);
                setError('');
              }}
              className="rounded-xl px-3 py-2 text-sm text-stone-600 hover:bg-stone-100"
            >
              Discard
            </button>
          )}
          <button
            type="button"
            disabled={!dirty || busy}
            onClick={onSave}
            className="rounded-xl bg-[#3f654c] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#304f3b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3f654c] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Save notes'}
          </button>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mutationErrors, setMutationErrors] = useState<Record<number, string>>(
    {},
  );
  const [pending, setPending] = useState<Record<number, boolean>>({});
  const pendingRef = useRef(new Set<number>());
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('steps')
      .select('*')
      .order('id');
    if (error) throw error;
    if (mounted.current) {
      setSteps((previous) => {
        const incoming = (data ?? []) as Step[];
        return incoming.map((item) =>
          pendingRef.current.has(item.id)
            ? (previous.find((s) => s.id === item.id) ?? item)
            : item,
        );
      });
      setLoadError('');
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh()
      .catch((e) => {
        if (mounted.current) setLoadError(errorMessage(e));
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
    const channel = supabase
      .channel('steps-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'steps' },
        () => {
          // Re-fetch to avoid replacing newer local state with an out-of-order event.
          void refresh().catch(() => {
            /* Retry on next update or manual refresh. */
          });
        },
      )
      .subscribe();
    return () => {
      mounted.current = false;
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const save = useCallback(
    async (id: number, patch: Patch): Promise<Step> => {
      // Reject overlapping writes to the same row instead of silently losing an edit.
      if (pendingRef.current.has(id))
        throw new Error('Another change is saving. Please try again.');
      pendingRef.current.add(id);
      if (mounted.current) {
        setPending((old) => ({ ...old, [id]: true }));
        setMutationErrors((old) => ({ ...old, [id]: '' }));
      }
      try {
        const { data, error } = await supabase
          .from('steps')
          .update(patch)
          .eq('id', id)
          .select('*')
          .single();
        if (error) throw error;
        if (!data)
          throw new Error(
            'No row was updated. Check your Supabase access policies.',
          );
        if (mounted.current)
          setSteps((old) => old.map((s) => (s.id === id ? (data as Step) : s)));
        return data as Step;
      } finally {
        pendingRef.current.delete(id);
        if (mounted.current) setPending((old) => ({ ...old, [id]: false }));
        // Reconcile any remote changes that arrived while the row was saving.
        void refresh().catch(() => {});
      }
    },
    [refresh],
  );

  async function changeStep(id: number, patch: Patch) {
    try {
      await save(id, patch);
    } catch (e) {
      setMutationErrors((old) => ({ ...old, [id]: errorMessage(e) }));
    }
  }

  const progress = useMemo(() => {
    const total = steps.reduce(
      (n, s, index) =>
        n +
        (DETAILS[s.id]?.tasks.length ?? 0) +
        (index === 4 ? AIMA_DOCUMENTS.length : 0),
      0,
    );
    const checked = steps.reduce(
      (n, s, index) =>
        n +
        (DETAILS[s.id]?.tasks.filter((_, i) => !!s.checks?.[String(i)])
          .length ?? 0) +
        (index === 4
          ? AIMA_DOCUMENTS.filter((doc) => !!s.checks?.[`aima:${doc.key}`])
              .length
          : 0),
      0,
    );
    return {
      total,
      checked,
      percent: total ? Math.round((checked / total) * 100) : 0,
      done: steps.filter((s) => s.status === 'done').length,
    };
  }, [steps]);

  return (
    <main className="min-h-screen bg-[#f7f6f1] font-sans text-stone-800">
      <header className="relative overflow-hidden bg-gradient-to-br from-[#dce8d8] via-[#eeede3] to-[#dce8ef]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-32 h-96 w-96 rounded-full border border-white/60 bg-white/10"
        />
        <div className="relative mx-auto max-w-5xl px-5 pb-14 pt-12 sm:px-8 sm:pt-16">
          <p className="text-xs font-bold uppercase tracking-[.26em] text-[#58735b]">
            Hangzhou <span aria-hidden="true">→</span> Lisbon
          </p>
          <div className="mt-5 flex items-start justify-between gap-6">
            <div>
              <h1 className="font-serif text-5xl font-semibold leading-[1.04] tracking-tight text-[#293f32] sm:text-7xl">
                Our Family
                <br />
                Reunion
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#506552]">
                One shared plan, one step at a time. From Hangzhou to our next
                chapter in Lisbon.
              </p>
            </div>
            <div
              aria-hidden="true"
              className="hidden h-24 w-24 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/40 text-4xl shadow-sm sm:flex"
            >
              🪷
            </div>
          </div>
          <div className="mt-10 rounded-3xl border border-white/80 bg-white/75 p-6 shadow-[0_12px_40px_rgba(44,72,49,.07)] backdrop-blur-sm">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#6c806e]">
                  Our progress
                </p>
                <p className="mt-1 text-sm text-stone-700">
                  {progress.done} of {steps.length} stages completed ·{' '}
                  {progress.checked} of {progress.total} tasks
                </p>
              </div>
              <span className="font-serif text-4xl font-semibold text-[#3f654c]">
                {progress.percent}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Checklist completion"
              aria-valuenow={progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#e5e8df]"
            >
              <div
                className="h-full rounded-full bg-[#6c9973] transition-[width] duration-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-stone-500">
              Checklist changes sync when saved. Notes sync only when you press
              Save notes.
            </p>
          </div>
        </div>
      </header>

      <div className="relative mx-auto -mt-3 max-w-5xl space-y-5 px-5 pb-20 sm:px-8">
        {loading && (
          <p role="status" className="rounded-2xl bg-white p-6 text-stone-600">
            Loading your roadmap…
          </p>
        )}
        {loadError && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"
          >
            Couldn't load your roadmap: {loadError}
            <button
              className="ml-3 font-semibold underline"
              onClick={() =>
                void refresh().catch((e) => setLoadError(errorMessage(e)))
              }
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !loadError && steps.length === 0 && (
          <p className="rounded-2xl bg-white p-6">
            No stages found. Check that your Supabase steps table is populated
            and readable.
          </p>
        )}
        {steps.map((step, stageIndex) => {
          const detail = DETAILS[step.id];
          if (!detail)
            return (
              <div key={step.id} className="rounded-2xl bg-white p-5">
                Missing configuration for stage {step.id}.
              </div>
            );
          const checks = step.checks ?? {};
          const count = detail.tasks.filter(
            (_, i) => !!checks[String(i)],
          ).length;
          const isPending = !!pending[step.id];
          return (
            <article
              key={step.id}
              className="rounded-[28px] border border-[#e9e9df] bg-white p-5 shadow-[0_7px_35px_rgba(47,60,46,.045)] sm:p-8"
            >
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                <div className="flex min-w-0 gap-4">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-bold ${statusStyle[step.status] ?? statusStyle.todo}`}
                  >
                    {step.status === 'done'
                      ? '✓'
                      : String(step.id).padStart(2, '0')}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#809281]">
                      {detail.place}
                    </p>
                    <h2 className="mt-1 font-serif text-2xl font-semibold tracking-tight text-[#293f32] sm:text-3xl">
                      {step.title_en.replace(/^\d+\.\s*/, '')}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                      {detail.desc}
                    </p>
                  </div>
                </div>
                <div className="shrink-0">
                  <label className="sr-only" htmlFor={`status-${step.id}`}>
                    Stage {step.id} status
                  </label>
                  <select
                    id={`status-${step.id}`}
                    value={step.status}
                    disabled={isPending}
                    onChange={(e) =>
                      void changeStep(step.id, {
                        status: e.target.value as Status,
                      })
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-[#6c9973] disabled:opacity-50 sm:w-auto ${statusStyle[step.status] ?? statusStyle.todo}`}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mb-3 mt-7 flex items-center justify-between text-xs font-medium text-stone-500">
                <span className="uppercase tracking-widest">Checklist</span>
                <span>
                  {count} / {detail.tasks.length} complete
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {detail.tasks.map((task, index) => {
                  const key = String(index);
                  const checked = !!checks[key];
                  return (
                    <label
                      key={key}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-sm leading-5 transition ${checked ? 'border-[#d7e5d6] bg-[#f0f6ef] text-stone-500' : 'border-stone-100 bg-[#faf9f6] hover:border-[#d5dfd2]'} ${isPending ? 'opacity-60' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isPending}
                        onChange={(e) => {
                          const nextChecks = {
                            ...checks,
                            [key]: e.target.checked,
                          };
                          const allDone = detail.tasks.every(
                            (_, i) => !!nextChecks[String(i)],
                          );
                          const nextStatus: Status = allDone
                            ? 'done'
                            : step.status === 'done'
                              ? 'doing'
                              : e.target.checked && step.status === 'todo'
                                ? 'doing'
                                : step.status;
                          void changeStep(step.id, {
                            checks: nextChecks,
                            status: nextStatus,
                          });
                        }}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#4b7655]"
                      />
                      <span
                        className={
                          checked ? 'line-through decoration-stone-400' : ''
                        }
                      >
                        {task}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-[#80a986] transition-[width] duration-300"
                  style={{
                    width: `${detail.tasks.length ? (count / detail.tasks.length) * 100 : 0}%`,
                  }}
                />
              </div>
              {stageIndex === 4 && (
                <section
                  aria-labelledby="aima-documents-heading"
                  className="mt-8 rounded-3xl border border-[#d6e3d5] bg-[#f3f8f0] p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[.18em] text-[#66836a]">
                        Step 5 · Submission day
                      </p>
                      <h3
                        id="aima-documents-heading"
                        className="mt-2 font-serif text-2xl font-semibold text-[#293f32]"
                      >
                        Documents to hand in at AIMA
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                        Your complete hand-in checklist. Keep documents listed
                        here even if you collected them in an earlier stage.
                        Conditional housing documents apply according to how you
                        occupy your home.
                      </p>
                    </div>
                    <span className="rounded-full border border-[#c6d9c6] bg-white px-3 py-1.5 text-xs font-semibold text-[#42664b]">
                      {
                        AIMA_DOCUMENTS.filter(
                          (doc) => !!checks[`aima:${doc.key}`],
                        ).length
                      }{' '}
                      / {AIMA_DOCUMENTS.length} ready
                    </span>
                  </div>
                  <div className="mt-5 grid gap-2">
                    {AIMA_DOCUMENTS.map((doc) => {
                      const key = `aima:${doc.key}`;
                      const checked = !!checks[key];
                      return (
                        <label
                          key={key}
                          className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm leading-6 transition ${checked ? 'border-[#c9ddc8] bg-white/65 text-stone-500' : 'border-[#e0e9dd] bg-white text-stone-800'} ${isPending ? 'opacity-60' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isPending}
                            onChange={(e) =>
                              void changeStep(step.id, {
                                checks: { ...checks, [key]: e.target.checked },
                              })
                            }
                            className="mt-1 h-4 w-4 shrink-0 accent-[#4b7655]"
                          />
                          <span
                            className={
                              checked ? 'line-through decoration-stone-400' : ''
                            }
                          >
                            {doc.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div
                    className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#dce8d8]"
                    role="progressbar"
                    aria-label="AIMA submission documents ready"
                    aria-valuemin={0}
                    aria-valuemax={AIMA_DOCUMENTS.length}
                    aria-valuenow={
                      AIMA_DOCUMENTS.filter(
                        (doc) => !!checks[`aima:${doc.key}`],
                      ).length
                    }
                  >
                    <div
                      className="h-full rounded-full bg-[#709b76] transition-[width]"
                      style={{
                        width: `${(AIMA_DOCUMENTS.filter((doc) => !!checks[`aima:${doc.key}`]).length / AIMA_DOCUMENTS.length) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-stone-500">
                    This reproduces your supplied list for planning; confirm
                    which items apply to your specific application with AIMA
                    before submission. Housing evidence is conditional.
                  </p>
                </section>
              )}
              {mutationErrors[step.id] && (
                <p role="alert" className="mt-3 text-xs text-rose-700">
                  Change not saved: {mutationErrors[step.id]}
                </p>
              )}
              <NotesEditor
                stepId={step.id}
                serverNote={step.note}
                save={save}
              />
            </article>
          );
        })}
        <footer className="pt-8 text-center text-xs leading-6 text-stone-500">
          Our personal planning checklist · Confirm official requirements with
          AIMA and the relevant consulate before applying.
        </footer>
      </div>
    </main>
  );
}
