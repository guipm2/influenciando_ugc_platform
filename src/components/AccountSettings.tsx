import React, { useState } from 'react';
import { Save, Eye, EyeOff, Shield, Bell, User, Mail, Lock, Trash2, Download, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import ModalPortal from './common/ModalPortal';

const AccountSettings = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showFinalConfirmation, setShowFinalConfirmation] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const { user, signOut } = useAuth();

  const [profileData, setProfileData] = useState({
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    opportunityAlerts: true,
    messageAlerts: true,
    weeklyDigest: false,
    whatsappOpportunities: false
  });

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'security', label: 'Segurança', icon: Shield },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'data', label: 'Dados', icon: Download }
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value
    });
  };

  const handleNotificationChange = (setting: string) => {
    setNotificationSettings({
      ...notificationSettings,
      [setting]: !notificationSettings[setting as keyof typeof notificationSettings]
    });
  };

  const handleSaveProfile = () => {
    // REMOVIDO: alert('Configurações de perfil salvas com sucesso!');
  };

  const handleChangePassword = () => {
    if (profileData.newPassword !== profileData.confirmPassword) {
      // REMOVIDO: alert('As senhas não coincidem');
      return;
    }
    // REMOVIDO: alert('Senha alterada com sucesso!');
    setProfileData({
      ...profileData,
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  };

  const handleSaveNotifications = () => {
    // REMOVIDO: alert('Configurações de notificação salvas com sucesso!');
  };

  const handleExportData = () => {
    // REMOVIDO: alert('Seus dados serão exportados e enviados por email em breve.');
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    setShowDeleteModal(false);
    setShowFinalConfirmation(true);
  };

  const handleFinalDelete = async () => {
    if (deleteConfirmationText !== 'EXCLUIR MINHA CONTA') {
      alert('Por favor, digite exatamente "EXCLUIR MINHA CONTA" para confirmar.');
      return;
    }

    setIsDeleting(true);

    try {
      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      // Usar a função RPC para deletar completamente o usuário
      const { data, error } = await supabase.rpc('delete_my_account');

      if (error) {
        console.error('Erro ao deletar conta via RPC:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Falha ao deletar conta');
      }

      // Fazer logout do usuário
      await signOut();
      
      // Mostrar mensagem de sucesso
      alert('Sua conta foi completamente excluída do sistema. Obrigado por ter usado nossa plataforma.');
      
    } catch (error) {
      console.error('Erro ao excluir conta:', error);
      
      // Fallback: se a RPC falhar, tentar método manual
      try {
        console.log('Tentando método de fallback...');
        
        if (!user) {
          throw new Error('Usuário não encontrado para fallback');
        }
        
        // Deletar dados relacionados manualmente
        await Promise.all([
          supabase.from('opportunity_applications').delete().eq('creator_id', user.id),
          supabase.from('opportunity_stages').delete().eq('creator_id', user.id),
          supabase.from('messages').delete().eq('sender_id', user.id),
          supabase.from('conversations').delete().eq('creator_id', user.id),
          supabase.from('notifications').delete().eq('user_id', user.id)
        ]);
        
        // Deletar perfil
        const { error: profileError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', user.id);

        if (profileError) {
          throw profileError;
        }

        // Fazer logout
        await signOut();
        
        alert('Sua conta e dados foram excluídos com sucesso. Nota: Sua conta de autenticação pode ainda existir no sistema.');
        
      } catch (fallbackError) {
        console.error('Erro no método de fallback:', fallbackError);
        alert('Ocorreu um erro ao excluir sua conta. Por favor, entre em contato com o suporte técnico para assistência.');
      }
    } finally {
      setIsDeleting(false);
      setShowFinalConfirmation(false);
      setDeleteConfirmationText('');
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informações da Conta</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      value={profileData.email}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <button
                onClick={handleSaveProfile}
                className="bg-[#00FF41] hover:bg-[#00CC34] text-black px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Salvar Alterações
              </button>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Alterar Senha</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Senha Atual
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      name="currentPassword"
                      value={profileData.currentPassword}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
                      placeholder="Sua senha atual"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      name="newPassword"
                      value={profileData.newPassword}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
                      placeholder="Nova senha (mínimo 6 caracteres)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirmar Nova Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={profileData.confirmPassword}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF41] focus:border-transparent"
                      placeholder="Confirme a nova senha"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <button
                onClick={handleChangePassword}
                className="bg-[#00FF41] hover:bg-[#00CC34] text-black px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Alterar Senha
              </button>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Preferências de Notificação</h3>
              <div className="space-y-4">
                {Object.entries({
                  emailNotifications: 'Notificações por Email',
                  pushNotifications: 'Notificações Push',
                  opportunityAlerts: 'Alertas de Novas Oportunidades',
                  messageAlerts: 'Alertas de Mensagens',
                  weeklyDigest: 'Resumo Semanal',
                  whatsappOpportunities: 'Receber Novas Oportunidades por WhatsApp'
                }).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        {key === 'whatsappOpportunities' && (
                          <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                          </svg>
                        )}
                        <h4 className="font-medium text-gray-900">{label}</h4>
                      </div>
                      <p className="text-sm text-gray-600">
                        {key === 'emailNotifications' && 'Receba notificações importantes por email'}
                        {key === 'pushNotifications' && 'Notificações em tempo real no navegador'}
                        {key === 'opportunityAlerts' && 'Seja notificado sobre novas oportunidades'}
                        {key === 'messageAlerts' && 'Alertas quando receber novas mensagens'}
                        {key === 'weeklyDigest' && 'Resumo semanal das suas atividades'}
                        {key === 'whatsappOpportunities' && 'Receba alertas de novas oportunidades diretamente no WhatsApp'}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings[key as keyof typeof notificationSettings]}
                        onChange={() => handleNotificationChange(key)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#00FF41]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00FF41]"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <button
                onClick={handleSaveNotifications}
                className="bg-[#00FF41] hover:bg-[#00CC34] text-black px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Salvar Preferências
              </button>
            </div>
          </div>
        );

      case 'data':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Gerenciar Dados</h3>
              
              <div className="space-y-4">
                <div className="p-4 bg-[#00FF41]/10 rounded-lg border border-[#00FF41]/30">
                  <h4 className="font-medium text-black mb-2">Exportar Dados</h4>
                  <p className="text-sm text-gray-700 mb-3">
                    Baixe uma cópia de todos os seus dados da plataforma
                  </p>
                  <button
                    onClick={handleExportData}
                    className="bg-[#00FF41] hover:bg-[#00CC34] text-black px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Exportar Dados
                  </button>
                </div>

                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <h4 className="font-medium text-red-900 mb-2">Excluir Conta</h4>
                  <p className="text-sm text-red-800 mb-3">
                    Exclua permanentemente sua conta e todos os dados associados. Esta ação não pode ser desfeita.
                  </p>
                  <button
                    onClick={handleDeleteAccount}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir Conta
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Configurações da Conta</h1>
          <p className="text-gray-600 mt-1">Gerencie suas preferências e configurações de segurança</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <nav className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        activeTab === tab.id
                          ? 'bg-[#00FF41]/10 text-[#00FF41] border-r-2 border-[#00FF41]'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${activeTab === tab.id ? 'text-[#00FF41]' : 'text-gray-400'}`} />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Primeira Confirmação */}
      {showDeleteModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Excluir Conta</h3>
                <p className="text-sm text-gray-600">Esta ação não pode ser desfeita</p>
              </div>
            </div>
            
              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  Ao excluir sua conta, os seguintes dados serão permanentemente removidos:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  <li>Todas as suas informações de perfil</li>
                  <li>Histórico de projetos e colaborações</li>
                  <li>Mensagens e conversas</li>
                  <li>Notificações e preferências</li>
                  <li>Dados bancários e contratuais</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal de Confirmação Final */}
      {showFinalConfirmation && (
        <ModalPortal>
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Confirmação Final</h3>
                <p className="text-sm text-gray-600">Última etapa para excluir sua conta</p>
              </div>
            </div>
            
              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  Para confirmar a exclusão da sua conta, digite exatamente:
                </p>
                <div className="bg-gray-100 p-3 rounded-lg mb-4">
                  <code className="text-red-600 font-mono font-bold">EXCLUIR MINHA CONTA</code>
                </div>
                <input
                  type="text"
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Digite a confirmação aqui"
                  disabled={isDeleting}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowFinalConfirmation(false);
                    setDeleteConfirmationText('');
                  }}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleFinalDelete}
                  disabled={isDeleting || deleteConfirmationText !== 'EXCLUIR MINHA CONTA'}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Excluindo...
                    </>
                  ) : (
                    'Excluir Conta Permanentemente'
                  )}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
};

export default AccountSettings;