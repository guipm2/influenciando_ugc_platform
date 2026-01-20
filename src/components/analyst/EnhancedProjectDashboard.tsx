import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, TrendingUp, Calendar, Clock, CheckCircle, 
  BarChart3, PieChart, Activity, Folder, Eye, 
  RefreshCw, Bell, DollarSign, Briefcase, Award, 
  Timer, Zap, Star
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAnalystAuth } from '../../contexts/AnalystAuthContext';
import { useRouter } from '../../hooks/useRouter';
import { useTabVisibility } from '../../hooks/useTabVisibility';
import { formatRelativeTime } from '../../utils/formatters';

interface ProjectDashboardStats {
  // Project stats
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  overdueProjects: number;
  
  // Deliverable stats
  totalDeliverables: number;
  pendingDeliverables: number;
  overdueDeliverables: number;
  approvedDeliverables: number;
  
  // Performance metrics
  avgProjectDuration: number;
  onTimeCompletionRate: number;
  creatorSatisfactionRate: number;
  
  // Financial
  totalProjectValue: number;
  avgProjectBudget: number;
  
  // Time metrics
  thisMonthProjects: number;
  thisMonthDeliverables: number;
}

interface ProjectOverview {
  id: string;
  opportunity_id: string;
  opportunity_title: string;
  company: string;
  content_type: string;
  budget_min: number;
  budget_max: number;
  creator_id: string;
  creator_name: string;
  creator_email: string;
  status: 'active' | 'completed' | 'overdue' | 'at_risk';
  progress: number; // 0-100
  deadline: string;
  created_at: string;
  deliverables_total: number;
  deliverables_completed: number;
  deliverables_overdue: number;
  last_activity: string;
  estimated_hours: number;
  spent_hours: number;
  duration?: number;
  conversation_id?: string;
}

interface UpcomingDeadline {
  id: string;
  title: string;
  type: 'deliverable' | 'project';
  project_title: string;
  creator_name: string;
  deadline: string;
  status: string;
  priority: number;
  days_until: number;
}

interface ContentTypeStats {
  content_type: string;
  count: number;
  avg_budget: number;
  completion_rate: number;
  avg_duration: number;
}

