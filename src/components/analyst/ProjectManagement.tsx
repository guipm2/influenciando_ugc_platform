import React, { useState, useEffect, useCallback } from 'react';
import { Folder, Calendar, User, CheckCircle, Clock, AlertCircle, MessageCircle, Filter, Eye, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAnalystAuth } from '../../contexts/AnalystAuthContext';
import { useRouter } from '../../hooks/useRouter';
import ModalPortal from '../common/ModalPortal';
import TimeLogModal from './TimeLogModal';

interface Project {
  id: string;
  opportunity_id: string;
  opportunity_title: string;
  company: string;
  content_type: string;
  deadline: string;
  budget: string;
  creator_id: string;
  creator_name: string;
  creator_email: string;
  standardDeliverables: ProjectDeliverable[];
  customDeliverables: ProjectDeliverable[];
  conversation_id?: string;
  created_at: string;
  briefing?: string;
}

interface ProjectDeliverable {
  id: string;
  title: string;
  description: string;
  due_date: string;
  priority?: number;
  status: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
  estimated_hours?: number;
  analyst_feedback?: string;
  reviewed_at?: string;
  files?: DeliverableFile[];
  created_at: string;
  updated_at: string;
}

interface DeliverableFile {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploaded_at: string;
}

interface DeliverableUpdate {
  status: string;
  updated_at: string;
  analyst_feedback?: string;
  reviewed_at?: string;
}

interface ProjectManagementProps {
  onOpenConversation?: (conversationId: string) => void;
  selectedProjectId?: string;
}

