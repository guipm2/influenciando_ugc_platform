import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MessageCircle, Search, MoreVertical, Send, ArrowLeft, ExternalLink, AlertTriangle, Trash2, PencilLine, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAnalystAuth } from '../../contexts/AnalystAuthContext';
import { useRouter } from '../../hooks/useRouter';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useTabVisibility } from '../../hooks/useTabVisibility';

// Unified conversation - one per analyst-creator pair
interface UnifiedConversation {
  id: string;
  analyst_id: string;
  creator_id: string;
  last_message_at: string;
  created_at: string;
  creator: {
    name: string;
    email: string;
  };
  // All projects between this analyst and creator
  projects: {
    id: string;
    opportunity_id: string;
    opportunity_title: string;
    opportunity_company: string;
    status: 'active' | 'completed' | 'paused';
    started_at: string;
  }[];
  lastMessage?: {
    content: string;
    sender_type: string;
    created_at: string;
    project_context?: string; // Which project this message is about
  };
  unread_count: number;
  custom_title?: string | null;
  tags?: string[] | null;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: 'analyst' | 'creator';
  content: string;
  read: boolean;
  created_at: string;
  message_type: 'general' | 'project' | 'system';
  project_context?: string; // opportunity_id if message is about specific project
  project_title?: string; // For display purposes
}

interface ConversationQueryResult {
  id: string;
  analyst_id: string;
  creator_id: string;
  created_at: string;
  last_message_at: string;
  custom_title: string | null;
  tags: string[] | null;
  creator: {
    name: string;
    email: string;
  };
  messages: {
    content: string;
    sender_type: 'analyst' | 'creator';
    created_at: string;
    message_type: 'general' | 'project' | 'system';
    project_context?: string;
  }[];
}

interface AnalystMessagesProps {
  selectedConversationId?: string | null;
  onBackToList?: () => void;
}

