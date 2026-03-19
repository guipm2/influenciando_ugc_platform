import { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, Target, MessageCircle, GraduationCap, User, HelpCircle, Lock, Folder } from 'lucide-react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import { AnalystAuthProvider, useAnalystAuth } from './contexts/AnalystAuthContext';
import { useRouter } from './hooks/useRouter';
import { supabase } from './lib/supabase';
const CreatorRouter = lazy(() => import('./components/creator/CreatorRouter'));
const CreatorOnboarding = lazy(() => import('./components/CreatorOnboarding'));
const GlobalSearch = lazy(() => import('./components/GlobalSearch'));
const NotificationDropdown = lazy(() => import('./components/NotificationDropdown'));
import Avatar from './components/common/Avatar';
const CreatorLoginPage = lazy(() => import('./components/auth/CreatorLoginPage'));
const AnalystLoginPage = lazy(() => import('./components/auth/AnalystLoginPage'));
const EmailConfirmationPage = lazy(() => import('./components/auth/EmailConfirmationPage'));
const AnalystDashboard = lazy(() => import('./components/analyst/AnalystDashboard'));
const LandingPage = lazy(() => import('./components/LandingPage'));

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/25 border-t-transparent" />
  </div>
);

function AnalystApp() {
  const { profile, loading } = useAnalystAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const { navigate } = useRouter();

  const handleOpenConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    navigate('/analysts/messages');
  };

  const handleBackToMessagesList = () => {
    setSelectedConversationId(null);
  };

  // Se ainda está carregando, mostra loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-influenciando-primary rounded-xl flex items-center justify-center text-black font-bold text-xl mb-4 mx-auto shadow-neon-sm">
            I
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-influenciando-primary mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se não tem perfil, mostrar página de login de analistas (não redirecionar)
  if (!profile) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <AnalystLoginPage />
      </Suspense>
    );
  }

  return (
    <AnalystDashboard 
      onOpenConversation={handleOpenConversation}
      selectedConversationId={selectedConversationId}
      onBackToList={handleBackToMessagesList}
    />
  );
}

