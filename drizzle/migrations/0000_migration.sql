CREATE TABLE public.studio_data (
  user_id uuid PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_data TO authenticated;
GRANT ALL ON public.studio_data TO service_role;
ALTER TABLE public.studio_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.studio_data FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.studio_data FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.studio_data FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.studio_data FOR DELETE TO authenticated USING (auth.uid() = user_id);