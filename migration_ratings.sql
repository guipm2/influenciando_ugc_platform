-- =====================================================
-- MIGRATION: RATING SYSTEM
-- =====================================================

-- Tabela: project_ratings
CREATE TABLE IF NOT EXISTS public.project_ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    application_id uuid REFERENCES public.opportunity_applications(id) ON DELETE CASCADE,
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT unique_application_rating UNIQUE (application_id)
);

-- Trigger para updated_at
CREATE TRIGGER update_project_ratings_updated_at
  BEFORE UPDATE ON public.project_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.project_ratings ENABLE ROW LEVEL SECURITY;

-- Policies

-- Creators can insert ratings for their own applications
CREATE POLICY "Creators can insert ratings for their own applications"
ON public.project_ratings FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.opportunity_applications oa
        WHERE oa.id = application_id
        AND oa.creator_id = auth.uid()
    )
);

-- Creators can view their own ratings
CREATE POLICY "Creators can view their own ratings"
ON public.project_ratings FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.opportunity_applications oa
        WHERE oa.id = application_id
        AND oa.creator_id = auth.uid()
    )
);

-- Analysts can view ratings for their opportunities
CREATE POLICY "Analysts can view ratings for their opportunities"
ON public.project_ratings FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.opportunity_applications oa
        JOIN public.opportunities o ON o.id = oa.opportunity_id
        WHERE oa.id = application_id
        AND o.created_by = auth.uid()
    )
);

COMMENT ON TABLE public.project_ratings IS 'Avaliações e feedbacks dos creators sobre os projetos concluídos';
