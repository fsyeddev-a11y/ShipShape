/**
 * @deprecated Use useUnifiedDocuments from '@/hooks/useUnifiedDocuments' instead.
 *
 * This context is maintained for backward compatibility but should not be used
 * for new code. The unified document model treats all document types consistently
 * through a single hook.
 *
 * Migration:
 *   Before: const { issues } = useIssues()
 *   After:  const { byType: { issue: issues } } = useUnifiedDocuments({ type: 'issue' })
 */
import { createContext, useContext, useMemo, ReactNode } from 'react';
import {
  useIssuesInfiniteQuery,
  useCreateIssue,
  useUpdateIssue,
  isCascadeWarningError,
  Issue,
  CreateIssueOptions,
} from '@/hooks/useIssuesQuery';

export type { Issue, CreateIssueOptions };

interface IssuesContextValue {
  issues: Issue[];
  loading: boolean;
  createIssue: (options?: CreateIssueOptions) => Promise<Issue | null>;
  updateIssue: (id: string, updates: Partial<Issue>) => Promise<Issue | null>;
  refreshIssues: () => Promise<void>;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}

const IssuesContext = createContext<IssuesContextValue | null>(null);

export function IssuesProvider({ children }: { children: ReactNode }) {
  const {
    data,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useIssuesInfiniteQuery();

  const createMutation = useCreateIssue();
  const updateMutation = useUpdateIssue();

  const issues = useMemo(
    () => data?.pages.flatMap(page => page.issues) ?? [],
    [data]
  );

  const createIssue = async (options?: CreateIssueOptions): Promise<Issue | null> => {
    try {
      return await createMutation.mutateAsync(options || {});
    } catch {
      return null;
    }
  };

  const updateIssue = async (id: string, updates: Partial<Issue>): Promise<Issue | null> => {
    try {
      return await updateMutation.mutateAsync({ id, updates });
    } catch (error) {
      if (isCascadeWarningError(error)) throw error;
      return null;
    }
  };

  const refreshIssues = async () => { await refetch(); };

  const value: IssuesContextValue = {
    issues,
    loading: isLoading,
    createIssue,
    updateIssue,
    refreshIssues,
    fetchNextPage: () => fetchNextPage(),
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
  };

  return (
    <IssuesContext.Provider value={value}>
      {children}
    </IssuesContext.Provider>
  );
}

export function useIssues() {
  const context = useContext(IssuesContext);
  if (!context) {
    throw new Error('useIssues must be used within IssuesProvider');
  }
  return context;
}
