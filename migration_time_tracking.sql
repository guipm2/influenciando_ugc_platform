-- Add estimated_hours to project_deliverables if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_deliverables' AND column_name = 'estimated_hours') THEN
        ALTER TABLE public.project_deliverables ADD COLUMN estimated_hours numeric(10,2) DEFAULT 0;
    END IF;
END $$;

-- Create time_entries table
CREATE TABLE IF NOT EXISTS public.time_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    deliverable_id uuid REFERENCES public.project_deliverables(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    hours numeric(10,2) NOT NULL,
    description text,
    date date DEFAULT CURRENT_DATE,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert own time entries"
  ON public.time_entries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view time entries for their deliverables"
  ON public.time_entries FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    deliverable_id IN (
        SELECT id FROM public.project_deliverables
        WHERE analyst_id = auth.uid() OR creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own time entries"
  ON public.time_entries FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own time entries"
  ON public.time_entries FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_time_entries_deliverable_id ON public.time_entries(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON public.time_entries(user_id);
