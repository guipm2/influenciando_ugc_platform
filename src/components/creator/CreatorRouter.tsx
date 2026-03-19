import React, { Suspense, lazy } from 'react';
import { useRouter } from '../../hooks/useRouter';

const Dashboard = lazy(() => import('../Dashboard'));
const Opportunities = lazy(() => import('../Opportunities'));
const OpportunityDetailsPage = lazy(() => import('../OpportunityDetailsPage'));
const Projects = lazy(() => import('../Projects'));
const Messages = lazy(() => import('../Messages'));
const Training = lazy(() => import('../Training'));
const Profile = lazy(() => import('../Profile'));
const Help = lazy(() => import('../Help'));
const AccountSettings = lazy(() => import('../AccountSettings'));

interface CreatorRouterProps {
  onOpenConversation: (projectId: string) => void; // Changed for clarity
  selectedConversationId: string | null; // Will receive projectId but keeping prop name for compatibility
  onBackToList: () => void;
}

const CreatorRouter: React.FC<CreatorRouterProps> = ({ 
  onOpenConversation, 
  selectedConversationId, 
  onBackToList 
}) => {
  const { currentPath } = useRouter();

  const renderWithSuspense = (element: React.ReactNode) => (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/25 border-t-transparent" />
        </div>
      }
    >
      {element}
    </Suspense>
  );

  // Extract the route from the path (remove /creators prefix)
  const route = currentPath.replace('/creators', '') || '/opportunities';

  // Handle opportunity details route with ID parameter
  if (route.startsWith('/opportunities/') && route !== '/opportunities') {
    const opportunityId = route.split('/')[2];
    return renderWithSuspense(<OpportunityDetailsPage opportunityId={opportunityId} />);
  }

  // Handle project details route with ID parameter
  if (route.startsWith('/projects/') && route !== '/projects') {
    const projectId = route.split('/')[2];
    return renderWithSuspense(<Projects selectedProjectId={projectId} onOpenConversation={onOpenConversation} />);
  }

  // Handle messages with project ID parameter
  if (route.startsWith('/messages/') && route !== '/messages') {
    const projectId = route.split('/')[2];
    return renderWithSuspense(<Messages selectedProjectId={projectId} onBackToList={onBackToList} />);
  }

  switch (route) {
    case '/dashboard':
      return renderWithSuspense(<Dashboard key={route} />);
    case '/opportunities':
      return renderWithSuspense(<Opportunities key={route} />);
    case '/projects':
      return renderWithSuspense(<Projects key={route} onOpenConversation={onOpenConversation} />);
    case '/messages':
      return renderWithSuspense(
        <Messages key={route} selectedProjectId={selectedConversationId} onBackToList={onBackToList} />
      );
    case '/training':
      return renderWithSuspense(<Training key={route} />);
    case '/profile':
      return renderWithSuspense(<Profile key={route} />);
    case '/help':
      return renderWithSuspense(<Help key={route} />);
    case '/settings':
      return renderWithSuspense(<AccountSettings key={route} />);
    default:
      return renderWithSuspense(<Opportunities key={route} />);
  }
};

export default CreatorRouter;