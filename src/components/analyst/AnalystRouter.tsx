import React, { Suspense, lazy } from 'react';
import { useRouter } from '../../hooks/useRouter';

const AnalystOverview = lazy(() => import('./AnalystOverview'));
const OpportunityManagement = lazy(() => import('./OpportunityManagement'));
const OpportunityStagesManagementWrapper = lazy(() => import('./OpportunityStagesManagementWrapper'));
const ProjectManagement = lazy(() => import('./ProjectManagement'));
const CreatorsList = lazy(() => import('./CreatorsList'));
const AnalystMessages = lazy(() => import('./AnalystMessages'));
const AnalystAccountSettings = lazy(() => import('./AnalystAccountSettings'));
const EnhancedDeliverableManagement = lazy(() => import('./EnhancedDeliverableManagement'));
const EnhancedProjectDashboard = lazy(() => import('./EnhancedProjectDashboard'));
const CreatorProfilePage = lazy(() => import('./CreatorProfilePage'));

interface AnalystRouterProps {
  onOpenConversation: (conversationId: string) => void;
  selectedConversationId: string | null;
  onBackToList: () => void;
}

const AnalystRouter: React.FC<AnalystRouterProps> = ({ 
  onOpenConversation, 
  selectedConversationId, 
  onBackToList 
}) => {
  const { currentPath } = useRouter();

  const renderWithSuspense = (element: React.ReactNode) => (
    <Suspense
      fallback={
        <div className="flex min-h-[35vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/25 border-t-transparent" />
        </div>
      }
    >
      {element}
    </Suspense>
  );

  // Extract the route from the path (remove /analysts prefix)
  const route = currentPath.replace('/analysts', '');

  // Handle project details route with ID parameter
  if (route.startsWith('/projects/') && route !== '/projects') {
    const projectId = route.split('/')[2];
    return renderWithSuspense(
      <ProjectManagement onOpenConversation={onOpenConversation} selectedProjectId={projectId} />
    );
  }

  if (route.startsWith('/creators/') && route !== '/creators') {
    return renderWithSuspense(<CreatorProfilePage />);
  }
  
  switch (route) {
    case '/overview':
      return renderWithSuspense(<AnalystOverview key={route} />);
    case '/project-dashboard':
      return renderWithSuspense(<EnhancedProjectDashboard key={route} />);
    case '/opportunities':
      return renderWithSuspense(<OpportunityManagement key={route} />);
    case '/stages':
      return renderWithSuspense(<OpportunityStagesManagementWrapper key={route} />);
    case '/projects':
      return renderWithSuspense(<ProjectManagement key={route} onOpenConversation={onOpenConversation} />);
    case '/deliverables':
      return renderWithSuspense(<EnhancedDeliverableManagement key={route} />);
    case '/creators':
      return renderWithSuspense(<CreatorsList key={route} onOpenConversation={onOpenConversation} />);
    case '/messages':
      return renderWithSuspense(
        <AnalystMessages key={route} selectedConversationId={selectedConversationId} onBackToList={onBackToList} />
      );
    case '/settings':
    case '/profile':
      return renderWithSuspense(<AnalystAccountSettings key={route} />);
    default:
      return renderWithSuspense(<AnalystOverview key={route} />);
  }
};

export default AnalystRouter;