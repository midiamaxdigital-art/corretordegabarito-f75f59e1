import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, Download, ImageUp, Loader2, Save, Trash2, Check, X, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CloudSync } from "@/components/CloudSync";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { readAnswerSheet } from "@/lib/grade.functions";
import { score, type Question } from "@/lib/scoring";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Corretor de Gabaritos IA — Corrija provas por foto" },
      { name: "description", content: "Tire ou envie a foto do gabarito e a IA corrige até 20 questões, com pontuação editável e histórico." },
      { property: "og:title", content: "Corretor de Gabaritos IA" },
      { property: "og:description", content: "Correção de gabaritos por foto com IA, pontuação editável e histórico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const LETTERS = ["A", "B", "C", "D", "E"];
type Record_ = { id: string; date: string; student: string; answers: string[]; earned: number; max: number; hits: number; total: number };

const defaultKey = (): Question[] => Array.from({ length: 20 }, () => ({ key: "", points: 1 }));

function useStored<T>(name: string, init: () => T) {
  const [v, setV] = useState<T>(init);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const raw = localStorage.getItem(name);
    if (raw) try { setV(JSON.parse(raw)); } catch { /* ignore */ }
    setReady(true);
  }, [name]);
  useEffect(() => { if (ready) localStorage.setItem(name, JSON.stringify(v)); }, [name, v, ready]);
  return [v, setV] as const;
}

async function compress(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = img.width * scale; c.height = img.height * scale;
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return c.toDataURL("image/jpeg", 0.88);
}

