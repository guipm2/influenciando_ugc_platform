import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Folder, Calendar, Upload, MessageCircle, CheckCircle, Clock, AlertCircle, FileText, X, Grid3X3, List, Eye, EyeOff, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useTabVisibility } from '../hooks/useTabVisibility';
import ProjectInfo from './ProjectInfo';
import { router } from '../utils/router';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import ModalPortal from './common/ModalPortal';
import RatingModal from './common/RatingModal';

// Helper function to navigate to project
const navigateToProject = (projectId: string) => {
  router.navigate(`/creators/projects/${projectId}`);
};

interface Project {
  id: string;
  opportunity_id: string;
  title: string;
  company: string;
  description: string;
  deadline: string;
  status: 'em_andamento' | 'entregue' | 'aprovado' | 'atrasado';
  db_status?: string;
  content_type: string;
  budget: string;
  conversation_id: string;
  deliverables: Deliverable[];
  created_at: string;
  opportunity?: {
    company_link?: string;
    briefing?: string;
  };
  rating?: {
    rating: number;
    feedback?: string;
  };
}

interface ProjectsProps {
  onOpenConversation: (conversationId: string) => void;
  selectedProjectId?: string; // Add support for URL-based project selection
}

interface Deliverable {
  id: string;
  project_id?: string;
  application_id?: string;
  title: string;
  description: string;
  briefing?: string;
  due_date: string;
  priority?: number;
  status: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected' | 'pendente' | 'entregue' | 'aprovado';
  analyst_feedback?: string;
  reviewed_at?: string;
  files: ProjectFile[];
  feedback?: string;
  created_at?: string;
  updated_at?: string;
}

interface ProjectFile {
  id: string;
  name: string;
  url: string | null;
  type: string;
  size: number;
  uploaded_at: string;
  path?: string;
}

const DELIVERABLES_BUCKET = 'deliverables';

