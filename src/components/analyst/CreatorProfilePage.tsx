import React, { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, MapPin, Users, Globe, Mail, Phone, Calendar, MessageCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useRouter } from '../../hooks/useRouter';
import { useAnalystAuth } from '../../contexts/AnalystAuthContext';
import { getInitial } from '../../utils/formatters';

interface CreatorProfile {
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

const CreatorProfilePage: React.FC = () => {
  const { currentPath, navigate } = useRouter();
  const creatorId = currentPath.split('/').pop() ?? '';
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contacting, setContacting] = useState(false);
  const { profile: analyst } = useAnalystAuth();

  const fetchCreator = useCallback(async () => {
    if (!creatorId) {
      setError('Creator não encontrado.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', creatorId)
        .eq('role', 'creator')
        .maybeSingle();

      if (fetchError) {
        console.error('Erro ao buscar perfil do creator:', fetchError);
        setError('Não foi possível carregar o perfil.');
        return;
      }

      if (!data) {
        setError('Creator não encontrado.');
        return;
      }

      setCreator(data as CreatorProfile);
      setError(null);
    } catch (err) {
      console.error('Erro ao carregar perfil do creator:', err);
      setError('Erro inesperado ao carregar o perfil.');
    } finally {
      setLoading(false);
    }
  }, [creatorId]);

  useEffect(() => {
    fetchCreator();
  }, [fetchCreator]);

  const openWhatsApp = useCallback(() => {
    if (!creator?.phone || !analyst) return;

    const cleanPhone = creator.phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const message = `Olá ${creator.name || creator.email}! Sou ${analyst.name || analyst.email}. Vi seu perfil na plataforma e gostaria de conversar sobre uma oportunidade.`;
    const whatsappUrl = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }, [creator, analyst]);

  const startConversation = useCallback(async () => {
    if (!creator || !analyst) return;

    setContacting(true);

    try {
      const { data: existingConversation, error: searchError } = await supabase
        .from('conversations')
        .select('id')
        .eq('analyst_id', analyst.id)
        .eq('creator_id', creator.id)
        .maybeSingle();

      if (searchError && searchError.code !== 'PGRST116') {
        console.error('Erro ao buscar conversa existente:', searchError);
        return;
      }

      let conversationId = existingConversation?.id;

      if (!conversationId) {
        const { data: newConversation, error: createError } = await supabase
          .from('conversations')
          .insert({
            analyst_id: analyst.id,
            creator_id: creator.id,
            opportunity_id: null,
            last_message_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (createError) {
          console.error('Erro ao criar conversa:', createError);
          return;
        }

        conversationId = newConversation.id;
      }

      if (conversationId) {
        navigate('/analysts/messages');
        // Pequeno atraso para garantir que o router processe a navegação antes de emitir evento
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('openConversation', { detail: { conversationId } }));
        }, 100);
      }
    } catch (err) {
      console.error('Erro ao iniciar conversa:', err);
    } finally {
      setContacting(false);
    }
  }, [analyst, creator, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando perfil do creator...
        </div>
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center px-6">
        <p className="text-lg font-semibold text-gray-800 mb-2">Não foi possível carregar o perfil.</p>
        <p className="text-gray-600 mb-6">{error ?? 'O creator solicitado não existe ou foi removido.'}</p>
        <button
          onClick={() => navigate('/analysts/creators')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#00FF41] text-black rounded-lg hover:bg-[#00CC34] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para lista de creators
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/analysts/creators')}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <span className="text-xs text-gray-500">
            Criador desde {new Date(creator.created_at).toLocaleDateString('pt-BR')}
          </span>
        </div>

        <div className="bg-white rounded-xl shadow border border-gray-200 p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-[#00FF41] to-[#00CC34] rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {getInitial(creator.name, creator.email)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{creator.name || 'Nome não informado'}</h1>
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="h-4 w-4" />
                  {creator.email}
                </div>
                {creator.niche && (
                  <span className="inline-flex items-center px-2 py-1 mt-2 text-xs font-medium bg-[#00FF41]/10 text-[#00FF41] rounded-full">
                    {creator.niche.charAt(0).toUpperCase() + creator.niche.slice(1)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {creator.phone && (
                <button
                  onClick={openWhatsApp}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                >
                  <Phone className="h-4 w-4" />
                  Chamar no WhatsApp
                </button>
              )}
              <button
                onClick={startConversation}
                disabled={contacting}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#00FF41] rounded-lg hover:bg-[#00CC34] disabled:bg-[#00FF41]/30"
              >
                {contacting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                {contacting ? 'Abrindo conversa...' : 'Enviar mensagem interna'}
              </button>
              {creator.website && (
                <a
                  href={creator.website.startsWith('http') ? creator.website : `https://${creator.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#00FF41] border border-[#00FF41]/30 rounded-lg hover:bg-[#00FF41]/10"
                >
                  <Globe className="h-4 w-4" />
                  Ver portfolio
                </a>
              )}
            </div>
          </div>

          {creator.bio && (
            <div className="bg-[#00FF41]/5 border border-[#00FF41]/20 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-[#00FF41] mb-2">Sobre o creator</h2>
              <p className="text-sm text-gray-900 leading-relaxed">{creator.bio}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Informações principais</h3>
              <div className="space-y-2 text-sm text-gray-600">
                {creator.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {creator.location}
                  </div>
                )}
                {creator.followers && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {creator.followers} seguidores
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Cadastro em {new Date(creator.created_at).toLocaleDateString('pt-BR')}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Contatos</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {creator.email}
                </div>
                {creator.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {creator.phone}
                  </div>
                )}
                {creator.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <a
                      href={creator.website.startsWith('http') ? creator.website : `https://${creator.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#00FF41] hover:text-[#00CC34]"
                    >
                      {creator.website}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatorProfilePage;
