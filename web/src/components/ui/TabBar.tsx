import { useRef, useCallback } from 'react';
import { cn } from '@/lib/cn';

export interface Tab {
  id: string;
  label: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  rightContent?: React.ReactNode;
}

export function TabBar({ tabs, activeTab, onTabChange, rightContent }: TabBarProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const currentIndex = tabRefs.current.findIndex(t => t === document.activeElement);
    if (currentIndex === -1) return;

    let nextIndex: number | null = null;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = tabs.length - 1;
    }

    if (nextIndex !== null) {
      tabRefs.current[nextIndex]?.focus();
      onTabChange(tabs[nextIndex]!.id);
    }
  }, [tabs, onTabChange]);

  return (
    <div className="flex items-center justify-between border-b border-border px-6">
      <div className="flex" role="tablist" aria-label="Content tabs" onKeyDown={handleKeyDown}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current[index] = el; }}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative px-4 py-3 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'text-foreground'
                : 'text-muted hover:text-foreground'
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
      {rightContent && <div className="flex items-center gap-2">{rightContent}</div>}
    </div>
  );
}