const AnalystMessages: React.FC<AnalystMessagesProps> = ({ 
  selectedConversationId 
}) => {
  const { analyst } = useAnalystAuth();
  const { navigate } = useRouter();
  const [conversations, setConversations] = useState<UnifiedConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<UnifiedConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);
  const [isEditingChatDetails, setIsEditingChatDetails] = useState(false);
  const [chatTitleInput, setChatTitleInput] = useState('');
  const [chatTagsInput, setChatTagsInput] = useState('');
  const [savingChatDetails, setSavingChatDetails] = useState(false);
  const [chatDetailsStatus, setChatDetailsStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch unified conversations
  const fetchConversations = useCallback(async () => {
    if (!analyst) return;

    try {
      // Step 1: Get all unique analyst-creator pairs who have conversations
      const { data: conversationData, error: convError } = await supabase
        .from('conversations')
        .select(`
          id,
          analyst_id,
          creator_id,
          created_at,
          last_message_at,
          custom_title,
          tags,
          creator:profiles!creator_id (
            name,
            email
          ),
          messages (
            content,
            sender_type,
            created_at,
            message_type,
            project_context
          )
        `)
        .eq('analyst_id', analyst.id)
        .order('created_at', { foreignTable: 'messages', ascending: false })
        .limit(1, { foreignTable: 'messages' })
        .order('last_message_at', { ascending: false });

      if (convError) {
        console.error('Erro ao buscar conversas:', convError);
        return;
      }

      // Step 2: Group conversations by creator and collect all conversation IDs
      const creatorConversations = new Map();
      const allConversationsByCreator = new Map();
      
      const typedConversationData = (conversationData || []) as unknown as ConversationQueryResult[];

      for (const conv of typedConversationData) {
        const lastMessage = conv.messages?.[0];

        if (!creatorConversations.has(conv.creator_id)) {
          creatorConversations.set(conv.creator_id, {
            id: conv.id, // Use the first conversation ID as the unified conversation ID
            analyst_id: conv.analyst_id,
            creator_id: conv.creator_id,
            creator: conv.creator,
            created_at: conv.created_at,
            last_message_at: conv.last_message_at,
            projects: [],
            unread_count: 0,
            custom_title: conv.custom_title,
            tags: conv.tags,
            lastMessage: lastMessage
          });
          allConversationsByCreator.set(conv.creator_id, []);
        } else {
          // Update last_message_at if this conversation is more recent
          const existing = creatorConversations.get(conv.creator_id);
          const existingDate = existing.last_message_at ? new Date(existing.last_message_at) : null;
          const currentDate = conv.last_message_at ? new Date(conv.last_message_at) : null;

          if (currentDate && (!existingDate || currentDate > existingDate)) {
            existing.id = conv.id;
            existing.last_message_at = conv.last_message_at;
            existing.custom_title = conv.custom_title;
            existing.tags = conv.tags;
          }

          // Update lastMessage if the one from this conversation is more recent
          if (lastMessage) {
            if (!existing.lastMessage || new Date(lastMessage.created_at) > new Date(existing.lastMessage.created_at)) {
              existing.lastMessage = lastMessage;
            }
          }
        }
        
        // Add conversation ID to the creator's list
        allConversationsByCreator.get(conv.creator_id).push(conv.id);
      }

      // Step 3: Get all projects (opportunity_applications) for each creator
      const creatorIds = Array.from(creatorConversations.keys());

      const { data: allApplications } = await supabase
        .from('opportunity_applications')
        .select(`
          id,
          opportunity_id,
          status,
          applied_at,
          creator_id,
          opportunity:opportunities (
            id,
            title,
            company,
            analyst_id
          )
        `)
        .in('creator_id', creatorIds)
        .eq('status', 'approved');

      // Filter applications where opportunity belongs to this analyst
      const relevantApplications = (allApplications || []).filter((app) => {
        const opp = Array.isArray(app.opportunity) ? app.opportunity[0] : app.opportunity;
        return opp && opp.analyst_id === analyst.id;
      });

      // Group applications by creator_id
      const applicationsByCreator = new Map();
      relevantApplications.forEach((app) => {
        if (!applicationsByCreator.has(app.creator_id)) {
          applicationsByCreator.set(app.creator_id, []);
        }
        applicationsByCreator.get(app.creator_id).push(app);
      });

      const unifiedConversations = await Promise.all(
        Array.from(creatorConversations.values()).map(async (conv) => {
          const creatorApps = applicationsByCreator.get(conv.creator_id) || [];

          const formattedProjects = creatorApps
            .map((app) => {
              const opp = Array.isArray(app.opportunity) ? app.opportunity[0] : app.opportunity;
              if (!opp) return null;

              return {
                id: app.id,
                opportunity_id: app.opportunity_id,
                opportunity_title: opp.title,
                opportunity_company: opp.company,
                status: 'active' as const,
                started_at: app.applied_at
              };
            })
            .filter((p): p is NonNullable<typeof p> => p !== null);

          // Get last message across all conversations with this creator
          const lastMessage = conv.lastMessage;

          return {
            ...conv,
            projects: formattedProjects,
            lastMessage: lastMessage ? {
              content: lastMessage.content,
              sender_type: lastMessage.sender_type,
              created_at: lastMessage.created_at,
              project_context: lastMessage.project_context
            } : undefined,
            custom_title: conv.custom_title || null,
            tags: (conv.tags || []) as string[]
          };
        })
      );

      setConversations(unifiedConversations);
    } catch (err) {
      console.error('Erro ao buscar conversas:', err);
    } finally {
      setLoading(false);
    }
  }, [analyst]);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar mensagens:', error);
        return;
      }

      setMessages(data || []);
    } catch (err) {
      console.error('Erro ao buscar mensagens:', err);
    }
  }, []);

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !analyst) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: analyst.id,
          sender_type: 'analyst',
          content: newMessage.trim(),
          read: true,
          message_type: 'general'
        });

      if (error) {
        console.error('Erro ao enviar mensagem:', error);
        return;
      }

      setNewMessage('');
      await fetchMessages(selectedConversation.id);
      await fetchConversations();
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    }
  };

  const getChatDisplayTitle = (conversation: UnifiedConversation) => {
    if (conversation.custom_title && conversation.custom_title.trim().length > 0) {
      return conversation.custom_title.trim();
    }

    if (conversation.creator?.name) {
      return conversation.creator.name;
    }

    if (conversation.projects.length > 0) {
      return conversation.projects[0].opportunity_title;
    }

    return conversation.creator?.email || 'Chat';
  };

  const parseTagsInput = (value: string) => {
    return Array.from(
      new Set(
        value
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      )
    ).slice(0, 10);
  };

  const handleSaveChatDetails = async () => {
    if (!selectedConversation || savingChatDetails) {
      return;
    }

    const conversationId = selectedConversation.id;
    const trimmedTitle = chatTitleInput.trim();
    const tagsArray = parseTagsInput(chatTagsInput);

    try {
      setSavingChatDetails(true);
      setChatDetailsStatus(null);

      const { error } = await supabase
        .from('conversations')
        .update({
          custom_title: trimmedTitle.length > 0 ? trimmedTitle : null,
          tags: tagsArray
        })
        .eq('id', conversationId);

      if (error) {
        throw error;
      }

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId
            ? { ...conv, custom_title: trimmedTitle || null, tags: tagsArray }
            : conv
        )
      );

      setSelectedConversation((prev) =>
        prev
          ? { ...prev, custom_title: trimmedTitle || null, tags: tagsArray }
          : prev
      );

      setIsEditingChatDetails(false);
      setChatDetailsStatus({ type: 'success', message: 'Detalhes do chat atualizados com sucesso.' });
    } catch (error) {
      console.error('Erro ao atualizar detalhes do chat:', error);
      setChatDetailsStatus({ type: 'error', message: 'Não foi possível salvar as alterações. Tente novamente.' });
    } finally {
      setSavingChatDetails(false);
    }
  };

  const handleCancelChatDetails = () => {
    if (selectedConversation) {
      setChatTitleInput(selectedConversation.custom_title || '');
      setChatTagsInput(Array.isArray(selectedConversation.tags) ? selectedConversation.tags.join(', ') : '');
    } else {
      setChatTitleInput('');
      setChatTagsInput('');
    }

    setChatDetailsStatus(null);
    setIsEditingChatDetails(false);
  };

  const deleteConversation = async () => {
    if (!selectedConversation) {
      return;
    }

    try {
      setDeletingChat(true);
      setChatDetailsStatus(null);

      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', selectedConversation.id);

      if (error) {
        throw error;
      }

      setConversations((prev) => prev.filter((conv) => conv.id !== selectedConversation.id));
      setSelectedConversation(null);
      setMessages([]);
      setShowDeleteConfirm(false);
      await fetchConversations();
    } catch (error) {
      console.error('Erro ao deletar conversa:', error);
      setChatDetailsStatus({ type: 'error', message: 'Não foi possível apagar o chat. Tente novamente.' });
    } finally {
      setDeletingChat(false);
    }
  };

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'agora';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h`;
    } else {
      return date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit' 
      });
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter(conv => {
    const searchTermLower = searchTerm.toLowerCase();
    return (
      conv.creator?.name?.toLowerCase().includes(searchTermLower) ||
      conv.creator?.email?.toLowerCase().includes(searchTermLower) ||
      conv.custom_title?.toLowerCase().includes(searchTermLower) ||
      (Array.isArray(conv.tags) && conv.tags.some((tag) => tag.toLowerCase().includes(searchTermLower))) ||
      conv.projects.some(project => 
        project.opportunity_title.toLowerCase().includes(searchTermLower) ||
        project.opportunity_company.toLowerCase().includes(searchTermLower)
      ) ||
      conv.lastMessage?.content?.toLowerCase().includes(searchTermLower)
    );
  });

  // Effects
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useAutoRefresh(fetchConversations, 20000, Boolean(analyst));

  // Recarregar quando a aba voltar a ficar visível
  useTabVisibility(() => {
    console.log('🔄 [ANALYST MESSAGES] Recarregando conversas após aba voltar a ficar visível');
    fetchConversations();
    if (selectedConversation?.id) {
      fetchMessages(selectedConversation.id);
    }
  });

  useEffect(() => {
    if (selectedConversationId) {
      const conversation = conversations.find(c => c.id === selectedConversationId);
      if (conversation) {
        setSelectedConversation(conversation);
        fetchMessages(conversation.id);
      }
    }
  }, [selectedConversationId, conversations, fetchMessages]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation, fetchMessages]);

  useAutoRefresh(
    () => {
      if (selectedConversation?.id) {
        return fetchMessages(selectedConversation.id);
      }
      return undefined;
    },
    12000,
    Boolean(selectedConversation?.id)
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (selectedConversation) {
      setChatTitleInput(selectedConversation.custom_title || '');
      setChatTagsInput(Array.isArray(selectedConversation.tags) ? selectedConversation.tags.join(', ') : '');
      setIsEditingChatDetails(false);
      setChatDetailsStatus(null);
    } else {
      setChatTitleInput('');
      setChatTagsInput('');
      setIsEditingChatDetails(false);
      setChatDetailsStatus(null);
    }
  }, [selectedConversation]);

  useEffect(() => {
    if (!chatDetailsStatus) return;

    const timeout = window.setTimeout(() => setChatDetailsStatus(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [chatDetailsStatus]);

  useEffect(() => {
    setShowDeleteConfirm(false);
  }, [selectedConversation]);

  const activeProject = useMemo(() => {
    if (!selectedConversation || selectedConversation.projects.length === 0) {
      return null;
    }

    const lastProjectMessage = [...messages]
      .reverse()
      .find((message) => message.project_context);

    if (lastProjectMessage) {
      const matchedProject = selectedConversation.projects.find(
        (project) => project.opportunity_id === lastProjectMessage.project_context
      );

      if (matchedProject) {
        return matchedProject;
      }
    }

    return selectedConversation.projects[0];
  }, [selectedConversation, messages]);

  const chatTitle = selectedConversation ? getChatDisplayTitle(selectedConversation) : '';
  const chatTags = selectedConversation ? (Array.isArray(selectedConversation.tags) ? selectedConversation.tags : []) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00FF41]"></div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-50">
      {/* Conversations List */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Mensagens</h2>
            <button className="p-2 text-gray-400 hover:text-gray-600">
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar conversas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00FF41]"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <MessageCircle className="h-12 w-12 mb-4" />
              <p className="text-center px-4">
                Nenhuma conversa encontrada
              </p>
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const displayTitle = getChatDisplayTitle(conversation);
              const tags = Array.isArray(conversation.tags) ? conversation.tags : [];

              return (
                <div
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                    selectedConversation?.id === conversation.id ? 'bg-[#00FF41]/10' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-[#00FF41]/10 rounded-full flex items-center justify-center">
                      <span className="text-[#00FF41] font-medium text-sm">
                        {conversation.creator?.name?.[0] || 'U'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {displayTitle}
                        </h3>
                        {conversation.lastMessage && (
                          <span className="text-xs text-gray-500">
                            {formatTime(conversation.lastMessage.created_at)}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 mt-1">
                        {conversation.creator?.name || 'Usuário'} • {conversation.creator?.email || 'sem e-mail'}
                      </p>

                      {tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center rounded-full bg-[#00FF41]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#00FF41]"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Project titles */}
                      {conversation.projects.length > 0 && (
                        <div className="mt-2">
                          {conversation.projects.slice(0, 2).map((project) => (
                            <p key={project.id} className="text-xs text-[#00FF41] font-medium truncate">
                              📁 {project.opportunity_title}
                            </p>
                          ))}
                          {conversation.projects.length > 2 && (
                            <p className="text-xs text-gray-500">
                              +{conversation.projects.length - 2} outros projetos
                            </p>
                          )}
                        </div>
                      )}

                      {/* Last message preview */}
                      {conversation.lastMessage && (
                        <p className="text-xs text-gray-600 truncate mt-2">
                          {conversation.lastMessage.sender_type === 'analyst' ? 'Você: ' : ''}
                          {conversation.lastMessage.content}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Messages View */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="bg-white border-b border-gray-200 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 lg:hidden"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="w-10 h-10 bg-[#00FF41]/10 rounded-full flex items-center justify-center">
                  <span className="text-[#00FF41] font-medium text-sm">
                    {selectedConversation.creator?.name?.[0] || 'U'}
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">{chatTitle || 'Chat'}</h3>
                  <p className="text-sm text-gray-500">
                    {selectedConversation.creator?.name || 'Usuário'} • {selectedConversation.creator?.email || 'sem e-mail'}
                  </p>
                  {selectedConversation.projects.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      {selectedConversation.projects.length} projeto(s) ativo(s)
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeProject && (
                  <button
                    onClick={() => navigate(`/analysts/projects/${activeProject.id}`)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#00FF41] px-4 py-2 text-black transition-colors hover:bg-[#00CC34]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Ver Projeto</span>
                  </button>
                )}
                <button
                  onClick={() => setIsEditingChatDetails((prev) => !prev)}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-900"
                >
                  <PencilLine className="h-4 w-4" />
                  <span>{isEditingChatDetails ? 'Fechar edição' : 'Editar detalhes'}</span>
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-red-600 transition-colors hover:border-red-400 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Apagar chat</span>
                </button>
              </div>
            </div>

            {chatTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {chatTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-[#00FF41]/10 px-3 py-1 text-xs font-medium text-[#00FF41]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {chatDetailsStatus && (
            <div
              className={`mx-4 mt-4 rounded-lg border px-4 py-3 text-sm ${
                chatDetailsStatus.type === 'success'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {chatDetailsStatus.message}
            </div>
          )}

          {isEditingChatDetails && (
            <div className="mx-4 mt-4 rounded-xl border border-gray-200 bg-white p-4">
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Título personalizado</label>
                  <input
                    type="text"
                    value={chatTitleInput}
                    onChange={(event) => setChatTitleInput(event.target.value)}
                    placeholder="Defina um nome descritivo para este chat"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#00FF41] focus:ring-2 focus:ring-[#00FF41]"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Deixe em branco para usar o nome do criador ou do projeto automaticamente.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tags (separadas por vírgula)</label>
                  <input
                    type="text"
                    value={chatTagsInput}
                    onChange={(event) => setChatTagsInput(event.target.value)}
                    placeholder="ex: briefing, revisão, contrato"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#00FF41] focus:ring-2 focus:ring-[#00FF41]"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Máximo de 10 tags. Utilize palavras-chave curtas para categorizar o chat.
                  </p>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCancelChatDetails}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveChatDetails}
                    disabled={savingChatDetails}
                    className="flex items-center gap-2 rounded-lg bg-[#00FF41] px-4 py-2 text-black transition-colors hover:bg-[#00CC34] disabled:cursor-not-allowed disabled:bg-[#00CC34]"
                  >
                    {savingChatDetails ? (
                      <span className="h-5 w-5 animate-spin rounded-full border-b-2 border-white"></span>
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    <span>Salvar alterações</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender_type === 'analyst' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.sender_type === 'analyst'
                      ? 'bg-[#00FF41] text-black'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {/* Project context indicator */}
                  {message.project_context && (
                    <p className={`text-xs mb-1 opacity-75 ${
                      message.sender_type === 'analyst' ? 'text-purple-100' : 'text-gray-500'
                    }`}>
                      📁 {message.project_title || 'Projeto'}
                    </p>
                  )}
                  
                  <p>{message.content}</p>
                  
                  <p
                    className={`text-xs mt-1 ${
                      message.sender_type === 'analyst' ? 'text-purple-100' : 'text-gray-500'
                    }`}
                  >
                    {new Date(message.created_at).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="bg-white border-t border-gray-200 p-4">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00FF41]"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className="px-4 py-2 bg-[#00FF41] text-black rounded-lg hover:bg-[#00CC34] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>

          {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Confirmar exclusão</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Ao apagar este chat todas as mensagens serão removidas permanentemente para você e para o criador. Essa ação não pode ser desfeita.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900"
                    disabled={deletingChat}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={deleteConversation}
                    disabled={deletingChat}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
                  >
                    {deletingChat ? (
                      <span className="h-5 w-5 animate-spin rounded-full border-b-2 border-white"></span>
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    <span>Apagar chat</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center text-gray-500">
            <MessageCircle className="h-16 w-16 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Selecione uma conversa</h3>
            <p>Escolha uma conversa para começar a trocar mensagens</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalystMessages;