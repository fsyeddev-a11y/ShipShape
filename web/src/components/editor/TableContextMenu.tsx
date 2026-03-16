import { Editor } from '@tiptap/react';
import { ContextMenuItem, ContextMenuSeparator } from '@/components/ui/ContextMenu';

interface TableContextMenuItemsProps {
  editor: Editor;
  onClose: () => void;
}

export function TableContextMenuItems({ editor, onClose }: TableContextMenuItemsProps) {
  return (
    <>
      <ContextMenuItem onClick={() => { editor.chain().focus().addRowAfter().run(); onClose(); }}>
        Add row
      </ContextMenuItem>
      <ContextMenuItem onClick={() => { editor.chain().focus().addColumnAfter().run(); onClose(); }}>
        Add column
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => { editor.chain().focus().deleteRow().run(); onClose(); }}>
        Delete row
      </ContextMenuItem>
      <ContextMenuItem onClick={() => { editor.chain().focus().deleteColumn().run(); onClose(); }}>
        Delete column
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => { editor.chain().focus().deleteTable().run(); onClose(); }} destructive>
        Delete table
      </ContextMenuItem>
    </>
  );
}
