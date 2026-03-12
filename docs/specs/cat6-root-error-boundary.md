# Spec 6.1: Add Root ErrorBoundary in main.tsx

**Category:** 6 — Runtime Error Handling (also Category 7 — Accessibility, Critical #3)
**Priority:** High (Quick Win)
**Severity:** High / Critical
**Audit Finding:** Category 6 Finding 1, Category 7 Critical #3

---

## Problem

`main.tsx` has no `<ErrorBoundary>` wrapping the 8 providers. Any provider crash (e.g., auth context failure, query client error) produces a blank white screen with no recovery path. The existing error boundary in `App.tsx:542` only covers page content, not the provider stack.

This is also a **Critical accessibility violation** — a blank white screen provides no information to any user, including assistive technology users.

## Fix

Add a root-level `<ErrorBoundary>` in `main.tsx` wrapping all providers.

### Steps

1. Create a `RootErrorBoundary` component (or use `react-error-boundary` if already in deps):
   ```tsx
   class RootErrorBoundary extends React.Component<Props, State> {
     state = { hasError: false, error: null };

     static getDerivedStateFromError(error: Error) {
       return { hasError: true, error };
     }

     render() {
       if (this.state.hasError) {
         return (
           <div role="alert" style={{ padding: '2rem', fontFamily: 'system-ui' }}>
             <h1>Something went wrong</h1>
             <p>The application encountered an unexpected error. Please refresh the page.</p>
             <button onClick={() => window.location.reload()}>Refresh</button>
           </div>
         );
       }
       return this.props.children;
     }
   }
   ```
2. Wrap the provider stack in `main.tsx`:
   ```tsx
   <RootErrorBoundary>
     <QueryClientProvider>
       <AuthProvider>
         {/* ... other providers */}
         <App />
       </AuthProvider>
     </QueryClientProvider>
   </RootErrorBoundary>
   ```
3. Ensure the error fallback UI includes `role="alert"` for accessibility

## Verification

- Provider crash shows error message instead of blank white screen
- Error boundary catches and displays errors from any provider in the stack
- Refresh button recovers the application
- `role="alert"` is present in the fallback UI

## Audit Targets Addressed

- Fixes Category 6 improvement target: error handling gap with user-facing impact
- Fixes Category 7 Critical violation #3: blank white screen on provider crash
- ~5 lines of code for high-impact fix
