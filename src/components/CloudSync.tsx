import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Cloud, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type CloudRecord = { id: string; date: string; student: string; answers: string[]; earned: number; max: number; hits: number; total: number };

export function CloudSync({ history, setHistory }: { history: CloudRecord[]; setHistory: (fn: (h: CloudRecord[]) => CloudRecord[]) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState(false);
  const known = useRef<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserEmail(data.session?.user.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUserEmail(s?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  // On login: merge cloud history with local
  useEffect(() => {
    if (!userEmail) { setSynced(false); known.current = new Set(); return; }
    (async () => {
      const { data, error } = await supabase.from("corrections").select("*");
      if (error) { toast.error("Erro ao carregar histórico da nuvem"); return; }
      const cloud: CloudRecord[] = (data ?? []).map((r) => ({ id: r.id, date: r.date, student: r.student, answers: r.answers as string[], earned: Number(r.earned), max: Number(r.max), hits: r.hits, total: r.total }));
      known.current = new Set(cloud.map((c) => c.id));
      setHistory((h) => {
        const ids = new Set(h.map((x) => x.id));
        return [...h, ...cloud.filter((c) => !ids.has(c.id))].sort((a, b) => b.date.localeCompare(a.date));
      });
      setSynced(true);
    })();
  }, [userEmail, setHistory]);

  // Push changes
  useEffect(() => {
    if (!userEmail || !synced) return;
    const t = setTimeout(async () => {
      const ids = new Set(history.map((h) => h.id));
      const removed = [...known.current].filter((id) => !ids.has(id));
      if (history.length) {
        const { error } = await supabase.from("corrections").upsert(history.map((h) => ({ ...h })));
        if (error) { toast.error("Erro ao salvar na nuvem"); return; }
      }
      if (removed.length) await supabase.from("corrections").delete().in("id", removed);
      known.current = ids;
    }, 600);
    return () => clearTimeout(t);
  }, [history, userEmail, synced]);

  async function signIn(create: boolean) {
    if (!email || password.length < 6) { toast.error("Digite o e-mail e uma senha com 6+ caracteres"); return; }
    setBusy(true);
    const { data, error } = create
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { toast.error(error.message.includes("Invalid") ? "E-mail ou senha incorretos" : error.message); return; }
    if (create && !data.session) toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
  }

  if (userEmail)
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-sm">
        <Cloud className="size-4 text-success" />
        <span>Histórico salvo na nuvem em <b>{userEmail}</b></span>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => supabase.auth.signOut()}><LogOut className="mr-1 size-4" />Sair</Button>
      </div>
    );

  return (
    <div className="space-y-2 rounded-xl border bg-card p-3 text-sm">
      <p className="flex items-center gap-2 font-medium"><Cloud className="size-4" />Salvar histórico na nuvem</p>
      <div className="flex flex-wrap gap-2">
        <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-48 flex-1" />
        <Input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className="w-36" />
        <Button size="sm" disabled={busy} onClick={() => signIn(false)}>Entrar</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => signIn(true)}>Criar conta</Button>
      </div>
    </div>
  );
}
