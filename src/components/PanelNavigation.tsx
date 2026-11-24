import { useId } from 'react';
import type { ReactNode } from 'react';

interface PanelItem<Section extends string> {
  id: Section;
  label: string;
  icon: ReactNode;
  count?: number;
}

interface PanelNavigationProps<Section extends string> {
  label: string;
  current: Section;
  items: PanelItem<Section>[];
  onSelect: (section: Section) => void;
  action?: ReactNode;
}

export function PanelNavigation<Section extends string>({
  label,
  current,
  items,
  onSelect,
  action,
}: PanelNavigationProps<Section>) {
  const pickerId = useId();

  return (
    <aside className="panel-sidebar">
      <p className="panel-nav-heading">{label}</p>
      <nav className="panel-nav-list" aria-label={label}>
        {items.map(({ id, label: title, icon, count }) => (
          <button
            key={id}
            type="button"
            className={`panel-nav-btn ${id === current ? 'active' : ''}`}
            aria-current={id === current ? 'page' : undefined}
            onClick={() => onSelect(id)}
          >
            {icon}
            <span>{title}</span>
            {count !== undefined && (
              <small
                className="panel-nav-count"
                style={
                  count > 0
                    ? {
                        background: '#10B981',
                        color: '#FFFFFF',
                        fontWeight: 800,
                        minWidth: 22,
                        height: 22,
                        padding: '0 7px',
                        borderRadius: 999,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.22)',
                      }
                    : undefined
                }
              >
                {count}
              </small>
            )}
          </button>
        ))}
      </nav>
      <div className="panel-nav-picker">
        <label htmlFor={pickerId}>{label}</label>
        <select
          id={pickerId}
          value={current}
          onChange={(event) => onSelect(event.target.value as Section)}
        >
          {items.map(({ id, label: title, count }) => (
            <option key={id} value={id}>{title}{count !== undefined ? ` (${count})` : ''}</option>
          ))}
        </select>
      </div>
      {action && <div className="panel-nav-footer">{action}</div>}
    </aside>
  );
}
