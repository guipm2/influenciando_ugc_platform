import React, { useState } from 'react';
import { 
  Activity, 
  Users, 
  Bell, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  CheckCheck, 
  MessageSquare,
  FileText,
  Clock,
  Briefcase,
  Upload,
  AlertCircle
} from 'lucide-react';

// Simple hook to replace removed useSafeCollaborationData
const useSimpleCollaborationData = () => ({
  activities: [],
  onlineUsers: [],
  unreadCount: 0,
  loading: false,
  error: null,
  markActivityAsRead: (activityId: string) => {
    void activityId;
  },
  markAllAsRead: () => {},
  refreshData: () => {},
  refetchActivities: () => {},
  refetchOnlineUsers: () => {}
});

interface BasicCollaborationHubProps {
  className?: string;
}

interface SafeOnlineUser {
  id: string;
  name: string;
  status: string;
  activity?: string;
}

interface SafeActivityItem {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  priority: number;
  activityType?: string;
}

const BasicCollaborationHub: React.FC<BasicCollaborationHubProps> = ({ 
  className = '' 
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'activity' | 'presence'>('activity');

  // Hook seguro para dados de colaboração
  const {
    activities,
    onlineUsers,
    loading,
    error,
    unreadCount,
    markActivityAsRead,
    markAllAsRead,
    refetchActivities,
    refetchOnlineUsers
  } = useSimpleCollaborationData();

  // Função para obter ícone baseado no tipo de atividade
  const getActivityIcon = (activityType?: string) => {
    switch (activityType) {
      case 'message_received':
        return <MessageSquare className="w-4 h-4" />;
      case 'deliverable_created':
      case 'deliverable_approved':
        return <FileText className="w-4 h-4" />;
      case 'deadline_approaching':
        return <Clock className="w-4 h-4" />;
      case 'project_assigned':
      case 'project_updated':
        return <Briefcase className="w-4 h-4" />;
      case 'file_shared':
        return <Upload className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const handleActivityClick = (activityId: string) => {
        markActivityAsRead(activityId);
  };

  const handleRefresh = () => {
    if (activeTab === 'activity') {
      refetchActivities();
    } else {
      refetchOnlineUsers();
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
        <div className="p-4 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600">Erro ao carregar dados de colaboração</p>
          <button 
            onClick={handleRefresh}
            className="text-xs text-red-500 hover:text-red-700 mt-2"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-gray-600" />
          <h2 className="font-medium text-gray-900">Colaboração</h2>
          {unreadCount > 0 && (
            <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="p-4">
          {/* Tabs */}
          <div className="flex space-x-1 mb-4 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm transition-colors ${
                activeTab === 'activity'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Bell className="w-4 h-4 mr-2" />
              Atividades
              {unreadCount > 0 && activeTab !== 'activity' && (
                <span className="ml-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('presence')}
              className={`flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm transition-colors ${
                activeTab === 'presence'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users className="w-4 h-4 mr-2" />
              Online ({onlineUsers.length})
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              {activeTab === 'activity' && unreadCount > 0 && (
                <span className="text-xs text-gray-500">
                  {unreadCount} não lidas
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleRefresh}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="Atualizar"
                disabled={loading}
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              </button>
              
              {activeTab === 'activity' && unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {loading && activities.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                  <span className="ml-3 text-sm text-gray-500">Carregando atividades...</span>
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Nenhuma atividade ainda</h3>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    As atividades do projeto, mensagens e atualizações aparecerão aqui quando disponíveis
                  </p>
                </div>
              ) : (
                activities.map((activity: SafeActivityItem) => (
                  <div
                    key={activity.id}
                    className={`p-3 rounded-lg border transition-colors cursor-pointer hover:bg-gray-50 ${
                      activity.read
                        ? 'bg-white border-gray-100'
                        : 'bg-[#00FF41]/10 border-[#00FF41]/30'
                    }`}
                    onClick={() => handleActivityClick(activity.id)}
                  >
                    <div className="flex items-start space-x-2">
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <div className={`w-2 h-2 rounded-full ${
                          activity.read ? 'bg-gray-300' : 'bg-[#00FF41]'
                        }`}></div>
                        <div className={`text-gray-600 ${
                          activity.read ? 'opacity-60' : ''
                        }`}>
                          {getActivityIcon(activity.activityType)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-gray-900 mb-1">
                          {activity.title}
                        </h4>
                        {activity.description && (
                          <p className="text-xs text-gray-600 mb-1">
                            {activity.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          {activity.time}
                        </p>
                      </div>
                      {activity.priority <= 2 && (
                        <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 mt-2"></div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Presence Tab */}
          {activeTab === 'presence' && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {onlineUsers.length > 0 ? (
                onlineUsers.map((user: SafeOnlineUser) => (
                  <div key={user.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-[#00FF41] rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {user.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {user.name}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                        {user.status}
                        {user.activity && ` • ${user.activity}`}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Ninguém online no momento</h3>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    Usuários online aparecerão aqui quando estiverem ativos no sistema
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BasicCollaborationHub;