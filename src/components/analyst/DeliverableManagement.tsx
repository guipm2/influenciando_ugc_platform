import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit3, Trash2, Clock, CheckCircle, AlertCircle, FileText, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAnalystAuth } from '../../contexts/AnalystAuthContext';
import ModalPortal from '../common/ModalPortal';

interface ProjectDeliverable {
  id: string;
  application_id: string;
  opportunity_id: string;
  creator_id: string;
  analyst_id: string;
  title: string;
  description: string;
  due_date: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
  estimated_hours?: number;
  analyst_feedback?: string;
  reviewed_at?: string;
  creator_name?: string;
  opportunity_title?: string;
  company?: string;
  created_at: string;
  updated_at: string;
}

interface Application {
  id: string;
  opportunity_id: string;
  creator_id: string;
  opportunity: {
    id: string;
    title: string;
    company: string;
    created_by: string;
  };
  creator: {
    name: string;
  };
}

interface DeliverableFormData {
  title: string;
  description: string;
  due_date: string;
  priority: number;
  estimated_hours: number;
}

const DeliverableManagement: React.FC = () => {
  const [deliverables, setDeliverables] = useState<ProjectDeliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<string>('');
  const [applications, setApplications] = useState<Application[]>([]);
  const [formData, setFormData] = useState<DeliverableFormData>({
    title: '',
    description: '',
    due_date: '',
    priority: 1,
    estimated_hours: 0
  });
  const [filter, setFilter] = useState<'all' | 'pending' | 'overdue' | 'completed'>('all');
  const { user } = useAnalystAuth();

  const fetchDeliverables = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('project_deliverables')
        .select(`
          *,
          creator:profiles!creator_id(name),
          opportunity:opportunities(title, company)
        `)
        .eq('analyst_id', user.id)
        .order('due_date', { ascending: true });

      if (error) {
        console.error('Erro ao buscar deliverables:', error);
        return;
      }

      const mappedDeliverables = data.map(item => ({
        ...item,
        creator_name: item.creator?.name || 'Desconhecido',
        opportunity_title: item.opportunity?.title || 'Sem título',
        company: item.opportunity?.company || 'Sem empresa'
      }));

      setDeliverables(mappedDeliverables);
    } catch (error) {
      console.error('Erro ao buscar deliverables:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchApprovedApplications = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('opportunity_applications')
        .select(`
          id,
          opportunity_id,
          creator_id,
          opportunity:opportunities(id, title, company, created_by),
          creator:profiles!creator_id(name)
        `)
        .eq('status', 'approved')
        .eq('opportunity.created_by', user.id);

      if (error) {
        console.error('Erro ao buscar candidaturas aprovadas:', error);
        return;
      }

      // Fix: Garantir que opportunity e creator sejam objetos, não arrays
      const fixedData = data?.map(app => ({
        ...app,
        opportunity: Array.isArray(app.opportunity) ? app.opportunity[0] : app.opportunity,
        creator: Array.isArray(app.creator) ? app.creator[0] : app.creator
      })) || [];

      setApplications(fixedData as Application[]);
    } catch (error) {
      console.error('Erro ao buscar candidaturas aprovadas:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchDeliverables();
      fetchApprovedApplications();
    }
  }, [user, fetchDeliverables, fetchApprovedApplications]);

  const handleCreateDeliverable = async () => {
    if (!selectedApplication || !formData.title || !formData.due_date || !user) {
      // REMOVIDO: alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    const selectedApp = applications.find(app => app.id === selectedApplication);
    if (!selectedApp) return;

    try {
      const { error } = await supabase
        .from('project_deliverables')
        .insert({
          application_id: selectedApplication,
          opportunity_id: selectedApp.opportunity_id,
          creator_id: selectedApp.creator_id,
          analyst_id: user.id,
          title: formData.title,
          description: formData.description,
          due_date: formData.due_date,
          priority: formData.priority,
          estimated_hours: formData.estimated_hours,
          status: 'pending'
        });

      if (error) {
        console.error('Erro ao criar deliverable:', error);
        // REMOVIDO: alert('Erro ao criar deliverable');
        return;
      }

      setShowCreateModal(false);
      setFormData({ title: '', description: '', due_date: '', priority: 1, estimated_hours: 0 });
      setSelectedApplication('');
      fetchDeliverables();
      // REMOVIDO: alert('Deliverable criado com sucesso!');
    } catch (error) {
      console.error('Erro ao criar deliverable:', error);
      // REMOVIDO: alert('Erro ao criar deliverable');
    }
  };

  const handleUpdateDeliverable = async (id: string) => {
    try {
      const { error } = await supabase
        .from('project_deliverables')
        .update({
          title: formData.title,
          description: formData.description,
          due_date: formData.due_date,
          priority: formData.priority,
          estimated_hours: formData.estimated_hours,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('Erro ao atualizar deliverable:', error);
        // REMOVIDO: alert('Erro ao atualizar deliverable');
        return;
      }

      setShowEditModal(null);
      setFormData({ title: '', description: '', due_date: '', priority: 1, estimated_hours: 0 });
      fetchDeliverables();
      // REMOVIDO: alert('Deliverable atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar deliverable:', error);
      // REMOVIDO: alert('Erro ao atualizar deliverable');
    }
  };

  const handleDeleteDeliverable = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este deliverable?')) return;

    try {
      const { error } = await supabase
        .from('project_deliverables')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao deletar deliverable:', error);
        // REMOVIDO: alert('Erro ao deletar deliverable');
        return;
      }

      fetchDeliverables();
      // REMOVIDO: alert('Deliverable deletado com sucesso!');
    } catch (error) {
      console.error('Erro ao deletar deliverable:', error);
      // REMOVIDO: alert('Erro ao deletar deliverable');
    }
  };

  const updateDeliverableStatus = async (id: string, status: string, feedback?: string) => {
    try {
      const updateData: Partial<ProjectDeliverable> = { 
        status: status as ProjectDeliverable['status'], 
        updated_at: new Date().toISOString() 
      };
      
      if (feedback !== undefined) {
        updateData.analyst_feedback = feedback;
        updateData.reviewed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('project_deliverables')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Erro ao atualizar status:', error);
        // REMOVIDO: alert('Erro ao atualizar status');
        return;
      }

      fetchDeliverables();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      // REMOVIDO: alert('Erro ao atualizar status');
    }
  };

  const normalizeStatus = (value: string) => {
    const lowered = value?.toLowerCase();
    if (lowered === 'in_progress' || lowered === 'em_andamento') {
      return 'pending';
    }
    if (lowered === 'pendente') {
      return 'pending';
    }
    if (lowered === 'entregue') {
      return 'submitted';
    }
    if (lowered === 'aprovado') {
      return 'approved';
    }
    if (lowered === 'rejeitado') {
      return 'rejected';
    }
    return lowered;
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    const normalizedStatus = normalizeStatus(status);
    const isOverdue = new Date(dueDate) < new Date() && normalizedStatus !== 'approved';
    
    const configs = {
      pending: { 
        label: isOverdue ? 'Atrasado' : 'Pendente', 
        color: isOverdue ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800',
        icon: isOverdue ? AlertCircle : Clock
      },
      submitted: { 
        label: 'Enviado', 
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

    const config = configs[normalizedStatus as keyof typeof configs] || configs.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    );
  };

  const getPriorityBadge = (priority: number) => {
    const configs = {
      1: { label: 'Baixa', color: 'bg-gray-100 text-gray-800' },
      2: { label: 'Normal', color: 'bg-[#00FF41]/10 text-[#00FF41]' },
      3: { label: 'Alta', color: 'bg-orange-100 text-orange-800' },
      4: { label: 'Urgente', color: 'bg-red-100 text-red-800' },
      5: { label: 'Crítica', color: 'bg-red-200 text-red-900' }
    };

    const config = configs[priority as keyof typeof configs] || configs[1];

    return (
      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const filteredDeliverables = deliverables.filter(deliverable => {
    const isOverdue = new Date(deliverable.due_date) < new Date() && deliverable.status !== 'approved';
    
    switch (filter) {
      case 'pending':
        return normalizeStatus(deliverable.status) === 'pending';
      case 'overdue':
        return isOverdue;
      case 'completed':
        return deliverable.status === 'approved';
      default:
        return true;
    }
  });

  const openEditModal = (deliverable: ProjectDeliverable) => {
    setFormData({
      title: deliverable.title,
      description: deliverable.description || '',
      due_date: deliverable.due_date,
      priority: deliverable.priority,
      estimated_hours: deliverable.estimated_hours || 0
    });
    setShowEditModal(deliverable.id);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Gerenciamento de Prazos</h1>
          <p className="text-gray-600 mt-1">Carregando deliverables...</p>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00FF41]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Gerenciamento de Prazos</h1>
          <p className="text-gray-600 mt-1">Defina e gerencie prazos específicos para cada projeto</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-[#00FF41] hover:bg-[#00CC34] text-black px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Novo Deliverable
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Filtrar por:</span>
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'Todos' },
              { key: 'pending', label: 'Pendentes' },
              { key: 'overdue', label: 'Atrasados' },
              { key: 'completed', label: 'Concluídos' }
            ].map(option => (
              <button
                key={option.key}
                onClick={() => setFilter(option.key as 'all' | 'pending' | 'overdue' | 'completed')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  filter === option.key
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

      {/* Lista de Deliverables */}
      <div className="space-y-4">
        {filteredDeliverables.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhum deliverable encontrado</p>
            <p className="text-gray-400 text-sm mt-1">
              {filter === 'all' 
                ? 'Crie deliverables para definir prazos específicos para seus projetos'
                : 'Nenhum deliverable corresponde ao filtro selecionado'
              }
            </p>
          </div>
        ) : (
          filteredDeliverables.map((deliverable) => (
            <div key={deliverable.id} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{deliverable.title}</h3>
                    {getStatusBadge(deliverable.status, deliverable.due_date)}
                    {getPriorityBadge(deliverable.priority)}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Projeto</p>
                      <p className="text-gray-900">{deliverable.opportunity_title}</p>
                      <p className="text-sm text-gray-500">{deliverable.company}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Creator</p>
                      <p className="text-gray-900">{deliverable.creator_name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Prazo</p>
                      <p className="text-gray-900">{new Date(deliverable.due_date).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Status</p>
                      <div className="flex items-center gap-2 mt-1">
                        {deliverable.status === 'submitted' && (
                          <>
                            <button
                              onClick={() => updateDeliverableStatus(deliverable.id, 'approved', 'Aprovado pelo analista')}
                              className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded transition-colors"
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
                              className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded transition-colors"
                            >
                              Rejeitar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {deliverable.description && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700">Descrição</p>
                      <p className="text-gray-600 text-sm">{deliverable.description}</p>
                    </div>
                  )}

                  {deliverable.analyst_feedback && (
                    <div className="mb-4 bg-gray-50 rounded-lg p-3">
                      <p className="text-sm font-medium text-gray-700">Feedback do Analista</p>
                      <p className="text-gray-600 text-sm">{deliverable.analyst_feedback}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => openEditModal(deliverable)}
                    className="p-2 text-gray-600 hover:text-[#00FF41] hover:bg-[#00FF41]/10 rounded-lg transition-colors"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteDeliverable(deliverable.id)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Criação */}
      {showCreateModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Novo Deliverable</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Projeto *
                  </label>
                  <select
                    value={selectedApplication}
                    onChange={(e) => setSelectedApplication(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
                  >
                    <option value="">Selecione um projeto</option>
                    {applications.map(app => (
                      <option key={app.id} value={app.id}>
                        {app.opportunity?.title} - {app.creator?.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Título *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
                    placeholder="Ex: Briefing e Conceito"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
                    placeholder="Descreva o que deve ser entregue..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data de Entrega *
                    </label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prioridade
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
                    >
                      <option value={1}>Baixa</option>
                      <option value={2}>Normal</option>
                      <option value={3}>Alta</option>
                      <option value={4}>Urgente</option>
                      <option value={5}>Crítica</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Horas Estimadas
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={formData.estimated_hours}
                      onChange={(e) => setFormData({ ...formData, estimated_hours: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({ title: '', description: '', due_date: '', priority: 1, estimated_hours: 0 });
                    setSelectedApplication('');
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateDeliverable}
                  className="flex-1 px-4 py-2 bg-[#00FF41] hover:bg-[#00CC34] text-black rounded-lg font-medium transition-colors"
                >
                  Criar Deliverable
                </button>
              </div>
          </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal de Edição */}
      {showEditModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Editar Deliverable</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Título *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data de Entrega *
                    </label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prioridade
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
                    >
                      <option value={1}>Baixa</option>
                      <option value={2}>Normal</option>
                      <option value={3}>Alta</option>
                      <option value={4}>Urgente</option>
                      <option value={5}>Crítica</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Horas Estimadas
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={formData.estimated_hours}
                      onChange={(e) => setFormData({ ...formData, estimated_hours: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowEditModal(null)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleUpdateDeliverable(showEditModal)}
                  className="flex-1 px-4 py-2 bg-[#00FF41] hover:bg-[#00CC34] text-black rounded-lg font-medium transition-colors"
                >
                  Atualizar
                </button>
              </div>
          </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default DeliverableManagement;