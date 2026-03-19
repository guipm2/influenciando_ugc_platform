import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Clock,
  MapPin,
  DollarSign,
  Users,
  Eye,
  Heart,
  Send,
  X,
  Grid3X3,
  List,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useRouter } from '../hooks/useRouter';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useTabVisibility } from '../hooks/useTabVisibility';
import { normalizeCompanyLink } from '../utils/formatters';
import ModalPortal from './common/ModalPortal';

type ApplicationStatus = 'pending' | 'approved' | 'rejected';

type ViewMode = 'grid' | 'list';

type DbOpportunityStatus = 'ativo' | 'pausado' | 'encerrado' | 'rascunho';

interface DbOpportunity {
  id: string;
  title: string;
  company: string;
  company_link?: string | null;
  location?: string | null;
  budget?: number | null;
  deadline?: string | null;
  description?: string | null;
  requirements?: string[] | null;
  content_type?: string | null;
  candidates_count?: number | null;
  status?: DbOpportunityStatus | null;
  created_at?: string;
}

interface OpportunityApplication {
  id: string;
  status: ApplicationStatus;
}

interface OpportunityCardData {
  id: string;
  title: string;
  company: string;
  companyLogo: string;
  companyLink?: string;
  location: string;
  budget: string;
  deadlineLabel: string;
  deadlineDate: string;
  description: string;
  requirements: string[];
  contentType: string;
  candidates: number;
  urgency: 'novo' | 'urgente';
  isClosed: boolean;
  daysLeft: number;
  userApplication?: OpportunityApplication;
}

const DEFAULT_LOGO =
  'https://images.pexels.com/photos/3762800/pexels-photo-3762800.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop';

const OPPORTUNITY_STATUSES: DbOpportunityStatus[] = ['ativo', 'pausado', 'encerrado'];

const getDeadlineMeta = (deadline?: string | null, rawStatus?: DbOpportunityStatus | null) => {
  const statusIndicatesClosure = rawStatus ? rawStatus !== 'ativo' : false;

  if (!deadline) {
    const isClosed = statusIndicatesClosure;
    return {
      deadlineLabel: isClosed ? 'Encerrada' : 'Prazo não informado',
      deadlineDate: 'Data não informada',
      daysLeft: 0,
      isClosed
    };
  }

  const deadlineDate = new Date(deadline);
  const today = new Date();
  const diffTime = deadlineDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const hasExpired = diffDays < 0;
  const isClosed = statusIndicatesClosure || hasExpired;

  const absoluteDays = Math.abs(diffDays);
  let deadlineLabel: string;

  if (isClosed) {
    deadlineLabel = hasExpired
      ? `Encerrada há ${absoluteDays === 1 ? '1 dia' : `${absoluteDays} dias`}`
      : 'Encerrada';
  } else if (diffDays === 0) {
    deadlineLabel = 'Encerra hoje';
  } else if (diffDays === 1) {
    deadlineLabel = 'Encerra amanhã';
  } else {
    deadlineLabel = `Encerra em ${diffDays} dias`;
  }

  const deadlineDateLabel = deadlineDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  return {
    deadlineLabel,
    deadlineDate: deadlineDateLabel,
    daysLeft: diffDays < 0 ? 0 : diffDays,
    isClosed
  };
};

const getUrgency = (isClosed: boolean, daysLeft: number) => {
  if (isClosed) {
    return 'novo';
  }

  return daysLeft <= 7 ? 'urgente' : 'novo';
};

const sortOpportunities = (items: OpportunityCardData[]) => {
  return [...items].sort((a, b) => {
    if (a.isClosed !== b.isClosed) {
      return a.isClosed ? 1 : -1;
    }

    return a.daysLeft - b.daysLeft;
  });
};

const getUrgencyBadge = (urgency: OpportunityCardData['urgency']) => {
  return {
    label: urgency === 'urgente' ? 'Urgente' : 'Novo',
    className: `glass-chip ${urgency === 'urgente' ? 'chip-danger' : 'chip-success'}`
  };
};

const getApplicationBadge = (status: ApplicationStatus) => {
  return {
    label: status === 'approved' ? 'Aprovado' : status === 'rejected' ? 'Rejeitado' : 'Pendente',
    className: `glass-chip ${
      status === 'approved' ? 'chip-success' : status === 'rejected' ? 'chip-danger' : 'chip-warning'
    }`
  };
};

