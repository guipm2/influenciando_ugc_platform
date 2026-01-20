import React, { useState, useEffect, useCallback } from 'react';
import { Search, Package, Truck, FileText, Video, Edit, CheckCircle, Clock, Plus, Save, X, Eye, Grid3X3, List, MoreVertical, ChevronDown, ChevronRight, Users, UserCheck, User, MapPin, ExternalLink, Globe, Calendar, Mail, Phone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAnalystAuth } from '../../contexts/AnalystAuthContext';

interface OpportunityStage {
  id: string;
  opportunity_id: string;
  stage: string;
  tracking_code: string | null;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  creator_id: string | null;
  opportunity: {
    title: string;
    company: string;
    deadline: string;
    content_type: string;
    candidates_count: number;
  };
  creator?: {
    name: string;
    email: string;
  };
}

interface OpportunityWithCreators {
  id: string;
  title: string;
  company: string;
  deadline: string;
  content_type: string;
  candidates_count: number;
  approved_count: number;
  creators: (OpportunityStage & {
    creator: {
      name: string;
      email: string;
      bio: string;
      location: string;
      niche: string;
      followers: string;
      website: string;
      phone: string;
      avatar_url: string;
      created_at: string;
    };
  })[];
}

interface CreatorStageUpdate {
  stageId: string;
  creatorId: string;
  trackingCode: string;
  notes: string;
}

interface StageConfig {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string; [key: string]: unknown }>;
  color: string;
  bgColor: string;
  description: string;
}