function Index() {
  const [questions, setQuestions] = useStored<Question[]>("gabarito-key", defaultKey);
  const [total, setTotal] = useStored<number>("gabarito-total", () => 20);
  const [history, setHistory] = useStored<Record_[]>("gabarito-history", () => []);
  const [image, setImage] = useState<string | null>(null);
  const [answers, setAnswers] = useState<string[] | null>(null);
  const [student, setStudent] = useState("");
  const [sortBy, setSortBy] = useState<"nome" | "nota">("nome");
  const [doubtful, setDoubtful] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const read = useServerFn(readAnswerSheet);

  const active = questions.slice(0, total);
  const keyReady = active.every((q) => q.key);
  const result = answers ? score(active, answers) : null;
  const [popup, setPopup] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  useEffect(() => {
    if (!savedId || !answers || !result) return;
    setHistory((h) => h.map((e) => (e.id === savedId ? { ...e, student: student || "Sem nome", answers, earned: result.earned, max: result.max, hits: result.hits } : e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedId, student, answers]);

  async function onFile(f?: File) {
    if (!f) return;
    setAnswers(null); setSavedId(null);
    const data = await compress(f);
    setImage(data);
    setLoading(true);
    try {
      const r = await read({ data: { image: data, total } });
      setAnswers(r.answers);
      setStudent(r.student);
      setDoubtful(r.doubtful);
      const res = score(active, r.answers);
      const id = crypto.randomUUID();
      setHistory((h) => [{ id, date: new Date().toISOString(), student: r.student || "Sem nome", answers: r.answers, earned: res.earned, max: res.max, hits: res.hits, total }, ...h]);
      setSavedId(id);
      setPopup(true);
      if (r.doubtful.length) toast.warning(`Confira ${r.doubtful.length} questão(ões) marcadas com "?"`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na leitura");
    } finally { setLoading(false); }
  }

  function save() {
    if (!answers || !result) return;
    if (savedId) { toast.success("Correção salva no histórico"); setAnswers(null); setImage(null); setStudent(""); setPopup(false); setSavedId(null); return; }
    setHistory([{ id: crypto.randomUUID(), date: new Date().toISOString(), student: student || "Sem nome", answers, earned: result.earned, max: result.max, hits: result.hits, total }, ...history]);
    toast.success("Correção salva no histórico");
    setAnswers(null); setImage(null); setStudent(""); setPopup(false);
  }

  const sorted = [...history].sort((a, b) =>
    sortBy === "nome" ? a.student.localeCompare(b.student, "pt-BR") || b.earned - a.earned : b.earned - a.earned || a.student.localeCompare(b.student, "pt-BR"),
  );

  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const rows = sorted.map((h) => {
      const r: Record<string, string | number> = { Aluno: h.student, Nota: h.earned, "Nota máxima": h.max, Acertos: h.hits, Questões: h.total, Data: new Date(h.date).toLocaleString("pt-BR") };
      h.answers.forEach((a, i) => { r[`Q${i + 1}`] = a; });
      return r;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Correções");
    XLSX.writeFile(wb, `correcoes-por-${sortBy}.xlsx`);
  }

  const upd = (i: number, p: Partial<Question>) => setQuestions(questions.map((q, j) => (j === i ? { ...q, ...p } : q)));

  const printKey = () => window.print();
  const [pCols, setPCols] = useStored("print-cols", () => 2);
  const [pSize, setPSize] = useStored("print-size", () => 28);
  const [pGap, setPGap] = useStored("print-gap", () => 8);
  const [pVertical, setPVertical] = useStored("print-vertical", () => true);

  return (
    <>
    <main className="mx-auto max-w-3xl px-4 py-8 print:hidden">
      <header className="mb-6">
        <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-destructive"><Check className="size-3" />Corretor</p>
        <h1 className="text-4xl font-extrabold text-primary md:text-5xl">Gabaritos corrigidos em segundos</h1>
        <p className="mt-2 text-muted-foreground">Defina o gabarito, fotografe as respostas e a IA corrige com dupla verificação.</p>
      </header>

      <Tabs defaultValue="corrigir">
        <TabsList className="mb-4 grid w-full grid-cols-3">
          <TabsTrigger value="corrigir">Corrigir</TabsTrigger>
          <TabsTrigger value="gabarito">Gabarito e pontos</TabsTrigger>
          <TabsTrigger value="historico">Histórico ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="corrigir" className="space-y-4">
          {!keyReady && (
            <div className="rounded-lg border border-accent bg-accent/30 p-3 text-sm">Preencha as respostas certas na aba <b>Gabarito e pontos</b> antes de corrigir.</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button size="lg" className="h-20 text-base" disabled={loading || !keyReady} onClick={() => camRef.current?.click()}><Camera className="mr-2" />Tirar foto</Button>
            <Button size="lg" variant="secondary" className="h-20 text-base" disabled={loading || !keyReady} onClick={() => fileRef.current?.click()}><ImageUp className="mr-2" />Enviar foto</Button>
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          </div>

          {image && <img src={image} alt="Gabarito enviado" className="max-h-80 w-full rounded-lg border bg-card object-contain" />}
          {loading && <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" />Lendo o gabarito…</p>}

          {answers && result && (
            <section className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Aluno</label>
                  <Input value={student} onChange={(e) => setStudent(e.target.value)} placeholder="Nome do aluno" />
                </div>
                <div className="text-right">
                  <div className="font-display text-4xl font-extrabold text-primary">{result.earned}<span className="text-lg text-muted-foreground">/{result.max}</span></div>
                  <div className="text-sm text-muted-foreground">{result.hits} de {total} acertos</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Confira a leitura: toque numa letra para corrigir se a IA errou.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {answers.map((a, i) => (
                  <div key={i} className={`flex items-center gap-2 rounded-md border p-2 ${result.results[i] ? "border-success/50 bg-success/10" : "border-destructive/40 bg-destructive/10"}`}>
                    <span className="w-6 font-mono font-bold">{i + 1}</span>
                    {result.results[i] ? <Check className="size-4 text-success" /> : <X className="size-4 text-destructive" />}
                    <div className="flex gap-1">
                      {[...LETTERS, "-"].map((l) => (
                        <button key={l} onClick={() => { setAnswers(answers.map((x, j) => (j === i ? l : x))); setDoubtful(doubtful.filter((d) => d !== i)); }} className={`size-7 rounded-full border font-mono text-xs ${a === l ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>{l}</button>
                      ))}
                    </div>
                    {doubtful.includes(i) && <span className="rounded bg-accent px-1 font-mono text-xs font-bold" title="Leituras divergentes, confira">?</span>}
                    <span className="ml-auto font-mono text-xs text-muted-foreground">({active[i]?.key})</span>
                  </div>
                ))}
              </div>
              <Button onClick={save} className="w-full"><Save className="mr-2" />Salvar correção</Button>
            </section>
          )}
        </TabsContent>

        <TabsContent value="gabarito" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
            <label className="text-sm font-medium">Número de questões</label>
            <Input type="number" min={1} max={20} value={total} onChange={(e) => setTotal(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} className="w-20" />
            <span className="ml-auto text-sm text-muted-foreground">Total: <b>{score(active, []).max}</b> pts</span>
            <Button size="sm" variant="outline" onClick={printKey}><Printer className="mr-1 size-4" />Imprimir gabarito</Button>
          </div>
          <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4 text-sm">
            <b className="w-full">Opções de impressão</b>
            <label className="flex items-center gap-2">Colunas
              <Input type="number" min={1} max={5} value={pCols} onChange={(e) => setPCols(Math.max(1, Math.min(5, Number(e.target.value) || 1)))} className="w-16" />
            </label>
            <label className="flex items-center gap-2">Tamanho
              <Button size="sm" variant="outline" onClick={() => setPSize(Math.max(16, pSize - 4))}>−</Button>
              <span className="w-8 text-center font-mono">{pSize}</span>
              <Button size="sm" variant="outline" onClick={() => setPSize(Math.min(56, pSize + 4))}>+</Button>
            </label>
            <label className="flex items-center gap-2">Espaço entre linhas
              <Button size="sm" variant="outline" onClick={() => setPGap(Math.max(0, pGap - 2))}>−</Button>
              <span className="w-8 text-center font-mono">{pGap}</span>
              <Button size="sm" variant="outline" onClick={() => setPGap(Math.min(40, pGap + 2))}>+</Button>
            </label>
            <label className="flex items-center gap-2">Ordem
              <Button size="sm" variant={pVertical ? "default" : "outline"} onClick={() => setPVertical(true)}>Um abaixo do outro</Button>
              <Button size="sm" variant={!pVertical ? "default" : "outline"} onClick={() => setPVertical(false)}>Lado a lado</Button>
            </label>
          </div>
          <div className="space-y-2">
            {active.map((q, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border bg-card p-2">
                <span className="w-6 font-mono font-bold">{i + 1}</span>
                <div className="flex gap-1">
                  {LETTERS.map((l) => (
                    <button key={l} onClick={() => upd(i, { key: l })} className={`size-8 rounded-full border font-mono text-sm ${q.key === l ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>{l}</button>
                  ))}
                </div>
                <Input type="number" step="0.25" min={0} value={q.points} onChange={(e) => upd(i, { points: Math.max(0, Number(e.target.value) || 0) })} className="ml-auto w-20" aria-label={`Pontos da questão ${i + 1}`} />
                <span className="text-xs text-muted-foreground">pts</span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="historico" className="space-y-2">
          <CloudSync history={history} setHistory={setHistory} />
          {history.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhuma correção salva ainda.</p>}
          {history.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Ordenar por:</span>
              <Button size="sm" variant={sortBy === "nome" ? "default" : "outline"} onClick={() => setSortBy("nome")}>Nome</Button>
              <Button size="sm" variant={sortBy === "nota" ? "default" : "outline"} onClick={() => setSortBy("nota")}>Nota</Button>
              <Button size="sm" variant="secondary" className="ml-auto" onClick={exportXlsx}><Download className="mr-1 size-4" />Baixar planilha</Button>
            </div>
          )}
          {sorted.map((h) => (
            <div key={h.id} className="flex items-center gap-3 rounded-md border bg-card p-3">
              <div className="flex-1">
                <div className="font-medium">{h.student}</div>
                <div className="text-xs text-muted-foreground">{new Date(h.date).toLocaleString("pt-BR")} · {h.hits}/{h.total} acertos · {h.answers.join(" ")}</div>
              </div>
              <div className="font-display text-2xl font-extrabold text-primary">{h.earned}<span className="text-sm text-muted-foreground">/{h.max}</span></div>
              <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => setHistory(history.filter((x) => x.id !== h.id))}><Trash2 /></Button>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </main>

    {/* Folha exclusiva para impressão: invisível na tela, visível só ao imprimir */}
      <Dialog open={popup && !!result} onOpenChange={setPopup}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {result && (
            <>
              <DialogHeader>
                <DialogTitle>Resultado da correção</DialogTitle>
                <DialogDescription>Salvo automaticamente no histórico</DialogDescription>
              </DialogHeader>
              <Input value={student} onChange={(e) => setStudent(e.target.value)} placeholder="Nome do aluno" aria-label="Nome do aluno" />
              <DialogHeader className="hidden">
              </DialogHeader>
              <div className="text-center">
                <p className="font-display text-5xl font-extrabold text-primary">{result.earned}<span className="text-2xl text-muted-foreground"> / {result.max}</span></p>
                <p className="text-sm text-muted-foreground">{result.hits} de {active.length} acertos</p>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {active.map((q, i) => {
                  const ok = !!q.key && answers?.[i] === q.key;
                  return (
                    <div key={i} className={`rounded-md border p-1 text-center font-mono text-xs ${ok ? "border-success bg-success/10" : "border-destructive bg-destructive/10"}`}>
                      <b>{i + 1}</b> {answers?.[i] ?? "-"}{doubtful.includes(i) ? " ?" : ""}
                      {!ok && <div className="text-[10px] text-muted-foreground">certa: {q.key || "—"}</div>}
                    </div>
                  );
                })}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setPopup(false)}>Revisar</Button>
                <Button onClick={save}><Check className="mr-1 size-4" />Concluir</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    <div className="hidden print:block">
      <ol
        className="grid gap-x-12"
        style={{
          rowGap: pGap,
          gridTemplateColumns: `repeat(${pCols}, max-content)`,
          ...(pVertical ? { gridAutoFlow: "column", gridTemplateRows: `repeat(${Math.ceil(active.length / pCols)}, auto)` } : {}),
        }}
      >
        {active.map((_, i) => (
          <li key={i} className="flex items-center" style={{ gap: pSize * 0.35 }}>
            <span className="text-right font-mono font-bold" style={{ width: pSize, fontSize: pSize * 0.5 }}>{i + 1}</span>
            <span className="flex" style={{ gap: pSize * 0.25 }}>
              {["A", "B", "C", "D", "E"].map((l) => (
                <span key={l} className="flex items-center justify-center rounded-full border-2 border-foreground font-mono font-bold" style={{ width: pSize, height: pSize, fontSize: pSize * 0.42 }}>
                  {l}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ol>
    </div>
    </>
  );
}
