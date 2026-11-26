CREATE TABLE public.corrections (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  student text NOT NULL DEFAULT 'Sem nome',
  answers jsonb NOT NULL DEFAULT '[]',
  earned numeric NOT NULL DEFAULT 0,
  max numeric NOT NULL DEFAULT 0,
  hits int NOT NULL DEFAULT 0,
  total int NOT NULL DEFAULT 0,
  date timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corrections TO authenticated;
GRANT ALL ON public.corrections TO service_role;
ALTER TABLE public.corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.corrections FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own insert" ON public.corrections FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update" ON public.corrections FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own delete" ON public.corrections FOR DELETE TO authenticated USING (user_id = auth.uid());