import type { ReactNode } from 'react';
import { ItemRow } from './ItemRow';
import type { ContentItem } from '../lib/types';

export type ItemGroup = {
  id: string;
  title: string;
  description?: string;
  items: ContentItem[];
};

type ItemListProps = {
  groups: ItemGroup[];
  timezone: string;
  onEdit: (item: ContentItem) => void;
  onPublish: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  emptyState?: ReactNode;
};

export function ItemList({ groups, timezone, onEdit, onPublish, onDelete, emptyState }: ItemListProps) {
  const visibleGroups = groups.filter((group) => group.items.length > 0);

  if (visibleGroups.length === 0) {
    return <div className="empty-state">{emptyState ?? 'لا توجد مواعيد تطابق هذه الفلاتر.'}</div>;
  }

  return (
    <div className="item-groups">
      {visibleGroups.map((group) => (
        <section className="item-group" key={group.id} aria-labelledby={`group-${group.id}`}>
          <div className="group-heading">
            <h2 id={`group-${group.id}`}>{group.title}</h2>
            {group.description && <p>{group.description}</p>}
            <span className="group-count">{group.items.length}</span>
          </div>
          <div className="group-items">
            {group.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                timezone={timezone}
                onEdit={onEdit}
                onPublish={onPublish}
                onDelete={onDelete}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