const Opportunities: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') {
      return 'list';
    }

    const stored = window.localStorage.getItem('creators-opportunities:view-mode');
    return stored === 'grid' || stored === 'list' ? stored : 'list';
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [opportunities, setOpportunities] = useState<OpportunityCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [savedOpportunities, setSavedOpportunities] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const stored = window.localStorage.getItem('creators-opportunities:saved');
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch (error) {
      console.warn('Não foi possível carregar favoritos de oportunidades:', error);
      return [];
    }
  });
  const [cancelRequest, setCancelRequest] = useState<{ opportunityId: string; applicationId: string } | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const { user } = useAuth();
  const { navigate } = useRouter();

  const fetchOpportunities = useCallback(
    async ({ silent = false, force = false }: { silent?: boolean; force?: boolean } = {}) => {
      if (!silent) {
        setLoading(true);
      }

      try {
        if (!force) {
          const cached = window.localStorage.getItem('creators-opportunities:cache');
          if (cached) {
            try {
              const parsed = JSON.parse(cached) as {
                updatedAt: string;
                items: OpportunityCardData[];
              };
              if (Array.isArray(parsed?.items)) {
                setOpportunities(parsed.items);
                if (!silent) {
                  setLoading(false);
                }
                return;
              }
            } catch (cacheError) {
              console.warn('Não foi possível utilizar o cache de oportunidades:', cacheError);
            }
          }
        }

        const [opportunitiesResponse, applicationsResponse] = await Promise.all([
          supabase
            .from('opportunities')
            .select('*')
            .in('status', OPPORTUNITY_STATUSES)
            .order('created_at', { ascending: false }),
          user
            ? supabase
                .from('opportunity_applications')
                .select('id, opportunity_id, status')
                .eq('creator_id', user.id)
            : Promise.resolve({ data: [], error: null })
        ]);

        const { data: opportunitiesData, error: opportunitiesError } = opportunitiesResponse;
        const { data: applicationsData, error: applicationsError } = applicationsResponse;

        if (opportunitiesError) {
          console.error('Erro ao buscar oportunidades:', opportunitiesError);
          // NÃO limpa dados existentes quando há erro
          if (!silent) {
            setLoading(false);
          }
          return;
        }

        if (applicationsError) {
          console.error('Erro ao buscar candidaturas:', applicationsError);
        }

        const applications = (applicationsData ?? []) as {
          id: string;
          opportunity_id: string;
          status: ApplicationStatus;
        }[];

        const formatted = (opportunitiesData ?? []).map((opp: DbOpportunity) => {
          const userApplication = applications.find((app) => app.opportunity_id === opp.id);

          const { deadlineLabel, deadlineDate, daysLeft, isClosed } = getDeadlineMeta(
            opp.deadline,
            opp.status ?? 'ativo'
          );
          const urgency = getUrgency(isClosed, daysLeft);

          return {
            id: opp.id,
            title: opp.title,
            company: opp.company,
            companyLogo: DEFAULT_LOGO,
            companyLink: normalizeCompanyLink(opp.company_link ?? undefined),
            location: opp.location || 'Remoto',
            budget: opp.budget ? `R$ ${opp.budget.toFixed(2)}` : 'A combinar',
            deadlineLabel,
            deadlineDate,
            description: opp.description ?? 'Descrição não informada.',
            requirements: Array.isArray(opp.requirements) ? opp.requirements : [],
            contentType: opp.content_type ?? 'Conteúdo UGC',
            candidates: opp.candidates_count ?? 0,
            urgency,
            isClosed,
            daysLeft,
            userApplication: userApplication
              ? {
                  id: userApplication.id,
                  status: userApplication.status
                }
              : undefined
          } satisfies OpportunityCardData;
        });

        setOpportunities(sortOpportunities(formatted));
        try {
          window.localStorage.setItem(
            'creators-opportunities:cache',
            JSON.stringify({
              updatedAt: new Date().toISOString(),
              items: sortOpportunities(formatted)
            })
          );
        } catch (cacheSaveError) {
          console.warn('Não foi possível salvar o cache de oportunidades:', cacheSaveError);
        }
      } catch (error) {
        console.error('Erro ao buscar oportunidades:', error);
        setOpportunities([]);
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    fetchOpportunities({ force: true });
  }, [fetchOpportunities]);

  useAutoRefresh(() => fetchOpportunities({ silent: true }), 20000, true);

  // Recarregar silenciosamente quando a aba voltar a ficar visível
  useTabVisibility(async () => {
    await fetchOpportunities({ silent: true, force: true });
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem('creators-opportunities:view-mode', viewMode);
    } catch (error) {
      console.warn('Não foi possível salvar a visualização selecionada:', error);
    }
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(
        'creators-opportunities:saved',
        JSON.stringify(savedOpportunities)
      );
    } catch (error) {
      console.warn('Não foi possível salvar favoritos de oportunidades:', error);
    }
  }, [savedOpportunities]);

  const filteredOpportunities = opportunities.filter((opportunity) => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) {
      return true;
    }

    return (
      opportunity.title.toLowerCase().includes(term) ||
      opportunity.company.toLowerCase().includes(term) ||
      opportunity.contentType.toLowerCase().includes(term)
    );
  });

  const toggleSavedOpportunity = useCallback((opportunityId: string) => {
    setSavedOpportunities((current) => {
      return current.includes(opportunityId)
        ? current.filter((id) => id !== opportunityId)
        : [...current, opportunityId];
    });
  }, []);

  const openCancelModal = (opportunityId: string, applicationId: string) => {
    setCancelError(null);
    setCancelRequest({ opportunityId, applicationId });
  };

  const closeCancelModal = () => {
    if (!cancelRequest) {
      return;
    }

    if (actionLoading === cancelRequest.opportunityId) {
      return;
    }

    setCancelRequest(null);
    setCancelError(null);
  };

  const cancelTargetOpportunity = cancelRequest
    ? opportunities.find((item) => item.id === cancelRequest.opportunityId)
    : null;

  const isCancellationInProgress = cancelRequest
    ? actionLoading === cancelRequest.opportunityId
    : false;

  const handleApply = async (opportunityId: string) => {
    if (!user) return;

    const opportunity = opportunities.find((item) => item.id === opportunityId);
    if (!opportunity || opportunity.isClosed) {
      return;
    }

    setActionLoading(opportunityId);

    try {
      const { error: insertError } = await supabase.from('opportunity_applications').insert({
        opportunity_id: opportunityId,
        creator_id: user.id,
        message: 'Tenho interesse nesta oportunidade!',
        status: 'pending'
      });

      if (insertError) {
        if (insertError.code === '23505') {
          console.warn('Usuário já inscrito na oportunidade.');
        } else {
          console.error('Erro ao se candidatar:', insertError);
        }
        return;
      }

      const { error: updateError } = await supabase
        .from('opportunities')
        .update({
          candidates_count: (opportunity.candidates || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', opportunityId);

      if (updateError) {
        console.error('Erro ao atualizar contagem de candidatos:', updateError);
      }

      fetchOpportunities({ silent: true });
    } catch (error) {
      console.error('Erro ao se candidatar:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelApplication = async () => {
    if (!user || !cancelRequest) {
      return;
    }

    const { opportunityId, applicationId } = cancelRequest;
    setCancelError(null);
    setActionLoading(opportunityId);

    const opportunity = opportunities.find((item) => item.id === opportunityId);
    let shouldCloseModal = true;

    try {
      const { error } = await supabase
        .from('opportunity_applications')
        .delete()
        .eq('id', applicationId)
        .eq('creator_id', user.id);

      if (error) {
        console.error('Erro ao cancelar candidatura:', error);
        setCancelError('Não foi possível cancelar agora. Tente novamente em instantes.');
        shouldCloseModal = false;
        return;
      }

      if (opportunity) {
        const nextCount = Math.max((opportunity.candidates ?? 1) - 1, 0);
        const { error: updateError } = await supabase
          .from('opportunities')
          .update({
            candidates_count: nextCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', opportunityId);

        if (updateError) {
          console.error('Erro ao atualizar contagem de candidatos:', updateError);
        }
      }

      fetchOpportunities({ silent: true });
    } catch (err) {
      console.error('Erro ao cancelar candidatura:', err);
      setCancelError('Não foi possível cancelar agora. Tente novamente.');
      shouldCloseModal = false;
    } finally {
      setActionLoading(null);
      if (shouldCloseModal) {
        setCancelRequest(null);
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="glass-card p-8 flex flex-col gap-3">
          <h1 className="text-2xl font-semibold text-white">Oportunidades</h1>
          <p className="text-sm text-gray-400">Carregando curadoria de projetos em destaque...</p>
          <div className="mt-6 flex items-center gap-3">
            <span className="inline-flex h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-transparent"></span>
            <span className="text-sm text-gray-500">Nossa equipe está sincronizando as oportunidades mais recentes.</span>
          </div>
        </div>
      </div>
    );
  }

  const renderOpportunityCard = (opportunity: OpportunityCardData) => {
    const isList = viewMode === 'list';
    const urgencyBadge = getUrgencyBadge(opportunity.urgency);
    const applicationBadge = opportunity.userApplication
      ? getApplicationBadge(opportunity.userApplication.status)
      : null;
    const isLoading = actionLoading === opportunity.id;

    const handleCardClick = () => {
      navigate(`/creators/opportunities/${opportunity.id}`);
    };

    const isSaved = savedOpportunities.includes(opportunity.id);

    const handleApplyClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      handleApply(opportunity.id);
    };

    const handleCancelClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!opportunity.userApplication) return;
      event.stopPropagation();
      openCancelModal(opportunity.id, opportunity.userApplication.id);
    };

    const handleSaveClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      toggleSavedOpportunity(opportunity.id);
    };

    return (
      <div
        key={opportunity.id}
        className={`glass-card transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:border-white/35 ${
          isList ? 'p-5 md:p-6 flex flex-col gap-6 md:flex-row md:items-center md:justify-between' : 'p-6 space-y-5'
        }`}
        onClick={handleCardClick}
      >
        <div className={`flex ${isList ? 'items-center gap-4 flex-1 min-w-0' : 'items-start gap-4'}`}>
          <img
            src={opportunity.companyLogo}
            alt={opportunity.company}
            className="w-14 h-14 rounded-2xl object-cover border border-white/15"
          />
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-white/95 truncate">{opportunity.title}</h3>
              <span className={`${urgencyBadge.className} text-[0.7rem]`}>{urgencyBadge.label}</span>
              {opportunity.isClosed && (
                <span className="glass-chip chip-danger text-[0.7rem]">Encerrada</span>
              )}
              <span className="glass-chip chip-info text-[0.7rem]">{opportunity.contentType}</span>
            </div>
            <p className="text-sm text-gray-400">{opportunity.company}</p>

            <div
              className={`grid ${
                isList ? 'grid-cols-2 lg:grid-cols-3 gap-3' : 'grid-cols-2 gap-3'
              } text-sm text-gray-300`}
            >
              <div className="surface-muted rounded-xl border border-white/10 p-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-200" />
                <span>{opportunity.budget}</span>
              </div>
              <div className="surface-muted rounded-xl border border-white/10 p-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-200" />
                <span className={opportunity.isClosed ? 'text-gray-400' : 'text-red-200'}>
                  {opportunity.deadlineLabel}
                </span>
              </div>
              <div className="surface-muted rounded-xl border border-white/10 p-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-sky-200" />
                <span>{opportunity.location}</span>
              </div>
              <div className="surface-muted rounded-xl border border-white/10 p-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-[#00FF41]" />
                <span>{opportunity.candidates} candidatos</span>
              </div>
            </div>

            {!isList && (
              <>
                <p className="text-sm text-gray-400 line-clamp-2">{opportunity.description}</p>
                {opportunity.requirements.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {opportunity.requirements.slice(0, 4).map((req, index) => (
                      <span key={index} className="glass-chip text-[0.65rem]">
                        {req}
                      </span>
                    ))}
                    {opportunity.requirements.length > 4 && (
                      <span className="text-xs text-gray-500">+{opportunity.requirements.length - 4} itens</span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className={`flex flex-col gap-3 ${isList ? 'items-end' : 'items-stretch'}`}>
          {opportunity.userApplication ? (
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {applicationBadge && (
                <span className={`${applicationBadge.className} text-xs`}>
                  {applicationBadge.label}
                </span>
              )}
              {opportunity.userApplication.status === 'pending' && (
                <button
                  onClick={handleCancelClick}
                  disabled={isLoading}
                  className="btn-ghost-glass bg-red-500/20 border-red-400/40 text-red-100 hover:bg-red-500/35 disabled:opacity-60 disabled:cursor-not-allowed text-xs"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full border border-current border-t-transparent animate-spin" />
                      Cancelando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <X className="h-3 w-3" />
                      Cancelar
                    </span>
                  )}
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={handleApplyClick}
              disabled={isLoading || opportunity.isClosed}
              className="btn-primary-glow text-sm px-4 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Enviando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  {opportunity.isClosed ? 'Indisponível' : 'Candidatar-se'}
                </span>
              )}
            </button>
          )}

          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/creators/opportunities/${opportunity.id}`);
              }}
              className="btn-ghost-glass text-xs"
            >
              <Eye className="h-4 w-4" />
              Ver detalhes
            </button>
            <button
              onClick={handleSaveClick}
              aria-pressed={isSaved}
              title={isSaved ? 'Remover dos favoritos' : 'Salvar para revisar depois'}
              className={`btn-ghost-glass text-xs transition-colors ${
                isSaved
                  ? 'border-[#00FF41]/60 bg-[#00FF41]/20 text-[#00FF41] hover:bg-[#00FF41]/25'
                  : ''
              }`}
            >
              <Heart className={`h-4 w-4 ${isSaved ? 'fill-current' : 'fill-transparent'}`} />
              {isSaved ? 'Salvo' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-10">
        <div className="glass-card p-6 md:p-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3">
              <span className="badge-pill">Radar de oportunidades</span>
              <div>
                <h1 className="text-3xl font-semibold text-white tracking-tight">Oportunidades</h1>
                <p className="text-sm text-gray-400 mt-2">
                  {filteredOpportunities.length} de {opportunities.length} oportunidades disponíveis
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:flex-1 max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar por marca, formato ou palavra-chave"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="input-glass pl-11"
              />
            </div>

            <div className="surface-muted rounded-2xl border border-white/12 p-1 flex items-center gap-1">
              <button
                onClick={() => setViewMode('grid')}
                aria-pressed={viewMode === 'grid'}
                aria-label="Mostrar oportunidades em grade"
                className={`btn-ghost-glass border-none px-3 py-2 ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-400'}`}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
                aria-label="Mostrar oportunidades em lista"
                className={`btn-ghost-glass border-none px-3 py-2 ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-400'}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {filteredOpportunities.length === 0 ? (
          <div className="glass-card p-12 flex flex-col items-center text-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/12 bg-white/5">
              <Search className="h-8 w-8 text-[#00FF41]" />
            </div>
            <h3 className="text-lg font-semibold text-white/90">
              {opportunities.length === 0 ? 'Nenhuma oportunidade disponível' : 'Nenhuma oportunidade encontrada'}
            </h3>
            <p className="text-sm text-gray-400 max-w-md">
              {opportunities.length === 0
                ? 'Aguarde novas oportunidades serem criadas pelos analistas.'
                : 'Tente ajustar sua busca para explorar outras campanhas.'}
            </p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'space-y-4'}>
            {filteredOpportunities.map(renderOpportunityCard)}
          </div>
        )}
      </div>

      {cancelRequest && (
        <ModalPortal>
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md px-4">
            <div className="glass-card w-full max-w-md border px-6 py-7 space-y-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-400/40 bg-red-500/20 text-red-100">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Cancelar candidatura</h3>
                  {cancelTargetOpportunity && (
                    <p className="text-sm text-gray-300 mt-1">
                      {cancelTargetOpportunity.title} · {cancelTargetOpportunity.company}
                    </p>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-300 leading-relaxed">
                Tem certeza de que deseja cancelar? Você perderá seu lugar na fila e precisará se candidatar novamente caso mude de ideia.
              </p>

              {cancelError && (
                <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {cancelError}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={closeCancelModal}
                  disabled={isCancellationInProgress}
                  className="btn-ghost-glass px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Manter candidatura
                </button>
                <button
                  onClick={handleCancelApplication}
                  disabled={isCancellationInProgress}
                  className="btn-ghost-glass px-4 py-2 border border-red-400/60 bg-red-500/20 text-red-100 hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCancellationInProgress ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border border-current border-t-transparent animate-spin" />
                      Cancelando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Cancelar candidatura
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
};

export default Opportunities;