const OpportunityStagesManagement: React.FC = () => {
  const [stages, setStages] = useState<OpportunityStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('todos');
  const [selectedStage, setSelectedStage] = useState<OpportunityStage | null>(null);
  const [showTrackingModal, setShowTrackingModal] = useState<string | null>(null);
  const [trackingCode, setTrackingCode] = useState('');
  const [notes, setNotes] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [draggedStage, setDraggedStage] = useState<OpportunityStage | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [expandedOpportunities, setExpandedOpportunities] = useState<Set<string>>(new Set());
  const [opportunitiesWithCreators, setOpportunitiesWithCreators] = useState<OpportunityWithCreators[]>([]);
  const [showCreatorTrackingModal, setShowCreatorTrackingModal] = useState<CreatorStageUpdate | null>(null);
  const [selectedCreatorProfile, setSelectedCreatorProfile] = useState<{
    name: string;
    email: string;
    bio?: string;
    location?: string;
    niche?: string;
    followers?: string;
    website?: string;
    phone?: string;
    avatar_url?: string;
    created_at: string;
  } | null>(null);
  const { profile: analyst } = useAnalystAuth();

  const stageConfigs: StageConfig[] = [
    {
      key: 'aguardando_envio',
      label: 'Aguardando Envio',
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      description: 'Aguardando o envio dos produtos para o criador'
    },
    {
      key: 'produtos_enviados',
      label: 'Produtos Enviados',
      icon: Package,
      color: 'text-[#00FF41]',
      bgColor: 'bg-[#00FF41]/10',
      description: 'Produtos enviados, aguardando recebimento'
    },
    {
      key: 'material_roteirizacao',
      label: 'Material em Roteirização',
      icon: FileText,
      color: 'text-[#00FF41]',
      bgColor: 'bg-[#00FF41]/10',
      description: 'Criador está desenvolvendo o roteiro'
    },
    {
      key: 'aguardando_gravacao',
      label: 'Aguardando Gravação',
      icon: Video,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      description: 'Roteiro aprovado, aguardando gravação'
    },
    {
      key: 'pronto_edicao',
      label: 'Pronto pra Edição',
      icon: Edit,
      color: 'text-[#00FF41]',
      bgColor: 'bg-[#00FF41]/10',
      description: 'Material gravado, pronto para edição'
    },
    {
      key: 'material_edicao',
      label: 'Material em Edição',
      icon: Edit,
      color: 'text-[#00FF41]',
      bgColor: 'bg-[#00FF41]/10',
      description: 'Conteúdo sendo editado pelo criador'
    },
    {
      key: 'revisao_final',
      label: 'Revisão Final',
      icon: Eye,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      description: 'Material em revisão final antes da entrega'
    },
    {
      key: 'finalizado',
      label: 'Finalizado',
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      description: 'Projeto concluído e entregue'
    }
  ];

  const fetchStages = useCallback(async () => {
    if (!analyst?.id) return;

    try {
      const { data, error } = await supabase
        .from('opportunity_stages')
        .select(`
          *,
          opportunity:opportunities (
            title,
            company,
            deadline,
            content_type,
            candidates_count
          ),
          creator:profiles (
            name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar etapas:', error);
      } else {
        setStages(data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar etapas:', err);
    } finally {
      setLoading(false);
    }
  }, [analyst?.id]);

  const fetchOpportunitiesWithCreators = useCallback(async () => {
    if (!analyst?.id) return;

    try {
      // Buscar oportunidades com candidaturas aprovadas
      const { data: opportunities, error: oppError } = await supabase
        .from('opportunities')
        .select(`
          id,
          title,
          company,
          deadline,
          content_type
        `)
        .eq('created_by', analyst.id);

      if (oppError) {
        console.error('Erro ao buscar oportunidades:', oppError);
        return;
      }

      if (!opportunities || opportunities.length === 0) {
        setOpportunitiesWithCreators([]);
        return;
      }

      const opportunityIds = opportunities.map(opp => opp.id);

      // Fetch all related data in parallel
      const [
        { data: allApplications, error: applicationsError },
        { data: approvedApplications, error: approvedError },
        { data: stages, error: stagesError }
      ] = await Promise.all([
        // Get all applications to count candidates
        supabase
          .from('opportunity_applications')
          .select('opportunity_id')
          .in('opportunity_id', opportunityIds),

        // Get approved applications with details
        supabase
          .from('opportunity_applications')
          .select(`
            opportunity_id,
            creator_id,
            creator:profiles (
              name,
              email,
              bio,
              location,
              niche,
              followers,
              website,
              phone,
              avatar_url,
              created_at
            )
          `)
          .in('opportunity_id', opportunityIds)
          .eq('status', 'approved'),

        // Get stages
        supabase
          .from('opportunity_stages')
          .select(`
            *,
            creator:profiles (
              name,
              email,
              bio,
              location,
              niche,
              followers,
              website,
              phone,
              avatar_url,
              created_at
            )
          `)
          .in('opportunity_id', opportunityIds)
      ]);

      if (applicationsError) console.error('Erro ao buscar contagem de candidatos:', applicationsError);
      if (approvedError) console.error('Erro ao buscar candidaturas aprovadas:', approvedError);
      if (stagesError) console.error('Erro ao buscar etapas:', stagesError);

      // Helper types for bulk data processing
      type CreatorProfile = {
        name: string;
        email: string;
        bio: string;
        location: string;
        niche: string;
        followers: string;
        website: string;
        phone: string;
        avatar_url: string;
        created_at: string;
      };

      type DbStage = {
        id: string;
        opportunity_id: string;
        stage: string;
        tracking_code: string | null;
        notes: string | null;
        completed_at: string | null;
        created_at: string;
        updated_at: string;
        creator_id: string | null;
        creator: CreatorProfile;
      };

      type DbApplication = {
        opportunity_id: string;
        creator_id: string;
        creator: CreatorProfile;
      };

      // Process data for quick lookup
      const candidateCounts = (allApplications || []).reduce((acc, app) => {
        acc[app.opportunity_id] = (acc[app.opportunity_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const approvedMap = (approvedApplications || []).reduce((acc, app) => {
        const typedApp = app as unknown as DbApplication;
        if (!acc[typedApp.opportunity_id]) acc[typedApp.opportunity_id] = [];
        acc[typedApp.opportunity_id].push(typedApp);
        return acc;
      }, {} as Record<string, DbApplication[]>);

      const stagesMap = (stages || []).reduce((acc, stage) => {
        const typedStage = stage as unknown as DbStage;
        if (!acc[typedStage.opportunity_id]) acc[typedStage.opportunity_id] = [];
        acc[typedStage.opportunity_id].push(typedStage);
        return acc;
      }, {} as Record<string, DbStage[]>);

      // Map back to opportunities
      const opportunitiesWithCreators = opportunities.map((opp) => {
        const oppStages = stagesMap[opp.id] || [];
        const creators = oppStages.map((stage) => ({
          ...stage,
          opportunity: opp
        }));

        return {
          ...opp,
          candidates_count: candidateCounts[opp.id] || 0,
          approved_count: (approvedMap[opp.id] || []).length,
          creators
        };
      });

      setOpportunitiesWithCreators(opportunitiesWithCreators);
    } catch (err) {
      console.error('Erro ao buscar oportunidades com criadores:', err);
    }
  }, [analyst?.id]);

  useEffect(() => {
    if (analyst?.id) {
      fetchStages();
      fetchOpportunitiesWithCreators();
    }
  }, [analyst?.id, fetchStages, fetchOpportunitiesWithCreators]);

  const updateStage = async (stageId: string, newStage: string, trackingCode?: string, notes?: string) => {
    setUpdating(stageId);

    try {
      const updateData: { [key: string]: string | null } = {
        stage: newStage,
        updated_at: new Date().toISOString()
      };

      if (trackingCode !== undefined) {
        updateData.tracking_code = trackingCode;
      }

      if (notes !== undefined) {
        updateData.notes = notes;
      }

      if (newStage === 'finalizado') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('opportunity_stages')
        .update(updateData)
        .eq('id', stageId);

      if (error) {
        console.error('Erro ao atualizar etapa:', error);
        // REMOVIDO: alert('Erro ao atualizar etapa');
      } else {
        await fetchStages();
        await fetchOpportunitiesWithCreators();
        // REMOVIDO: alert('Etapa atualizada com sucesso!');
      }
    } catch (err) {
      console.error('Erro ao atualizar etapa:', err);
      // REMOVIDO: alert('Erro ao atualizar etapa');
    } finally {
      setUpdating(null);
    }
  };

  const handleTrackingSubmit = async (stageId: string) => {
    if (!trackingCode.trim()) {
      // REMOVIDO: alert('Por favor, insira o código de rastreio');
      return;
    }

    await updateStage(stageId, 'produtos_enviados', trackingCode, notes);
    setShowTrackingModal(null);
    setTrackingCode('');
    setNotes('');
  };

  const handleCreatorTrackingSubmit = async () => {
    if (!showCreatorTrackingModal || !showCreatorTrackingModal.trackingCode.trim()) {
      // REMOVIDO: alert('Por favor, insira o código de rastreio');
      return;
    }

    await updateStage(
      showCreatorTrackingModal.stageId, 
      'produtos_enviados', 
      showCreatorTrackingModal.trackingCode, 
      showCreatorTrackingModal.notes
    );
    
    setShowCreatorTrackingModal(null);
  };

  const toggleOpportunityExpansion = (opportunityId: string) => {
    const newExpanded = new Set(expandedOpportunities);
    if (newExpanded.has(opportunityId)) {
      newExpanded.delete(opportunityId);
    } else {
      newExpanded.add(opportunityId);
    }
    setExpandedOpportunities(newExpanded);
  };

  const handleDragStart = (e: React.DragEvent, stage: OpportunityStage) => {
    setDraggedStage(stage);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(targetStage);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedStage || draggedStage.stage === targetStage) {
      setDraggedStage(null);
      return;
    }

    // Verificar se é uma progressão válida (não permitir voltar etapas)
    const currentIndex = stageConfigs.findIndex(config => config.key === draggedStage.stage);
    const targetIndex = stageConfigs.findIndex(config => config.key === targetStage);

    if (targetIndex < currentIndex) {
      // REMOVIDO: alert('Não é possível voltar etapas. Use os botões de ação para fazer alterações específicas.');
      setDraggedStage(null);
      return;
    }

    // Atualizar etapa
    await updateStage(draggedStage.id, targetStage);
    setDraggedStage(null);
  };

  const getStageConfig = (stageKey: string) => {
    return stageConfigs.find(config => config.key === stageKey) || stageConfigs[0];
  };

  const getNextStage = (currentStage: string) => {
    const currentIndex = stageConfigs.findIndex(config => config.key === currentStage);
    if (currentIndex < stageConfigs.length - 1) {
      return stageConfigs[currentIndex + 1];
    }
    return null;
  };

  const filteredStages = stages.filter(stage => {
    const matchesSearch = stage.opportunity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         stage.opportunity.company.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = stageFilter === 'todos' || stage.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00FF41]"></div>
      </div>
    );
  }

  const renderKanbanView = () => {
    const stageGroups = stageConfigs.map(config => ({
      ...config,
      stages: filteredStages.filter(stage => stage.stage === config.key)
    }));

    return (
      <div className="flex gap-6 overflow-x-auto pb-6" style={{ minHeight: 'calc(100vh - 300px)' }}>
        {stageGroups.map((group) => {
          const Icon = group.icon;
          const isDropTarget = dragOverColumn === group.key;
          
          return (
            <div
              key={group.key}
              className={`flex-shrink-0 w-80 bg-gray-50 rounded-xl border-2 transition-all duration-200 ${
                isDropTarget 
                  ? 'border-[#00FF41] bg-[#00FF41]/5 shadow-lg' 
                  : 'border-gray-200'
              }`}
              onDragOver={(e) => handleDragOver(e, group.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, group.key)}
            >
              {/* Column Header */}
              <div className={`p-4 border-b border-gray-200 ${group.bgColor} rounded-t-xl`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${group.color}`} />
                    <h3 className={`font-semibold ${group.color}`}>{group.label}</h3>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full bg-white ${group.color}`}>
                    {group.stages.length}
                  </span>
                </div>
                <p className={`text-sm mt-1 ${group.color} opacity-80`}>
                  {group.description}
                </p>
              </div>

              {/* Drop Zone */}
              {isDropTarget && (
                <div className="p-4 border-2 border-dashed border-[#00FF41] bg-[#00FF41]/10 m-2 rounded-lg">
                  <div className="text-center text-[#00FF41]">
                    <Package className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm font-medium">Solte aqui para mover</p>
                  </div>
                </div>
              )}

              {/* Stages List */}
              <div className="p-3 space-y-3 min-h-[200px]">
                {group.stages.map((stage) => (
                  <div
                    key={stage.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, stage)}
                    className={`bg-white rounded-lg border border-gray-200 p-4 cursor-move hover:shadow-md transition-all duration-200 ${
                      draggedStage?.id === stage.id ? 'opacity-50 scale-95' : ''
                    }`}
                  >
                    {/* Stage Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 text-sm leading-tight">
                          {stage.opportunity.title}
                        </h4>
                        <p className="text-xs text-gray-600 mt-1">
                          {stage.opportunity.company}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStage(stage);
                        }}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        <MoreVertical className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>

                    {/* Stage Details */}
                    <div className="space-y-2 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>Tipo:</span>
                        <span className="font-medium">{stage.opportunity.content_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Prazo:</span>
                        <span className="font-medium">{formatDate(stage.opportunity.deadline)}</span>
                      </div>
                      {stage.tracking_code && (
                        <div className="flex justify-between">
                          <span>Rastreio:</span>
                          <span className="font-medium text-[#00FF41] truncate max-w-20" title={stage.tracking_code}>
                            {stage.tracking_code}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Notes Preview */}
                    {stage.notes && (
                      <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-700 line-clamp-2">
                        {stage.notes}
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {new Date(stage.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-1">
                        {stage.stage === 'aguardando_envio' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowTrackingModal(stage.id);
                            }}
                            className="p-1 hover:bg-[#00FF41]/10 rounded transition-colors"
                            title="Adicionar código de rastreio"
                          >
                            <Truck className="h-3 w-3 text-[#00FF41]" />
                          </button>
                        )}
                        
                        {getNextStage(stage.stage) && stage.stage !== 'finalizado' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const nextStage = getNextStage(stage.stage);
                              if (nextStage) {
                                updateStage(stage.id, nextStage.key);
                              }
                            }}
                            disabled={updating === stage.id}
                            className="p-1 hover:bg-green-100 rounded transition-colors disabled:opacity-50"
                            title="Avançar etapa"
                          >
                            {updating === stage.id ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-green-600"></div>
                            ) : (
                              <Plus className="h-3 w-3 text-green-600" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Empty State */}
                {group.stages.length === 0 && !isDropTarget && (
                  <div className="text-center py-8 text-gray-400">
                    <Icon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma oportunidade</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderListView = () => {
    const filteredOpportunities = opportunitiesWithCreators.filter(opp => {
      const matchesSearch = opp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           opp.company.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });

    return (
      <div className="space-y-4">
        {filteredOpportunities.map((opportunity) => {
          const isExpanded = expandedOpportunities.has(opportunity.id);
          
          return (
            <div key={opportunity.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header da Oportunidade */}
              <div 
                className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleOpportunityExpansion(opportunity.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-600" />
                      )}
                    </button>
                    
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{opportunity.title}</h3>
                      <p className="text-gray-600">{opportunity.company}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Users className="h-4 w-4" />
                        <span className="font-medium">{opportunity.candidates_count || 0}</span>
                      </div>
                      <span className="text-xs text-gray-500">Candidatos</span>
                    </div>
                    
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-green-600">
                        <UserCheck className="h-4 w-4" />
                        <span className="font-medium">{opportunity.approved_count}</span>
                      </div>
                      <span className="text-xs text-gray-500">Aprovados</span>
                    </div>
                    
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-[#00FF41]">
                        <Package className="h-4 w-4" />
                        <span className="font-medium">{opportunity.creators.length}</span>
                      </div>
                      <span className="text-xs text-gray-500">Em Produção</span>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">{opportunity.content_type}</div>
                      <div className="text-xs text-gray-500">
                        Prazo: {formatDate(opportunity.deadline)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Lista de Criadores Expandida */}
              {isExpanded && (
                <div className="border-t border-gray-200 bg-gray-50">
                  {opportunity.creators.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      <User className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p>Nenhum criador em produção ainda</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {opportunity.creators.map((creator) => {
                        const config = getStageConfig(creator.stage);
                        const Icon = config.icon;
                        const nextStage = getNextStage(creator.stage);
                        
                        return (
                          <div key={creator.id} className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              {/* Info do Criador */}
                              <div className="flex items-center gap-4">
                                <button
                                  onClick={() => setSelectedCreatorProfile(creator.creator)}
                                  className="w-10 h-10 bg-gradient-to-br from-[#00FF41] to-[#00CC34] rounded-full flex items-center justify-center text-black text-sm font-bold hover:scale-105 transition-transform"
                                  title="Ver perfil completo"
                                >
                                  {creator.creator?.name?.charAt(0) || creator.creator?.email?.charAt(0).toUpperCase()}
                                </button>
                                <div>
                                  <button
                                    onClick={() => setSelectedCreatorProfile(creator.creator)}
                                    className="font-medium text-gray-900 hover:text-[#00FF41] transition-colors text-left"
                                  >
                                    {creator.creator?.name || 'Nome não informado'}
                                  </button>
                                  <p className="text-sm text-gray-600">{creator.creator?.email}</p>
                                  {creator.creator?.niche && (
                                    <span className="inline-block mt-1 px-2 py-1 bg-[#00FF41]/10 text-[#00FF41] rounded-full text-xs font-medium">
                                      {creator.creator.niche.charAt(0).toUpperCase() + creator.creator.niche.slice(1)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Etapa Atual */}
                              <div className="flex items-center gap-4">
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bgColor}`}>
                                  <Icon className={`h-4 w-4 ${config.color}`} />
                                  <span className={`text-sm font-medium ${config.color}`}>
                                    {config.label}
                                  </span>
                                </div>
                                
                                {/* Código de Rastreio */}
                                {creator.tracking_code && (
                                  <div className="text-sm">
                                    <span className="text-gray-600">Rastreio: </span>
                                    <span className="font-medium text-[#00FF41]">{creator.tracking_code}</span>
                                  </div>
                                )}
                                
                                {/* Ações */}
                                <div className="flex items-center gap-2">
                                  {creator.stage === 'aguardando_envio' && (
                                    <button
                                      onClick={() => setShowCreatorTrackingModal({
                                        stageId: creator.id,
                                        creatorId: creator.creator_id || '',
                                        trackingCode: '',
                                        notes: ''
                                      })}
                                      className="bg-[#00FF41] hover:bg-[#00CC34] text-black px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1"
                                    >
                                      <Truck className="h-3 w-3" />
                                      Rastreio
                                    </button>
                                  )}
                                  
                                  {nextStage && creator.stage !== 'finalizado' && (
                                    <button
                                      onClick={() => updateStage(creator.id, nextStage.key)}
                                      disabled={updating === creator.id}
                                      className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1"
                                    >
                                      {updating === creator.id ? (
                                        <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                                      ) : (
                                        <Plus className="h-3 w-3" />
                                      )}
                                      Avançar
                                    </button>
                                  )}
                                  
                                  <button
                                    onClick={() => setSelectedCreatorProfile(creator.creator)}
                                    className="bg-white/5 hover:bg-white/10 text-white border border-white/20 hover:border-[#00FF41]/30 px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1"
                                  >
                                    <Eye className="h-3 w-3" />
                                    Perfil
                                  </button>
                                </div>
                              </div>
                            </div>
                            
                            {/* Informações Adicionais do Criador */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-3">
                              {creator.creator?.location && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4" />
                                  <span>{creator.creator.location}</span>
                                </div>
                              )}
                              {creator.creator?.followers && (
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4" />
                                  <span>{creator.creator.followers} seguidores</span>
                                </div>
                              )}
                              {creator.creator?.website && (
                                <div className="flex items-center gap-2">
                                  <ExternalLink className="h-4 w-4" />
                                  <a
                                    href={creator.creator.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#00FF41] hover:text-[#00CC34] transition-colors"
                                  >
                                    Ver portfolio
                                  </a>
                                </div>
                              )}
                            </div>
                            
                            {/* Observações */}
                            {creator.notes && (
                              <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                                <p className="text-sm text-gray-700">{creator.notes}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        
        {/* Empty State */}
        {filteredOpportunities.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">Nenhuma oportunidade encontrada</h3>
            <p className="text-gray-600">
              Tente ajustar seus filtros de busca
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Fixed Sidebar with Filters */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Gerenciamento de Etapas</h1>
          <p className="text-gray-600 text-sm mt-1">Acompanhe o progresso das oportunidades</p>
        </div>

        {/* View Mode Toggle */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-[#00FF41] shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="h-4 w-4" />
              Lista
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-white text-[#00FF41] shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid3X3 className="h-4 w-4" />
              Kanban
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Pesquisar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar oportunidades..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Stage Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por Etapa</label>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent text-sm"
            >
              <option value="todos">Todas as etapas</option>
              {stageConfigs.map(config => (
                <option key={config.key} value={config.key}>{config.label}</option>
              ))}
            </select>
          </div>

          {/* Stage Legend */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Legenda das Etapas</label>
            <div className="space-y-2">
              {stageConfigs.map((config) => {
                const Icon = config.icon;
                const stageCount = stages.filter(s => s.stage === config.key).length;
                
                return (
                  <div key={config.key} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded ${config.bgColor}`}>
                        <Icon className={`h-3 w-3 ${config.color}`} />
                      </div>
                      <span className="text-xs font-medium text-gray-700">{config.label}</span>
                    </div>
                    <span className="text-xs text-gray-500">{stageCount}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Statistics */}
          <div className="pt-4 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-3">Estatísticas</label>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total de Oportunidades:</span>
                <span className="font-medium text-gray-900">{stages.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Em Andamento:</span>
                <span className="font-medium text-[#00FF41]">
                  {stages.filter(s => s.stage !== 'finalizado').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Finalizadas:</span>
                <span className="font-medium text-green-600">
                  {stages.filter(s => s.stage === 'finalizado').length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Content Header */}
        <div className="p-6 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {viewMode === 'kanban' ? 'Visualização Kanban' : 'Visualização em Lista'}
              </h2>
              <p className="text-sm text-gray-600">
                {filteredStages.length} de {stages.length} oportunidades
                {viewMode === 'kanban' && ' • Arraste para mover entre etapas'}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {viewMode === 'kanban' ? renderKanbanView() : renderListView()}

          {/* Empty State */}
          {viewMode === 'list' && opportunitiesWithCreators.length === 0 && (
            <div className="text-center py-12">
              <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                Nenhuma oportunidade em andamento
              </h3>
              <p className="text-gray-600">
                As oportunidades aprovadas aparecerão aqui para gerenciamento
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tracking Code Modal */}
      {showTrackingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Adicionar Código de Rastreio</h3>
              <button
                onClick={() => {
                  setShowTrackingModal(null);
                  setTrackingCode('');
                  setNotes('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código de Rastreio *
                </label>
                <input
                  type="text"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
                  placeholder="Ex: BR123456789BR"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
                  placeholder="Informações adicionais sobre o envio..."
                />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowTrackingModal(null);
                    setTrackingCode('');
                    setNotes('');
                  }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleTrackingSubmit(showTrackingModal)}
                  disabled={!trackingCode.trim()}
                  className="flex-1 bg-[#00FF41] hover:bg-[#00CC34] disabled:bg-[#00FF41]/40 text-black font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Creator Tracking Code Modal */}
      {showCreatorTrackingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Adicionar Código de Rastreio</h3>
              <button
                onClick={() => setShowCreatorTrackingModal(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código de Rastreio *
                </label>
                <input
                  type="text"
                  value={showCreatorTrackingModal.trackingCode}
                  onChange={(e) => setShowCreatorTrackingModal({
                    ...showCreatorTrackingModal,
                    trackingCode: e.target.value
                  })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
                  placeholder="Ex: BR123456789BR"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações (opcional)
                </label>
                <textarea
                  value={showCreatorTrackingModal.notes}
                  onChange={(e) => setShowCreatorTrackingModal({
                    ...showCreatorTrackingModal,
                    notes: e.target.value
                  })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
                  placeholder="Informações adicionais sobre o envio..."
                />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={() => setShowCreatorTrackingModal(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreatorTrackingSubmit}
                  disabled={!showCreatorTrackingModal.trackingCode.trim()}
                  className="flex-1 bg-[#00FF41] hover:bg-[#00CC34] disabled:bg-[#00FF41]/40 text-black font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stage Details Modal */}
      {selectedStage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Detalhes da Oportunidade</h2>
              <button
                onClick={() => setSelectedStage(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Opportunity Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{selectedStage.opportunity.title}</h3>
                <p className="text-gray-600">{selectedStage.opportunity.company}</p>
              </div>

              {/* Current Stage */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3">Etapa Atual</h4>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${getStageConfig(selectedStage.stage).bgColor}`}>
                  {React.createElement(getStageConfig(selectedStage.stage).icon, {
                    className: `h-5 w-5 ${getStageConfig(selectedStage.stage).color}`
                  })}
                  <span className={`font-medium ${getStageConfig(selectedStage.stage).color}`}>
                    {getStageConfig(selectedStage.stage).label}
                  </span>
                </div>
              </div>

              {/* Stage Timeline */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3">Linha do Tempo</h4>
                <div className="space-y-3">
                  {stageConfigs.map((config, index) => {
                    const isCompleted = stageConfigs.findIndex(s => s.key === selectedStage.stage) >= index;
                    const isCurrent = config.key === selectedStage.stage;
                    const StageIcon = config.icon;

                    return (
                      <div key={config.key} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isCompleted 
                            ? isCurrent 
                              ? config.bgColor 
                              : 'bg-green-100'
                            : 'bg-gray-100'
                        }`}>
                          <StageIcon className={`h-4 w-4 ${
                            isCompleted 
                              ? isCurrent 
                                ? config.color 
                                : 'text-green-600'
                              : 'text-gray-400'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${
                            isCompleted ? 'text-gray-900' : 'text-gray-500'
                          }`}>
                            {config.label}
                          </p>
                          <p className="text-xs text-gray-500">{config.description}</p>
                        </div>
                        {isCompleted && !isCurrent && (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Additional Info */}
              {(selectedStage.tracking_code || selectedStage.notes) && (
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Informações Adicionais</h4>
                  <div className="space-y-3">
                    {selectedStage.tracking_code && (
                      <div className="p-3 bg-[#00FF41]/5 rounded-lg">
                        <p className="text-sm font-medium text-gray-900">Código de Rastreio</p>
                        <p className="text-[#00FF41]">{selectedStage.tracking_code}</p>
                      </div>
                    )}
                    {selectedStage.notes && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-900">Observações</p>
                        <p className="text-gray-700">{selectedStage.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Creator Profile Modal */}
      {selectedCreatorProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Perfil do Criador</h2>
              <button
                onClick={() => setSelectedCreatorProfile(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Profile Header */}
              <div className="text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-[#00FF41] to-[#00CC34] rounded-full flex items-center justify-center text-black text-2xl font-bold mx-auto mb-4">
                  {selectedCreatorProfile.name?.charAt(0) || selectedCreatorProfile.email?.charAt(0).toUpperCase()}
                </div>
                <h3 className="text-2xl font-bold text-gray-900">{selectedCreatorProfile.name || 'Nome não informado'}</h3>
                <p className="text-gray-600">{selectedCreatorProfile.email}</p>
                {selectedCreatorProfile.niche && (
                  <span className="inline-block mt-2 px-3 py-1 bg-[#00FF41]/10 text-[#00FF41] rounded-full text-sm font-medium">
                    {selectedCreatorProfile.niche.charAt(0).toUpperCase() + selectedCreatorProfile.niche.slice(1)}
                  </span>
                )}
              </div>

              {/* Bio */}
              {selectedCreatorProfile.bio && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Sobre</h4>
                  <p className="text-gray-600 leading-relaxed">{selectedCreatorProfile.bio}</p>
                </div>
              )}

              {/* Details Grid */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Informações de Contato</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedCreatorProfile.location && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <MapPin className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Localização</p>
                        <p className="text-gray-600">{selectedCreatorProfile.location}</p>
                      </div>
                    </div>
                  )}

                  {selectedCreatorProfile.followers && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Users className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Seguidores</p>
                        <p className="text-gray-600">{selectedCreatorProfile.followers}</p>
                      </div>
                    </div>
                  )}

                  {selectedCreatorProfile.phone && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Phone className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Telefone</p>
                        <p className="text-gray-600">{selectedCreatorProfile.phone}</p>
                      </div>
                    </div>
                  )}

                  {selectedCreatorProfile.website && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Globe className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Website</p>
                        <a
                          href={selectedCreatorProfile.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#00FF41] hover:text-[#00CC34] transition-colors"
                        >
                          {selectedCreatorProfile.website}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Member Since */}
              <div className="flex items-center gap-3 p-3 bg-[#00FF41]/5 rounded-lg">
                <Calendar className="h-5 w-5 text-[#00FF41]" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Membro desde</p>
                  <p className="text-[#00FF41]">
                    {new Date(selectedCreatorProfile.created_at).toLocaleDateString('pt-BR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                {selectedCreatorProfile.phone && (
                  <button
                    onClick={() => {
                      if (!selectedCreatorProfile.phone) return;
                      // Limpar o número de telefone (remover caracteres não numéricos)
                      const cleanPhone = selectedCreatorProfile.phone.replace(/\D/g, '');
                      
                      // Adicionar código do país se não tiver
                      const phoneWithCountryCode = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
                      
                      // Mensagem personalizada
                      const message = `Olá ${selectedCreatorProfile.name || selectedCreatorProfile.email}! Sou ${analyst?.name || analyst?.email}. Gostaria de conversar sobre o projeto.`;
                      
                      // Criar URL do WhatsApp
                      const whatsappUrl = `https://wa.me/${phoneWithCountryCode}?text=${encodeURIComponent(message)}`;
                      
                      // Abrir WhatsApp
                      window.open(whatsappUrl, '_blank');
                    }}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                    </svg>
                    WhatsApp
                  </button>
                )}
                
                <button
                  onClick={() => window.open(`mailto:${selectedCreatorProfile.email}`, '_blank')}
                  className="flex-1 bg-[#00FF41] hover:bg-[#00CC34] text-black px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Mail className="h-4 w-4" />
                  Email
                </button>
                
                {selectedCreatorProfile.website && (
                  <button
                    onClick={() => window.open(selectedCreatorProfile.website, '_blank')}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/20 hover:border-[#00FF41]/30 px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Portfolio
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpportunityStagesManagement;