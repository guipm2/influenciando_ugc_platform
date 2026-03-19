import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  Users,
  Target,
  UserCheck,
  Clock,
  DollarSign,
  MapPin,
  Tag
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAnalystAuth } from '../../contexts/AnalystAuthContext';
import { useTabVisibility } from '../../hooks/useTabVisibility';
import { resolveSiteUrl } from '../../utils/siteUrl';
import { normalizeCompanyLink } from '../../utils/formatters';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { createSquareThumbnail } from '../../utils/imageUtils';
import CreateOpportunityModal from './CreateOpportunityModal';
import ApplicationsModal from './ApplicationsModal';
import ViewOpportunityModal from './ViewOpportunityModal';
import EditOpportunityModal from './EditOpportunityModal';

interface Opportunity {
  id: string;
  title: string;
  company: string;
  company_link?: string;
  description: string;
  budget: number;
  location: string;
  content_type: string;
  requirements: string[];
  deadline: string;
  status: string;
  age_range?: string;
  gender?: string;
  analyst_id?: string;
  created_by?: string;
  candidates_count: number;
  created_at: string;
}

type NewOpportunityPayload = {
  title: string;
  company: string;
  company_link?: string;
  description: string;
  budget: number;
  location: string;
  content_type: string;
  requirements: string[];
  deadline: string;
  status: string;
  age_range: string;
  gender: string;
  images?: File[];
};

const OPPORTUNITY_CREATED_WEBHOOK_URL =
  (import.meta.env.VITE_OPPORTUNITY_CREATED_WEBHOOK_URL as string | undefined) ??
  '';

type RawOpportunity = Partial<Opportunity> & Record<string, unknown>;

type DeadlineInfo = {
  formattedDate: string;
  statusText: string;
  badgeClass: string;
};