const ProjectManagement: React.FC<ProjectManagementProps> = ({ onOpenConversation, selectedProjectId }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'overdue'>('all');
  const [showCreateDeliverableModal, setShowCreateDeliverableModal] = useState(false);
  const [briefing, setBriefing] = useState('');
  const [briefingSaving, setBriefingSaving] = useState(false);
  const [briefingSaved, setBriefingSaved] = useState(false);
  const [showTimeLogModal, setShowTimeLogModal] = useState(false);
  const [selectedDeliverableForTime, setSelectedDeliverableForTime] = useState<{id: string, title: string} | null>(null);
  const [deliverableForm, setDeliverableForm] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 1,
    estimated_hours: 0,
    status: 'pending' as 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected'
  });
  const { user } = useAnalystAuth();
  const { navigate } = useRouter();
  
  const createCustomDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProject || !user || !deliverableForm.title || !deliverableForm.due_date) {
      // REMOVIDO: alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    try {
      const { error } = await supabase
        .from('project_deliverables')
        .insert({
          application_id: selectedProject.id,
          opportunity_id: selectedProject.opportunity_id,
          creator_id: selectedProject.creator_id,
          analyst_id: user.id,
          title: deliverableForm.title,
          description: deliverableForm.description,
          due_date: deliverableForm.due_date,
          priority: deliverableForm.priority,
          estimated_hours: deliverableForm.estimated_hours,
          status: 'pending'
        });

      if (error) {
        console.error('Erro ao criar deliverable:', error);
        // REMOVIDO: alert('Erro ao criar deliverable');
        return;
      }

      // Fechar modal e resetar form
      setShowCreateDeliverableModal(false);
      setDeliverableForm({ 
        title: '', 
        description: '', 
        due_date: '', 
        priority: 1, 
        estimated_hours: 0,
        status: 'pending' 
      });
      
      // Recarregar projetos para atualizar a lista
      fetchProjects();
      
      // REMOVIDO: alert('Deliverable criado com sucesso!');
    } catch (error) {
      console.error('Erro ao criar deliverable:', error);
      // REMOVIDO: alert('Erro ao criar deliverable');
    }
  };

  const saveBriefing = async () => {
    if (!selectedProject || !user) return;

    setBriefingSaving(true);
    try {
      const { error } = await supabase
        .from('opportunities')
        .update({ briefing })
        .eq('id', selectedProject.opportunity_id);

      if (error) {
        console.error('Erro ao salvar briefing:', error);
        return;
      }

      setBriefingSaved(true);
      // Recarregar projetos para atualizar os dados
      fetchProjects();
      
      // Limpar o indicador de "salvo" após alguns segundos
      setTimeout(() => setBriefingSaved(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar briefing:', error);
    } finally {
      setBriefingSaving(false);
    }
  };
  const openConversation = async (project: Project) => {
            
    try {
      // Buscar conversa única entre analista e criador (independente do projeto)
            const { data: existingConversation, error: searchError } = await supabase
        .from('conversations')
        .select('id')
        .eq('creator_id', project.creator_id)
        .eq('analyst_id', user?.id)
        .maybeSingle();

      
      if (searchError && searchError.code !== 'PGRST116') {
        console.error('Erro ao buscar conversa única:', searchError);
        return;
      }

      let conversationId = existingConversation?.id;

      // Se não existe conversa única, cria uma nova
      if (!conversationId) {
                const { data: newConversation, error: createError } = await supabase
          .from('conversations')
          .insert({
            opportunity_id: null, // Conversa geral, não específica de projeto
            creator_id: project.creator_id,
            analyst_id: user?.id,
            last_message_at: new Date().toISOString()
          })
          .select('id')
          .single();

                
        if (createError) {
          console.error('Erro ao criar conversa única:', createError);
          return;
        }

        conversationId = newConversation.id;
      }

                  
      // Navega para a página de mensagens
      navigate('/analysts/messages');
      
      // Chama o callback para abrir a conversa única específica
            if (onOpenConversation) {
        onOpenConversation(conversationId);
      }
    } catch (error) {
      console.error('❌ Erro geral ao gerenciar conversa única:', error);
    }
  };

  const fetchProjects = useCallback(async () => {
    if (!user) {
            return;
    }

    
    try {
      // Buscar candidaturas aprovadas para oportunidades do analista
      const { data: applications, error } = await supabase
        .from('opportunity_applications')
        .select(`
          id,
          opportunity_id,
          creator_id,
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
            briefing
          ),
          creator:profiles!creator_id (
            name,
            email
          )
        `)
        .eq('status', 'approved');

      
      if (error) {
        console.error('❌ Erro ao buscar candidaturas:', error);
        setProjects([]);
        return;
      }

      if (!applications || applications.length === 0) {
        setProjects([]);
        return;
      }

      // Filtrar apenas as oportunidades criadas pelo analista atual
      const filteredApplications = applications.filter(app => {
        const opportunity = Array.isArray(app.opportunity) ? app.opportunity[0] : app.opportunity;
        const isFromAnalyst = opportunity && opportunity.created_by === user.id;
        return isFromAnalyst;
      });

      
      // Processar cada candidatura aprovada
      const projectsData: Project[] = [];
      
      for (const app of filteredApplications) {
        const opportunity = Array.isArray(app.opportunity) ? app.opportunity[0] : app.opportunity;
        const creator = Array.isArray(app.creator) ? app.creator[0] : app.creator;
        
        if (!opportunity || !creator) {
          console.warn('⚠️ Dados incompletos para a candidatura:', app.id);
          continue;
        }

        
        // Gerar deliverables padrão
        const standardDeliverables = generateStandardDeliverables(opportunity.content_type, opportunity.deadline, app.id);

        // Buscar deliverables customizados do banco de dados
        const { data: customDeliverablesData } = await supabase
          .from('project_deliverables')
          .select('*')
          .eq('application_id', app.id)
          .eq('analyst_id', user.id);

        const customDeliverables: ProjectDeliverable[] = (customDeliverablesData || []).map(d => ({
          id: d.id,
          title: d.title,
          description: d.description,
          due_date: d.due_date,
          priority: d.priority,
          estimated_hours: d.estimated_hours,
          status: d.status,
          analyst_feedback: d.analyst_feedback,
          reviewed_at: d.reviewed_at,
          files: [],
          created_at: d.created_at,
          updated_at: d.updated_at
        }));

        projectsData.push({
          id: app.id,
          opportunity_id: app.opportunity_id,
          opportunity_title: opportunity.title,
          company: opportunity.company,
          content_type: opportunity.content_type,
          deadline: opportunity.deadline,
          budget: `R$ ${opportunity.budget?.toFixed(2) || '0.00'}`,
          creator_id: app.creator_id,
          creator_name: creator.name || 'Nome não informado',
          creator_email: creator.email || '',
          standardDeliverables,
          customDeliverables,
          conversation_id: undefined,
          created_at: new Date().toISOString(), // Usar data atual como fallback
          briefing: opportunity.briefing || ''
        });
      }

            setProjects(projectsData);
    } catch (error) {
      console.error('❌ Erro ao buscar projetos:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const generateStandardDeliverables = (contentType: string, deadline: string, applicationId: string): ProjectDeliverable[] => {
    const baseDeliverables = [
      {
        id: `std_1_${applicationId}`,
        title: 'Briefing e Conceito',
        description: 'Apresentar o conceito criativo e briefing do conteúdo',
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: 1,
        status: 'pending' as const,
        files: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    if (contentType.toLowerCase().includes('reel') || contentType.toLowerCase().includes('video')) {
      baseDeliverables.push({
        id: `std_2_${applicationId}`,
        title: 'Roteiro e Storyboard',
        description: 'Roteiro detalhado e storyboard do vídeo',
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: 2,
        status: 'pending' as const,
        files: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    baseDeliverables.push({
      id: `std_3_${applicationId}`,
      title: 'Conteúdo Final',
      description: `Entrega do ${contentType} finalizado`,
      due_date: deadline,
      priority: 3,
      status: 'pending' as const,
      files: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    return baseDeliverables;
  };

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user, fetchProjects]);

  // Quando houver selectedProjectId da URL, definir o projeto selecionado
  useEffect(() => {
    if (selectedProjectId && projects.length > 0) {
      const project = projects.find(p => p.id === selectedProjectId);
      setSelectedProject(project || null);
    } else if (!selectedProjectId) {
      setSelectedProject(null);
    }
  }, [selectedProjectId, projects]);

  // Carregar briefing quando projeto for selecionado
  useEffect(() => {
    if (selectedProject) {
      setBriefing(selectedProject.briefing || '');
    }
  }, [selectedProject]);

  // Debug useEffect para monitorar o estado do modal
  useEffect(() => {
      }, [showCreateDeliverableModal]);

  const getStatusBadge = (status: string, dueDate: string) => {
    const isOverdue = new Date(dueDate) < new Date() && status !== 'approved';
    
    const configs = {
      pending: { 
        label: isOverdue ? 'Atrasado' : 'Pendente', 
        color: isOverdue ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800',
        icon: isOverdue ? AlertCircle : Clock
      },
      in_progress: { 
        label: isOverdue ? 'Atrasado (Em andamento)' : 'Em andamento', 
        color: isOverdue ? 'bg-red-100 text-red-800' : 'bg-[#00FF41]/10 text-[#00FF41]',
        icon: isOverdue ? AlertCircle : Clock
      },
      submitted: { 
        label: 'Aguardando Revisão', 
        color: 'bg-[#00FF41]/10 text-[#00FF41]',
        icon: Eye
      },
      approved: { 
        label: 'Aprovado', 
        color: 'bg-green-100 text-green-800',
        icon: CheckCircle
      },
      rejected: { 
        label: 'Rejeitado', 
        color: 'bg-red-100 text-red-800',
        icon: AlertCircle
      }
    };

    const config = configs[status as keyof typeof configs] || configs.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    );
  };

  const getProjectProgress = (project: Project) => {
    const allDeliverables = [...project.standardDeliverables, ...project.customDeliverables];
    const completed = allDeliverables.filter(d => d.status === 'approved').length;
    return { completed, total: allDeliverables.length };
  };

  const getProjectStatus = (project: Project) => {
    const allDeliverables = [...project.standardDeliverables, ...project.customDeliverables];
    const hasOverdue = allDeliverables.some(d => new Date(d.due_date) < new Date() && d.status !== 'approved');
    const allCompleted = allDeliverables.every(d => d.status === 'approved');
    const hasSubmitted = allDeliverables.some(d => d.status === 'submitted');
    
    if (allCompleted) return 'completed';
    if (hasOverdue) return 'overdue';
    if (hasSubmitted) return 'review';
    return 'active';
  };

  const updateDeliverableStatus = async (deliverableId: string, status: string, feedback?: string) => {
    try {
      const updateData: DeliverableUpdate = { 
        status, 
        updated_at: new Date().toISOString() 
      };
      
      if (feedback !== undefined) {
        updateData.analyst_feedback = feedback;
        updateData.reviewed_at = new Date().toISOString();
      }

      // Se for um deliverable customizado (do banco), atualizar no banco
      if (deliverableId.startsWith('std_')) {
        // Para deliverables padrão, apenas atualizar localmente por enquanto
        // REMOVIDO: alert('Funcionalidade de aprovação para deliverables padrão será implementada em breve');
        return;
      }

      const { error } = await supabase
        .from('project_deliverables')
        .update(updateData)
        .eq('id', deliverableId);

      if (error) {
        console.error('Erro ao atualizar status:', error);
        // REMOVIDO: alert('Erro ao atualizar status');
        return;
      }

      // Recarregar projetos
      fetchProjects();
      // REMOVIDO: alert(status === 'approved' ? 'Deliverable aprovado!' : 'Deliverable rejeitado!');
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      // REMOVIDO: alert('Erro ao atualizar status');
    }
  };

  const filteredProjects = projects.filter(project => {
    const projectStatus = getProjectStatus(project);
    
    switch (statusFilter) {
      case 'active':
        return projectStatus === 'active' || projectStatus === 'review';
      case 'completed':
        return projectStatus === 'completed';
      case 'overdue':
        return projectStatus === 'overdue';
      default:
        return true;
    }
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const renderModal = () => {
    if (!showCreateDeliverableModal || !selectedProject) return null;
    
    return (
      <ModalPortal>
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Nova Entrega</h2>
            <button
              onClick={() => setShowCreateDeliverableModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={createCustomDeliverable}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título
                </label>
                <input
                  type="text"
                  value={deliverableForm.title}
                  onChange={(e) => setDeliverableForm(prev => ({
                    ...prev,
                    title: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00FF41]"
                  placeholder="Ex: Roteiro do vídeo"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  rows={3}
                  value={deliverableForm.description}
                  onChange={(e) => setDeliverableForm(prev => ({
                    ...prev,
                    description: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00FF41]"
                  placeholder="Descreva o que precisa ser entregue..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prazo
                </label>
                <input
                  type="date"
                  value={deliverableForm.due_date}
                  onChange={(e) => setDeliverableForm(prev => ({
                    ...prev,
                    due_date: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00FF41]"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Horas Estimadas
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={deliverableForm.estimated_hours}
                  onChange={(e) => setDeliverableForm(prev => ({
                    ...prev,
                    estimated_hours: parseFloat(e.target.value) || 0
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00FF41]"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select 
                  value={deliverableForm.status}
                  onChange={(e) => setDeliverableForm(prev => ({
                    ...prev,
                    status: e.target.value as 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected'
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00FF41]"
                >
                  <option value="pending">Pendente</option>
                  <option value="in_progress">Em Progresso</option>
                  <option value="completed">Concluída</option>
                  <option value="overdue">Atrasada</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowCreateDeliverableModal(false)}
                className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 text-black bg-[#00FF41] rounded-lg hover:bg-[#00CC34]"
              >
                Criar Entrega
              </button>
            </div>
          </form>
        </div>
        </div>
      </ModalPortal>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Administração de Projetos</h1>
          <p className="text-gray-600 mt-1">Carregando projetos...</p>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00FF41]"></div>
        </div>
      </div>
    );
  }

  if (selectedProjectId && selectedProject) {
    const progress = getProjectProgress(selectedProject);
    const allDeliverables = [...selectedProject.standardDeliverables, ...selectedProject.customDeliverables];
    
    return (
      <div>
        {renderModal()}
        <div className="space-y-6">
        {/* Header do Projeto */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/analysts/projects')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ←
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{selectedProject.opportunity_title}</h1>
              <p className="text-gray-600">{selectedProject.company} • {selectedProject.creator_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              Progresso: {progress.completed}/{progress.total}
            </span>
            <button
              onClick={() => {
                                                setShowCreateDeliverableModal(true);
                setTimeout(() => {
                                  }, 100);
              }}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Nova Entrega
            </button>
            <button
              onClick={() => openConversation(selectedProject)}
              className="bg-[#00FF41] hover:bg-[#00CC34] text-black px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Conversar
            </button>
          </div>
        </div>

        {/* Informações do Projeto */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Detalhes do Projeto</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-700">Creator</p>
              <p className="text-gray-900">{selectedProject.creator_name}</p>
              <p className="text-sm text-gray-500">{selectedProject.creator_email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Prazo Final</p>
              <p className="text-gray-900">{formatDate(selectedProject.deadline)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Tipo de Conteúdo</p>
              <p className="text-gray-900">{selectedProject.content_type}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Orçamento</p>
              <p className="text-gray-900">{selectedProject.budget}</p>
            </div>
          </div>
        </div>

        {/* Briefing do Projeto */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Briefing do Projeto</h3>
            {briefingSaved && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Salvo com sucesso
              </span>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Instruções para o Creator
              </label>
              <textarea
                value={briefing}
                onChange={(e) => setBriefing(e.target.value)}
                placeholder="Digite aqui as instruções, conceito criativo, direcionamentos específicos e todas as informações que o creator precisa saber para desenvolver o projeto..."
                className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-[#00FF41] resize-none"
                disabled={briefingSaving}
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={saveBriefing}
                disabled={briefingSaving}
                className="bg-[#00FF41] hover:bg-[#00CC34] disabled:bg-[#00FF41]/40 text-black px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {briefingSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Salvar Briefing
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Deliverables */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Status das Entregas</h3>
          
          <div className="space-y-6">
            {/* Deliverables Padrão */}
            {selectedProject.standardDeliverables.length > 0 && (
              <div>
                <h4 className="text-md font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#00FF41]" />
                  Entregas Padrão ({selectedProject.standardDeliverables.length})
                </h4>
                <div className="space-y-3">
                  {selectedProject.standardDeliverables.map((deliverable) => (
                    <div key={deliverable.id} className="border border-gray-200 rounded-lg p-4 bg-[#00FF41]/5">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h5 className="font-medium text-gray-900">{deliverable.title}</h5>
                            {getStatusBadge(deliverable.status, deliverable.due_date)}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{deliverable.description}</p>
                          <p className="text-xs text-gray-500">Prazo: {formatDate(deliverable.due_date)}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => {
                              setSelectedDeliverableForTime({ id: deliverable.id, title: deliverable.title });
                              setShowTimeLogModal(true);
                            }}
                            className="p-1.5 text-gray-500 hover:text-[#00FF41] hover:bg-[#00FF41]/10 rounded-lg transition-colors"
                            title="Registrar Tempo"
                          >
                            <Clock className="h-4 w-4" />
                          </button>
                          {deliverable.status === 'submitted' && (
                            <>
                              <button
                                onClick={() => updateDeliverableStatus(deliverable.id, 'approved', 'Aprovado pelo analista')}
                                className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition-colors"
                              >
                                Aprovar
                              </button>
                              <button
                                onClick={() => {
                                  const feedback = prompt('Feedback para rejeição:');
                                  if (feedback !== null) {
                                    updateDeliverableStatus(deliverable.id, 'rejected', feedback);
                                  }
                                }}
                                className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition-colors"
                              >
                                Rejeitar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {deliverable.analyst_feedback && (
                        <div className="mt-3 p-3 bg-gray-50 rounded">
                          <p className="text-sm font-medium text-gray-700">Seu Feedback:</p>
                          <p className="text-sm text-gray-600">{deliverable.analyst_feedback}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Deliverables Customizados */}
            {selectedProject.customDeliverables.length > 0 && (
              <div>
                <h4 className="text-md font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-[#00FF41]" />
                  Entregas Específicas ({selectedProject.customDeliverables.length})
                </h4>
                <div className="space-y-3">
                  {selectedProject.customDeliverables.map((deliverable) => (
                    <div key={deliverable.id} className="border border-[#00FF41]/30 rounded-lg p-4 bg-[#00FF41]/5">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h5 className="font-medium text-gray-900">{deliverable.title}</h5>
                            {getStatusBadge(deliverable.status, deliverable.due_date)}
                            {deliverable.priority && (
                              <span className="px-2 py-1 bg-[#00FF41]/10 text-[#00FF41] rounded-full text-xs font-medium">
                                Prioridade: {deliverable.priority}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{deliverable.description}</p>
                          <p className="text-xs text-gray-500">Prazo: {formatDate(deliverable.due_date)}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {deliverable.status === 'submitted' && (
                            <>
                              <button
                                onClick={() => updateDeliverableStatus(deliverable.id, 'approved', 'Aprovado pelo analista')}
                                className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition-colors"
                              >
                                Aprovar
                              </button>
                              <button
                                onClick={() => {
                                  const feedback = prompt('Feedback para rejeição:');
                                  if (feedback !== null) {
                                    updateDeliverableStatus(deliverable.id, 'rejected', feedback);
                                  }
                                }}
                                className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition-colors"
                              >
                                Rejeitar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {deliverable.analyst_feedback && (
                        <div className="mt-3 p-3 bg-gray-50 rounded">
                          <p className="text-sm font-medium text-gray-700">Seu Feedback:</p>
                          <p className="text-sm text-gray-600">{deliverable.analyst_feedback}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {allDeliverables.length === 0 && (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Nenhum deliverable encontrado</p>
                <p className="text-gray-400 text-sm">Este projeto ainda não possui entregas definidas</p>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {renderModal()}
        <TimeLogModal
          isOpen={showTimeLogModal}
          onClose={() => {
            setShowTimeLogModal(false);
            setSelectedDeliverableForTime(null);
          }}
          deliverableId={selectedDeliverableForTime?.id || ''}
          deliverableTitle={selectedDeliverableForTime?.title || ''}
          onSuccess={() => {
            // Opcional: recarregar dados ou mostrar feedback
          }}
        />
      <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Administração de Projetos</h1>
        <p className="text-gray-600 mt-1">Gerencie o progresso de todos os seus projetos aprovados</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtrar por:
          </span>
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'Todos' },
              { key: 'active', label: 'Ativos' },
              { key: 'overdue', label: 'Atrasados' },
              { key: 'completed', label: 'Concluídos' }
            ].map(option => (
              <button
                key={option.key}
                onClick={() => setStatusFilter(option.key as 'all' | 'active' | 'completed' | 'overdue')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  statusFilter === option.key
                    ? 'bg-[#00FF41]/10 text-[#00FF41] font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista de Projetos */}
      <div className="space-y-4">
        {filteredProjects.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Folder className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhum projeto encontrado</p>
            <p className="text-gray-400 text-sm mt-1">
              {statusFilter === 'all' 
                ? 'Para testar a funcionalidade de deliverables, primeiro crie uma oportunidade e aprove uma candidatura'
                : 'Nenhum projeto corresponde ao filtro selecionado'
              }
            </p>
            <div className="mt-4 p-4 bg-[#00FF41]/5 rounded-lg border border-[#00FF41]/30">
              <p className="text-sm text-[#00FF41] font-medium mb-2">💡 Como testar deliverables:</p>
              <ol className="text-sm text-gray-700 space-y-1">
                <li>1. Vá para <strong>Oportunidades</strong> e crie uma nova oportunidade</li>
                <li>2. Com outro usuário (criador), candidate-se à oportunidade</li>
                <li>3. Volte aqui e aprove a candidatura</li>
                <li>4. Clique no projeto aprovado para ver o botão <strong>"Nova Entrega"</strong></li>
              </ol>
            </div>
          </div>
        ) : (
          filteredProjects.map((project) => {
            const progress = getProjectProgress(project);
            const projectStatus = getProjectStatus(project);
            const totalDeliverables = project.standardDeliverables.length + project.customDeliverables.length;
            
            return (
              <div
                key={project.id}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-200 cursor-pointer"
                onClick={() => navigate(`/analysts/projects/${project.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#00FF41]/10 rounded-lg flex items-center justify-center">
                      <Folder className="h-6 w-6 text-[#00FF41]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{project.opportunity_title}</h3>
                      <p className="text-gray-600 text-sm">{project.company}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {project.creator_name}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(project.deadline)}
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {totalDeliverables} {totalDeliverables === 1 ? 'entrega' : 'entregas'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm text-gray-600 mb-1">Progresso</div>
                    <div className="text-lg font-semibold text-gray-900 mb-2">
                      {progress.completed}/{progress.total}
                    </div>
                    <div className="w-32 bg-gray-200 rounded-full h-2 mb-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          projectStatus === 'completed' 
                            ? 'bg-green-600' 
                            : projectStatus === 'overdue'
                            ? 'bg-red-600'
                            : 'bg-[#00FF41]'
                        }`}
                        style={{
                          width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {projectStatus === 'completed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3" />
                          Concluído
                        </span>
                      )}
                      {projectStatus === 'overdue' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                          <AlertCircle className="h-3 w-3" />
                          Atrasado
                        </span>
                      )}
                      {projectStatus === 'review' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-[#00FF41]/10 text-[#00FF41]">
                          <Eye className="h-3 w-3" />
                          Revisar
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openConversation(project);
                        }}
                        className="flex items-center gap-1 text-[#00FF41] hover:text-[#00CC34] transition-colors text-sm"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Chat
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      </div>
    </div>
  );
};

export default ProjectManagement;