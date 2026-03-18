import { useState, useEffect } from 'react';
import { Eye, Calendar, Award, Target, Clock, ArrowRight, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useRouter } from '../hooks/useRouter';
import { useTabVisibility } from '../hooks/useTabVisibility';
import { OnboardingRecoveryBanner } from './common/OnboardingRecoveryBanner';
import { IncompleteDataBanner } from './common/IncompleteDataBanner';

interface Application {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  applied_at: string;
  opportunity: {
    id: string;
    title: string;
    company: string;
    budget: number;
    deadline: string;
  };
}

interface Deliverable {
  id: string;
  title: string;
  description: string;
  due_date: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  opportunity: {
    title: string;
    company: string;
    budget?: number;
  };
}

interface UpcomingDeadline {
  id: string;
  title: string;
  company: string;
  deadline: string;
  description: string;
}

type ApplicationQueryRow = Omit<Application, 'opportunity'> & {
  opportunity: Application['opportunity'] | Application['opportunity'][] | null;
};

type DeliverableQueryRow = Omit<Deliverable, 'opportunity'> & {
  opportunities: Deliverable['opportunity'] | Deliverable['opportunity'][] | null;
};

const Dashboard = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<UpcomingDeadline[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [loadingDeadlines, setLoadingDeadlines] = useState(true);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const { user } = useAuth();
  const { navigate } = useRouter();

  // Função para recarregar dados quando a aba voltar a ficar visível
  const reloadDashboardData = async () => {
    if (!user) return;
    
    console.log('🔄 [DASHBOARD] Recarregando dados após aba voltar a ficar visível');
    
    // Validar sessão antes de fazer requisições
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('⚠️ [DASHBOARD] Sessão inválida ao tentar recarregar dados');
        return;
      }
    } catch (err) {
      console.error('❌ [DASHBOARD] Erro ao validar sessão:', err);
      return;
    }
    
    // Recarregar candidaturas - NÃO limpa dados existentes se falhar
    try {
      const { data, error } = await supabase
        .from('opportunity_applications')
        .select(`
          id,
          status,
          applied_at,
          opportunity:opportunities (
            id,
            title,
            company,
            budget,
            deadline
          )
        `)
        .eq('creator_id', user.id)
        .order('applied_at', { ascending: false });

      if (error) {
        console.error('❌ [DASHBOARD] Erro ao recarregar candidaturas:', error);
        // NÃO limpa dados existentes
      } else if (data) {
        const fixedData = (data as ApplicationQueryRow[] | null)?.map((app) => ({
          ...app,
          opportunity: Array.isArray(app.opportunity) ? app.opportunity[0] : app.opportunity
        })) || [];
        setApplications(fixedData);
        console.log('✅ [DASHBOARD] Candidaturas recarregadas com sucesso');
      }
    } catch (err) {
      console.error('❌ [DASHBOARD] Exceção ao recarregar candidaturas:', err);
      // NÃO limpa dados existentes
    }
    
    // Recarregar deliverables - NÃO limpa dados existentes se falhar
    try {
      const { data, error } = await supabase
        .from('project_deliverables')
        .select(`
          id,
          title,
          description,
          due_date,
          priority,
          status,
          opportunities!deliverables_opportunity_fkey (
            title,
            company,
            budget
          )
        `)
        .eq('creator_id', user.id)
        .order('due_date', { ascending: true });

      if (error) {
        console.error('❌ [DASHBOARD] Erro ao recarregar deliverables:', error);
        // NÃO limpa dados existentes
      } else if (data) {
        const allDeliverables = (data as DeliverableQueryRow[] | null)?.map((deliverable) => {
          const opportunity = Array.isArray(deliverable.opportunities) 
            ? deliverable.opportunities[0] 
            : deliverable.opportunities;
          
          return {
            ...deliverable,
            opportunity: opportunity || { title: 'Projeto', company: 'Empresa', budget: 0 }
          };
        }) as Deliverable[];
        
        setDeliverables(allDeliverables || []);
        
        // Calcular earnings
        const completedDeliverables = allDeliverables?.filter(d => d.status === 'completed') || [];
        const estimatedEarnings = completedDeliverables.reduce((total, deliverable) => {
          return total + (deliverable.opportunity?.budget || 0);
        }, 0);
        setTotalEarnings(estimatedEarnings);
        console.log('✅ [DASHBOARD] Deliverables recarregados com sucesso');
      }
    } catch (err) {
      console.error('❌ [DASHBOARD] Exceção ao recarregar deliverables:', err);
      // NÃO limpa dados existentes
    }
  };

  // Usar o hook de visibilidade da aba
  useTabVisibility(reloadDashboardData);

  const getPriorityLabel = (priority: number) => {
    const labels = { 1: 'Baixa', 2: 'Normal', 3: 'Alta', 4: 'Urgente', 5: 'Crítica' };
    return labels[priority as keyof typeof labels] || 'Normal';
  };

  useEffect(() => {
    // Verificar se há dados do onboarding salvos localmente (fallback)
    const checkOnboardingFallback = async () => {
      if (!user) return;

      try {
        const fallbackData = localStorage.getItem('onboarding_fallback');
        if (!fallbackData) return;

        const parsed = JSON.parse(fallbackData);
        
        // Verificar se é do usuário atual e se tem menos de 24 horas
        if (parsed.userId !== user.id) return;
        
        const savedTime = new Date(parsed.timestamp).getTime();
        const now = new Date().getTime();
        const hoursPassed = (now - savedTime) / (1000 * 60 * 60);
        
        if (hoursPassed > 24) {
          // Dados muito antigos, remover
          localStorage.removeItem('onboarding_fallback');
          return;
        }

        console.log('💾 Encontrados dados do onboarding salvos localmente. Tentando salvar novamente...');
        
        // Tentar salvar novamente
        const { error } = await supabase
          .from('profiles')
          .update({
            ...parsed.data,
            onboarding_completed: true,
            onboarding_step: 4,
            onboarding_completed_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (error) {
          console.error('❌ Ainda não foi possível salvar os dados:', error);
          // Manter os dados para tentar novamente depois
        } else {
          console.log('✅ Dados do onboarding salvos com sucesso!');
          localStorage.removeItem('onboarding_fallback');
          
          // Mostrar notificação de sucesso
          alert('✅ Suas informações de cadastro foram salvas com sucesso!');
        }
      } catch (error) {
        console.error('Erro ao processar fallback do onboarding:', error);
      }
    };

    const fetchApplications = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('opportunity_applications')
          .select(`
            id,
            status,
            applied_at,
            opportunity:opportunities (
              id,
              title,
              company,
              budget,
              deadline
            )
          `)
          .eq('creator_id', user.id)
          .order('applied_at', { ascending: false });

        if (error) {
          console.error('Erro ao buscar candidaturas:', error);
        } else {
          // Fix: Garantir que opportunity seja um objeto, não array
          const fixedData = data?.map(app => ({
            ...app,
            opportunity: Array.isArray(app.opportunity) ? app.opportunity[0] : app.opportunity
          })) || [];
          setApplications(fixedData);
        }
      } catch (err) {
        console.error('Erro ao buscar candidaturas:', err);
      } finally {
        setLoadingApplications(false);
      }
    };

    const fetchUpcomingDeadlines = async () => {
      if (!user) return;

      try {
        // Busca deliverables específicos definidos pelo analista (próximos 30 dias)
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        const { data, error } = await supabase
          .from('project_deliverables')
          .select(`
            id,
            title,
            description,
            due_date,
            priority,
            status,
            opportunities!deliverables_opportunity_fkey (
              title,
              company,
              budget
            )
          `)
          .eq('creator_id', user.id)
          .order('due_date', { ascending: true });

        if (error) {
          console.error('Erro ao buscar deliverables:', error);
          // Fallback para busca por oportunidades se a tabela não existir ainda
          await fetchUpcomingDeadlinesFallback();
        } else {
          // Separar deliverables por status e calcular earnings
          const allDeliverables = data?.map(deliverable => {
            const opportunity = Array.isArray(deliverable.opportunities) 
              ? deliverable.opportunities[0] 
              : deliverable.opportunities;
            
            return {
              ...deliverable,
              opportunity: opportunity || { title: 'Projeto', company: 'Empresa', budget: 0 }
            };
          }) as Deliverable[];
          
          setDeliverables(allDeliverables || []);
          
          // Calcular earnings estimados baseado em projetos aprovados
          const completedDeliverables = allDeliverables?.filter(d => d.status === 'completed') || [];
          const estimatedEarnings = completedDeliverables.reduce((total, deliverable) => {
            return total + (deliverable.opportunity?.budget || 0);
          }, 0);
          setTotalEarnings(estimatedEarnings);

          // Filtrar apenas próximos prazos para a seção de deadlines
          const upcomingDeadlinesData = allDeliverables
            ?.filter(deliverable => {
              const dueDate = new Date(deliverable.due_date);
              return dueDate >= new Date() && 
                     dueDate <= thirtyDaysFromNow && 
                     ['pending', 'in_progress'].includes(deliverable.status);
            })
            .slice(0, 3)
            .map(deliverable => ({
              id: deliverable.id,
              title: deliverable.title,
              company: deliverable.opportunity?.company || 'Empresa',
              deadline: deliverable.due_date,
              description: deliverable.description || `${deliverable.title} - Prioridade: ${getPriorityLabel(deliverable.priority)}`
            })) as UpcomingDeadline[];
          
          setUpcomingDeadlines(upcomingDeadlinesData || []);
        }
      } catch (error) {
        console.error('Erro ao buscar deliverables:', error);
        // Fallback para busca por oportunidades se houver erro
        await fetchUpcomingDeadlinesFallback();
      } finally {
        setLoadingDeadlines(false);
      }
    };

    // Função de fallback que usa o sistema antigo
    const fetchUpcomingDeadlinesFallback = async () => {
      if (!user) return;

      try {
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        // Buscar oportunidades aprovadas diretamente
        const { data: applications, error: appError } = await supabase
          .from('opportunity_applications')
          .select('opportunity_id')
          .eq('creator_id', user.id)
          .eq('status', 'approved');

        if (appError) {
          console.error('Erro ao buscar candidaturas aprovadas:', appError);
          return;
        }

        if (!applications || applications.length === 0) {
          setUpcomingDeadlines([]);
          return;
        }

        const opportunityIds = applications.map(app => app.opportunity_id);

        const { data, error } = await supabase
          .from('opportunities')
          .select('id, title, company, deadline, description')
          .in('id', opportunityIds)
          .gte('deadline', new Date().toISOString().split('T')[0])
          .lte('deadline', thirtyDaysFromNow.toISOString().split('T')[0])
          .order('deadline', { ascending: true })
          .limit(3);

        if (error) {
          console.error('Erro ao buscar prazos fallback:', error);
        } else {
          setUpcomingDeadlines((data || []) as UpcomingDeadline[]);
        }
      } catch (error) {
        console.error('Erro ao buscar prazos fallback:', error);
      }
    };

    if (user) {
      checkOnboardingFallback();
      fetchApplications();
      fetchUpcomingDeadlines();
    }
  }, [user]);

  const approvedCount = applications.filter(app => app.status === 'approved').length;
  const pendingCount = applications.filter(app => app.status === 'pending').length;
  const activeDeliverablesCount = deliverables.filter(d => ['pending', 'in_progress'].includes(d.status)).length;
  const today = new Date();
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(today.getDate() + 3);
  const urgentDeliverablesCount = deliverables.filter(d => {
    if (!['pending', 'in_progress'].includes(d.status)) return false;
    const dueDate = new Date(d.due_date);
    return dueDate <= threeDaysFromNow;
  }).length;
  const completedDeliverablesCount = deliverables.filter(d => d.status === 'completed').length;

  const stats = [
    {
      label: 'Oportunidades Aplicadas',
      value: applications.length.toString(),
      icon: Target,
      accent: 'info',
      description: 'Total de candidaturas enviadas'
    },
    {
      label: 'Propostas Aceitas',
      value: approvedCount.toString(),
      icon: Award,
      accent: 'success',
      description: 'Projetos aprovados ativos'
    },
    {
      label: 'Candidaturas Pendentes',
      value: pendingCount.toString(),
      icon: Clock,
      accent: 'warning',
      description: 'Aguardando análise'
    },
    {
      label: 'Earnings Estimados',
      value: totalEarnings > 0 ? `R$ ${(totalEarnings / 1000).toFixed(1)}k` : 'R$ 0',
      icon: DollarSign,
      accent: 'success',
      description: 'Baseado em projetos completados'
    },
    {
      label: 'Tarefas Ativas',
      value: activeDeliverablesCount.toString(),
      icon: TrendingUp,
      accent: 'purple',
      description: 'Deliverables em andamento'
    },
    {
      label: 'Prazos Urgentes',
      value: urgentDeliverablesCount.toString(),
      icon: AlertCircle,
      accent: 'danger',
      description: 'Entrega em até 3 dias'
    }
  ] as const;

  const accentTokens: Record<
    typeof stats[number]['accent'],
    { icon: string; chip: string; ring: string }
  > = {
    info: { icon: 'text-indigo-200', chip: 'chip-info', ring: 'ring-indigo-400/35' },
    success: { icon: 'text-emerald-200', chip: 'chip-success', ring: 'ring-emerald-400/35' },
    warning: { icon: 'text-amber-200', chip: 'chip-warning', ring: 'ring-amber-400/35' },
    purple: { icon: 'text-fuchsia-200', chip: 'chip-info', ring: 'ring-fuchsia-400/35' },
    danger: { icon: 'text-rose-200', chip: 'chip-danger', ring: 'ring-rose-400/35' }
  };

  const statusTokens: Record<Application['status'], { label: string; chip: string; dot: string; ring: string }> = {
    approved: { label: 'Aprovado', chip: 'chip-success', dot: 'bg-emerald-300', ring: 'ring-emerald-400/30' },
    pending: { label: 'Pendente', chip: 'chip-warning', dot: 'bg-amber-300', ring: 'ring-amber-400/30' },
    rejected: { label: 'Rejeitado', chip: 'chip-danger', dot: 'bg-rose-300', ring: 'ring-rose-400/30' }
  };

  const urgencyTokens = {
    high: { chip: 'chip-danger', icon: 'text-rose-200', ring: 'ring-rose-400/30' },
    medium: { chip: 'chip-warning', icon: 'text-amber-200', ring: 'ring-amber-400/30' },
    low: { chip: 'chip-info', icon: 'text-indigo-200', ring: 'ring-indigo-400/30' }
  } as const;

  const getUrgencyTokens = (days: number) => {
    if (days <= 3) return urgencyTokens.high;
    if (days <= 7) return urgencyTokens.medium;
    return urgencyTokens.low;
  };

  return (
    <div className="space-y-10">
      {/* Banner de dados incompletos (tem prioridade sobre recovery) */}
      <IncompleteDataBanner />
      
      {/* Banner de recuperação de dados do onboarding */}
      <OnboardingRecoveryBanner />

      <div className="glass-card p-6 md:p-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <span className="badge-pill">Visão geral</span>
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight md:text-3xl">Dashboard</h1>
            <p className="text-sm text-gray-400 mt-2">
              Acompanhe suas atividades, projetos e indicadores críticos em tempo real
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/creators/opportunities')}
            className="btn-primary-glow px-5 py-2"
          >
            <Target className="h-4 w-4" />
            Ver oportunidades
          </button>
          <button
            onClick={() => navigate('/creators/projects')}
            className="btn-ghost-glass"
          >
            <Eye className="h-4 w-4" />
            Meus projetos
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const getNavigationPath = () => {
            switch(stat.label) {
              case 'Oportunidades Aplicadas':
              case 'Candidaturas Pendentes':
                return '/creators/opportunities';
              case 'Propostas Aceitas':
              case 'Earnings Estimados':
              case 'Tarefas Ativas':
              case 'Prazos Urgentes':
                return '/creators/projects';
              default:
                return '/creators/dashboard';
            }
          };

          const accent = accentTokens[stat.accent];
          
          return (
            <div 
              key={index} 
              className={`glass-card group p-6 flex flex-col gap-4 cursor-pointer transition-all duration-300 hover:border-white/35 hover:-translate-y-1 ring-1 ring-transparent ${accent.ring}`}
              onClick={() => navigate(getNavigationPath())}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="h-11 w-11 rounded-2xl surface-muted border border-white/15 flex items-center justify-center shadow-inner shadow-black/20">
                  <Icon className={`h-5 w-5 ${accent.icon}`} />
                </div>
                <ArrowRight className="h-4 w-4 text-gray-500 group-hover:text-white/80 transition-colors" />
              </div>
              <div>
                <span className={`glass-chip ${accent.chip} text-[0.58rem] mb-2 inline-flex md:text-[0.65rem]`}>{stat.label}</span>
                <p className="text-2xl font-semibold text-white mb-1 leading-tight md:text-3xl">{stat.value}</p>
                <p className="text-[0.7rem] text-gray-400 md:text-xs">{stat.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Applications */}
        <div className="glass-card p-6 lg:col-span-2 flex flex-col gap-5">
          <div className="glass-section-title">
            <div className="icon-wrap">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <h3>Minhas Candidaturas</h3>
              <p className="text-sm text-gray-400">Visão rápida das últimas aplicações e seus status</p>
            </div>
          </div>
          {loadingApplications ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/15 border-t-transparent"></div>
            </div>
          ) : applications.length === 0 ? (
            <div className="surface-muted rounded-2xl border border-dashed border-white/15 py-12 text-center space-y-3">
              <Target className="h-12 w-12 text-gray-500 mx-auto" />
              <div>
                <p className="font-medium text-white/90">Nenhuma candidatura ainda</p>
                <p className="text-sm text-gray-400">Candidate-se a oportunidades para acompanhar seu progresso</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                {applications.slice(0, 5).map((application) => {
                  const statusToken = statusTokens[application.status];

                  return (
                    <div 
                      key={application.id} 
                      className={`surface-muted border border-white/10 rounded-2xl p-4 flex items-start gap-3 transition-all duration-300 cursor-pointer ring-1 ring-transparent ${statusToken.ring} hover:border-white/35 hover:ring-white/15`}
                      onClick={() => {
                        if (application.status === 'approved') {
                          navigate('/creators/projects');
                        } else {
                          navigate('/creators/opportunities');
                        }
                      }}
                    >
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-xl border border-white/10 flex items-center justify-center shadow-inner shadow-black/30">
                          <div className={`h-2.5 w-2.5 rounded-full ${statusToken.dot}`}></div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-white leading-snug sm:text-sm line-clamp-2">
                              {application.opportunity.title}
                            </p>
                            <p className="text-xs text-gray-400">{application.opportunity.company}</p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{new Date(application.applied_at).toLocaleDateString('pt-BR')}</span>
                          <span className={`glass-chip ${statusToken.chip} text-[0.65rem]`}>{statusToken.label}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {applications.length > 5 && (
                <div className="pt-4 border-t border-white/10">
                  <button 
                    onClick={() => navigate('/creators/opportunities')}
                    className="w-full btn-ghost-glass justify-center text-sm gap-2"
                  >
                    Ver todas as candidaturas
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Upcoming Deadlines */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="glass-section-title mb-0">
            <div className="icon-wrap">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3>Próximos Prazos</h3>
              <p className="text-sm text-gray-400">Fique de olho nas entregas com vencimento em breve</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/creators/projects')}
            className="btn-ghost-glass text-sm gap-2"
          >
            Ver todos
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        
        {loadingDeadlines ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/15 border-t-transparent"></div>
          </div>
        ) : upcomingDeadlines.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingDeadlines.map((deadline) => {
              const deadlineDate = new Date(deadline.deadline);
              const today = new Date();
              const daysLeft = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              const urgency = getUrgencyTokens(daysLeft);
              
              return (
                <div 
                  key={deadline.id}
                  className={`surface-muted border border-white/10 rounded-2xl p-5 flex flex-col gap-3 transition-all cursor-pointer ring-1 ring-transparent ${urgency.ring} hover:border-white/35 hover:ring-white/15`}
                  onClick={() => navigate('/creators/projects')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Calendar className={`h-4 w-4 ${urgency.icon}`} />
                      <span className="font-medium text-white/90">
                        {deadlineDate.toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <span className={`glass-chip ${urgency.chip} text-[0.65rem]`}> 
                      {daysLeft <= 0 ? 'Hoje' : daysLeft === 1 ? 'Amanhã' : `${daysLeft} dias`}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-white leading-tight">{deadline.title}</p>
                    <p className="text-sm text-gray-400">{deadline.company}</p>
                  </div>
                  {deadline.description && (
                    <p className="text-xs text-gray-500 line-clamp-2">{deadline.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="surface-muted border border-dashed border-white/15 rounded-2xl py-12 text-center space-y-3 text-gray-400">
            <Calendar className="h-12 w-12 mx-auto text-gray-500" />
            <div>
              <p className="text-sm font-medium text-white/80">Nenhum prazo próximo encontrado</p>
              <p className="text-xs text-gray-500 mt-1">Prazos aparecerão aqui quando você tiver projetos aprovados</p>
            </div>
          </div>
        )}
      </div>

      {/* Creator Performance Insights */}
      {applications.length > 0 && (
        <div className="glass-card p-6 space-y-6">
          <div className="glass-section-title">
            <div className="icon-wrap">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3>Insights de Performance</h3>
              <p className="text-sm text-gray-400">Métricas-chave para acompanhar sua evolução na plataforma</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="surface-muted border border-white/10 rounded-2xl p-6 text-center space-y-3 ring-1 ring-transparent hover:ring-white/15 transition-all duration-300">
              <div className="h-14 w-14 mx-auto rounded-2xl bg-gradient-to-br from-emerald-400/20 via-emerald-500/10 to-transparent border border-white/10 flex items-center justify-center shadow-inner shadow-black/30">
                <TrendingUp className="h-7 w-7 text-emerald-200" />
              </div>
              <div className="text-3xl font-semibold text-white">
                {applications.length > 0 ? `${Math.round((approvedCount / applications.length) * 100)}%` : '0%'}
              </div>
              <div className="text-sm font-medium text-gray-300">Taxa de aprovação</div>
              <div className="text-xs text-gray-500">{approvedCount} de {applications.length} candidaturas</div>
            </div>
            <div className="surface-muted border border-white/10 rounded-2xl p-6 text-center space-y-3 ring-1 ring-transparent hover:ring-white/15 transition-all duration-300">
              <div className="h-14 w-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-400/20 via-indigo-500/10 to-transparent border border-white/10 flex items-center justify-center shadow-inner shadow-black/30">
                <Target className="h-7 w-7 text-indigo-200" />
              </div>
              <div className="text-3xl font-semibold text-white">{approvedCount}</div>
              <div className="text-sm font-medium text-gray-300">Projetos ativos</div>
              <div className="text-xs text-gray-500">{completedDeliverablesCount} deliverables concluídos</div>
            </div>
            <div className="surface-muted border border-white/10 rounded-2xl p-6 text-center space-y-3 ring-1 ring-transparent hover:ring-white/15 transition-all duration-300">
              <div className="h-14 w-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-400/25 via-orange-500/10 to-transparent border border-white/10 flex items-center justify-center shadow-inner shadow-black/30">
                <Clock className="h-7 w-7 text-amber-200" />
              </div>
              <div className="text-3xl font-semibold text-white">{urgentDeliverablesCount > 0 ? urgentDeliverablesCount : '✓'}</div>
              <div className="text-sm font-medium text-gray-300">Prazos urgentes</div>
              <div className="text-xs text-gray-500">{urgentDeliverablesCount > 0 ? 'Requer atenção imediata' : 'Todos os prazos em dia'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;