const getDeadlineInfo = (deadline?: string): DeadlineInfo => {
  if (!deadline) {
    return {
      formattedDate: 'Sem prazo definido',
      statusText: 'Sem prazo',
      badgeClass: 'bg-gray-100 text-gray-600'
    };
  }

  const deadlineDate = new Date(deadline);

  if (Number.isNaN(deadlineDate.getTime())) {
    return {
      formattedDate: 'Prazo inválido',
      statusText: 'Verifique a data',
      badgeClass: 'bg-red-100 text-red-700'
    };
  }

  const normalizedDeadline = new Date(deadlineDate);
  normalizedDeadline.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((normalizedDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const formattedDate = normalizedDeadline.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  if (diffDays < 0) {
    return {
      formattedDate,
      statusText: `Encerrada há ${Math.abs(diffDays)}d`,
      badgeClass: 'bg-gray-200 text-gray-600'
    };
  }

  if (diffDays === 0) {
    return {
      formattedDate,
      statusText: 'Encerra hoje',
      badgeClass: 'bg-red-100 text-red-700'
    };
  }

  if (diffDays <= 7) {
    return {
      formattedDate,
      statusText: `Encerra em ${diffDays}d`,
      badgeClass: 'bg-orange-100 text-orange-700'
    };
  }

  return {
    formattedDate,
    statusText: `Em ${diffDays}d`,
    badgeClass: 'bg-emerald-100 text-emerald-700'
  };
};

const normalizeOpportunity = (raw: RawOpportunity, overrides: Partial<Opportunity> = {}): Opportunity => {
  const safeArray = (value?: string[] | null) => (Array.isArray(value) ? value : []);

  return {
    id: (raw?.id as string) ?? overrides.id ?? '',
    title: (raw?.title as string) ?? overrides.title ?? '',
    company: (raw?.company as string) ?? overrides.company ?? '',
    company_link: normalizeCompanyLink((raw?.company_link as string) ?? overrides.company_link ?? ''),
    description: (raw?.description as string) ?? overrides.description ?? '',
    budget: typeof raw?.budget === 'number' ? (raw.budget as number) : overrides.budget ?? 0,
    location: (raw?.location as string) ?? overrides.location ?? '',
    content_type: (raw?.content_type as string) ?? overrides.content_type ?? '',
    requirements: safeArray((raw as { requirements?: string[] }).requirements) ?? overrides.requirements ?? [],
    deadline: (raw?.deadline as string) ?? overrides.deadline ?? '',
    status: (raw?.status as string) ?? overrides.status ?? '',
    age_range: (raw?.age_range as string) ?? overrides.age_range ?? '',
    gender: (raw?.gender as string) ?? overrides.gender ?? '',
    analyst_id: (raw?.analyst_id as string) ?? overrides.analyst_id ?? '',
    created_by: (raw?.created_by as string) ?? overrides.created_by ?? '',
    candidates_count: typeof raw?.candidates_count === 'number' ? raw.candidates_count : overrides.candidates_count ?? 0,
    created_at: (raw?.created_at as string) ?? overrides.created_at ?? new Date().toISOString()
  };
};

const notifyOpportunityCreated = async (opportunity: Opportunity) => {
  if (!opportunity?.id || !OPPORTUNITY_CREATED_WEBHOOK_URL) {
    return;
  }

  try {
    const baseUrl = resolveSiteUrl();
    const opportunityLink = `${baseUrl}/creators/opportunities/${opportunity.id}`;

    const safeString = (value?: string | null) => (value ? String(value) : '');
    const safeNumber = (value?: number | null) => (typeof value === 'number' && !Number.isNaN(value) ? value : '');
    const safeArray = (value?: string[] | null) => (Array.isArray(value) ? value : []);

    const response = await fetch(OPPORTUNITY_CREATED_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        opportunity_id: safeString(opportunity.id),
        opportunity_link: opportunityLink,
        title: safeString(opportunity.title),
        company: safeString(opportunity.company),
        company_link: safeString(opportunity.company_link),
        description: safeString(opportunity.description),
        budget: safeNumber(opportunity.budget),
        location: safeString(opportunity.location),
        content_type: safeString(opportunity.content_type),
        requirements: safeArray(opportunity.requirements),
        deadline: safeString(opportunity.deadline),
        status: safeString(opportunity.status),
        age_range: safeString(opportunity.age_range),
        gender: safeString(opportunity.gender),
        analyst_id: safeString(opportunity.analyst_id),
        created_by: safeString(opportunity.created_by),
        created_at: safeString(opportunity.created_at)
      })
    });

    if (!response.ok) {
      console.error('Webhook de oportunidade retornou um status inesperado:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('Erro ao notificar webhook de nova oportunidade:', error);
  }
};

const OpportunityManagement: React.FC = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showApplicationsModal, setShowApplicationsModal] = useState<{
    opportunityId: string;
    opportunityTitle: string;
  } | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'ativo' | 'inativo'>('all');
  const [contentTypeFilter, setContentTypeFilter] = useState('');
  const [deadlineFilter, setDeadlineFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const { profile } = useAnalystAuth();

  const fetchOpportunities = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!profile) return;

    if (!silent) {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          application_metrics:opportunity_applications!opportunity_applications_opportunity_id_fkey(count)
        `)
        .eq('created_by', profile.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar oportunidades:', error);
      } else {
        const next = (data || []).map((raw) => {
          const record = raw as Record<string, unknown> & {
            application_metrics?: Array<Record<string, unknown>> | Record<string, unknown> | null;
          };

          let applicationsCount = 0;
          const metrics = record.application_metrics;
          const parseCount = (value: unknown): number => {
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : 0;
          };

          if (Array.isArray(metrics)) {
            const firstEntry = metrics[0];
            const rawCount = firstEntry?.count;
            applicationsCount = parseCount(rawCount);
          } else if (metrics && typeof metrics === 'object') {
            const rawCount = (metrics as { count?: unknown }).count;
            applicationsCount = parseCount(rawCount);
          }

          const opportunityFields = { ...record } as Record<string, unknown>;
          delete opportunityFields.application_metrics;

          return normalizeOpportunity(opportunityFields as RawOpportunity, {
            candidates_count: applicationsCount
          });
        });

        setOpportunities(next);
      }
    } catch (err) {
      console.error('Erro ao buscar oportunidades:', err);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [profile]);

  useEffect(() => {
    void fetchOpportunities();
  }, [fetchOpportunities]);

  useAutoRefresh(() => fetchOpportunities({ silent: true }), 20000, true);

  // Recarregar silenciosamente quando a aba voltar a ficar visível
  useTabVisibility(() => {
    fetchOpportunities({ silent: true });
  });

  const handleCreateOpportunity = async (opportunityData: NewOpportunityPayload) => {
    if (!profile) return;

    try {
      const { images, ...opportunityDataWithoutImages } = opportunityData;
      
      const sanitizedData = {
        ...opportunityDataWithoutImages,
        company_link: normalizeCompanyLink(opportunityDataWithoutImages.company_link)
      };
      const { data, error } = await supabase
        .from('opportunities')
        .insert({
          ...sanitizedData,
          // Usar analyst_id para referenciar tabela analysts
          analyst_id: profile.id,
          company: profile.company,
          created_by: profile.id
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar oportunidade:', error);
        // REMOVIDO: alert('Erro ao criar oportunidade');
      } else {
        const createdOpportunity = normalizeOpportunity(data as RawOpportunity, {
          analyst_id: profile.id,
          created_by: profile.id,
          candidates_count: 0
        });

        // Upload de imagens se houver
        if (images && images.length > 0) {
          try {
            for (let i = 0; i < images.length; i++) {
              const file = images[i];
              const optimizedBlob = await createSquareThumbnail(file, 800);
              const fileName = `${createdOpportunity.id}/${Date.now()}-${i}.webp`;
              
              const { error: uploadError } = await supabase.storage
                .from('opportunity-images')
                .upload(fileName, optimizedBlob, {
                  contentType: 'image/webp',
                  cacheControl: '3600',
                  upsert: false
                });
              
              if (uploadError) {
                console.error('Erro ao fazer upload da imagem:', uploadError);
                continue;
              }
              
              // Gerar URL assinada (válida por 1 ano)
              const { data: signedUrlData } = await supabase.storage
                .from('opportunity-images')
                .createSignedUrl(fileName, 31536000);
              
              const publicUrl = signedUrlData?.signedUrl || '';
              console.log('URL assinada gerada:', publicUrl);
              
              await supabase
                .from('opportunity_images')
                .insert({
                  opportunity_id: createdOpportunity.id,
                  image_url: publicUrl,
                  display_order: i
                });
            }
          } catch (imgError) {
            console.error('Erro ao fazer upload de imagens:', imgError);
          }
        }

        setOpportunities(prev => [createdOpportunity, ...prev]);
        setShowCreateModal(false);
        void notifyOpportunityCreated(createdOpportunity);
        // REMOVIDO: alert('Oportunidade criada com sucesso!');
      }
    } catch (err) {
      console.error('Erro ao criar oportunidade:', err);
      // REMOVIDO: alert('Erro ao criar oportunidade');
    }
  };

  const handleDeleteOpportunity = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta oportunidade?')) return;

    try {
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', id)
        .eq('created_by', profile?.id);

      if (error) {
        console.error('Erro ao excluir oportunidade:', error);
        // REMOVIDO: alert('Erro ao excluir oportunidade');
      } else {
        setOpportunities(prev => prev.filter(opp => opp.id !== id));
        // REMOVIDO: alert('Oportunidade excluída com sucesso!');
      }
    } catch (err) {
      console.error('Erro ao excluir oportunidade:', err);
      // REMOVIDO: alert('Erro ao excluir oportunidade');
    }
  };

  const handleViewOpportunity = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setShowViewModal(true);
  };

  const handleEditOpportunity = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setShowEditModal(true);
  };

  const handleCandidatesCountChange = useCallback((opportunityId: string, count: number) => {
    setOpportunities(prev =>
      prev.map((opportunity) =>
        opportunity.id === opportunityId
          ? { ...opportunity, candidates_count: count }
          : opportunity
      )
    );
  }, []);

  const filteredOpportunities = opportunities.filter((opportunity) => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchesSearch =
      normalizedSearch.length === 0 ||
      opportunity.title.toLowerCase().includes(normalizedSearch) ||
      opportunity.description.toLowerCase().includes(normalizedSearch) ||
      opportunity.company.toLowerCase().includes(normalizedSearch);

    if (!matchesSearch) {
      return false;
    }

    if (statusFilter !== 'all' && opportunity.status !== statusFilter) {
      return false;
    }

    if (contentTypeFilter && opportunity.content_type !== contentTypeFilter) {
      return false;
    }

    if (deadlineFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadlineDate = new Date(opportunity.deadline);

      if (deadlineFilter === 'upcoming' && deadlineDate < today) {
        return false;
      }

      if (deadlineFilter === 'past' && deadlineDate >= today) {
        return false;
      }
    }

    return true;
  });

  const contentTypes = Array.from(new Set(opportunities.map((opp) => opp.content_type).filter(Boolean)));

  const hasActiveFilters = statusFilter !== 'all' || contentTypeFilter !== '' || deadlineFilter !== 'all';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00FF41]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Gerenciar Oportunidades</h1>
          <p className="text-gray-600 mt-1">{opportunities.length} oportunidades criadas</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-[#00FF41] hover:bg-[#00CC34] text-black px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nova Oportunidade
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar oportunidades..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
            />
          </div>
        </div>

        <button
          onClick={() => setShowFilters(prev => !prev)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Filter className="h-4 w-4" />
          Filtros
          {hasActiveFilters && <span className="inline-block w-2 h-2 rounded-full bg-[#00FF41]" />}
        </button>
      </div>

      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
              >
                <option value="all">Todos</option>
                <option value="ativo">Ativas</option>
                <option value="inativo">Inativas</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de conteúdo</label>
              <select
                value={contentTypeFilter}
                onChange={(e) => setContentTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
              >
                <option value="">Todos</option>
                {contentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prazo</label>
              <select
                value={deadlineFilter}
                onChange={(e) => setDeadlineFilter(e.target.value as typeof deadlineFilter)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
              >
                <option value="all">Todos</option>
                <option value="upcoming">Próximos prazos</option>
                <option value="past">Prazo vencido</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => {
                setStatusFilter('all');
                setContentTypeFilter('');
                setDeadlineFilter('all');
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Limpar filtros
            </button>
            <button
              onClick={() => setShowFilters(false)}
              className="px-4 py-2 text-sm bg-[#00FF41] text-black rounded-lg hover:bg-[#00CC34]"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}

      {/* Opportunities List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredOpportunities.map((opportunity) => {
          const deadlineInfo = getDeadlineInfo(opportunity.deadline);
          const requirementCount = opportunity.requirements?.length ?? 0;
          const hasAudienceDetail = Boolean(opportunity.age_range || opportunity.gender);
          const candidateLabel = opportunity.candidates_count === 1 ? 'candidato' : 'candidatos';

          return (
            <div
              key={opportunity.id}
              className="flex flex-col gap-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-lg"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">{opportunity.title}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                    <span className="font-medium text-gray-700">{opportunity.company || 'Empresa não informada'}</span>
                    {opportunity.location && (
                      <>
                        <span className="hidden h-1.5 w-1.5 rounded-full bg-gray-300 sm:inline-block" />
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          {opportunity.location}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                      opportunity.status === 'ativo'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <span className="inline-block h-2 w-2 rounded-full bg-current"></span>
                    {opportunity.status === 'ativo' ? 'Ativa' : 'Inativa'}
                  </span>
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#00FF41]/10 px-3 py-1.5 text-sm font-semibold text-[#00FF41]">
                    <Users className="h-4 w-4" />
                    <span>{opportunity.candidates_count}</span>
                    <span className="text-xs font-medium uppercase tracking-wide text-[#00FF41]">{candidateLabel}</span>
                  </div>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-gray-600 line-clamp-3">
                {opportunity.description || 'Sem descrição disponível para esta oportunidade.'}
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Investimento</p>
                    <p className="text-sm font-semibold text-gray-900">R$ {opportunity.budget.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">Valor previsto para o criador</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50">
                    <Clock className="h-5 w-5 text-orange-500" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Prazo</p>
                    <p className="text-sm font-semibold text-gray-900">{deadlineInfo.formattedDate}</p>
                    <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${deadlineInfo.badgeClass}`}>
                      {deadlineInfo.statusText}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00FF41]/10">
                    <Tag className="h-5 w-5 text-[#00FF41]" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Formato</p>
                    <p className="text-sm font-semibold text-gray-900">{opportunity.content_type || 'Não informado'}</p>
                    <p className="text-xs text-gray-500">
                      {opportunity.company_link ? 'Briefing disponível' : 'Sem link cadastrado'}
                    </p>
                  </div>
                </div>
              </div>

              {(requirementCount > 0 || hasAudienceDetail) && (
                <div className="flex flex-wrap gap-2 text-xs font-medium text-gray-600">
                  {requirementCount > 0 && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1">
                      {requirementCount} {requirementCount === 1 ? 'requisito' : 'requisitos'}
                    </span>
                  )}
                  {opportunity.age_range && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1">
                      <UserCheck className="h-3.5 w-3.5" />
                      Público: {opportunity.age_range}
                    </span>
                  )}
                  {opportunity.gender && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1">
                      Perfil: {opportunity.gender}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500">
                  {opportunity.company_link && (
                    <a
                      href={opportunity.company_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-[#00FF41]/30 px-3 py-1 text-[#00FF41] transition-colors hover:bg-[#00FF41]/10"
                    >
                      Ver briefing
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() =>
                      setShowApplicationsModal({
                        opportunityId: opportunity.id,
                        opportunityTitle: opportunity.title
                      })
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-[#00FF41] px-4 py-2 text-sm font-semibold text-black shadow-sm transition-colors hover:bg-[#00CC34]"
                  >
                    <UserCheck className="h-4 w-4 text-black" />
                    Candidaturas
                  </button>
                  <button
                    onClick={() => handleViewOpportunity(opportunity)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
                  >
                    <Eye className="h-4 w-4" />
                    Ver detalhes
                  </button>
                  <button
                    onClick={() => handleEditOpportunity(opportunity)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
                  >
                    <Edit className="h-4 w-4" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteOpportunity(opportunity.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredOpportunities.length === 0 && (
        <div className="text-center py-12">
          <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            {opportunities.length === 0 ? 'Nenhuma oportunidade criada' : 'Nenhuma oportunidade encontrada'}
          </h3>
          <p className="text-gray-600 mb-4">
            {opportunities.length === 0 
              ? 'Crie sua primeira oportunidade para começar a conectar com criadores'
              : 'Tente ajustar seus filtros de busca'
            }
          </p>
          {opportunities.length === 0 && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#00FF41] hover:bg-[#00CC34] text-black px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Criar Primeira Oportunidade
            </button>
          )}
        </div>
      )}

      {/* Create Opportunity Modal */}
      {showCreateModal && (
        <CreateOpportunityModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateOpportunity}
        />
      )}

      {/* Applications Modal */}
      {showApplicationsModal && (
        <ApplicationsModal
          opportunityId={showApplicationsModal.opportunityId}
          opportunityTitle={showApplicationsModal.opportunityTitle}
          onClose={() => {
            setShowApplicationsModal(null);
            void fetchOpportunities({ silent: true });
          }}
          onCandidatesCountChange={handleCandidatesCountChange}
          onOpportunityStatusChange={(id, status) => {
            setOpportunities(prev =>
              prev.map(opportunity =>
                opportunity.id === id ? { ...opportunity, status } : opportunity
              )
            );
            if (status === 'inativo') {
              void fetchOpportunities({ silent: true });
            }
          }}
        />
      )}

      {/* View Opportunity Modal */}
      {showViewModal && selectedOpportunity && (
        <ViewOpportunityModal
          opportunity={selectedOpportunity}
          onClose={() => setShowViewModal(false)}
        />
      )}

      {/* Edit Opportunity Modal */}
      {showEditModal && selectedOpportunity && (
        <EditOpportunityModal
          opportunity={selectedOpportunity}
          onClose={() => setShowEditModal(false)}
          onSubmit={(updatedData: Partial<Opportunity>) => {
            // Atualizar a oportunidade na lista
            setOpportunities(prev => prev.map(opp => 
              opp.id === selectedOpportunity.id 
                ? {
                    ...opp,
                    ...updatedData,
                    company_link: normalizeCompanyLink(updatedData.company_link ?? opp.company_link)
                  }
                : opp
            ));
            setShowEditModal(false);
          }}
        />
      )}
    </div>
  );
};

export default OpportunityManagement;