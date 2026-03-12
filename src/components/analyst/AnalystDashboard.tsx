import React, { useState } from 'react';
import { LayoutDashboard, Target, Users, MessageCircle, Package, FolderOpen, CheckSquare } from 'lucide-react';
import { useAnalystAuth } from '../../contexts/AnalystAuthContext';
import { getInitial } from '../../utils/formatters';
import { useRouter } from '../../hooks/useRouter';
import AnalystGlobalSearch from './AnalystGlobalSearch';
import AnalystRouter from './AnalystRouter';
import AnalystNotificationDropdown from './NotificationDropdown';
import BasicCollaborationHub from '../collaboration/BasicCollaborationHub';

interface AnalystDashboardProps {
  onOpenConversation: (conversationId: string) => void;
  selectedConversationId: string | null;
  onBackToList: () => void;
}

const AnalystDashboard: React.FC<AnalystDashboardProps> = ({ 
  onOpenConversation, 
  selectedConversationId, 
  onBackToList 
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showSidebarUserDropdown, setShowSidebarUserDropdown] = useState(false);
  const { profile, signOut } = useAnalystAuth();
  const { currentPath, navigate } = useRouter();
  
  const menuItems = [
    { path: '/analysts/overview', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/analysts/project-dashboard', label: 'Dashboard Projetos', icon: LayoutDashboard },
    { path: '/analysts/opportunities', label: 'Oportunidades', icon: Target },
    { path: '/analysts/stages', label: 'Gerenciar Etapas', icon: Package },
    { path: '/analysts/projects', label: 'Projetos', icon: FolderOpen },
    { path: '/analysts/deliverables', label: 'Deliverables', icon: CheckSquare },
    { path: '/analysts/creators', label: 'Criadores', icon: Users },
    { path: '/analysts/messages', label: 'Mensagens', icon: MessageCircle }
  ];

  // Redirect to /analysts/overview if on root analysts path
  React.useEffect(() => {
    if (currentPath === '/analysts') {
      navigate('/analysts/overview');
    }
  }, [currentPath, navigate]);

  const isActiveRoute = (path: string) => {
    return currentPath === path;
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden text-slate-100">
      {/* Sidebar */}
      <div
        className="glass-sidebar fixed left-0 top-0 z-50 h-full w-72 overflow-hidden"
      >
        <div className="flex h-20 items-center px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00FF41] to-[#00CC34] text-sm font-bold text-black shadow-neon">
            I
          </div>
          <span className="ml-3 text-sm font-semibold uppercase tracking-[0.45em] text-slate-200">
            Analyst
          </span>
        </div>

        <nav className="mt-6 flex-1 flex flex-col gap-1 px-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = isActiveRoute(item.path);
            const buttonClasses = [
              'group relative w-full rounded-2xl transition-all duration-300 flex items-center gap-2 px-4 py-2.5'
            ];

            buttonClasses.push(
              isActive
                ? 'bg-gradient-to-r from-[#00FF41]/85 to-[#00CC34]/70 text-black shadow-neon'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            );

            const iconWrapperClasses = [
              'flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 transition-all duration-300 shadow-inner shadow-black/30',
              isActive
                ? 'bg-gradient-to-br from-[#00FF41] to-[#00CC34] shadow-neon-sm'
                : 'bg-white/5 group-hover:bg-white/10'
            ].join(' ');

            return (
              <button key={item.path} onClick={() => navigate(item.path)} className={buttonClasses.join(' ')}>
                <div className={iconWrapperClasses}>
                  <Icon
                    className={`h-5 w-5 ${
                      isActive ? 'text-black drop-shadow-[0_0_12px_rgba(0,255,65,0.6)]' : 'text-slate-300 group-hover:text-white/90'
                    }`}
                  />
                </div>
                <span className="ml-1 whitespace-nowrap text-sm font-medium tracking-wide">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-5 left-2 right-2">
          <div className="relative">
            <button
              onClick={() => setShowSidebarUserDropdown(!showSidebarUserDropdown)}
              className="group flex w-full items-center justify-start gap-3 rounded-2xl bg-white/5 px-4 py-3 text-left transition-all duration-300 hover:bg-white/10"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#00FF41] to-[#00CC34] text-sm font-semibold text-black shadow-neon-sm">
                {getInitial(profile?.name, profile?.email)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{profile?.name}</div>
                <div className="text-xs uppercase tracking-[0.4em] text-slate-400">Analyst</div>
              </div>
            </button>

            {showSidebarUserDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSidebarUserDropdown(false)} />
                <div className="absolute bottom-full left-0 mb-3 w-52 overflow-hidden rounded-2xl border border-white/12 bg-black/95 backdrop-blur-[30px] saturate-150 z-20">
                  <div className="divide-y divide-white/10 text-sm text-slate-200">
                    <button
                      onClick={() => {
                        setShowSidebarUserDropdown(false);
                        navigate('/analysts/profile');
                      }}
                      className="block w-full px-4 py-3 text-left transition hover:bg-white/5"
                    >
                      Meu Perfil
                    </button>
                    <button
                      onClick={() => {
                        navigate('/analysts/settings');
                        setShowSidebarUserDropdown(false);
                      }}
                      className="block w-full px-4 py-3 text-left transition hover:bg-white/5"
                    >
                      Configurações da Conta
                    </button>
                    <button
                      onClick={() => {
                        setShowSidebarUserDropdown(false);
                        signOut();
                      }}
                      className="block w-full px-4 py-3 text-left text-rose-300 transition hover:bg-rose-500/10"
                    >
                      Sair
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 ml-72">
        <header
          className="glass-header overflow-visible fixed top-0 right-0 z-40 flex h-20 items-center justify-between px-6"
          style={{ left: '288px' }}
        >
          <div className="w-full max-w-xl">
            <AnalystGlobalSearch />
          </div>

          <div className="flex items-center gap-4">
            <AnalystNotificationDropdown />

            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="group flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 transition hover:bg-white/10"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#00FF41] to-[#00CC34] text-sm font-semibold text-black shadow-neon-sm">
                  {getInitial(profile?.name, profile?.email)}
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-white">{profile?.name}</div>
                  <div className="text-[10px] uppercase tracking-[0.45em] text-slate-400">{profile?.company}</div>
                </div>
              </button>

              {showUserDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowUserDropdown(false)} />
                  <div className="absolute right-0 mt-3 w-56 overflow-hidden rounded-2xl border border-white/12 bg-black/95 backdrop-blur-[30px] saturate-150 shadow-[0_25px_70px_-30px_rgba(0,0,0,0.9)]">
                    <div className="divide-y divide-white/10 text-sm text-slate-200">
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          navigate('/analysts/profile');
                        }}
                        className="block w-full px-4 py-3 text-left transition hover:bg-white/5"
                      >
                        Meu Perfil
                      </button>
                      <button
                        onClick={() => {
                          navigate('/analysts/settings');
                          setShowUserDropdown(false);
                        }}
                        className="block w-full px-4 py-3 text-left transition hover:bg-white/5"
                      >
                        Configurações da Conta
                      </button>
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          signOut();
                        }}
                        className="block w-full px-4 py-3 text-left text-rose-300 transition hover:bg-rose-500/10"
                      >
                        Sair
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="relative z-10 mt-20 px-6 pb-10">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            <div className="glass-panel lg:col-span-3 p-6">
              <AnalystRouter
                onOpenConversation={onOpenConversation}
                selectedConversationId={selectedConversationId}
                onBackToList={onBackToList}
              />
            </div>
            <div className="lg:col-span-1">
              <div className="glass-panel sticky top-28 p-6">
                <BasicCollaborationHub className="!bg-transparent !p-0" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AnalystDashboard;