import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, MapPin, Users, ExternalLink, Grid3X3, List, X, Phone, Calendar, Globe, MessageCircle, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAnalystAuth } from '../../contexts/AnalystAuthContext';
import { getInitial } from '../../utils/formatters';
import { useTabVisibility } from '../../hooks/useTabVisibility';
import ModalPortal from '../common/ModalPortal';

interface Creator {
  id: string;
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
}

interface CreatorsListProps {
  onOpenConversation?: (conversationId: string) => void;
}

const CreatorsList: React.FC<CreatorsListProps> = ({ onOpenConversation }) => {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [nicheFilter, setNicheFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
  const [contactingCreator, setContactingCreator] = useState<string | null>(null);
  const [showContactModal, setShowContactModal] = useState<string | null>(null);
  const { profile: analyst } = useAnalystAuth();

  const fetchCreators = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'creator')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar criadores:', error);
      } else {
        setCreators(data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar criadores:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCreators();
  }, [fetchCreators]);

  // Recarregar silenciosamente quando a aba voltar a ficar visível
  useTabVisibility(() => {
    fetchCreators();
  });

  const filteredCreators = creators.filter(creator => {
    const matchesSearch = creator.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         creator.bio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         creator.location?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesNiche = nicheFilter === '' || creator.niche === nicheFilter;
    return matchesSearch && matchesNiche;
  });

  const niches = [...new Set(creators.map(creator => creator.niche).filter(Boolean))];

  const openWhatsApp = (phone: string, name: string) => {
    // Limpar o número de telefone (remover caracteres não numéricos)
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Adicionar código do país se não tiver
    const phoneWithCountryCode = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    
    // Mensagem personalizada
    const message = `Olá ${name}! Sou ${analyst?.name || analyst?.email}. Vi seu perfil na plataforma e gostaria de conversar sobre uma possível parceria.`;
    
    // Criar URL do WhatsApp
    const whatsappUrl = `https://wa.me/${phoneWithCountryCode}?text=${encodeURIComponent(message)}`;
    
    // Abrir WhatsApp
    window.open(whatsappUrl, '_blank');
  };

  const handleCreateConversation = async (creatorId: string) => {
    if (!analyst) return;
    
    setContactingCreator(creatorId);
    
    try {
      // Buscar conversa única entre este analista e criador (independente de projeto/oportunidade)
      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('analyst_id', analyst.id)
        .eq('creator_id', creatorId)
        .maybeSingle();

      if (existingConversation) {
        // Redirecionar para conversa existente única
        if (onOpenConversation) {
          onOpenConversation(existingConversation.id);
        }
        setShowContactModal(null);
        setContactingCreator(null);
        return;
      }

      // Criar conversa única entre analista e criador (não vinculada a projeto específico)
      const { data: newConversation, error } = await supabase
        .from('conversations')
        .insert({
          analyst_id: analyst.id,
          creator_id: creatorId,
          opportunity_id: null, // Conversa geral entre analista e criador
          last_message_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.error('Erro ao criar conversa única:', error);
        // REMOVIDO: alert('Erro ao criar conversa. Tente novamente.');
      } else {
        // Redirecionar para nova conversa única
        if (onOpenConversation && newConversation) {
          onOpenConversation(newConversation.id);
        }
        setShowContactModal(null);
      }
    } catch (err) {
      console.error('Erro ao criar conversa única:', err);
      // REMOVIDO: alert('Erro ao criar conversa. Tente novamente.');
    } finally {
      setContactingCreator(null);
    }
  };

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
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Criadores de Conteúdo</h1>
        <p className="text-gray-600 mt-1">{creators.length} criadores cadastrados na plataforma</p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar criadores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-[#00FF41] shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-[#00FF41] shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          
          <select
            value={nicheFilter}
            onChange={(e) => setNicheFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
          >
            <option value="">Todos os nichos</option>
            {niches.map(niche => (
              <option key={niche} value={niche}>
                {niche.charAt(0).toUpperCase() + niche.slice(1)}
              </option>
            ))}
          </select>
          
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Filter className="h-4 w-4" />
            Filtros
          </button>
        </div>
      </div>

      {/* Creators Grid */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
        {filteredCreators.map((creator) => (
          <div
            key={creator.id}
            className={`bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-200 cursor-pointer ${
              viewMode === 'list' ? 'p-4' : 'p-6'
            }`}
            onClick={() => setSelectedCreator(creator)}
          >
            {viewMode === 'list' ? (
              /* List View */
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#00FF41] to-[#00CC34] rounded-full flex items-center justify-center text-black text-sm font-bold flex-shrink-0">
                    {getInitial(creator.name, creator.email)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{creator.name || 'Nome não informado'}</h3>
                      {creator.niche && (
                        <span className="px-2 py-1 bg-[#00FF41]/10 text-[#00FF41] rounded-full text-xs font-medium flex-shrink-0">
                          {creator.niche.charAt(0).toUpperCase() + creator.niche.slice(1)}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mb-2">{creator.email}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      {creator.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {creator.location}
                        </div>
                      )}
                      {creator.followers && (
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {creator.followers} seguidores
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 ml-4">
                  <div className="flex items-center gap-2">
                    {creator.phone && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openWhatsApp(creator.phone, creator.name || creator.email);
                        }}
                        className="flex items-center gap-1 text-green-500 hover:text-green-700 transition-colors"
                        title="Conversar no WhatsApp"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                        </svg>
                      </button>
                    )}
                    {creator.website && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(creator.website, '_blank');
                        }}
                        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`mailto:${creator.email}`, '_blank');
                      }}
                      className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowContactModal(creator.id);
                    }}
                    className="bg-[#00FF41] hover:bg-[#00CC34] text-black px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Iniciar Conversa
                  </button>
                </div>
              </div>
            ) : (
              /* Grid View (existing layout) */
              <>
                {/* Profile Header */}
                <div className="text-center mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#00FF41] to-[#00CC34] rounded-full flex items-center justify-center text-black text-xl font-bold mx-auto mb-3">
                    {getInitial(creator.name, creator.email)}
                  </div>
                  <h3 className="font-semibold text-gray-900">{creator.name || 'Nome não informado'}</h3>
                  <p className="text-gray-600 text-sm">{creator.email}</p>
                </div>

                {/* Bio */}
                {creator.bio && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {creator.bio}
                  </p>
                )}

                {/* Details */}
                <div className="space-y-2 mb-4">
                  {creator.niche && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="px-2 py-1 bg-[#00FF41]/10 text-[#00FF41] rounded-full text-xs font-medium">
                          {creator.niche.charAt(0).toUpperCase() + creator.niche.slice(1)}
                        </span>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowContactModal(creator.id);
                        }}
                        className="w-full bg-[#00FF41] hover:bg-[#00CC34] text-black px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Iniciar Conversa
                      </button>
                    </div>
                  )}
                  {!creator.niche && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowContactModal(creator.id);
                      }}
                      className="w-full bg-[#00FF41] hover:bg-[#00CC34] text-black px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Iniciar Conversa
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Creator Profile Modal */}
      {selectedCreator && (
        <ModalPortal>
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Perfil do Criador</h2>
                <button
                  onClick={() => setSelectedCreator(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-[#00FF41] to-[#00CC34] rounded-full flex items-center justify-center text-black text-2xl font-bold mx-auto mb-4">
                    {getInitial(selectedCreator.name, selectedCreator.email)}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">{selectedCreator.name || 'Nome não informado'}</h3>
                  <p className="text-gray-600">{selectedCreator.email}</p>
                  {selectedCreator.niche && (
                    <span className="inline-block mt-2 px-3 py-1 bg-[#00FF41]/10 text-[#00FF41] rounded-full text-sm font-medium">
                      {selectedCreator.niche.charAt(0).toUpperCase() + selectedCreator.niche.slice(1)}
                    </span>
                  )}
                </div>

                {selectedCreator.bio && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Sobre</h4>
                    <p className="text-gray-600 leading-relaxed">{selectedCreator.bio}</p>
                  </div>
                )}

                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Informações de Contato</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedCreator.location && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <MapPin className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Localização</p>
                          <p className="text-gray-600">{selectedCreator.location}</p>
                        </div>
                      </div>
                    )}

                    {selectedCreator.followers && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Users className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Seguidores</p>
                          <p className="text-gray-600">{selectedCreator.followers}</p>
                        </div>
                      </div>
                    )}

                    {selectedCreator.phone && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Phone className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Telefone</p>
                          <p className="text-gray-600">{selectedCreator.phone}</p>
                        </div>
                      </div>
                    )}

                    {selectedCreator.phone && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-gray-900">WhatsApp</p>
                          <p className="text-gray-600">{selectedCreator.phone}</p>
                        </div>
                      </div>
                    )}

                    {selectedCreator.website && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Globe className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Website</p>
                          <a
                            href={selectedCreator.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#00FF41] hover:text-[#00CC34] transition-colors"
                          >
                            {selectedCreator.website}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#00FF41]/5 rounded-lg">
                  <Calendar className="h-5 w-5 text-[#00FF41]" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Membro desde</p>
                    <p className="text-[#00FF41]">
                      {new Date(selectedCreator.created_at).toLocaleDateString('pt-BR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                  {selectedCreator.phone && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openWhatsApp(selectedCreator.phone, selectedCreator.name || selectedCreator.email);
                      }}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67 0.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
                      </svg>
                      WhatsApp
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowContactModal(selectedCreator.id);
                    }}
                    className="flex-1 bg-[#00FF41] hover:bg-[#00CC34] text-black px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Iniciar Conversa
                  </button>

                  {selectedCreator.website && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(selectedCreator.website, '_blank');
                      }}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/20 hover:border-[#00FF41]/30 px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Ver Portfolio
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Contact Options Modal */}
      {showContactModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Como deseja entrar em contato?</h3>
                <button
                  onClick={() => setShowContactModal(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                {(() => {
                  const creator = creators.find((c) => c.id === showContactModal);
                  if (!creator?.phone) return null;

                  return (
                    <button
                      onClick={() => {
                        openWhatsApp(creator.phone, creator.name || creator.email);
                        setShowContactModal(null);
                      }}
                      className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-200 transition-colors"
                    >
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <h4 className="font-semibold text-gray-900">WhatsApp</h4>
                        <p className="text-sm text-gray-600">Conversar diretamente no WhatsApp</p>
                      </div>
                    </button>
                  );
                })()}

                <button
                  onClick={() => {
                    const creator = creators.find((c) => c.id === showContactModal);
                    if (creator) {
                      handleCreateConversation(creator.id);
                    }
                    setShowContactModal(null);
                  }}
                  disabled={contactingCreator === showContactModal}
                  className="w-full flex items-center gap-4 p-4 border border-white/20 rounded-lg hover:bg-[#00FF41]/5 hover:border-[#00FF41]/40 transition-colors disabled:opacity-50"
                >
                  <div className="w-12 h-12 bg-[#00FF41] rounded-full flex items-center justify-center">
                    {contactingCreator === showContactModal ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                    ) : (
                      <MessageCircle className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold text-gray-900">Chat da Plataforma</h4>
                    <p className="text-sm text-gray-600">
                      {contactingCreator === showContactModal ? 'Criando conversa...' : 'Conversar dentro da plataforma'}
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default CreatorsList;