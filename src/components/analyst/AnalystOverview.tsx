import React, { useState, useEffect, useCallback } from 'react';
import { Target, Users, TrendingUp, Eye, ArrowRight, Calendar, Folder } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAnalystAuth } from '../../contexts/AnalystAuthContext';
import { useRouter } from '../../hooks/useRouter';
import { useTabVisibility } from '../../hooks/useTabVisibility';
import ViewOpportunityModal from './ViewOpportunityModal';

interface DashboardStats {
  activeOpportunities: number;
  totalOpportunities: number;
  completedOpportunities: number;
  totalApplications: number;
}

interface RecentOpportunity {
  id: string;
  title: string;
  company: string;
  description: string;
  budget_min: number;
  budget_max: number;
  location: string;
  content_type: string;
  requirements: string[];
  deadline: string;
  status: string;
  candidates_count: number;
  created_at: string;
}

interface UpcomingProject {
  id: string;
  title: string;
  company: string;
  creator_name: string;
  deadline: string;
  status: string;
}

const AnalystOverview: React.FC = () => {
  const { user } = useAnalystAuth();
  const { navigate } = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    activeOpportunities: 0,
    totalOpportunities: 0,
    completedOpportunities: 0,
    totalApplications: 0,
  });
  const [recentOpportunities, setRecentOpportunities] = useState<RecentOpportunity[]>([]);
  const [upcomingProjects, setUpcomingProjects] = useState<UpcomingProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selectedOpportunity, setSelectedOpportunity] = useState<RecentOpportunity | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);

      // Otimização: Buscar contagens diretamente usando COUNT e HEAD para evitar buscar todos os registros
      const [
        { count: activeCount, error: activeError },
        { count: completedCount, error: completedError },
        { count: totalCount, error: totalError },
        { count: appsCount, error: appsError }
      ] = await Promise.all([
        supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('created_by', user.id).eq('status', 'ativo'),
        supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('created_by', user.id).eq('status', 'concluido'),
        supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('created_by', user.id),
        supabase.from('opportunity_applications').select('*', { count: 'exact', head: true }) // RLS filtra automaticamente para apps das oportunidades do user
      ]);

      if (activeError) console.error('Erro ao buscar contagem de ativas:', activeError);
      if (completedError) console.error('Erro ao buscar contagem de concluídas:', completedError);
      if (totalError) console.error('Erro ao buscar contagem total:', totalError);
      if (appsError) console.error('Erro ao buscar contagem de candidaturas:', appsError);

      setStats({
        activeOpportunities: activeCount || 0,
        totalOpportunities: totalCount || 0,
        completedOpportunities: completedCount || 0,
        totalApplications: appsCount || 0,
      });

      // Otimização: Buscar apenas as 5 oportunidades mais recentes
      const { data: recentOpp, error: recentError } = await supabase
          .from('opportunities')
          .select('*')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

      if (recentError) {
        console.error('Erro ao buscar oportunidades recentes:', recentError);
      }

      // Buscar contagens de candidatos apenas para estas 5 oportunidades
      let recentWithCounts = recentOpp || [];
      if (recentOpp && recentOpp.length > 0) {
        const { data: appsForRecent, error: appsRecentError } = await supabase
          .from('opportunity_applications')
          .select('opportunity_id')
          .in('opportunity_id', recentOpp.map(op => op.id));

        if (!appsRecentError && appsForRecent) {
           const counts = appsForRecent.reduce((acc, app) => {
             acc[app.opportunity_id] = (acc[app.opportunity_id] || 0) + 1;
             return acc;
           }, {} as Record<string, number>);

           recentWithCounts = recentOpp.map(op => ({
             ...op,
             candidates_count: counts[op.id] || 0
           }));
        }
      }

      setRecentOpportunities(recentWithCounts);

    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchUpcomingProjects = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingProjects(true);

      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const { data: opportunities, error: opportunitiesError } = await supabase
        .from('opportunities')
        .select(`
          id,
          title,
          company,
          deadline,
          created_by
        `)
        .eq('created_by', user.id)
        .gte('deadline', new Date().toISOString().split('T')[0])
        .lte('deadline', thirtyDaysFromNow.toISOString().split('T')[0])
        .order('deadline', { ascending: true })
        .limit(10);

      if (opportunitiesError) {
        console.error('Erro ao buscar oportunidades:', opportunitiesError);
        setUpcomingProjects([]);
        return;
      }

      if (!opportunities || opportunities.length === 0) {
        setUpcomingProjects([]);
        return;
      }

      const { data: applications, error: applicationsError } = await supabase
        .from('opportunity_applications')
        .select(`
          id,
          opportunity_id,
          creator:profiles!creator_id (
            name
          )
        `)
        .eq('status', 'approved')
        .in('opportunity_id', opportunities.map(opp => opp.id));

      if (applicationsError) {
        console.error('Erro ao buscar applications:', applicationsError);
        return;
      }

      const upcomingProjectsData = opportunities
        .map(opportunity => {
          const application = applications?.find(app => app.opportunity_id === opportunity.id);
          
          if (!application) return null;

          const creator = Array.isArray(application.creator) ? application.creator[0] : application.creator;

          return {
            id: application.id,
            title: opportunity.title || 'Projeto',
            company: opportunity.company || 'Empresa',
            creator_name: creator?.name || 'Creator',
            deadline: opportunity.deadline || '',
            status: 'active'
          };
        })
        .filter(Boolean) as UpcomingProject[];

      setUpcomingProjects(upcomingProjectsData.slice(0, 3));
    } catch (error) {
      console.error('Erro ao buscar projetos próximos:', error);
    } finally {
      setLoadingProjects(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      fetchUpcomingProjects();
    }
  }, [user, fetchDashboardData, fetchUpcomingProjects]);

  // Recarregar dados quando a aba voltar a ficar visível
  useTabVisibility(() => {
    if (user) {
      console.log('🔄 [ANALYST OVERVIEW] Recarregando dados após aba voltar a ficar visível');
      fetchDashboardData();
      fetchUpcomingProjects();
    }
  });

  const handleViewOpportunity = (opportunity: RecentOpportunity) => {
    setSelectedOpportunity(opportunity);
    setShowViewModal(true);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 dia atrás';
    if (diffDays <= 7) return `${diffDays} dias atrás`;
    if (diffDays <= 14) return '1 semana atrás';
    if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} semanas atrás`;
    return `${Math.ceil(diffDays / 30)} meses atrás`;
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'ativo': return { text: 'Ativa', class: 'bg-green-100 text-green-700' };
      case 'inativo': return { text: 'Inativa', class: 'bg-yellow-100 text-yellow-700' };
      case 'concluido': return { text: 'Concluída', class: 'bg-gray-100 text-gray-700' };
      default: return { text: 'Desconhecido', class: 'bg-gray-100 text-gray-700' };
    }
  };

  const dashboardStats = [
    { 
      label: 'Oportunidades Ativas', 
      value: loading ? '...' : stats.activeOpportunities.toString(), 
      icon: Target, 
      color: 'text-[#00FF41]', 
      bg: 'bg-[#00FF41]/10' 
    },
    { 
      label: 'Total de Candidaturas', 
      value: loading ? '...' : stats.totalApplications.toString(), 
      icon: Users, 
      color: 'text-[#00FF41]', 
      bg: 'bg-[#00FF41]/10' 
    },
    { 
      label: 'Campanhas Concluídas', 
      value: loading ? '...' : stats.completedOpportunities.toString(), 
      icon: TrendingUp, 
      color: 'text-[#00FF41]', 
      bg: 'bg-[#00FF41]/10' 
    },
    { 
      label: 'Total de Oportunidades', 
      value: loading ? '...' : stats.totalOpportunities.toString(), 
      icon: Eye, 
      color: 'text-orange-600', 
      bg: 'bg-orange-100' 
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Visão Geral</h1>
          <p className="text-gray-600 mt-1">Acompanhe suas campanhas e métricas</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => navigate('/analysts/opportunities')}
            className="px-4 py-2 bg-[#00FF41] hover:bg-[#00CC34] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Target className="h-4 w-4" />
            Criar Oportunidade
          </button>
          <button 
            onClick={() => navigate('/analysts/projects')}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            Ver Projetos
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardStats.map((stat, index) => {
          const Icon = stat.icon;
          const getNavigationPath = () => {
            switch(stat.label) {
              case 'Oportunidades Ativas':
                return '/analysts/opportunities';
              case 'Total de Candidaturas':
                return '/analysts/creators';
              case 'Campanhas Concluídas':
                return '/analysts/opportunities';
              case 'Total de Oportunidades':
                return '/analysts/opportunities';
              default:
                return '/analysts/overview';
            }
          };
          
          return (
            <div 
              key={index} 
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer group hover:border-[#00FF41]/30"
              onClick={() => navigate(getNavigationPath())}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`p-3 rounded-lg ${stat.bg} group-hover:scale-105 transition-transform`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-purple-500 transition-colors" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Opportunities */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Oportunidades Recentes</h3>
            <button 
              onClick={() => navigate('/analysts/opportunities')}
              className="text-sm text-[#00FF41] hover:text-[#00FF41] font-medium flex items-center gap-1"
            >
              Ver todas <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00FF41] mx-auto"></div>
                <p className="text-gray-500 mt-2">Carregando...</p>
              </div>
            ) : recentOpportunities.length === 0 ? (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nenhuma oportunidade criada ainda</p>
                <p className="text-sm text-gray-500">Crie sua primeira oportunidade!</p>
              </div>
            ) : (
              recentOpportunities.map((opportunity) => {
                const statusDisplay = getStatusDisplay(opportunity.status);
                return (
                  <div 
                    key={opportunity.id} 
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-all duration-200 hover:shadow-sm border border-transparent hover:border-gray-200"
                    onClick={() => handleViewOpportunity(opportunity)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-[#00FF41]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Target className="h-5 w-5 text-[#00FF41]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-gray-900 hover:text-[#00FF41] transition-colors truncate">{opportunity.title}</h4>
                        <p className="text-sm text-gray-600 truncate">
                          {opportunity.candidates_count || 0} candidatos • {formatTimeAgo(opportunity.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${statusDisplay.class}`}>
                        {statusDisplay.text}
                      </span>
                      <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-purple-500 transition-colors" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Active Projects */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Projetos Ativos</h3>
            <button 
              onClick={() => navigate('/analysts/projects')}
              className="text-sm text-[#00FF41] hover:text-[#00FF41] font-medium flex items-center gap-1"
            >
              Ver todos <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Projetos em andamento</p>
              <p className="text-sm text-gray-500">Em breve</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Deadlines */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Próximos Prazos</h3>
          <button 
            onClick={() => navigate('/analysts/projects')}
            className="text-sm text-[#00FF41] hover:text-[#00FF41] font-medium flex items-center gap-1"
          >
            Ver todos <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        
        {loadingProjects ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00FF41]"></div>
          </div>
        ) : upcomingProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingProjects.map((project) => {
              const deadlineDate = new Date(project.deadline);
              const today = new Date();
              const daysLeft = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              
              // Cor baseada na urgência
              const getUrgencyColor = (days: number) => {
                if (days <= 3) return { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-800', icon: 'text-red-600', hover: 'hover:border-red-300' };
                if (days <= 7) return { border: 'border-orange-200', bg: 'bg-orange-50', text: 'text-orange-800', icon: 'text-orange-600', hover: 'hover:border-orange-300' };
                return { border: 'border-[#00FF41]/30', bg: 'bg-[#00FF41]/10', text: 'text-gray-800', icon: 'text-[#00FF41]', hover: 'hover:border-[#00FF41]' };
              };
              
              const colors = getUrgencyColor(daysLeft);
              
              return (
                <div 
                  key={project.id}
                  className={`border ${colors.border} ${colors.bg} rounded-lg p-4 hover:shadow-sm transition-all cursor-pointer ${colors.hover}`}
                  onClick={() => navigate('/analysts/projects')}
                >
                  <div className="flex items-center mb-2">
                    <Calendar className={`h-4 w-4 ${colors.icon} mr-2`} />
                    <span className={`text-sm font-medium ${colors.text}`}>
                      {deadlineDate.toLocaleDateString('pt-BR')}
                      {daysLeft <= 7 && (
                        <span className="ml-2 text-xs">
                          ({daysLeft === 0 ? 'Hoje' : daysLeft === 1 ? 'Amanhã' : `${daysLeft} dias`})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 mb-2">
                    <Folder className={`h-4 w-4 ${colors.icon} mt-0.5 flex-shrink-0`} />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{project.title}</p>
                      <p className="text-xs text-gray-600">{project.company}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span>Creator: {project.creator_name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Nenhum prazo próximo encontrado</p>
            <p className="text-xs text-gray-400 mt-1">Projetos com prazos aparecerão aqui</p>
          </div>
        )}
      </div>

      {/* View Opportunity Modal */}
      {showViewModal && selectedOpportunity && (
        <ViewOpportunityModal
          opportunity={selectedOpportunity}
          onClose={() => setShowViewModal(false)}
        />
      )}
    </div>
  );
};

export default AnalystOverview;