-- =====================================================
-- MIGRAÇÃO COMPLETA - INFLUENCIANDO PLATFORM
-- Script otimizado para novo projeto Supabase
-- =====================================================
-- IMPORTANTE: Execute este script no SQL Editor do Supabase
-- O Supabase já gerencia os schemas 'auth' e 'storage'
-- =====================================================

-- ============ PARTE 1: ENUMS (Tipos Customizados) ============

CREATE TYPE public.user_role AS ENUM ('creator', 'analyst');

CREATE TYPE public.opportunity_status AS ENUM (
    'draft',
    'ativo',
    'pausado',
    'encerrado',
    'concluido',
    'cancelado'
);

CREATE TYPE public.application_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'in_progress',
    'completed'
);

CREATE TYPE public.deliverable_status AS ENUM (
    'pending',
    'in_review',
    'approved',
    'rejected',
    'completed'
);

CREATE TYPE public.message_type AS ENUM (
    'text',
    'file',
    'system',
    'deliverable'
);

CREATE TYPE public.notification_type AS ENUM (
    'application',
    'message',
    'opportunity',
    'deliverable',
    'system'
);

CREATE TYPE public.session_status AS ENUM (
    'active',
    'ended',
    'cancelled'
);

CREATE TYPE public.user_status AS ENUM (
    'online',
    'offline',
    'away',
    'busy'
);

-- ============ PARTE 2: TABELAS ============

-- Tabela: profiles (PRINCIPAL - sem foreign keys primeiro)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY,
    email text,
    name text,
    bio text,
    location text,
    followers text,
    website text,
    phone text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    role public.user_role DEFAULT 'creator'::public.user_role,
    terms_accepted boolean DEFAULT false,
    terms_accepted_at timestamp with time zone,
    terms_version text DEFAULT '1.0'::text,
    company text,
    instagram_url text,
    tiktok_url text,
    portfolio_url text,
    birth_date text,
    gender text,
    niches text[],
    pix_key text,
    full_name text,
    document_number text,
    address jsonb,
    onboarding_completed boolean DEFAULT false,
    onboarding_step integer DEFAULT 0,
    onboarding_completed_at timestamp with time zone,
    document_type text,
    age integer,
    onboarding_data_incomplete boolean DEFAULT false
);

-- Tabela: analysts
CREATE TABLE IF NOT EXISTS public.analysts (
    id uuid NOT NULL PRIMARY KEY,
    company_name text,
    position text,
    secret_key text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Tabela: opportunities
CREATE TABLE IF NOT EXISTS public.opportunities (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    title text NOT NULL,
    description text,
    requirements text,
    budget numeric(10,2) DEFAULT 0 NOT NULL,
    deadline date,
    created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    status public.opportunity_status DEFAULT 'draft'::public.opportunity_status,
    category text,
    location text,
    niches text[],
    payment_type text,
    deliverables_count integer DEFAULT 0,
    applications_count integer DEFAULT 0,
    company text,
    company_link text,
    briefing text,
    age_range text,
    gender text,
    content_type text,
    analyst_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    candidates_count integer DEFAULT 0
);

COMMENT ON COLUMN public.opportunities.budget IS 'Orçamento total do projeto por criador';

-- Tabela: opportunity_images
CREATE TABLE IF NOT EXISTS public.opportunity_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
    image_url text NOT NULL,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- Tabela: opportunity_applications
CREATE TABLE IF NOT EXISTS public.opportunity_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
    creator_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    cover_letter text,
    status public.application_status DEFAULT 'pending'::public.application_status,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    applied_at timestamp with time zone DEFAULT now()
);

-- Tabela: opportunity_stages
CREATE TABLE IF NOT EXISTS public.opportunity_stages (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
    application_id uuid REFERENCES public.opportunity_applications(id) ON DELETE CASCADE,
    stage_name text NOT NULL,
    stage_order integer NOT NULL,
    completed boolean DEFAULT false,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Tabela: project_deliverables
CREATE TABLE IF NOT EXISTS public.project_deliverables (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    application_id uuid REFERENCES public.opportunity_applications(id) ON DELETE CASCADE,
    opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
    analyst_id uuid REFERENCES public.profiles(id),
    creator_id uuid REFERENCES public.profiles(id),
    title text NOT NULL,
    description text,
    due_date timestamp with time zone,
    status public.deliverable_status DEFAULT 'pending'::public.deliverable_status,
    file_url text,
    file_name text,
    file_type text,
    file_size bigint,
    feedback text,
    submitted_at timestamp with time zone,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    priority integer DEFAULT 0
);

-- Tabela: conversations
CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    analyst_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    creator_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
    last_message_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    custom_title text,
    tags text[]
);

-- Tabela: messages
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text,
    type public.message_type DEFAULT 'text'::public.message_type,
    file_url text,
    file_name text,
    file_type text,
    file_size bigint,
    metadata jsonb DEFAULT '{}'::jsonb,
    read boolean DEFAULT false,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deliverable_id uuid REFERENCES public.project_deliverables(id) ON DELETE SET NULL
);

-- Tabela: notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    type public.notification_type NOT NULL,
    title text NOT NULL,
    message text,
    link text,
    read boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone
);

-- Tabela: notification_preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    email_notifications boolean DEFAULT true,
    push_notifications boolean DEFAULT true,
    application_updates boolean DEFAULT true,
    message_notifications boolean DEFAULT true,
    opportunity_updates boolean DEFAULT true,
    deliverable_updates boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Tabela: activity_feed
CREATE TABLE IF NOT EXISTS public.activity_feed (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    activity_type text NOT NULL,
    title text NOT NULL,
    description text,
    entity_type text,
    entity_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    read boolean DEFAULT false,
    priority integer DEFAULT 3,
    created_at timestamp with time zone DEFAULT now()
);

-- Tabela: user_presence
CREATE TABLE IF NOT EXISTS public.user_presence (
    user_id uuid NOT NULL PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    status public.user_status DEFAULT 'offline'::public.user_status,
    last_seen timestamp with time zone DEFAULT now(),
    current_page text,
    metadata jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp with time zone DEFAULT now()
);

-- Tabela: collaboration_analytics
CREATE TABLE IF NOT EXISTS public.collaboration_analytics (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    analyst_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    creator_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
    total_messages integer DEFAULT 0,
    total_files_shared integer DEFAULT 0,
    total_session_time integer DEFAULT 0,
    last_interaction_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Tabela: collaborative_sessions
CREATE TABLE IF NOT EXISTS public.collaborative_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
    created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    status public.session_status DEFAULT 'active'::public.session_status,
    started_at timestamp with time zone DEFAULT now(),
    ended_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Tabela: collaborative_session_participants
CREATE TABLE IF NOT EXISTS public.collaborative_session_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    session_id uuid REFERENCES public.collaborative_sessions(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at timestamp with time zone DEFAULT now(),
    left_at timestamp with time zone,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb
);

-- Tabela: shared_files
CREATE TABLE IF NOT EXISTS public.shared_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    session_id uuid REFERENCES public.collaborative_sessions(id) ON DELETE CASCADE,
    uploaded_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_type text,
    file_size bigint,
    description text,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);

-- Tabela: file_access_log
CREATE TABLE IF NOT EXISTS public.file_access_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    file_id uuid REFERENCES public.shared_files(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    action text NOT NULL,
    accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);

-- ============ PARTE 3: ÍNDICES ============

-- Índices para performance
CREATE INDEX idx_opportunities_created_by ON public.opportunities(created_by);
CREATE INDEX idx_opportunities_status ON public.opportunities(status);
CREATE INDEX idx_opportunities_analyst_id ON public.opportunities(analyst_id);
CREATE INDEX idx_opportunity_applications_opportunity_id ON public.opportunity_applications(opportunity_id);
CREATE INDEX idx_opportunity_applications_creator_id ON public.opportunity_applications(creator_id);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_activity_feed_user_id ON public.activity_feed(user_id);
CREATE INDEX idx_conversations_analyst_id ON public.conversations(analyst_id);
CREATE INDEX idx_conversations_creator_id ON public.conversations(creator_id);
CREATE INDEX idx_project_deliverables_application_id ON public.project_deliverables(application_id);

-- ============ PARTE 4: FUNCTIONS ============

-- Função: is_analyst
CREATE OR REPLACE FUNCTION public.is_analyst()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'analyst'
  );
$$;

-- Função: is_creator
CREATE OR REPLACE FUNCTION public.is_creator()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'creator'
  );
$$;

-- Função: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Função: handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Função: cleanup_old_data
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete old activity feed items (older than 90 days)
  DELETE FROM activity_feed
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND read = true;
  
  -- Delete old read notifications (older than 30 days)
  DELETE FROM notifications
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND read = true;
  
  -- Delete old file access logs (older than 1 year)
  DELETE FROM file_access_log
  WHERE created_at < NOW() - INTERVAL '1 year';
  
  -- Clean up expired files
  DELETE FROM shared_files
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW();
    
  -- Update offline users (inactive for more than 15 minutes)
  UPDATE user_presence
  SET status = 'offline'
  WHERE status != 'offline'
    AND last_seen < NOW() - INTERVAL '15 minutes';
END;
$$;

-- Função: get_latest_messages
CREATE OR REPLACE FUNCTION public.get_latest_messages(conversation_ids uuid[])
RETURNS SETOF public.messages
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (conversation_id) *
  FROM public.messages
  WHERE conversation_id = ANY(conversation_ids)
  ORDER BY conversation_id, created_at DESC;
$$;

-- ============ PARTE 5: TRIGGERS ============

-- Trigger: on_auth_user_created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Triggers: update_updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_analysts_updated_at
  BEFORE UPDATE ON public.analysts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_opportunity_applications_updated_at
  BEFORE UPDATE ON public.opportunity_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PARTE 6: ROW LEVEL SECURITY (RLS) ============

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborative_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborative_session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_access_log ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES: profiles ============

CREATE POLICY "Enable insert for authenticated users only" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable select for authenticated users" 
  ON public.profiles FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Enable update for users based on id" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Allow profile creation during signup" 
  ON public.profiles FOR INSERT 
  TO authenticated, anon 
  WITH CHECK (true);

CREATE POLICY "Allow profile update during signup" 
  ON public.profiles FOR UPDATE 
  TO authenticated, anon 
  USING (true) 
  WITH CHECK (true);

-- ============ POLICIES: analysts ============

CREATE POLICY "Analysts can insert own data" 
  ON public.analysts FOR INSERT 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Analysts can view own data" 
  ON public.analysts FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Analysts can update own data" 
  ON public.analysts FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Allow analyst signup" 
  ON public.analysts FOR INSERT 
  TO authenticated, anon 
  WITH CHECK (true);

CREATE POLICY "Allow analyst update during signup" 
  ON public.analysts FOR UPDATE 
  TO authenticated, anon 
  USING (true) 
  WITH CHECK (true);

-- ============ POLICIES: opportunities ============

CREATE POLICY "Analysts can create opportunities" 
  ON public.opportunities FOR INSERT 
  TO authenticated 
  WITH CHECK (public.is_analyst() AND created_by = auth.uid());

CREATE POLICY "Analysts can view own opportunities" 
  ON public.opportunities FOR SELECT 
  TO authenticated 
  USING ((public.is_analyst() AND created_by = auth.uid()) OR public.is_creator());

CREATE POLICY "Analysts can update own opportunities" 
  ON public.opportunities FOR UPDATE 
  TO authenticated 
  USING (public.is_analyst() AND created_by = auth.uid()) 
  WITH CHECK (public.is_analyst() AND created_by = auth.uid());

CREATE POLICY "Analysts can delete own opportunities" 
  ON public.opportunities FOR DELETE 
  TO authenticated 
  USING (public.is_analyst() AND created_by = auth.uid());

-- ============ POLICIES: opportunity_applications ============

CREATE POLICY "Enable insert for authenticated creators" 
  ON public.opportunity_applications FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Enable select for own applications" 
  ON public.opportunity_applications FOR SELECT 
  TO authenticated 
  USING (
    auth.uid() = creator_id OR
    auth.uid() IN (
      SELECT created_by FROM public.opportunities WHERE id = opportunity_id
    )
  );

CREATE POLICY "Enable update for own applications" 
  ON public.opportunity_applications FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = creator_id);

CREATE POLICY "Enable delete for application creator" 
  ON public.opportunity_applications FOR DELETE 
  TO authenticated 
  USING (auth.uid() = creator_id);

-- ============ POLICIES: conversations & messages ============

CREATE POLICY "Analysts and creators can create conversations" 
  ON public.conversations FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = analyst_id OR auth.uid() = creator_id);

CREATE POLICY "Enable read access for conversation participants" 
  ON public.conversations FOR SELECT 
  TO authenticated 
  USING (auth.uid() = analyst_id OR auth.uid() = creator_id);

CREATE POLICY "Enable insert for conversation participants" 
  ON public.messages FOR INSERT 
  TO authenticated 
  WITH CHECK (
    auth.uid() IN (
      SELECT analyst_id FROM public.conversations WHERE id = conversation_id
      UNION
      SELECT creator_id FROM public.conversations WHERE id = conversation_id
    )
  );

CREATE POLICY "Enable read access for conversation messages" 
  ON public.messages FOR SELECT 
  TO authenticated 
  USING (
    auth.uid() IN (
      SELECT analyst_id FROM public.conversations WHERE id = conversation_id
      UNION
      SELECT creator_id FROM public.conversations WHERE id = conversation_id
    )
  );

-- ============ POLICIES: notifications ============

CREATE POLICY "Users can view own notifications" 
  ON public.notifications FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" 
  ON public.notifications FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- ============ POLICIES: project_deliverables ============

CREATE POLICY "Analysts can manage deliverables for their opportunities" 
  ON public.project_deliverables 
  TO authenticated 
  USING (
    analyst_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.opportunities 
      WHERE id = opportunity_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Creators can view and update their deliverables" 
  ON public.project_deliverables 
  TO authenticated 
  USING (
    creator_id = auth.uid() OR
    application_id IN (
      SELECT id FROM public.opportunity_applications 
      WHERE creator_id = auth.uid()
    )
  );

-- ============ COMENTÁRIOS E METADATA ============

COMMENT ON TABLE public.profiles IS 'Perfis de usuários (creators e analysts)';
COMMENT ON TABLE public.analysts IS 'Dados específicos de analistas';
COMMENT ON TABLE public.opportunities IS 'Oportunidades de trabalho criadas por analistas';
COMMENT ON TABLE public.project_deliverables IS 'Entregas/deliverables dos projetos';
COMMENT ON TABLE public.conversations IS 'Conversas entre analysts e creators';
COMMENT ON TABLE public.messages IS 'Mensagens dentro das conversas';

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================
-- Próximos passos:
-- 1. Execute este script no SQL Editor do novo Supabase
-- 2. Configure os buckets de Storage (avatars, opportunity-images, deliverables)
-- 3. Atualize as variáveis de ambiente (.env) com as novas credenciais
-- 4. Teste a autenticação e criação de usuários
-- =====================================================