const EnhancedProjectDashboard: React.FC = () => {
  const { user } = useAnalystAuth();
  const { navigate } = useRouter();
  
  // State management
  const [stats, setStats] = useState<ProjectDashboardStats>({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    overdueProjects: 0,
    totalDeliverables: 0,
    pendingDeliverables: 0,
    overdueDeliverables: 0,
    approvedDeliverables: 0,
    avgProjectDuration: 0,
    onTimeCompletionRate: 0,
    creatorSatisfactionRate: 0,
    totalProjectValue: 0,
    avgProjectBudget: 0,
    thisMonthProjects: 0,
    thisMonthDeliverables: 0
  });
  
  const [projects, setProjects] = useState<ProjectOverview[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<UpcomingDeadline[]>([]);
  const [contentTypeStats, setContentTypeStats] = useState<ContentTypeStats[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'performance' | 'analytics'>('overview');
  const [timeFilter, setTimeFilter] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'overdue' | 'completed'>('all');

  // Fetch dashboard statistics
  const fetchDashboardStats = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Get date filters
      const now = new Date();
      const startDate = new Date();
      
      switch (timeFilter) {
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
        default:
          startDate.setFullYear(2020); // All time
      }

      // Fetch projects data
      const { data: projectsData, error: projectsError } = await supabase
        .from('opportunity_applications')
        .select(`
          id,
          opportunity_id,
          creator_id,
          status,
          applied_at,
          updated_at,
          opportunity:opportunities!inner(
            id,
            title,
            company,
            content_type,
            budget_min,
            budget_max,
            deadline,
            created_by,
            created_at
          ),
          creator:profiles!creator_id(
            name,
            email
          )
        `)
        .in('status', ['approved', 'in_progress', 'completed'])
        .eq('opportunities.created_by', user.id)
        .gte('applied_at', startDate.toISOString());

      if (projectsError) {
        console.error('Erro ao buscar projetos:', projectsError);
        return;
      }

      // Fetch deliverables data
      const { data: deliverablesData, error: deliverablesError } = await supabase
        .from('project_deliverables')
        .select(`
          id,
          application_id,
          title,
          due_date,
          status,
          priority,
          estimated_hours,
          created_at,
          updated_at
        `)
        .eq('analyst_id', user.id);

      if (deliverablesError) {
        console.error('Erro ao buscar deliverables:', deliverablesError);
        return;
      }


      // Process projects with deliverables
      const projectsWithDeliverables = (projectsData || []).map(project => {
        const opportunity = Array.isArray(project.opportunity) ? project.opportunity[0] : project.opportunity;
        const creator = Array.isArray(project.creator) ? project.creator[0] : project.creator;
        
        const projectDeliverables = (deliverablesData || []).filter(d => d.application_id === project.id);
        const completedDeliverables = projectDeliverables.filter(d => d.status === 'approved').length;
        const overdueDeliverables = projectDeliverables.filter(d => 
          new Date(d.due_date) < now && d.status !== 'approved'
        ).length;
        
        const progress = projectDeliverables.length > 0 
          ? Math.round((completedDeliverables / projectDeliverables.length) * 100)
          : 0;
        
        const isOverdue = new Date(opportunity.deadline) < now && progress < 100;
        const isAtRisk = overdueDeliverables > 0 || (
          new Date(opportunity.deadline).getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000 && progress < 80
        );
        
        let status: ProjectOverview['status'] = 'active';

        if (project.status === 'completed') {
          status = 'completed';
        } else if (progress === 100) {
          status = 'completed';
        } else if (isOverdue) {
          status = 'overdue';
        } else if (isAtRisk) {
          status = 'at_risk';
        }

        // Calculate last activity
        const timestamps = [
          new Date(project.applied_at).getTime(),
          project.updated_at ? new Date(project.updated_at).getTime() : 0
        ];

        // If project is explicitly completed in DB, use updated_at as completion time
        if (project.status === 'completed' && project.updated_at) {
          const durationMs = new Date(project.updated_at).getTime() - new Date(project.applied_at).getTime();
          const durationDays = durationMs / (1000 * 60 * 60 * 24);
          if (durationDays >= 0) {
            duration = durationDays;
          }
        }

        if (projectDeliverables.length > 0) {
          const dates = projectDeliverables.map(d => new Date(d.updated_at || d.created_at).getTime());
          const maxDate = Math.max(...dates);
          lastActivity = new Date(maxDate).toISOString();

          // Calculate duration if completed (fallback to deliverables if not set above)
          if (status === 'completed' && duration === undefined) {
            const approvedDates = projectDeliverables
              .filter(d => d.status === 'approved')
              .map(d => new Date(d.updated_at || d.created_at).getTime());

            if (approvedDates.length > 0) {
              const maxApprovedDate = Math.max(...approvedDates);
              const durationMs = maxApprovedDate - new Date(project.applied_at).getTime();
              const durationDays = durationMs / (1000 * 60 * 60 * 24);
              if (durationDays >= 0) {
                duration = durationDays;
              }
            }
          }
        }

        return {
          id: project.id,
          opportunity_id: opportunity.id,
          opportunity_title: opportunity.title,
          company: opportunity.company,
          content_type: opportunity.content_type,
          budget_min: opportunity.budget_min,
          budget_max: opportunity.budget_max,
          creator_id: project.creator_id,
          creator_name: creator?.name || 'N/A',
          creator_email: creator?.email || '',
          status,
          progress,
          deadline: opportunity.deadline,
          created_at: project.applied_at,
          deliverables_total: projectDeliverables.length,
          deliverables_completed: completedDeliverables,
          deliverables_overdue: overdueDeliverables,
          last_activity: lastActivity,
          duration,
          estimated_hours: projectDeliverables.reduce((sum, d) => sum + (d.estimated_hours || 0), 0),
          spent_hours: 0 // TODO: Implement time tracking
        };
      });

      // Calculate statistics
      const activeProjects = projectsWithDeliverables.filter(p => p.status === 'active').length;
      const completedProjects = projectsWithDeliverables.filter(p => p.status === 'completed').length;
      const overdueProjects = projectsWithDeliverables.filter(p => p.status === 'overdue').length;
      
      const pendingDeliverables = (deliverablesData || []).filter(d => d.status === 'pending').length;
      const overdueDeliverables = (deliverablesData || []).filter(d => 
        new Date(d.due_date) < now && d.status !== 'approved'
      ).length;
      const approvedDeliverables = (deliverablesData || []).filter(d => d.status === 'approved').length;
      
      const totalProjectValue = projectsWithDeliverables.reduce((sum, p) => sum + p.budget_max, 0);
      const avgProjectBudget = projectsWithDeliverables.length > 0 
        ? totalProjectValue / projectsWithDeliverables.length 
        : 0;

      // Calculate average project duration
      const projectsWithDuration = projectsWithDeliverables.filter(p => p.duration !== undefined);
      const totalDuration = projectsWithDuration.reduce((sum, p) => sum + (p.duration || 0), 0);

      const avgProjectDuration = projectsWithDuration.length > 0
        ? Math.round(totalDuration / projectsWithDuration.length)
        : 0;

      // This month stats
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthProjects = projectsWithDeliverables.filter(p => 
        new Date(p.created_at) >= thisMonthStart
      ).length;
      const thisMonthDeliverables = (deliverablesData || []).filter(d => 
        new Date(d.created_at) >= thisMonthStart
      ).length;

      // Calculate content type statistics and duration
      const contentTypes = new Map();

      projectsWithDeliverables.forEach(project => {
        const type = project.content_type;
        if (!contentTypes.has(type)) {
          contentTypes.set(type, {
            content_type: type,
            count: 0,
            total_budget: 0,
            completed: 0,
            total_duration: 0,
            completed_with_duration: 0
          });
        }
        const stats = contentTypes.get(type);
        stats.count++;
        stats.total_budget += project.budget_max;

        if (project.status === 'completed') {
          stats.completed++;

          if (project.duration !== undefined) {
            stats.total_duration += project.duration;
            stats.completed_with_duration++;
          }
        }
      });

      const contentTypeStatsArray = Array.from(contentTypes.values()).map(stat => ({
        content_type: stat.content_type,
        count: stat.count,
        avg_budget: stat.total_budget / stat.count,
        completion_rate: (stat.completed / stat.count) * 100,
        avg_duration: stat.completed_with_duration > 0
          ? Math.round(stat.total_duration / stat.completed_with_duration)
          : 0
      }));

      setStats({
        totalProjects: projectsWithDeliverables.length,
        activeProjects,
        completedProjects,
        overdueProjects,
        totalDeliverables: deliverablesData?.length || 0,
        pendingDeliverables,
        overdueDeliverables,
        approvedDeliverables,
        avgProjectDuration,
        onTimeCompletionRate: completedProjects > 0 ? (completedProjects / (completedProjects + overdueProjects)) * 100 : 0,
        creatorSatisfactionRate: 95, // TODO: Implement rating system
        totalProjectValue,
        avgProjectBudget,
        thisMonthProjects,
        thisMonthDeliverables
      });

      setProjects(projectsWithDeliverables);

      // Generate upcoming deadlines
      const upcomingDeadlines: UpcomingDeadline[] = [];
      
      // Project deadlines
      projectsWithDeliverables.forEach(project => {
        if (project.status === 'active' || project.status === 'at_risk') {
          const daysUntil = Math.ceil((new Date(project.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntil >= -7 && daysUntil <= 30) {
            upcomingDeadlines.push({
              id: project.id,
              title: project.opportunity_title,
              type: 'project',
              project_title: project.opportunity_title,
              creator_name: project.creator_name,
              deadline: project.deadline,
              status: project.status,
              priority: daysUntil < 0 ? 1 : daysUntil < 7 ? 2 : 3,
              days_until: daysUntil
            });
          }
        }
      });

      // Deliverable deadlines
      (deliverablesData || []).forEach(deliverable => {
        if (deliverable.status !== 'approved') {
          const daysUntil = Math.ceil((new Date(deliverable.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntil >= -7 && daysUntil <= 14) {
            const project = projectsWithDeliverables.find(p => p.id === deliverable.application_id);
            upcomingDeadlines.push({
              id: deliverable.id,
              title: deliverable.title,
              type: 'deliverable',
              project_title: project?.opportunity_title || 'Projeto',
              creator_name: project?.creator_name || 'N/A',
              deadline: deliverable.due_date,
              status: deliverable.status,
              priority: deliverable.priority,
              days_until: daysUntil
            });
          }
        }
      });

      setUpcomingDeadlines(upcomingDeadlines.sort((a, b) => a.days_until - b.days_until).slice(0, 10));
      setContentTypeStats(contentTypeStatsArray);

    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, timeFilter]);

  // Refresh data
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardStats();
  };

  // Filter projects based on status filter
  const filteredProjects = projects.filter(project => {
    if (statusFilter === 'all') return true;
    return project.status === statusFilter;
  });

  // Get status styling
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'active': return 'bg-[#00FF41]/10 text-[#00FF41]';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'at_risk': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: number, daysUntil: number) => {
    if (daysUntil < 0) return 'text-red-600';
    if (daysUntil < 3 || priority <= 2) return 'text-red-500';
    if (daysUntil < 7 || priority === 3) return 'text-yellow-500';
    return 'text-green-500';
  };

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  // Recarregar quando a aba voltar a ficar visível
  useTabVisibility(() => {
    console.log('🔄 [ANALYST PROJECTS] Recarregando dashboard de projetos após aba voltar a ficar visível');
    fetchDashboardStats();
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00FF41]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard de Projetos</h1>
            <p className="text-gray-600">Visão holística de todos os seus projetos e métricas</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as typeof timeFilter)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00FF41]"
            >
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="all">Todo período</option>
            </select>
            
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-[#00FF41] text-black rounded-lg hover:bg-[#00CC34] flex items-center space-x-2 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'overview', label: 'Visão Geral', icon: BarChart3 },
                { key: 'projects', label: 'Projetos', icon: Folder },
                { key: 'performance', label: 'Performance', icon: TrendingUp },
                { key: 'analytics', label: 'Analytics', icon: PieChart }
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as 'overview' | 'projects' | 'performance' | 'analytics')}
                    className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.key
                        ? 'border-[#00FF41] text-[#00FF41]'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Projetos Ativos</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.activeProjects}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      +{stats.thisMonthProjects} este mês
                    </p>
                  </div>
                  <div className="p-3 bg-[#00FF41]/10 rounded-full">
                    <Folder className="h-6 w-6 text-[#00FF41]" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Deliverables Pendentes</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.pendingDeliverables}</p>
                    <p className="text-sm text-red-500 mt-1">
                      {stats.overdueDeliverables} atrasados
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-full">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Taxa de Sucesso</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.onTimeCompletionRate.toFixed(1)}%
                    </p>
                    <p className="text-sm text-green-500 mt-1">
                      {stats.completedProjects} concluídos
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-full">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Valor Total</p>
                    <p className="text-2xl font-bold text-gray-900">
                      R$ {(stats.totalProjectValue / 1000).toFixed(0)}k
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Média: R$ {(stats.avgProjectBudget / 1000).toFixed(1)}k
                    </p>
                  </div>
                  <div className="p-3 bg-[#00FF41]/10 rounded-full">
                    <DollarSign className="h-6 w-6 text-[#00FF41]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions & Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Upcoming Deadlines */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Próximos Prazos</h3>
                    <Bell className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {upcomingDeadlines.slice(0, 5).map((deadline) => (
                      <div key={deadline.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            {deadline.type === 'project' ? (
                              <Folder className="h-4 w-4 text-gray-400" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-gray-400" />
                            )}
                            <p className="text-sm font-medium text-gray-900">{deadline.title}</p>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {deadline.creator_name} • {deadline.project_title}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${getPriorityColor(deadline.priority, deadline.days_until)}`}>
                            {deadline.days_until < 0 
                              ? `${Math.abs(deadline.days_until)}d atrasado`
                              : deadline.days_until === 0 
                              ? 'Hoje'
                              : `${deadline.days_until}d`
                            }
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(deadline.deadline).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    ))}
                    
                    {upcomingDeadlines.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                        <p>Nenhum prazo próximo</p>
                      </div>
                    )}
                  </div>
                  
                  {upcomingDeadlines.length > 5 && (
                    <button 
                      onClick={() => setActiveTab('projects')}
                      className="w-full mt-4 text-sm text-[#00FF41] hover:text-[#00CC34]"
                    >
                      Ver todos os prazos →
                    </button>
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Atividade Recente</h3>
                    <Activity className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {projects.slice(0, 5).map((project) => (
                      <div key={project.id} className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          project.status === 'completed' ? 'bg-green-400' :
                          project.status === 'overdue' ? 'bg-red-400' :
                          project.status === 'at_risk' ? 'bg-yellow-400' :
                          'bg-[#00FF41]'
                        }`}></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {project.opportunity_title}
                          </p>
                          <p className="text-xs text-gray-500">
                            {project.creator_name} • {project.company}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            getStatusStyle(project.status)
                          }`}>
                            {project.status === 'completed' ? 'Concluído' :
                             project.status === 'overdue' ? 'Atrasado' :
                             project.status === 'at_risk' ? 'Em Risco' :
                             'Ativo'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Content Type Performance */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Performance por Tipo de Conteúdo</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {contentTypeStats.map((stat) => (
                    <div key={stat.content_type} className="text-center">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-2">{stat.content_type}</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Projetos:</span>
                            <span className="font-medium">{stat.count}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Budget médio:</span>
                            <span className="font-medium">R$ {(stat.avg_budget / 1000).toFixed(1)}k</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Taxa de conclusão:</span>
                            <span className="font-medium text-green-600">{stat.completion_rate.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Duração média:</span>
                            <span className="font-medium">{stat.avg_duration} dias</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Projects Tab */}
        {activeTab === 'projects' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <h3 className="text-lg font-semibold text-gray-900">Todos os Projetos</h3>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00FF41]"
                  >
                    <option value="all">Todos os Status</option>
                    <option value="active">Ativos</option>
                    <option value="overdue">Atrasados</option>
                    <option value="completed">Concluídos</option>
                  </select>
                </div>
                
                <button
                  onClick={() => navigate('/analysts/projects')}
                  className="px-4 py-2 bg-[#00FF41] text-black rounded-lg hover:bg-[#00CC34] flex items-center space-x-2"
                >
                  <Eye className="h-4 w-4" />
                  <span>Ver Detalhes</span>
                </button>
              </div>
            </div>

            {/* Projects Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <div key={project.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        getStatusStyle(project.status)
                      }`}>
                        {project.status === 'completed' ? 'Concluído' :
                         project.status === 'overdue' ? 'Atrasado' :
                         project.status === 'at_risk' ? 'Em Risco' :
                         'Ativo'}
                      </span>
                      <span className="text-xs text-gray-500">{project.content_type}</span>
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                      {project.opportunity_title}
                    </h3>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Briefcase className="h-4 w-4 mr-2" />
                        {project.company}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Users className="h-4 w-4 mr-2" />
                        {project.creator_name}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        {new Date(project.deadline).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <DollarSign className="h-4 w-4 mr-2" />
                        R$ {(project.budget_min / 1000).toFixed(0)}k - R$ {(project.budget_max / 1000).toFixed(0)}k
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <Activity className="h-4 w-4 mr-2" />
                        Atividade: {formatRelativeTime(project.last_activity)}
                      </div>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Progresso</span>
                        <span>{project.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            project.progress === 100 ? 'bg-green-500' :
                            project.progress >= 80 ? 'bg-[#00FF41]' :
                            project.progress >= 50 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${project.progress}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    {/* Deliverables summary */}
                    <div className="flex justify-between text-sm text-gray-600 mb-4">
                      <span>
                        {project.deliverables_completed}/{project.deliverables_total} deliverables
                      </span>
                      {project.deliverables_overdue > 0 && (
                        <span className="text-red-600">
                          {project.deliverables_overdue} atrasados
                        </span>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => navigate(`/analysts/projects/${project.id}`)}
                        className="flex-1 px-3 py-2 bg-[#00FF41] text-black rounded-lg hover:bg-[#00CC34] text-sm"
                      >
                        Ver Projeto
                      </button>
                      <button
                        onClick={() => navigate('/analysts/deliverables')}
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-700"
                      >
                        Deliverables
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {filteredProjects.length === 0 && (
              <div className="text-center py-12">
                <Folder className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum projeto encontrado</h3>
                <p className="text-gray-500">
                  {statusFilter !== 'all' 
                    ? 'Tente ajustar os filtros para encontrar projetos.'
                    : 'Comece criando uma nova oportunidade.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Métricas de Performance</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <Star className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-600">{stats.creatorSatisfactionRate}%</p>
                    <p className="text-sm text-gray-600">Satisfação dos Creators</p>
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="p-4 bg-[#00FF41]/10 rounded-lg">
                    <Timer className="h-8 w-8 text-[#00FF41] mx-auto mb-2" />
                    <p className="text-2xl font-bold text-[#00FF41]">{stats.onTimeCompletionRate.toFixed(1)}%</p>
                    <p className="text-sm text-gray-600">Entregas no Prazo</p>
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="p-4 bg-[#00FF41]/10 rounded-lg">
                    <Zap className="h-8 w-8 text-[#00FF41] mx-auto mb-2" />
                    <p className="text-2xl font-bold text-[#00FF41]">{stats.avgProjectDuration || 'N/A'}</p>
                    <p className="text-sm text-gray-600">Duração Média (dias)</p>
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <Award className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-yellow-600">
                      {stats.completedProjects > 0 ? Math.round((stats.approvedDeliverables / stats.totalDeliverables) * 100) : 0}%
                    </p>
                    <p className="text-sm text-gray-600">Taxa de Aprovação</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Crescimento Mensal</h3>
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Gráficos de performance em desenvolvimento</p>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Analytics Avançados</h3>
              <div className="text-center py-8 text-gray-500">
                <PieChart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Analytics detalhados em desenvolvimento</p>
                <p className="text-sm mt-2">Em breve: ROI por projeto, análise de tendências, previsões</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedProjectDashboard;