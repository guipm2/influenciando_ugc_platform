import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Edit, Save, Eye, EyeOff, Shield, Lock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTabVisibility } from '../hooks/useTabVisibility';
import { supabase } from '../lib/supabase';
import { formatCEP, formatDocument, formatPhone } from '../utils/formatters';
import AvatarUpload from './common/AvatarUpload';

type DocumentType = 'cpf' | 'cnpj' | '';

interface ProfileAddress {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

interface ProfileFormData {
  name: string;
  bio: string;
  email: string;
  instagram_url: string;
  tiktok_url: string;
  portfolio_url: string;
  age: number | null;
  gender: string;
  niches: string[];
  pix_key: string;
  full_name: string;
  document_type: DocumentType;
  document_number: string;
  phone: string;
  address: ProfileAddress;
  avatar_url: string;
}

const DEFAULT_ADDRESS: ProfileAddress = {
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  zipCode: ''
};

const NICHE_OPTIONS = [
  'Moda', 'Beleza', 'Fitness', 'Lifestyle', 'Viagem', 'Culinária',
  'Tecnologia', 'Gaming', 'Música', 'Arte', 'Decoração', 'Pets',
  'Maternidade', 'Negócios', 'Educação', 'Saúde', 'Esportes', 'Entretenimento'
];

const STATE_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const GENDER_OPTIONS = [
  { value: 'feminino', label: 'Feminino' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'nao-binario', label: 'Não-binário' },
  { value: 'prefiro-nao-informar', label: 'Prefiro não informar' }
];

const DOCUMENT_TYPE_OPTIONS = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' }
];

