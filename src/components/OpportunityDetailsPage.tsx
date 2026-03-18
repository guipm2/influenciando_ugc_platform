import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, MapPin, Calendar, DollarSign, Tag, Users, Building2, Send, Heart, Share2, Check, Clock, Star, Award, Briefcase, ExternalLink, Instagram, Globe, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useRouter } from '../hooks/useRouter';
import { isInstagramUrl, normalizeCompanyLink } from '../utils/formatters';
import ModalPortal from './common/ModalPortal';
import OpportunityImageGallery from './common/OpportunityImageGallery';

interface OpportunityDetails {
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
  candidates_count: number;
  created_at: string;
}

interface UserApplication {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  applied_at: string;
  message: string;
}

interface OpportunityDetailsPageProps {
  opportunityId: string;
}

const OpportunityDetailsPage: React.FC<OpportunityDetailsPageProps> = ({ opportunityId }) => {
  const [opportunity, setOpportunity] = useState<OpportunityDetails | null>(null);
  const [userApplication, setUserApplication] = useState<UserApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applicationMessage, setApplicationMessage] = useState('');
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const { user } = useAuth();
  const { navigate } = useRouter();

  const fetchOpportunityDetails = useCallback(async () => {
    try {
      // Buscar detalhes da oportunidade
      const { data: oppData, error: oppError } = await supabase
        .from('opportunities')
        .select('*')
        .eq('id', opportunityId)
        .single();

      if (oppError) {
        console.error('Erro ao buscar oportunidade:', oppError);
        return;
      }

      // Buscar contagem dinâmica de candidatos
      const { count: candidatesCount, error: countError } = await supabase
        .from('opportunity_applications')
        .select('*', { count: 'exact', head: true })
        .eq('opportunity_id', opportunityId);

      if (countError) {
        console.error('Erro ao buscar contagem de candidatos:', countError);
      }

      // Atualizar dados da oportunidade com contagem dinâmica
      const updatedOpportunity = {
        ...oppData,
        company_link: normalizeCompanyLink((oppData?.company_link as string) ?? ''),
        requirements: Array.isArray(oppData?.requirements) ? oppData.requirements : [],
        candidates_count: candidatesCount || 0
      };

      setOpportunity(updatedOpportunity);

      // Buscar candidatura do usuário se logado
      if (user) {
        const { data: applicationData, error: applicationError } = await supabase
          .from('opportunity_applications')
          .select('*')
          .eq('opportunity_id', opportunityId)
          .eq('creator_id', user.id)
          .maybeSingle();

        if (applicationError && applicationError.code !== 'PGRST116') {
          console.error('Erro ao buscar candidatura:', applicationError);
        } else {
          setUserApplication(applicationData);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes:', error);
    } finally {
      setLoading(false);
    }
  }, [opportunityId, user]);

  useEffect(() => {
    fetchOpportunityDetails();
  }, [fetchOpportunityDetails]);

  const handleApply = async () => {
    if (!user || !opportunity) return;
    if (opportunity.status !== 'ativo') return;
    
    setApplying(true);
    try {
      // Inserir nova candidatura
      const { error: insertError } = await supabase
        .from('opportunity_applications')
        .insert({
          opportunity_id: opportunity.id,
          creator_id: user.id,
          message: applicationMessage || 'Candidatura enviada através da plataforma',
          status: 'pending'
        });

      if (insertError) {
        console.error('Erro ao enviar candidatura:', insertError);
        // REMOVIDO: alert('Erro ao enviar candidatura. Tente novamente.');
        return;
      }

      // Atualizar contagem de candidatos na tabela opportunities
      const { error: updateError } = await supabase
        .from('opportunities')
        .update({ 
          candidates_count: (opportunity.candidates_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', opportunity.id);

      if (updateError) {
        console.error('Erro ao atualizar contagem de candidatos:', updateError);
        // Não interromper o fluxo, pois a candidatura já foi criada
      }

      // REMOVIDO: alert('Candidatura enviada com sucesso!');
      setShowApplicationForm(false);
      setApplicationMessage('');
      // Recarregar dados para mostrar a nova candidatura
      fetchOpportunityDetails();
    } catch (error) {
      console.error('Erro ao enviar candidatura:', error);
      // REMOVIDO: alert('Erro ao enviar candidatura. Tente novamente.');
    } finally {
      setApplying(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const getDaysLeft = (deadline: string) => {
    const deadlineDate = new Date(deadline);
    const today = new Date();
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusBadge = (status?: 'pending' | 'approved' | 'rejected') => {
    if (!status) return null;
    
    const styles = {
      pending: { className: 'glass-chip chip-warning', label: 'Pendente' },
      approved: { className: 'glass-chip chip-success', label: 'Aprovado' },
      rejected: { className: 'glass-chip chip-danger', label: 'Rejeitado' }
    } as const;

    const config = styles[status];

    return <span className={config.className}>{config.label}</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card px-10 py-8 flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/30 border-t-transparent"></div>
          <p className="text-sm text-gray-400">Carregando detalhes da oportunidade...</p>
        </div>
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card px-10 py-8 text-center space-y-4 max-w-md">
          <h2 className="text-2xl font-semibold text-white/95">Oportunidade não encontrada</h2>
          <p className="text-sm text-gray-400">
            A oportunidade que você está procurando não existe ou foi removida.
          </p>
          <button
            onClick={() => navigate('/creators/opportunities')}
            className="btn-primary-glow w-full justify-center"
          >
            Voltar para oportunidades
          </button>
        </div>
      </div>
    );
  }

  const daysLeft = getDaysLeft(opportunity.deadline);
  const isClosed = opportunity.status !== 'ativo' || daysLeft <= 0;
  const deadlineStatusClass = daysLeft <= 0 ? 'chip-danger' : daysLeft <= 3 ? 'chip-danger' : daysLeft <= 7 ? 'chip-warning' : 'chip-success';
  const deadlineLabel = daysLeft > 0 ? `${daysLeft} dias restantes` : 'Prazo expirado';
  const budgetDisplay = opportunity.budget ? `R$ ${opportunity.budget.toFixed(2)}` : 'A combinar';

  return (
    <div className="min-h-screen pb-16">
      <div className="max-w-6xl mx-auto px-4 pt-10 space-y-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={() => navigate('/creators/opportunities')}
            className="btn-ghost-glass"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para oportunidades
          </button>
          <div className="glass-chip chip-info text-xs">
            <Calendar className="h-3.5 w-3.5" />
            Publicada em {formatDate(opportunity.created_at)}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="glass-card p-6 md:p-8 space-y-6">
              {isClosed && (
                <div className="surface-muted border border-amber-300/30 rounded-2xl p-4 text-sm text-amber-100/90 flex items-center gap-3">
                  <Clock className="h-4 w-4" />
                  Esta oportunidade não está mais aceitando candidaturas.
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className={`glass-chip ${deadlineStatusClass}`}>
                  <Clock className="h-3.5 w-3.5" />
                  {deadlineLabel}
                </span>
                <span className="glass-chip chip-info">
                  <Briefcase className="h-3.5 w-3.5" />
                  {opportunity.content_type}
                </span>
                {opportunity.candidates_count >= 10 && (
                  <span className="glass-chip chip-info">
                    <Star className="h-3.5 w-3.5" />
                    Popular
                  </span>
                )}
                {opportunity.status !== 'ativo' && (
                  <span className="glass-chip chip-danger">Encerrada</span>
                )}
                {userApplication && (
                  <div className="ml-auto">
                    {getStatusBadge(userApplication.status)}
                  </div>
                )}
              </div>

              <div className="space-y-5">
                <h1 className="text-3xl md:text-4xl font-semibold text-white/95 leading-tight">
                  {opportunity.title}
                </h1>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="surface-muted rounded-2xl border border-white/12 p-4 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                      <Building2 className="h-4 w-4 text-[#00FF41]" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Empresa</p>
                      <p className="text-sm font-semibold text-white/90">{opportunity.company}</p>
                    </div>
                  </div>
                  <div className="surface-muted rounded-2xl border border-white/12 p-4 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                      <DollarSign className="h-4 w-4 text-emerald-200" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Investimento</p>
                      <p className="text-sm font-semibold text-emerald-200">{budgetDisplay}</p>
                    </div>
                  </div>
                  <div className="surface-muted rounded-2xl border border-white/12 p-4 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                      <MapPin className="h-4 w-4 text-sky-200" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Localização</p>
                      <p className="text-sm font-semibold text-white/90 truncate">{opportunity.location}</p>
                    </div>
                  </div>
                </div>
              </div>

              {userApplication && (
                <div className="surface-muted border border-emerald-300/25 rounded-2xl p-5 flex flex-wrap items-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-300/40">
                    <Check className="h-5 w-5 text-emerald-200" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/90">Candidatura enviada</p>
                    <p className="text-xs text-gray-400">Enviada em {formatDate(userApplication.applied_at)}</p>
                  </div>
                  <div className="ml-auto">{getStatusBadge(userApplication.status)}</div>
                </div>
              )}
            </div>

            {/* Galeria de Imagens */}
            <OpportunityImageGallery 
              opportunityId={opportunityId}
              className="glass-card p-6 md:p-8"
            />

            <div className="glass-card p-6 md:p-8 space-y-6">
              <div className="glass-section-title mb-0">
                <div className="icon-wrap">
                  <Briefcase className="h-5 w-5" />
                </div>
                <h2>Descrição da Oportunidade</h2>
              </div>
              <div className="leading-relaxed text-gray-200 whitespace-pre-line">
                {opportunity.description}
              </div>
              <div className="surface-muted rounded-2xl border border-white/12 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-300">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#00FF41]" />
                  {opportunity.candidates_count || 0} candidatos
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#00FF41]" />
                  Criada em {formatDate(opportunity.created_at)}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#00FF41]" />
                  Prazo: {formatDate(opportunity.deadline)}
                </div>
              </div>
            </div>

            {opportunity.requirements && opportunity.requirements.length > 0 && (
              <div className="glass-card p-6 md:p-8 space-y-6">
                <div className="glass-section-title mb-0">
                  <div className="icon-wrap">
                    <Award className="h-5 w-5" />
                  </div>
                  <h2>Requisitos</h2>
                </div>
                <div className="space-y-3">
                  {opportunity.requirements.map((req, index) => (
                    <div key={index} className="surface-muted rounded-2xl border border-white/12 p-4 flex items-start gap-3">
                      <div className="p-2 rounded-full bg-white/5 border border-white/10 mt-0.5">
                        <Check className="h-3.5 w-3.5 text-[#00FF41]" />
                      </div>
                      <span className="text-sm text-gray-200">{req}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              {user && !userApplication && !isClosed && (
                <div className="glass-card p-6 md:p-7 space-y-5">
                  <div className="glass-section-title mb-0">
                    <div className="icon-wrap">
                      <Send className="h-5 w-5" />
                    </div>
                    <h3>Ações Disponíveis</h3>
                  </div>
                  <button
                    onClick={() => setShowApplicationForm(true)}
                    className="btn-primary-glow w-full justify-center text-base py-3"
                  >
                    <Send className="h-4 w-4" />
                    Candidatar-se agora
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <button className="btn-ghost-glass justify-center">
                      <Heart className="h-4 w-4" />
                      Salvar
                    </button>
                    <button className="btn-ghost-glass justify-center">
                      <Share2 className="h-4 w-4" />
                      Compartilhar
                    </button>
                  </div>
                </div>
              )}

              <div className="glass-card p-6 md:p-7 space-y-6">
                <div className="glass-section-title mb-0">
                  <div className="icon-wrap">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <h3>Sobre a Empresa</h3>
                </div>
                <div className="surface-muted rounded-2xl border border-white/12 p-5 flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex-shrink-0">
                    <Building2 className="h-6 w-6 text-[#00FF41]" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-lg font-semibold text-white/95 truncate">{opportunity.company}</p>
                    <p className="text-sm text-gray-400 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Membro desde {formatDate(opportunity.created_at)}
                    </p>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      A marca utiliza a plataforma para encontrar criadores alinhados ao seu posicionamento digital.
                    </p>
                  </div>
                </div>

                {opportunity.company_link && (
                  <div className="surface-muted rounded-2xl border border-white/12 p-5 space-y-3">
                    <h4 className="text-xs uppercase tracking-[0.28em] text-gray-500">Conheça a marca</h4>
                    <button
                      onClick={() => {
                        window.open(opportunity.company_link, '_blank', 'noopener,noreferrer');
                      }}
                      className="btn-primary-glow w-full justify-center"
                    >
                      {isInstagramUrl(opportunity.company_link) ? (
                        <Instagram className="h-4 w-4" />
                      ) : (
                        <Globe className="h-4 w-4" />
                      )}
                      {isInstagramUrl(opportunity.company_link) ? 'Ver Instagram' : 'Visitar site'}
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    <p className="text-xs text-gray-400">
                      Abra em uma nova aba para mergulhar na identidade visual e nos cases recentes.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="surface-muted rounded-2xl border border-white/12 p-4 text-center">
                    <p className="text-2xl">★</p>
                    <p className="text-xs text-gray-400 mt-2">Empresa verificada</p>
                  </div>
                  <div className="surface-muted rounded-2xl border border-white/12 p-4 text-center">
                    <p className="text-2xl">⚡</p>
                    <p className="text-xs text-gray-400 mt-2">Resposta rápida</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-card p-6 md:p-7 space-y-5">
              <div className="glass-section-title mb-0">
                <div className="icon-wrap">
                  <Award className="h-5 w-5" />
                </div>
                <h3>Detalhes da oportunidade</h3>
              </div>

              <div className="space-y-4 text-sm text-gray-300">
                <div className="surface-muted rounded-2xl border border-white/12 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                      <DollarSign className="h-4 w-4 text-emerald-200" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Investimento</p>
                      <p className="mt-2 text-lg font-semibold text-emerald-200">{budgetDisplay}</p>
                    </div>
                  </div>
                </div>
                <div className="surface-muted rounded-2xl border border-white/12 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                      <MapPin className="h-4 w-4 text-sky-200" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Localização</p>
                      <p className="mt-2 text-base font-semibold text-white/90">{opportunity.location}</p>
                    </div>
                  </div>
                </div>
                <div className="surface-muted rounded-2xl border border-white/12 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                      <Tag className="h-4 w-4 text-[#00FF41]" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Tipo de conteúdo</p>
                      <p className="mt-2 text-base font-semibold text-white/90">{opportunity.content_type}</p>
                    </div>
                  </div>
                </div>
                <div className="surface-muted rounded-2xl border border-white/12 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                      <Clock className="h-4 w-4 text-amber-200" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Prazo</p>
                      <p className="mt-2 text-base font-semibold text-white/90">{formatDate(opportunity.deadline)}</p>
                      <p className="text-xs text-gray-400 mt-1">{deadlineLabel}</p>
                    </div>
                  </div>
                </div>
                <div className="surface-muted rounded-2xl border border-white/12 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                      <Users className="h-4 w-4 text-[#00FF41]" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Candidatos</p>
                      <p className="mt-2 text-2xl font-semibold text-white/90">{opportunity.candidates_count || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showApplicationForm && (
        <ModalPortal>
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="glass-card max-w-md w-full p-6 md:p-7 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white/95">Enviar candidatura</h2>
              <button
                onClick={() => setShowApplicationForm(false)}
                className="btn-ghost-glass px-3 py-1"
              >
                <X className="h-4 w-4" />
                Fechar
              </button>
            </div>

            <div className="surface-muted rounded-2xl border border-white/12 p-4 space-y-1">
              <h3 className="text-sm font-semibold text-white/90">{opportunity.title}</h3>
              <p className="text-xs text-gray-400">{opportunity.company}</p>
            </div>

            <div>
              <label
                htmlFor="application-message"
                className="block text-xs uppercase tracking-[0.28em] text-gray-500 mb-2"
              >
                Mensagem (opcional)
              </label>
              <textarea
                id="application-message"
                rows={4}
                className="input-glass resize-none min-h-[140px]"
                placeholder="Conte um pouco sobre por que você é ideal para esta oportunidade..."
                value={applicationMessage}
                onChange={(e) => setApplicationMessage(e.target.value)}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-end">
              <button
                onClick={() => setShowApplicationForm(false)}
                className="btn-ghost-glass w-full sm:w-auto justify-center"
              >
                Cancelar
              </button>
              <button
                onClick={handleApply}
                disabled={applying}
                className="btn-primary-glow w-full sm:w-auto justify-center disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {applying ? (
                  <span className="flex items-center gap-2 text-sm">
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enviando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-sm">
                    <Send className="h-4 w-4" />
                    Enviar candidatura
                  </span>
                )}
              </button>
            </div>
          </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default OpportunityDetailsPage;