function CreatorApp() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null); // Changed from selectedConversationId
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showSidebarUserDropdown, setShowSidebarUserDropdown] = useState(false);
  const [opportunitiesCount, setOpportunitiesCount] = useState(0);
  const [profileTimeout, setProfileTimeout] = useState(false);
  const { user, loading, signOut, profile } = useAuth();
  const { currentPath, navigate } = useRouter();

  // Timeout para profile loading - aumentado para 15 segundos
  useEffect(() => {
    if (user && !profile && !loading) {
      const timeoutId = setTimeout(() => {
        setProfileTimeout(true);
      }, 15000); // Aumentado para 15 segundos

      return () => clearTimeout(timeoutId);
    } else if (profile) {
      setProfileTimeout(false);
    }
  }, [user, profile, loading]);

  const handleOpenConversation = (projectId: string) => { // Changed parameter name for clarity
    setSelectedProjectId(projectId);
    navigate(`/creators/messages/${projectId}`); // Navigate directly to project chat
  };

  const handleBackToMessagesList = () => {
    setSelectedProjectId(null);
    navigate('/creators/messages');
  };

  // Fetch opportunities count
  const fetchOpportunitiesCount = useCallback(async () => {
    if (!user) return;
    
    try {
      const { count, error } = await supabase
        .from('opportunities')
        .select('id', { count: 'exact', head: false })
        .eq('status', 'ativo');

      if (error) {
        console.error('Erro ao buscar contagem de oportunidades:', error);
      } else {
        setOpportunitiesCount(count || 0);
      }
    } catch (err) {
      console.error('Erro ao buscar contagem de oportunidades:', err);
    }
  }, [user]);

  // Redirect automático após login bem-sucedido
  useEffect(() => {
    if (user && profile && profile.role === 'creator') {
      // Se está numa página de login ou root, redireciona para opportunities
      if (currentPath === '/creators' || currentPath === '/login/creators' || currentPath === '/') {
        navigate('/creators/opportunities');
      }
    }
  }, [user, profile, currentPath, navigate]);

  // Redirect to /creators/opportunities if on root creators path
  useEffect(() => {
    if (currentPath === '/creators' && user && profile) {
      navigate('/creators/opportunities');
    }
  }, [currentPath, navigate, user, profile]);

  // Fetch opportunities count when user loads
  useEffect(() => {
    if (user) {
      fetchOpportunitiesCount();
    }
  }, [user, fetchOpportunitiesCount]);

  // Se ainda está carregando, mostra loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-black rounded-xl flex items-center justify-center text-[#00FF41] font-bold text-2xl mb-4 mx-auto shadow-neon">
            I
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00FF41] mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se não tem usuário ou perfil, redireciona para landing page
  // Se profile timeout, força logout
  if (!user || (!profile && !loading && profileTimeout) || (profile && profile.role !== 'creator')) {
    if (profileTimeout) {
      signOut();
    }
    // Usar navigate em vez de renderizar a página obsoleta
    navigate('/');
    return null;
  }

  // Se ainda está carregando profile sem timeout
  if (!profile && !profileTimeout) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-black rounded-xl flex items-center justify-center text-[#00FF41] font-bold text-2xl mb-4 mx-auto shadow-neon">
            I
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00FF41] mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Carregando perfil...</p>
          
          {/* Botão de emergência para forçar logout */}
          <button
            onClick={() => {
              signOut();
            }}
            className="mt-8 px-4 py-2 bg-red-600 text-white rounded-lg transition-colors hover:bg-red-700 dark:hover:bg-red-500"
          >
            Forçar Logout (Caso Esteja Travado)
          </button>
        </div>
      </div>
    );
  }

  // Verificar se precisa completar onboarding
  if (profile && !profile.onboarding_completed) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <CreatorOnboarding 
          onComplete={() => {
            // Recarregar perfil após completar onboarding
            window.location.reload();
          }} 
        />
      </Suspense>
    );
  }

  const menuItems = [
    { path: '/creators/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/creators/opportunities', label: 'Oportunidades', icon: Target, badge: opportunitiesCount > 0 ? opportunitiesCount : undefined },
    { path: '/creators/projects', label: 'Projetos', icon: Folder },
    { path: '/creators/messages', label: 'Mensagens', icon: MessageCircle },
    { path: '/creators/training', label: 'Treinamentos', icon: GraduationCap, locked: true },
    { path: '/creators/profile', label: 'Perfil', icon: User },
    { path: '/creators/help', label: 'Ajuda', icon: HelpCircle }
  ];

  const isActiveRoute = (path: string) => {
    return currentPath === path;
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden text-slate-100">
      {/* Sidebar */}
      <div className="glass-sidebar fixed left-0 top-0 z-50 h-full w-72 overflow-hidden">
        {/* Logo */}
        <div className="flex h-20 items-center px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00FF41] to-[#00CC34] text-sm font-bold text-black shadow-neon">
            I
          </div>
          <span className="ml-3 text-sm font-semibold uppercase tracking-[0.45em] text-slate-200">
            Hub
          </span>
        </div>

        {/* Navigation */}
        <nav
          className="mt-6 flex flex-1 flex-col gap-0.5 px-2"
          style={{ maxHeight: 'calc(100vh - 180px)', overflowY: 'hidden' }}
        >
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = isActiveRoute(item.path);
            const buttonClasses = [
              'group relative w-full rounded-2xl transition-all duration-300 flex items-center gap-2 px-4 py-2.5'
            ];

            buttonClasses.push(
              isActive
                ? 'bg-gradient-to-r from-[#00FF41]/85 to-[#00CC34]/80 text-black shadow-neon'
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
                <div className="relative">
                  <div className={iconWrapperClasses}>
                    <Icon
                      className={`h-5 w-5 ${
                        isActive
                          ? 'text-white drop-shadow-[0_0_12px_rgba(110,79,255,0.65)]'
                          : 'text-slate-300 group-hover:text-white/90'
                      }`}
                    />
                  </div>
                  {item.locked && (
                    <Lock className="absolute -bottom-1 -right-1 h-3.5 w-3.5 text-slate-200" />
                  )}
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-gradient-to-r from-[#00FF41] to-[#00CC34] px-1 text-[10px] font-semibold text-black">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="ml-1 whitespace-nowrap text-sm font-medium tracking-wide">
                  {item.label}
                </span>

                {(item.badge || item.locked) && (
                  <div className="ml-auto flex items-center gap-2">
                    {item.locked && <Lock className="h-4 w-4 text-slate-300" />}
                    {item.badge && (
                      <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-gradient-to-r from-[#00FF41] to-[#00CC34] px-2 text-xs font-semibold text-black">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="absolute bottom-5 left-2 right-2">
          <div className="relative">
            <button
              onClick={() => setShowSidebarUserDropdown(!showSidebarUserDropdown)}
              className="group flex w-full items-center justify-start gap-3 rounded-2xl bg-white/5 px-4 py-3 text-left transition-all duration-300 hover:bg-white/10"
            >
              <Avatar
                src={profile?.avatar_url}
                alt={user.user_metadata?.name || user.email || 'User'}
                size="sm"
                fallbackInitials={user.user_metadata?.name || user.email}
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">
                  {user.user_metadata?.name || user.email}
                </div>
                <div className="text-xs uppercase tracking-[0.4em] text-slate-400">Creator</div>
              </div>
            </button>

            {showSidebarUserDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSidebarUserDropdown(false)} />
                <div className="absolute bottom-full left-0 mb-3 w-52 overflow-hidden rounded-2xl border border-white/12 bg-black/95 backdrop-blur-[30px] saturate-150 z-20">
                  <div className="divide-y divide-white/10 text-sm text-slate-200">
                    <button
                      onClick={() => {
                        navigate('/creators/profile');
                        setShowSidebarUserDropdown(false);
                      }}
                      className="block w-full px-4 py-3 text-left transition hover:bg-white/5"
                    >
                      Meu Perfil
                    </button>
                    <button
                      onClick={() => {
                        navigate('/creators/settings');
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
                      className="block w-full px-4 py-3 text-left text-red-300 transition hover:bg-red-500/10"
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

      {/* Main content */}
      <div className="flex-1 ml-72">
        <header
          className="glass-header overflow-visible fixed top-0 right-0 z-40 flex h-20 items-center justify-between px-6"
          style={{ left: '288px' }}
        >
          <div className="w-full max-w-xl">
            <GlobalSearch />
          </div>

          <div className="flex items-center gap-4">
            <NotificationDropdown />
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="group flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 transition hover:bg-white/10"
              >
                <Avatar
                  src={profile?.avatar_url}
                  alt={user.user_metadata?.name || user.email || 'User'}
                  size="sm"
                  fallbackInitials={user.user_metadata?.name || user.email}
                />
                <div className="text-left">
                  <div className="text-sm font-semibold text-white">
                    {user.user_metadata?.name || user.email}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.45em] text-slate-400">Creator</div>
                </div>
              </button>

              {showUserDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowUserDropdown(false)} />
                  <div className="absolute right-0 mt-3 w-56 overflow-hidden rounded-2xl border border-white/12 bg-black/95 backdrop-blur-[30px] saturate-150 shadow-[0_25px_70px_-30px_rgba(0,0,0,0.9)]">
                    <div className="divide-y divide-white/10 text-sm text-slate-200">
                      <button
                        onClick={() => {
                          navigate('/creators/profile');
                          setShowUserDropdown(false);
                        }}
                        className="block w-full px-4 py-3 text-left transition hover:bg-white/5"
                      >
                        Meu Perfil
                      </button>
                      <button
                        onClick={() => {
                          navigate('/creators/settings');
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
                        className="block w-full px-4 py-3 text-left text-red-300 transition hover:bg-red-500/10"
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

        <main className="relative z-10 mt-24 px-6 pb-10">
          <CreatorRouter
            onOpenConversation={handleOpenConversation}
            selectedConversationId={selectedProjectId}
            onBackToList={handleBackToMessagesList}
          />
        </main>
      </div>
    </div>
  );
}

function App() {
  const { currentPath } = useRouter();

  // Handle login routes first (more specific)
  if (currentPath === '/login/creators') {
    return (
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
          <CreatorLoginPage />
        </Suspense>
      </AuthProvider>
    );
  }

  if (currentPath === '/login/analysts') {
    return (
      <AnalystAuthProvider>
        <Suspense fallback={<RouteFallback />}>
          <AnalystLoginPage />
        </Suspense>
      </AnalystAuthProvider>
    );
  }

  // Handle generic auth routes
  if (currentPath === '/auth/email-confirmed') {
    return (
      <Suspense fallback={<RouteFallback />}>
        <EmailConfirmationPage />
      </Suspense>
    );
  }

  // Handle root route
  if (currentPath === '/') {
    return (
      <Suspense fallback={<RouteFallback />}>
        <LandingPage />
      </Suspense>
    );
  }

  // Handle analyst routes
  if (currentPath.startsWith('/analysts')) {
    return (
      <AnalystAuthProvider>
        <Suspense fallback={<RouteFallback />}>
          <AnalystApp />
        </Suspense>
      </AnalystAuthProvider>
    );
  }

  // Handle creator routes
  if (currentPath.startsWith('/creators')) {
    return (
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
          <CreatorApp />
        </Suspense>
      </AuthProvider>
    );
  }

  // Default fallback to landing page for any unmatched route
  return (
    <Suspense fallback={<RouteFallback />}>
      <LandingPage />
    </Suspense>
  );
}

export default App;