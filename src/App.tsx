import { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';
import { DETAILS } from './config';

type Step = {
  id: number;
  title_en: string;
  owner: string;
  status: string;
  checks: Record<string, boolean>;
  note: string | null;
};

export default function App() {
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    supabase
      .from('steps')
      .select('*')
      .order('id')
      .then(({ data }) => data && setSteps(data as Step[]));
    const channel = supabase
      .channel('steps-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'steps' },
        (payload) => {
          if (payload.new)
            setSteps((s) =>
              s.map((x) =>
                x.id === (payload.new as any).id ? (payload.new as Step) : x,
              ),
            );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function updateStep(id: number, patch: Partial<Step>) {
    const { data } = await supabase
      .from('steps')
      .update(patch)
      .eq('id', id)
      .select();
    if (data)
      setSteps((s) => s.map((x) => (x.id === id ? (data[0] as Step) : x)));
  }

  const progress = useMemo(() => {
    const totalTasks = Object.values(DETAILS).reduce(
      (acc, v) => acc + v.tasks.length,
      0,
    );
    const checkedTasks = steps.reduce(
      (acc, s) => acc + Object.values(s.checks || {}).filter(Boolean).length,
      0,
    );
    const doneSteps = steps.filter((s) => s.status === 'done').length;
    const percent = totalTasks
      ? Math.round((checkedTasks / totalTasks) * 100)
      : 0;
    return { totalTasks, checkedTasks, doneSteps, percent };
  }, [steps]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'doing':
        return {
          select: 'bg-[#e8f0fe] border-[#a8c4e3] text-[#1e4a7a]',
          card: 'border-[#a8c4e3] shadow-[0_4px_20px_rgba(168,196,227,0.25)]',
          dot: 'bg-[#2c5a8a] text-white',
        };
      case 'done':
        return {
          select: 'bg-[#e6f4ea] border-[#a3c9a8] text-[#1e4a2a] font-medium',
          card: 'border-[#a8c4a3] bg-[#f3f7f1]',
          dot: 'bg-[#4a6741] text-white',
        };
      case 'blocked':
        return {
          select: 'bg-[#fdecea] border-[#e8b4b4] text-[#8a2a2a] font-medium',
          card: 'border-[#e8b4b4] bg-[#fff5f5] shadow-[0_4px_20px_rgba(232,180,180,0.25)]',
          dot: 'bg-[#b4232a] text-white',
        };
      default:
        return {
          select: 'bg-[#faf8f3] border-zinc-200 text-zinc-600',
          card: 'border-[#ece9e0] shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]',
          dot: 'bg-[#f0ece1] text-[#7a6f5a]',
        };
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f4ef] text-zinc-800">
      {/* Hangzhou Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#d6e7d0]/80 via-[#e8e6d9]/70 to-[#c9d8e8]/60" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative max-w-4xl mx-auto px-6 pt-12 pb-10">
          <div className="block md:flex justify-between items-start">
            <div>
              <p className="text-[11px] tracking-[0.3em] text-[#6b7e6a] uppercase">
                Hangzhou → Lisbon
              </p>
              <h1
                className="text-[42px] leading-[0.95] font-[700] mt-2 tracking-tight"
                style={{ fontFamily: 'serif' }}
              >
                Our Family
                <br />
                Reunion
              </h1>
              <p className="mt-3 text-[#5a6b5a] md:max-w-md leading-relaxed">
                Like West Lake after rain, every step clears. From tea fields to
                the Tagus. Josue & Veronica, same page.
              </p>
            </div>
            <div className="hidden md:block text-center">
              <div className="w-20 h-20 rounded-full border border-[#b8c9b6] flex items-center justify-center bg-white/40 backdrop-blur text-2xl">
                🪷
              </div>
              <p className="text-xs text-[#7a8f7a] mt-2">
                Lotus grows
                <br />
                in muddy water
              </p>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-8 bg-white/70 backdrop-blur rounded-[20px] border border-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {progress.doneSteps}/{steps.length} stages •{' '}
                {progress.checkedTasks}/{progress.totalTasks} tasks
              </span>
              <span className="font-bold text-[#4a6741]">
                {progress.percent}%
              </span>
            </div>
            <div className="mt-3 h-3 bg-[#e9e7df] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#8fb58a] to-[#4a6741] rounded-full transition-all duration-700"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              All saved to Supabase automatically. Your wife sees updates live.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-20 -mt-2 space-y-5">
        {steps.map((s) => {
          const d = DETAILS[s.id];
          const doneRatio = d
            ? Object.keys(s.checks || {}).filter((k) => s.checks[k]).length /
              d.tasks.length
            : 0;
          const isDone = s.status === 'done';
          const st = getStatusStyle(s.status);
          return (
            <div
              key={s.id}
              className={`group rounded-[24px] border bg-white p-6 transition-all ${st.card}`}
            >
              <div className="flex justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${st.dot}`}
                    >
                      {isDone ? '✓' : s.id + 1}
                    </div>
                    <p className="text-[11px] tracking-widest uppercase text-[#9aa69a]">
                      {d.place}
                    </p>
                  </div>
                  <h3 className="mt-3 text-xl font-semibold tracking-tight">
                    {s.title_en.replace(/^\d+\.\s/, '')}
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-zinc-600 max-w-xl">
                    {d.desc}
                  </p>
                </div>
                <select
                  value={s.status}
                  onChange={(e) => updateStep(s.id, { status: e.target.value })}
                  className={`h-9 text-sm border rounded-full px-4 focus:outline-none focus:ring-2 focus:ring-[#b8c9b6]/40 transition-colors ${st.select}`}
                >
                  <option value="todo">To do</option>
                  <option value="doing">Doing • 行</option>
                  <option value="done">Done • 完</option>
                  <option value="blocked">Blocked • 阻</option>
                </select>
              </div>

              <div className="mt-5 grid sm:grid-cols-2 gap-2">
                {d.tasks.map((t, i) => {
                  const key = String(i);
                  const checks = (s.checks || {}) as Record<string, boolean>;
                  const checked = !!checks[key];

                  return (
                    <label
                      key={i}
                      className={`flex gap-3 p-3 rounded-xl border text-[13px] cursor-pointer transition-colors ${checked ? 'bg-[#eef3ee] border-[#c5d8c7] line-through text-zinc-500' : 'bg-stone-50 border-stone-100 hover:bg-white'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        className="accent-[#4a6741] mt-0.5"
                        onChange={(e) => {
                          const nc: Record<string, boolean> = {
                            ...checks,
                            [key]: e.target.checked,
                          };
                          const allDone = d.tasks.every((_, idx) =>
                            idx === i ? e.target.checked : !!nc[String(idx)],
                          );
                          updateStep(s.id, {
                            checks: nc,
                            status: allDone
                              ? 'done'
                              : e.target.checked
                                ? 'doing'
                                : s.status,
                          });
                        }}
                      />
                      <span>{t}</span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-3 h-1.5 bg-[#f2efe8] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#8fb58a] transition-all"
                  style={{ width: `${doneRatio * 100}%` }}
                />
              </div>

              <textarea
                value={s.note || ''}
                onChange={(e) => updateStep(s.id, { note: e.target.value })}
                className="mt-4 w-full text-sm border border-[#ece9e0] rounded-xl p-3 bg-[#fdfcfa] focus:outline-none focus:border-[#b8c9b6] placeholder:text-zinc-400"
                placeholder="Notes, links, AIMA numbers..."
                rows={2}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