const cloneProfileData = (data: ProfileFormData) => JSON.parse(JSON.stringify(data)) as ProfileFormData;

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const { user } = useAuth();
  
  const [profileData, setProfileData] = useState<ProfileFormData>({
    name: '',
    bio: '',
    email: '',
    instagram_url: '',
    tiktok_url: '',
    portfolio_url: '',
    age: null,
    gender: '',
    niches: [],
    pix_key: '',
    full_name: '',
    document_type: '',
    document_number: '',
    phone: '',
    address: { ...DEFAULT_ADDRESS },
    avatar_url: ''
  });
  const [originalProfileData, setOriginalProfileData] = useState<ProfileFormData | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    try {
      // Validar sessão antes de buscar
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('⚠️ [PROFILE] Sessão inválida ao tentar carregar perfil');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('❌ [PROFILE] Erro ao buscar perfil:', error);
        // NÃO limpa dados existentes quando há erro
        return;
      }

      if (data) {
        const parsedAddress = (() => {
          if (!data.address) return { ...DEFAULT_ADDRESS };
          if (typeof data.address === 'string') {
            try {
              const parsed = JSON.parse(data.address);
              return { ...DEFAULT_ADDRESS, ...parsed };
            } catch {
              return { ...DEFAULT_ADDRESS };
            }
          }
          return { ...DEFAULT_ADDRESS, ...data.address };
        })();

        setProfileData({
          name: data.name || '',
          bio: data.bio || '',
          email: data.email || user.email || '',
          instagram_url: data.instagram_url || '',
          tiktok_url: data.tiktok_url || '',
          portfolio_url: data.portfolio_url || '',
          age: data.age || null,
          gender: data.gender || '',
          niches: Array.isArray(data.niches) ? data.niches : [],
          pix_key: data.pix_key || '',
          full_name: data.full_name || '',
          document_type: (data.document_type as DocumentType) || '',
          document_number: data.document_number || '',
          phone: data.phone || '',
          address: parsedAddress,
          avatar_url: data.avatar_url || ''
        });
        setOriginalProfileData(
          cloneProfileData({
            name: data.name || '',
            bio: data.bio || '',
            email: data.email || user.email || '',
            instagram_url: data.instagram_url || '',
            tiktok_url: data.tiktok_url || '',
            portfolio_url: data.portfolio_url || '',
            age: data.age || null,
            gender: data.gender || '',
            niches: Array.isArray(data.niches) ? data.niches : [],
            pix_key: data.pix_key || '',
            full_name: data.full_name || '',
            document_type: (data.document_type as DocumentType) || '',
            document_number: data.document_number || '',
            phone: data.phone || '',
            address: parsedAddress,
            avatar_url: data.avatar_url || ''
          })
        );
      }
    } catch (err) {
      console.error('Erro ao buscar perfil:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user, fetchProfile]);

  const maskData = (data: string, type: 'pix' | 'document' | 'phone') => {
    if (!data) return '';
    if (type === 'pix') {
      return data.includes('@') 
        ? `${data.substring(0, 2)}***@${data.split('@')[1]}`
        : `${data.substring(0, 3)}***${data.substring(data.length - 3)}`;
    }
    if (type === 'document') {
      return `${data.substring(0, 3)}***${data.substring(data.length - 2)}`;
    }
    if (type === 'phone') {
      const digits = data.replace(/\D/g, '');
      if (digits.length <= 4) return data;
      const area = digits.slice(0, 2);
      const suffix = digits.slice(-4);
      const middleLength = Math.max(digits.length - 6, 4);
      const middle = '*'.repeat(middleLength);
      return `(${area}) ${middle}-${suffix}`;
    }
    return data;
  };

  useEffect(() => {
    if (!statusMessage) return;
    const timeout = setTimeout(() => setStatusMessage(null), 4000);
    return () => clearTimeout(timeout);
  }, [statusMessage]);

  // Recarregar dados do perfil silenciosamente quando a aba voltar a ficar visível
  useTabVisibility(() => {
    fetchProfile();
  });

  const handleFieldChange = (field: keyof ProfileFormData, value: string | number | null) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddressChange = (field: keyof ProfileAddress, value: string) => {
    const nextValue = field === 'zipCode' ? formatCEP(value) : value;
    setProfileData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        [field]: nextValue
      }
    }));
  };

  const handleNicheToggle = (niche: string) => {
    if (!isEditing) return;
    setProfileData(prev => ({
      ...prev,
      niches: prev.niches.includes(niche)
        ? prev.niches.filter(n => n !== niche)
        : [...prev.niches, niche]
    }));
  };

  const handleDocumentTypeChange = (type: DocumentType) => {
    setProfileData(prev => {
      if (!type) {
        return {
          ...prev,
          document_type: type,
          document_number: ''
        };
      }

      const formattedDocument = prev.document_number
        ? formatDocument(prev.document_number, type)
        : '';

      return {
        ...prev,
        document_type: type,
        document_number: formattedDocument
      };
    });
  };

  const handleDocumentNumberChange = (value: string) => {
    setProfileData(prev => {
      if (!prev.document_type) {
        const digits = value.replace(/\D/g, '').slice(0, 14);
        return {
          ...prev,
          document_number: digits
        };
      }

      return {
        ...prev,
        document_number: formatDocument(value, prev.document_type)
      };
    });
  };

  const handlePhoneChange = (value: string) => {
    setProfileData(prev => ({
      ...prev,
      phone: formatPhone(value)
    }));
  };

  const handleCancel = () => {
    if (originalProfileData) {
      setProfileData(cloneProfileData(originalProfileData));
    }
    setIsEditing(false);
    setStatusMessage(null);
  };

  const isAddressFilled = useMemo(() => {
    return Object.values(profileData.address).some(value => value?.trim?.());
  }, [profileData.address]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setStatusMessage(null);

    const updatePayload = {
      name: profileData.name.trim() || null,
      bio: profileData.bio.trim() || null,
      instagram_url: profileData.instagram_url.trim() || null,
      tiktok_url: profileData.tiktok_url.trim() || null,
      portfolio_url: profileData.portfolio_url.trim() || null,
      age: profileData.age || null,
      gender: profileData.gender || null,
      niches: profileData.niches,
      pix_key: profileData.pix_key.trim() || null,
      full_name: profileData.full_name.trim() || null,
      document_type: profileData.document_type || null,
      document_number: profileData.document_number.trim() || null,
      phone: profileData.phone.trim() || null,
      address: isAddressFilled ? profileData.address : null
    };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      const cloned = cloneProfileData(profileData);
      setOriginalProfileData(cloned);
      setProfileData(cloned);
      setIsEditing(false);
      setStatusMessage({ type: 'success', message: 'Informações atualizadas com sucesso.' });
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err);
      setStatusMessage({ type: 'error', message: 'Não foi possível salvar as alterações. Tente novamente.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Meu Perfil</h1>
          <p className="text-gray-600 mt-1">Gerencie suas informações pessoais e profissionais</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSensitiveData(!showSensitiveData)}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {showSensitiveData ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showSensitiveData ? 'Ocultar' : 'Mostrar'} dados sensíveis
          </button>
          
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#00FF41] text-black rounded-lg hover:bg-[#00CC34]"
            >
              <Edit className="h-4 w-4" />
              Editar Perfil
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </button>
            </div>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
            statusMessage.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 mt-0.5" />
          )}
          <span className="text-sm">{statusMessage.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="text-center">
              <AvatarUpload
                currentAvatarUrl={profileData.avatar_url}
                userName={profileData.name || profileData.full_name}
                onUploadComplete={(url) => {
                  setProfileData(prev => ({ ...prev, avatar_url: url }));
                  setStatusMessage({ type: 'success', message: url ? 'Foto de perfil atualizada com sucesso!' : 'Foto de perfil removida com sucesso!' });
                }}
                onUploadError={(error) => {
                  setStatusMessage({ type: 'error', message: error });
                }}
              />
              <h3 className="text-lg font-semibold text-gray-900 mb-1 mt-4">
                {profileData.full_name || profileData.name || 'Nome não informado'}
              </h3>
              <p className="text-gray-500 text-sm">
                {profileData.niches.length > 0 ? profileData.niches.join(', ') : 'Nichos não informados'}
              </p>
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Informações Básicas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                <input
                  type="text"
                  value={profileData.name}
                  disabled={!isEditing}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={profileData.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  placeholder="seu@email.com"
                />
                <p className="text-xs text-gray-500 mt-1">Para alterar o email de acesso, entre em contato com o suporte.</p>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
              <textarea
                value={profileData.bio}
                disabled={!isEditing}
                onChange={(e) => handleFieldChange('bio', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                placeholder="Conte um pouco sobre você..."
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Redes e Nichos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Instagram</label>
                <input
                  type="url"
                  value={profileData.instagram_url}
                  disabled={!isEditing}
                  onChange={(e) => handleFieldChange('instagram_url', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                  placeholder="https://instagram.com/seuperfil"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">TikTok</label>
                <input
                  type="url"
                  value={profileData.tiktok_url}
                  disabled={!isEditing}
                  onChange={(e) => handleFieldChange('tiktok_url', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                  placeholder="https://tiktok.com/@seuperfil"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Portfólio / Site</label>
                <input
                  type="url"
                  value={profileData.portfolio_url}
                  disabled={!isEditing}
                  onChange={(e) => handleFieldChange('portfolio_url', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                  placeholder="https://seusite.com"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Idade</label>
                  <input
                    type="number"
                    min={13}
                    max={100}
                    value={profileData.age ?? ''}
                    disabled={!isEditing}
                    onChange={(e) => handleFieldChange('age', e.target.value ? parseInt(e.target.value, 10) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                    placeholder="25"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gênero</label>
                  <select
                    value={profileData.gender}
                    disabled={!isEditing}
                    onChange={(e) => handleFieldChange('gender', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                  >
                    <option value="">Selecione</option>
                    {GENDER_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Nichos</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {NICHE_OPTIONS.map(niche => (
                  <button
                    key={niche}
                    type="button"
                    onClick={() => handleNicheToggle(niche)}
                    disabled={!isEditing}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      profileData.niches.includes(niche)
                        ? 'bg-[#00FF41] text-black'
                        : 'bg-gray-100 text-gray-700'
                    } ${!isEditing ? 'cursor-default opacity-90' : 'hover:bg-[#00FF41]/10'}`}
                  >
                    {niche}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dados Bancários</h3>
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-800 bg-yellow-100 px-2 py-1 rounded">Dados sensíveis</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Chave PIX</label>
              <input
                type="text"
                value={isEditing ? profileData.pix_key : (showSensitiveData ? profileData.pix_key : maskData(profileData.pix_key, 'pix'))}
                disabled={!isEditing}
                onChange={(e) => handleFieldChange('pix_key', e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                  isEditing ? '' : 'bg-gray-50 text-gray-500'
                }`}
                placeholder="Chave PIX não informada"
              />
              {!isEditing && (
                <p className="mt-2 text-sm text-gray-500">
                  <Shield className="inline h-4 w-4 mr-1" />
                  Para visualizar seus dados completos, utilize o botão "Mostrar dados sensíveis".
                </p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dados Contratuais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo</label>
                <input
                  type="text"
                  value={profileData.full_name}
                  disabled={!isEditing}
                  onChange={(e) => handleFieldChange('full_name', e.target.value)}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                    isEditing ? '' : 'bg-gray-50 text-gray-500'
                  }`}
                  placeholder="Nome não informado"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de documento</label>
                <select
                  value={profileData.document_type}
                  disabled={!isEditing}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) => handleDocumentTypeChange(event.target.value as DocumentType)}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                    isEditing ? '' : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  <option value="">Selecione</option>
                  {DOCUMENT_TYPE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Documento</label>
                <input
                  type="text"
                  value={isEditing ? profileData.document_number : (showSensitiveData ? profileData.document_number : maskData(profileData.document_number, 'document'))}
                  disabled={!isEditing}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleDocumentNumberChange(event.target.value)}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                    isEditing ? '' : 'bg-gray-50 text-gray-500'
                  }`}
                  placeholder={profileData.document_type === 'cnpj' ? '00.000.000/0000-00' : '000.000.000-00'}
                  maxLength={profileData.document_type === 'cnpj' ? 18 : 14}
                />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Telefone</label>
                <input
                  type="tel"
                  value={profileData.phone}
                  disabled={!isEditing}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => handlePhoneChange(event.target.value)}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                    isEditing ? '' : 'bg-gray-50 text-gray-500'
                  }`}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Endereço</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">CEP</label>
                <input
                  type="text"
                  value={profileData.address.zipCode}
                  disabled={!isEditing}
                  onChange={(e) => handleAddressChange('zipCode', e.target.value)}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                    isEditing ? '' : 'bg-gray-50 text-gray-500'
                  }`}
                  placeholder="00000-000"
                  maxLength={9}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                <select
                  value={profileData.address.state}
                  disabled={!isEditing}
                  onChange={(e) => handleAddressChange('state', e.target.value)}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                    isEditing ? '' : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  <option value="">Selecione</option>
                  {STATE_OPTIONS.map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Rua</label>
                <input
                  type="text"
                  value={profileData.address.street}
                  disabled={!isEditing}
                  onChange={(e) => handleAddressChange('street', e.target.value)}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                    isEditing ? '' : 'bg-gray-50 text-gray-500'
                  }`}
                  placeholder="Nome da rua"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Número</label>
                <input
                  type="text"
                  value={profileData.address.number}
                  disabled={!isEditing}
                  onChange={(e) => handleAddressChange('number', e.target.value)}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                    isEditing ? '' : 'bg-gray-50 text-gray-500'
                  }`}
                  placeholder="123"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Complemento</label>
                <input
                  type="text"
                  value={profileData.address.complement}
                  disabled={!isEditing}
                  onChange={(e) => handleAddressChange('complement', e.target.value)}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                    isEditing ? '' : 'bg-gray-50 text-gray-500'
                  }`}
                  placeholder="Apartamento, bloco, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bairro</label>
                <input
                  type="text"
                  value={profileData.address.neighborhood}
                  disabled={!isEditing}
                  onChange={(e) => handleAddressChange('neighborhood', e.target.value)}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                    isEditing ? '' : 'bg-gray-50 text-gray-500'
                  }`}
                  placeholder="Bairro"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cidade</label>
                <input
                  type="text"
                  value={profileData.address.city}
                  disabled={!isEditing}
                  onChange={(e) => handleAddressChange('city', e.target.value)}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                    isEditing ? '' : 'bg-gray-50 text-gray-500'
                  }`}
                  placeholder="Cidade"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
