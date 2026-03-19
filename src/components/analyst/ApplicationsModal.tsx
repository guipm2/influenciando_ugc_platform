import React, { useState, useEffect, useCallback } from 'react';
import { X, Users, Check, XIcon, ExternalLink, MapPin, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAnalystAuth } from '../../contexts/AnalystAuthContext';
import { getInitial } from '../../utils/formatters';
import ModalPortal from '../common/ModalPortal';

interface Application {
  id: string;
  creator_id: string;
  status: 'pending' | 'approved' | 'rejected';
  message: string;
  applied_at: string;
  creator: {
    name: string;
    email: string;
    bio: string;
    location: string;
    niche?: string;
    niches?: string[];
    followers: string;
    website: string;
    avatar_url: string;
  };
}

interface ApplicationsModalProps {
  opportunityId: string;
  opportunityTitle: string;
  onClose: () => void;
  onOpportunityStatusChange?: (opportunityId: string, status: string) => void;
  onCandidatesCountChange?: (opportunityId: string, count: number) => void;
}

const ApplicationsModal: React.FC<ApplicationsModalProps> = ({
  opportunityId,
  opportunityTitle,
  onClose,
  onOpportunityStatusChange,
  onCandidatesCountChange
}) => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { analyst } = useAnalystAuth();

  const openCreatorProfile = (creatorId: string) => {
    if (typeof window === 'undefined' || !creatorId) return;
    const baseUrl = window.location.origin;
    const profileUrl = `${baseUrl}/analysts/creators/${creatorId}`;
    window.open(profileUrl, '_blank', 'noopener,noreferrer');
  };

  const normalizeApplication = useCallback((raw: Record<string, unknown>): Application => {
    const creatorRaw = raw.creator;
    const parsedCreator = (Array.isArray(creatorRaw) ? creatorRaw[0] : creatorRaw) as Record<string, unknown> | undefined;
    const getString = (source: Record<string, unknown> | undefined, key: string, fallback = ''): string => {
      const value = source?.[key];
      return typeof value === 'string' ? value : fallback;
    };
    const getStringArray = (source: Record<string, unknown> | undefined, key: string): string[] => {
      const value = source?.[key];
      if (Array.isArray(value)) {
        return value
          .map((item) => (typeof item === 'string' ? item : String(item ?? '')).trim())
          .filter((item) => item.length > 0);
      }
      return [];
    };

    const niches = getStringArray(parsedCreator, 'niches');
    const primaryNiche = (() => {
      const legacyNiche = getString(parsedCreator, 'niche');
      if (legacyNiche) {
        return legacyNiche;
      }
      return niches[0] ?? '';
    })();

    return {
      id: String(raw.id),
      creator_id: String(raw.creator_id),
      status: (raw.status as Application['status']) ?? 'pending',
      message: typeof raw.message === 'string' ? raw.message : '',
      applied_at: String(raw.applied_at ?? new Date().toISOString()),
      creator: {
        name: (() => {
          const value = getString(parsedCreator, 'name');
          return value.trim().length > 0 ? value : 'Nome não informado';
        })(),
        email: getString(parsedCreator, 'email', 'Email não informado'),
        bio: getString(parsedCreator, 'bio'),
        location: getString(parsedCreator, 'location'),
        niche: primaryNiche,
        niches,
        followers: getString(parsedCreator, 'followers'),
        website: getString(parsedCreator, 'website'),
        avatar_url: getString(parsedCreator, 'avatar_url')
      }
    };
  }, []);

  const fetchApplications = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    setErrorMessage(null);
    try {
      const { data, error } = await supabase
        .from('opportunity_applications')
        .select(`
          id,
          creator_id,
          status,
          message,
          applied_at,
          creator:profiles!opportunity_applications_creator_id_fkey (
            name,
            email,
            bio,
            location,
            niches,
            followers,
            website,
            avatar_url
          )
        `)
        .eq('opportunity_id', opportunityId)
        .order('applied_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar candidaturas:', error);
        setErrorMessage('Não foi possível carregar as candidaturas desta oportunidade.');
        setApplications([]);
        onCandidatesCountChange?.(opportunityId, 0);
      } else {
        const normalized = (data || []).map(normalizeApplication);
        setApplications(normalized);
        onCandidatesCountChange?.(opportunityId, normalized.length);
      }
    } catch (err) {
      console.error('Erro ao buscar candidaturas:', err);
      setErrorMessage('Ocorreu um erro inesperado ao carregar as candidaturas.');
      setApplications([]);
      onCandidatesCountChange?.(opportunityId, 0);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [normalizeApplication, onCandidatesCountChange, opportunityId]);

  useEffect(() => {
    void fetchApplications();
  }, [fetchApplications]);

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchApplications({ silent: true });
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchApplications]);

  const updateApplicationStatus = async (applicationId: string, status: 'approved' | 'rejected') => {
    setUpdating(applicationId);

    try {
      // Get the application details before updating
      const application = applications.find(app => app.id === applicationId);
      if (!application) {
        console.error('Application not found');
        return;
      }

      const { error } = await supabase
        .from('opportunity_applications')
        .update({
          status,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      if (error) {
        console.error('Erro ao atualizar candidatura:', error);
        // REMOVIDO: alert('Erro ao atualizar candidatura');
      } else {
        // If approved, create a conversation for the project
        if (status === 'approved') {
          await createProjectConversation(opportunityId, application.creator_id);
          const now = new Date().toISOString();
          const { error: opportunityError } = await supabase
            .from('opportunities')
            .update({
              status: 'encerrado',
              updated_at: now
            })
            .eq('id', opportunityId);

          if (opportunityError) {
            console.error('Erro ao encerrar oportunidade após aprovação:', opportunityError);
          } else if (onOpportunityStatusChange) {
            onOpportunityStatusChange(opportunityId, 'encerrado');
          }
        }

        await fetchApplications({ silent: true });
        // REMOVIDO: alert(`Candidatura ${status === 'approved' ? 'aprovada' : 'rejeitada'} com sucesso! O criador será notificado.`);
      }
    } catch (err) {
      console.error('Erro ao atualizar candidatura:', err);
      // REMOVIDO: alert('Erro ao atualizar candidatura');
    } finally {
      setUpdating(null);
    }
  };

  const createProjectConversation = async (opportunityId: string, creatorId: string) => {
    try {
      // Check if conversation already exists for this project and creator
      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('opportunity_id', opportunityId)
        .eq('creator_id', creatorId)
        .maybeSingle();

      if (existingConversation) {
        console.log('Conversation already exists for this project');
        return;
      }

      // Create new project conversation
      const { error: conversationError } = await supabase
        .from('conversations')
        .insert({
          opportunity_id: opportunityId,
          analyst_id: analyst?.id,
          creator_id: creatorId,
          last_message_at: new Date().toISOString()
        });

      if (conversationError) {
        console.error('Erro ao criar conversa do projeto:', conversationError);
      } else {
        console.log('Conversa do projeto criada com sucesso');
      }
    } catch (error) {
      console.error('Erro ao criar conversa do projeto:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Aprovada</span>;
      case 'rejected':
        return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">Rejeitada</span>;
      default:
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">Pendente</span>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
        <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Candidaturas</h2>
            <p className="text-gray-600 mt-1">{opportunityTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00FF41]"></div>
            </div>
          ) : errorMessage ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-14 w-14 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Erro ao carregar candidaturas</h3>
              <p className="text-gray-600 mb-6">{errorMessage}</p>
              <button
                onClick={() => {
                  setLoading(true);
                  void fetchApplications();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#00FF41] hover:bg-[#00CC34] text-white rounded-lg transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">Nenhuma candidatura ainda</h3>
              <p className="text-gray-600">Aguarde criadores se candidatarem para esta oportunidade</p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {applications.map((application) => (
                <div
                  key={application.id}
                  className="bg-gray-50 rounded-lg p-6 border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#00FF41] to-[#00CC34] rounded-full flex items-center justify-center text-white text-lg font-bold">
                        {getInitial(application.creator.name, application.creator.email)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {application.creator.name || 'Nome não informado'}
                        </h3>
                        <p className="text-gray-600 text-sm">{application.creator.email}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Candidatou-se em {formatDate(application.applied_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openCreatorProfile(application.creator_id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#00FF41] border border-[#00FF41]/30 rounded-lg hover:bg-[#00FF41]/10 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Ver perfil
                      </button>
                      {getStatusBadge(application.status)}
                    </div>
                  </div>

                  {/* Creator Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {application.creator.bio && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-gray-600">{application.creator.bio}</p>
                      </div>
                    )}
                    
                    {application.creator.niches && application.creator.niches.length > 0 ? (
                      <div className="md:col-span-2 flex items-start gap-2 text-sm text-gray-600">
                        <span className="font-medium mt-1">Nichos:</span>
                        <div className="flex flex-wrap gap-2">
                          {application.creator.niches.map((niche) => (
                            <span
                              key={niche}
                              className="px-2 py-1 bg-[#00FF41]/10 text-[#00FF41] rounded-full text-xs"
                            >
                              {niche}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : application.creator.niche ? (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="font-medium">Nicho:</span>
                        <span className="px-2 py-1 bg-[#00FF41]/10 text-[#00FF41] rounded-full text-xs">
                          {application.creator.niche.charAt(0).toUpperCase() + application.creator.niche.slice(1)}
                        </span>
                      </div>
                    ) : null}
                    
                    {application.creator.location && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="h-4 w-4" />
                        {application.creator.location}
                      </div>
                    )}
                    
                    {application.creator.followers && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users className="h-4 w-4" />
                        {application.creator.followers} seguidores
                      </div>
                    )}
                    
                    {application.creator.website && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <ExternalLink className="h-4 w-4" />
                        <a
                          href={application.creator.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#00FF41] hover:text-[#00FF41]"
                        >
                          Ver portfolio
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Application Message */}
                  {application.message && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-900 mb-2">Mensagem:</p>
                      <p className="text-sm text-gray-600 bg-white p-3 rounded border">
                        {application.message}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  {application.status === 'pending' && (
                    <div className="flex items-center justify-end space-x-3">
                      <button
                        onClick={() => updateApplicationStatus(application.id, 'rejected')}
                        disabled={updating === application.id}
                        className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {updating === application.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        ) : (
                          <XIcon className="h-4 w-4" />
                        )}
                        Rejeitar
                      </button>
                      <button
                        onClick={() => updateApplicationStatus(application.id, 'approved')}
                        disabled={updating === application.id}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {updating === application.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        Aprovar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </ModalPortal>
  );
};

export default ApplicationsModal;