const generateFileId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `file_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeDeliverableStatus = (status?: string): Deliverable['status'] => {
  if (!status) return 'pending';
  const normalized = status.toLowerCase();

  if (normalized === 'in_progress' || normalized === 'em_andamento') {
    return 'pending';
  }

  if (normalized === 'pendente') {
    return 'pending';
  }

  if (normalized === 'entregue') {
    return 'submitted';
  }

  if (normalized === 'aprovado') {
    return 'approved';
  }

  if (normalized === 'rejeitado') {
    return 'rejected';
  }

  if (
    normalized === 'pending' ||
    normalized === 'submitted' ||
    normalized === 'approved' ||
    normalized === 'rejected'
  ) {
    return normalized as Deliverable['status'];
  }

  return 'pending';
};

const parseDeliverableFiles = (files: unknown): ProjectFile[] => {
  if (!Array.isArray(files)) return [];

  return files.map((file) => {
    if (file && typeof file === 'object') {
      const typedFile = file as Record<string, unknown>;
      const path = typeof typedFile.path === 'string' ? typedFile.path : undefined;
      const id = typeof typedFile.id === 'string' ? typedFile.id : path ?? generateFileId();

      return {
        id,
        path,
        name: typeof typedFile.name === 'string' ? typedFile.name : 'Arquivo',
        url: typeof typedFile.url === 'string' ? typedFile.url : null,
        type: typeof typedFile.type === 'string' ? typedFile.type : 'application/octet-stream',
        size: typeof typedFile.size === 'number' ? typedFile.size : Number(typedFile.size) || 0,
        uploaded_at: typeof typedFile.uploaded_at === 'string'
          ? typedFile.uploaded_at
          : new Date().toISOString()
      } satisfies ProjectFile;
    }

    return {
      id: generateFileId(),
      name: 'Arquivo',
      url: null,
      type: 'application/octet-stream',
      size: 0,
      uploaded_at: new Date().toISOString()
    } satisfies ProjectFile;
  });
};

const mapDeliverableFromDb = (deliverable: Record<string, unknown>): Deliverable => {
  const typedDeliverable = deliverable as Record<string, unknown>;

  return {
    id: String(typedDeliverable.id),
    application_id: typedDeliverable.application_id ? String(typedDeliverable.application_id) : undefined,
    title: typeof typedDeliverable.title === 'string' ? typedDeliverable.title : 'Deliverable',
    description: typeof typedDeliverable.description === 'string' ? typedDeliverable.description : '',
    briefing: typeof typedDeliverable.briefing === 'string' ? typedDeliverable.briefing : '',
    due_date: String(typedDeliverable.due_date ?? new Date().toISOString().split('T')[0]),
    priority: typeof typedDeliverable.priority === 'number'
      ? typedDeliverable.priority
      : typeof typedDeliverable.priority === 'string'
        ? Number(typedDeliverable.priority)
        : undefined,
    status: normalizeDeliverableStatus(typeof typedDeliverable.status === 'string' ? typedDeliverable.status : undefined),
    analyst_feedback: typeof typedDeliverable.analyst_feedback === 'string' ? typedDeliverable.analyst_feedback : undefined,
    reviewed_at: typeof typedDeliverable.reviewed_at === 'string' ? typedDeliverable.reviewed_at : undefined,
    files: parseDeliverableFiles(typedDeliverable.deliverable_files),
    created_at: typeof typedDeliverable.created_at === 'string' ? typedDeliverable.created_at : undefined,
    updated_at: typeof typedDeliverable.updated_at === 'string' ? typedDeliverable.updated_at : undefined,
    feedback: typeof typedDeliverable.feedback === 'string' ? typedDeliverable.feedback : undefined
  };
};

const Projects: React.FC<ProjectsProps> = ({ onOpenConversation, selectedProjectId }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false); // ✅ Usar ref em vez de state para evitar re-renders
  const [showUploadModal, setShowUploadModal] = useState<string | null>(null);
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [uploadingDeliverableId, setUploadingDeliverableId] = useState<string | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window === 'undefined') {
      return 'grid';
    }

    const stored = window.localStorage.getItem('creators-projects:view-mode');
    return stored === 'grid' || stored === 'list' ? stored : 'grid';
  });
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [hideCompleted, setHideCompleted] = useState(false);
  const { user } = useAuth();

  // Auto-select project based on URL parameter
  useEffect(() => {
    if (selectedProjectId && projects.length > 0) {
      const project = projects.find(p => p.id === selectedProjectId);
      if (project) {
        setSelectedProject(project);
      }
    }
  }, [selectedProjectId, projects]);

  useEffect(() => {
    if (!selectedProject) return;

    const current = projects.find(project => project.id === selectedProject.id);
    if (current && current !== selectedProject) {
      setSelectedProject(current);
    }
  }, [projects, selectedProject]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem('creators-projects:view-mode', viewMode);
    } catch (error) {
      console.warn('Não foi possível salvar a visualização selecionada para projetos:', error);
    }
  }, [viewMode]);

  const fetchProjects = useCallback(async ({ silent = false, force = false }: { silent?: boolean; force?: boolean } = {}) => {
    if (!user || fetchingRef.current) return; // ✅ Usar ref

    if (!silent) {
      setLoading(true);
    }

    fetchingRef.current = true; // ✅ Marcar como executando
    try {
      if (!force && typeof window !== 'undefined') {
        const cached = window.sessionStorage.getItem('creators-projects:cache');
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as {
              updatedAt: string;
              items: Project[];
            };
            if (Array.isArray(parsed?.items)) {
              setProjects(parsed.items);
              if (!silent) {
                setLoading(false);
              }
              return;
            }
          } catch (cacheError) {
            console.warn('Não foi possível utilizar o cache de projetos:', cacheError);
          }
        }
      }

      // Buscar candidaturas aprovadas
      const { data: applications, error } = await supabase
        .from('opportunity_applications')
        .select(`
          id,
          opportunity_id,
          status,
          opportunity:opportunities (
            id,
            title,
            company,
            description,
            deadline,
            content_type,
            budget,
            created_by,
            company_link,
            briefing,
            created_at
          ),
          project_ratings(rating, feedback)
        `)
        .eq('creator_id', user.id)
        .eq('status', 'approved');

      if (error) {
        console.error('❌ [PROJECTS] Erro ao buscar projetos:', error);
        setLoading(false);
        fetchingRef.current = false; // ✅ Liberar flag
        return;
      }

      const projectsData = [];
      
      for (const app of applications || []) {
        const opportunity = Array.isArray(app.opportunity) ? app.opportunity[0] : app.opportunity;
        
        if (!opportunity) continue;

        // Buscar conversa relacionada
        const { data: conversation, error: conversationError } = await supabase
          .from('conversations')
          .select('id')
          .eq('opportunity_id', app.opportunity_id)
          .eq('creator_id', user.id)
          .eq('analyst_id', opportunity.created_by)
          .maybeSingle();

        if (conversationError) {
          console.error('❌ [PROJECTS] Erro ao buscar conversa:', conversationError);
        }

        // Buscar deliverables cadastrados no banco para esta candidatura
        const { data: dbDeliverables, error: deliverablesError } = await supabase
          .from('project_deliverables')
          .select('*')
          .eq('application_id', app.id)
          .order('priority', { ascending: true });

        if (deliverablesError) {
          console.error('❌ [PROJECTS] Erro ao buscar deliverables:', deliverablesError);
        }

        // Mapear deliverables vindos do banco para a interface local
        const mappedDbDeliverables: Deliverable[] = (dbDeliverables ?? []).map(mapDeliverableFromDb);

        // Extract rating if exists
        const appWithRatings = app as unknown as { project_ratings: { rating: number; feedback: string }[] | null };
        const rating = Array.isArray(appWithRatings.project_ratings) && appWithRatings.project_ratings.length > 0
          ? appWithRatings.project_ratings[0]
          : null;

        // Só gerar deliverables padrão caso ainda não exista nenhum cadastrado no banco
        const fallbackDeliverables = mappedDbDeliverables.length === 0
          ? generateDeliverables(opportunity.content_type, app.id)
          : [];

        const allDeliverables = [...mappedDbDeliverables, ...fallbackDeliverables].sort((a, b) => {
          const aDate = new Date(a.due_date).getTime();
          const bDate = new Date(b.due_date).getTime();

          if (!Number.isNaN(aDate) && !Number.isNaN(bDate) && aDate !== bDate) {
            return aDate - bDate;
          }

          const aPriority = a.priority ?? 999;
          const bPriority = b.priority ?? 999;
          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }

          return a.title.localeCompare(b.title);
        });

        projectsData.push({
          id: app.id,
          opportunity_id: app.opportunity_id,
          title: opportunity.title,
          company: opportunity.company,
          description: opportunity.description,
          deadline: opportunity.deadline,
          status: getProjectStatus(opportunity.deadline, allDeliverables),
          db_status: app.status,
          content_type: opportunity.content_type,
          budget: `R$ ${opportunity.budget?.toFixed(2) || '0.00'}`,
          conversation_id: conversation?.id || '',
          deliverables: allDeliverables,
          created_at: new Date().toISOString(),
          opportunity: {
            company_link: opportunity.company_link,
            briefing: opportunity.briefing
          },
          rating: rating ? {
            rating: rating.rating,
            feedback: rating.feedback
          } : undefined
        });
      }

      setProjects(projectsData);
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(
            'creators-projects:cache',
            JSON.stringify({
              updatedAt: new Date().toISOString(),
              items: projectsData
            })
          );
        } catch (cacheSaveError) {
          console.warn('Não foi possível salvar o cache de projetos:', cacheSaveError);
        }
      }
    } catch (err) {
      console.error('❌ [PROJECTS] Erro geral ao buscar projetos:', err);
    } finally {
      setLoading(false);
      fetchingRef.current = false; // ✅ Sempre liberar flag
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;
    
    if (user) {
      fetchProjects({ force: true }).then(() => {
        if (!mounted) return;
        // Execução completa
      });
    }

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Intencionalmente não incluindo fetchProjects para evitar loop infinito

  useAutoRefresh(() => fetchProjects({ silent: true }), 25000, Boolean(user));

  // Recarregar quando a aba voltar a ficar visível
  useTabVisibility(async () => {
    if (!user) return;
    
    console.log('🔄 [PROJECTS] Recarregando projetos após aba voltar a ficar visível');
    
    // Validar sessão antes de recarregar
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('⚠️ [PROJECTS] Sessão inválida ao tentar recarregar');
        return;
      }
    } catch (err) {
      console.error('❌ [PROJECTS] Erro ao validar sessão:', err);
      return;
    }
    
    await fetchProjects({ force: true });
  });

  const getProjectStatus = (deadline: string, deliverables?: Deliverable[]): 'em_andamento' | 'entregue' | 'aprovado' | 'atrasado' => {
    const deadlineDate = new Date(deadline);
    const today = new Date();
    
    if (deliverables) {
      const normalizedStatuses = deliverables.map(d => normalizeDeliverableStatus(d.status));
      const allApproved = normalizedStatuses.every(status => status === 'approved');
      const allSubmitted = normalizedStatuses.every(status => status === 'submitted' || status === 'approved');
      
      if (allApproved) return 'aprovado';
      if (allSubmitted) return 'entregue';
    }
    
    if (today > deadlineDate) {
      return 'atrasado';
    }
    return 'em_andamento';
  };

  const generateDeliverables = (contentType: string, applicationId?: string): Deliverable[] => {
    const baseDeliverables = [];

    if (contentType.toLowerCase().includes('reel') || contentType.toLowerCase().includes('video')) {
      baseDeliverables.push({
        id: `std_2_${applicationId || Date.now()}`,
        project_id: '',
        application_id: applicationId,
        title: 'Roteiro e Storyboard',
        description: 'Roteiro detalhado e storyboard do vídeo',
        briefing: 'O briefing para desenvolvimento do roteiro será fornecido após aprovação do conceito inicial. Incluirá direcionamentos sobre narrativa, duração, elementos visuais e chamadas para ação.',
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: 2,
        status: 'pending' as const,
        files: []
      });
    }

    return baseDeliverables;
  };

  const getStatusBadge = (status: string) => {
    const normalizedStatus = normalizeDeliverableStatus(status);

    const statusConfig = {
      em_andamento: { className: 'glass-chip chip-info', label: 'Em andamento', icon: Clock },
      entregue: { className: 'glass-chip chip-warning', label: 'Entregue', icon: Upload },
      aprovado: { className: 'glass-chip chip-success', label: 'Aprovado', icon: CheckCircle },
      atrasado: { className: 'glass-chip chip-danger', label: 'Atrasado', icon: AlertCircle },
      pending: { className: 'glass-chip', label: 'Pendente', icon: Clock },
      submitted: { className: 'glass-chip chip-warning', label: 'Enviado', icon: Upload },
      approved: { className: 'glass-chip chip-success', label: 'Aprovado', icon: CheckCircle },
      rejected: { className: 'glass-chip chip-danger', label: 'Rejeitado', icon: X }
    } as const;

    const statusKey = (statusConfig as Record<string, (typeof statusConfig)[keyof typeof statusConfig]>)[status]
      ? status
      : normalizedStatus;

    const config = statusConfig[statusKey as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={`${config.className}`}>
        <Icon className="h-3.5 w-3.5" />
        {config.label}
      </span>
    );
  };

  const handleFileUpload = async (deliverableId: string) => {
    if (!uploadFiles || uploadFiles.length === 0) return;

    const filesArray = Array.from(uploadFiles);
    setUploadingDeliverableId(deliverableId);

    const findProjectContainingDeliverable = () => {
      if (selectedProject && selectedProject.deliverables.some(d => d.id === deliverableId)) {
        return selectedProject;
      }

      return projects.find(project => project.deliverables.some(d => d.id === deliverableId)) ?? null;
    };

    const projectWithDeliverable = findProjectContainingDeliverable();
    const existingDeliverable = projectWithDeliverable?.deliverables.find(d => d.id === deliverableId);
    const existingFiles = existingDeliverable?.files ?? [];

    try {
      const uploadedFiles: ProjectFile[] = [];

      for (const file of filesArray) {
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
        const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const path = `${deliverableId}/${uniqueSuffix}-${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from(DELIVERABLES_BUCKET)
          .upload(path, file, { upsert: true });

        if (uploadError) {
          console.error('❌ [PROJECTS] Erro ao enviar arquivo do deliverable:', uploadError);
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage
          .from(DELIVERABLES_BUCKET)
          .getPublicUrl(path);

        uploadedFiles.push({
          id: path,
          path,
          name: file.name,
          url: publicUrlData?.publicUrl ?? null,
          type: file.type,
          size: file.size,
          uploaded_at: new Date().toISOString()
        });
      }

      const updatedFiles = [...existingFiles, ...uploadedFiles];

      const { data: updatedDeliverable, error: updateError } = await supabase
        .from('project_deliverables')
        .update({
          deliverable_files: updatedFiles,
          status: 'submitted'
        })
        .eq('id', deliverableId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ [PROJECTS] Erro ao atualizar deliverable após upload:', updateError);
        throw updateError;
      }

      const deliverableFromDb = mapDeliverableFromDb(updatedDeliverable as Record<string, unknown>);

      const updateProjectDeliverables = (project: Project): Project => {
        const updatedDeliverables = project.deliverables.map(deliverable =>
          deliverable.id === deliverableId ? { ...deliverable, ...deliverableFromDb } : deliverable
        );

        return {
          ...project,
          deliverables: updatedDeliverables,
          status: getProjectStatus(project.deadline, updatedDeliverables)
        };
      };

      setProjects(prevProjects =>
        prevProjects.map(project =>
          project.deliverables.some(deliverable => deliverable.id === deliverableId)
            ? updateProjectDeliverables(project)
            : project
        )
      );

      if (selectedProject?.deliverables.some(deliverable => deliverable.id === deliverableId)) {
        setSelectedProject(prev => (prev ? updateProjectDeliverables(prev) : prev));
      }

  await fetchProjects({ silent: true, force: true });

      setShowUploadModal(null);
      setUploadFiles(null);
    } catch (err) {
      console.error('❌ [PROJECTS] Falha ao enviar arquivos do deliverable:', err);
      alert('Não foi possível enviar os arquivos. Verifique sua conexão e tente novamente.');
    } finally {
      setUploadingDeliverableId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const openConversation = (project: Project) => {
    // Usar o opportunity_id para navegar para o chat (não o ID da aplicação)
        onOpenConversation(project.opportunity_id);
  };

  const filteredProjects = projects.filter(project => {
    if (statusFilter !== 'todos' && project.status !== statusFilter) {
      return false;
    }
    
    if (hideCompleted && (project.status === 'aprovado' || project.status === 'entregue')) {
      return false;
    }
    
    return true;
  });

  const handleRateProject = async (rating: number, feedback: string) => {
    if (!selectedProject || !user) return;

    setIsSubmittingRating(true);
    try {
      const { error } = await supabase
        .from('project_ratings')
        .insert({
          application_id: selectedProject.id,
          rating,
          feedback
        });

      if (error) throw error;

      // Update local state
      const updatedProject = {
        ...selectedProject,
        rating: { rating, feedback }
      };

      setSelectedProject(updatedProject);
      setProjects(prev => prev.map(p => p.id === selectedProject.id ? updatedProject : p));

      setShowRatingModal(false);
    } catch (error) {
      console.error('Error submitting rating:', error);
      alert('Erro ao enviar avaliação. Tente novamente.');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="glass-card p-8 flex flex-col gap-3">
          <h1 className="text-2xl font-semibold">Meus Projetos</h1>
          <p className="text-sm text-gray-400">Carregando o seu hub criativo com atualizações em tempo real...</p>
          <div className="mt-6 flex items-center gap-3">
            <span className="inline-flex h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-transparent"></span>
            <span className="text-sm text-gray-500">Sincronizando entregas e conversas.</span>
          </div>
        </div>
      </div>
    );
  }

  // Se projeto selecionado, mostrar detalhes
  if (selectedProject) {
    const totalDeliverables = selectedProject.deliverables.length;
    const deliveredCount = selectedProject.deliverables.filter(d => ['submitted', 'approved', 'entregue', 'aprovado'].includes(normalizeDeliverableStatus(d.status))).length;
    const awaitingFeedback = selectedProject.deliverables.filter(d => ['submitted', 'entregue'].includes(normalizeDeliverableStatus(d.status))).length;

    return (
      <div className="space-y-10">
        <div className="glass-card p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex flex-col md:flex-row md:items-center gap-5">
              <button
                onClick={() => {
                  setSelectedProject(null);
                  router.navigate('/creators/projects');
                }}
                className="btn-ghost-glass text-sm px-4"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para projetos
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">{selectedProject.title}</h1>
                  {getStatusBadge(selectedProject.status)}
                </div>
                <p className="mt-2 text-sm text-gray-400 flex items-center gap-2">
                  <Folder className="h-4 w-4 text-gray-500" />
                  {selectedProject.company}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <div className="glass-chip chip-info text-xs sm:text-sm">
                <Clock className="h-3.5 w-3.5" />
                Prazo {formatDate(selectedProject.deadline)}
              </div>
              <button
                onClick={() => openConversation(selectedProject)}
                className="btn-primary-glow text-sm"
              >
                <MessageCircle className="h-4 w-4" />
                Conversar com analista
              </button>

              {(selectedProject.status === 'aprovado' || selectedProject.db_status === 'approved') && (
                selectedProject.rating ? (
                  <div className="flex items-center gap-1 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-sm font-medium text-yellow-200">
                      {selectedProject.rating.rating}/5
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowRatingModal(true)}
                    className="btn-ghost-glass text-sm border-yellow-500/30 text-yellow-200 hover:bg-yellow-500/10"
                  >
                    <Star className="h-4 w-4" />
                    Avaliar Projeto
                  </button>
                )
              )}
            </div>
          </div>

          <hr className="glass-divider-soft" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="surface-muted rounded-2xl border border-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Tipo de Conteúdo</p>
              <p className="mt-3 text-lg font-semibold text-white/90">{selectedProject.content_type}</p>
            </div>
            <div className="surface-muted rounded-2xl border border-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Orçamento</p>
              <p className="mt-3 text-lg font-semibold text-emerald-200">{selectedProject.budget}</p>
            </div>
            <div className="surface-muted rounded-2xl border border-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Entregas</p>
              <p className="mt-3 text-lg font-semibold text-white/90">
                {deliveredCount}/{totalDeliverables}
              </p>
              {awaitingFeedback > 0 && (
                <p className="text-xs text-[#00FF41] mt-1">{awaitingFeedback} aguardando avaliação</p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-sm text-gray-400 leading-relaxed max-w-4xl">
              {selectedProject.description}
            </p>
          </div>
        </div>

        <ProjectInfo
          project={{
            title: selectedProject.title,
            company: selectedProject.company,
            description: selectedProject.description,
            company_link: selectedProject.opportunity?.company_link,
            created_at: selectedProject.created_at
          }}
          briefing={selectedProject.opportunity?.briefing}
        />

        <div className="glass-card p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="glass-section-title mb-0">
              <div className="icon-wrap">
                <Upload className="h-5 w-5" />
              </div>
              <h2>Cronograma de Entregas</h2>
            </div>
            <p className="text-xs text-gray-500 uppercase tracking-[0.35em]">
              Sincronizado automaticamente com o analista
            </p>
          </div>

          {selectedProject.deliverables.length > 0 ? (
            <div className="space-y-5">
              {selectedProject.deliverables.map((deliverable) => {
                const isCustom = deliverable.application_id && deliverable.id.startsWith('std_') === false;
                const normalizedStatus = normalizeDeliverableStatus(deliverable.status);
                const isWaitingReview = normalizedStatus === 'submitted';

                return (
                  <div
                    key={deliverable.id}
                    className="surface-muted rounded-2xl border border-white/12 p-5 sm:p-6 transition-all hover:border-[#00FF41]/30 hover:shadow-[0_18px_45px_-28px_rgba(0,0,0,0.9)]"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h5 className="text-lg font-semibold text-white/95">{deliverable.title}</h5>
                          {isCustom && (
                            <span className="glass-chip chip-info text-[0.65rem] uppercase tracking-[0.2em]">Específica</span>
                          )}
                          {deliverable.priority && (
                            <span className="glass-chip text-[0.65rem] uppercase tracking-[0.2em]">
                              Prioridade {deliverable.priority}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed max-w-3xl">
                          {deliverable.description}
                        </p>
                      </div>
                      <div className="flex flex-col items-start sm:items-end gap-2 min-w-[200px]">
                        <span className="text-xs uppercase tracking-[0.25em] text-gray-500">
                          Prazo
                        </span>
                        <span className="text-sm font-semibold text-white/90">
                          {formatDate(deliverable.due_date)}
                        </span>
                        {getStatusBadge(deliverable.status)}
                      </div>
                    </div>

                    {deliverable.files.length > 0 && (
                      <div className="mt-4 space-y-3">
                        <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Arquivos enviados</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {deliverable.files.map((file) => (
                            <div
                              key={file.id}
                              className="surface-muted border border-white/10 rounded-xl p-3 flex items-center gap-3"
                            >
                              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                                <FileText className="h-4 w-4 text-[#00FF41]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white/90 truncate">{file.name}</p>
                                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                              </div>
                              <div className="glass-chip chip-success text-[0.65rem]">
                                Enviado
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(normalizedStatus === 'pending' || normalizedStatus === 'rejected') && isCustom && (
                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => setShowUploadModal(deliverable.id)}
                          className="btn-primary-glow text-sm"
                        >
                          <Upload className="h-4 w-4" />
                          Enviar arquivos
                        </button>
                        {normalizedStatus === 'rejected' && (
                          <span className="glass-chip chip-danger text-[0.65rem]">Reenvio necessário</span>
                        )}
                      </div>
                    )}

                    {isWaitingReview && (
                      <div className="mt-5 glass-chip chip-warning text-xs">Aguardando análise do analista</div>
                    )}

                    {deliverable.analyst_feedback && (
                      <div className="mt-5 border border-amber-200/30 bg-amber-500/10 rounded-2xl p-4">
                        <p className="text-xs uppercase tracking-[0.25em] text-amber-200">Feedback do analista</p>
                        <p className="mt-2 text-sm text-amber-100/90 leading-relaxed">{deliverable.analyst_feedback}</p>
                      </div>
                    )}

                    {normalizedStatus === 'rejected' && !deliverable.analyst_feedback && (
                      <div className="mt-5 border border-red-400/30 bg-red-500/10 rounded-2xl p-4 text-sm text-red-100/90">
                        Sua última entrega foi rejeitada. Revise os arquivos e envie uma nova versão para continuar o projeto.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="surface-muted rounded-2xl border border-dashed border-white/15 p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/5">
                <Clock className="h-6 w-6 text-[#00FF41]" />
              </div>
              <h5 className="text-lg font-semibold text-white/90">Nenhuma entrega definida</h5>
              <p className="mt-2 text-sm text-gray-400 max-w-md mx-auto">
                As entregas deste projeto ainda estão sendo estruturadas. Alinhe com o analista para acelerar o planejamento.
              </p>
            </div>
          )}
        </div>

        {showUploadModal && (
          <ModalPortal>
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
              <div className="glass-card max-w-md w-full p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white/95">Enviar arquivos</h3>
                <button
                  onClick={() => setShowUploadModal(null)}
                  className="btn-ghost-glass px-3 py-1"
                >
                  <X className="h-4 w-4" />
                  Fechar
                </button>
              </div>

              <p className="mt-3 text-sm text-gray-400">
                Adicione todos os arquivos necessários para esta entrega. Eles ficam visíveis automaticamente para o analista responsável.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-[0.28em] text-gray-500 mb-2">
                    Selecionar arquivos
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => setUploadFiles(e.target.files)}
                    className="input-glass"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3">
                  <button
                    onClick={() => setShowUploadModal(null)}
                    className="btn-ghost-glass w-full sm:w-auto justify-center"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleFileUpload(showUploadModal)}
                    disabled={!uploadFiles || uploadFiles.length === 0 || uploadingDeliverableId === showUploadModal}
                    className="btn-primary-glow w-full sm:w-auto justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {uploadingDeliverableId === showUploadModal ? (
                      <span className="flex items-center gap-2 text-sm">
                        <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Enviando
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-sm">
                        <Upload className="h-4 w-4" />
                        Enviar
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
            </div>
          </ModalPortal>
        )}

        <RatingModal
          isOpen={showRatingModal}
          onClose={() => setShowRatingModal(false)}
          onSubmit={handleRateProject}
          isSubmitting={isSubmittingRating}
        />
      </div>
    );
  }

  // Lista de projetos
  return (
    <div className="space-y-10">
      <div className="glass-card p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <span className="badge-pill">Painel criativo</span>
            <div>
              <h1 className="text-3xl font-semibold text-white tracking-tight">Meus Projetos</h1>
              <p className="text-sm text-gray-400 mt-2">
                {filteredProjects.length} de {projects.length} projetos ativos no momento
              </p>
            </div>
          </div>

          <div className="w-full lg:w-auto flex flex-col sm:flex-row sm:items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select-glass sm:w-48"
            >
              <option value="todos">Todos os Status</option>
              <option value="em_andamento">Em andamento</option>
              <option value="entregue">Entregue</option>
              <option value="aprovado">Aprovado</option>
              <option value="atrasado">Atrasado</option>
            </select>

            <button
              onClick={() => setHideCompleted(!hideCompleted)}
              className={`btn-ghost-glass w-full sm:w-auto justify-center ${hideCompleted ? 'border-white/50 bg-white/15' : ''}`}
            >
              {hideCompleted ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {hideCompleted ? 'Mostrar concluídos' : 'Ocultar concluídos'}
            </button>

            <div className="surface-muted rounded-2xl border border-white/12 p-1 flex items-center justify-between">
              <button
                onClick={() => setViewMode('grid')}
                aria-pressed={viewMode === 'grid'}
                aria-label="Mostrar projetos em grade"
                className={`btn-ghost-glass border-none px-3 py-2 ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-400'}`}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
                aria-label="Mostrar projetos em lista"
                className={`btn-ghost-glass border-none px-3 py-2 ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-400'}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center text-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/12 bg-white/5">
            <Folder className="h-8 w-8 text-[#00FF41]" />
          </div>
          <h3 className="text-lg font-semibold text-white/90">Nenhum projeto encontrado</h3>
          <p className="text-sm text-gray-400 max-w-md">
            {statusFilter !== 'todos' || hideCompleted
              ? 'Ajuste os filtros para visualizar outros projetos ativos.'
              : 'Você ainda não tem projetos aprovados. Continue aplicando nas oportunidades destacadas para ativar seu hub.'}
          </p>
        </div>
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'
              : 'space-y-4'
          }
        >
          {filteredProjects.map((project) => {
            const total = project.deliverables.length;
            const delivered = project.deliverables.filter(d => ['submitted', 'approved', 'entregue', 'aprovado'].includes(normalizeDeliverableStatus(d.status))).length;

            return (
              <div
                key={project.id}
                onClick={() => {
                  setSelectedProject(project);
                  navigateToProject(project.id);
                }}
                className={`glass-card p-6 transition-transform duration-300 cursor-pointer hover:-translate-y-1 hover:border-white/35 ${
                  viewMode === 'list' ? 'flex flex-col md:flex-row md:items-center md:justify-between gap-6' : 'space-y-4'
                }`}
              >
                <div className="space-y-4 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500 uppercase tracking-[0.25em]">Projeto</p>
                      <h3 className="text-xl font-semibold text-white/95">{project.title}</h3>
                      <p className="text-xs text-gray-500">{project.company}</p>
                    </div>
                    {getStatusBadge(project.status)}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="surface-muted rounded-2xl border border-white/10 p-4 flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                        <Calendar className="h-4 w-4 text-[#00FF41]" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Prazo</p>
                        <p className="text-sm font-semibold text-white/90">{formatDate(project.deadline)}</p>
                      </div>
                    </div>
                    <div className="surface-muted rounded-2xl border border-white/10 p-4 flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                        <FileText className="h-4 w-4 text-[#00FF41]" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Conteúdo</p>
                        <p className="text-sm font-semibold text-white/90">{project.content_type}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="glass-chip chip-info text-xs">
                      {delivered}/{total} entregas concluídas
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openConversation(project);
                      }}
                      className="btn-ghost-glass text-xs"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Abrir conversa
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Projects;