import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';

interface MentionListProps {
  items: { id: string; name: string; email: string }[];
  command: (item: { id: string; label: string }) => void;
}

export const MentionList = forwardRef<any, MentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  const selectItem = useCallback(
    (index: number) => {
      const user = props.items[index];
      if (user) {
        props.command({ id: user.id, label: user.name });
      }
    },
    [props.items, props.command]
  );

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % props.items.length);
        return true;
      }
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i - 1 + props.items.length) % props.items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (props.items.length === 0) {
    return (
      <div className="bg-white border rounded-lg shadow-lg p-2 text-sm text-gray-400 min-w-[200px]">
        No users found
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg shadow-lg overflow-hidden min-w-[200px]">
      {props.items.map((user, index) => (
        <button
          key={user.id}
          className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2 ${
            index === selectedIndex ? 'bg-blue-100' : ''
          }`}
          onClick={() => selectItem(index)}
        >
          <span className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-xs font-medium text-blue-700">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <span>{user.name}</span>
          <span className="text-xs text-gray-400 ml-auto">{user.email}</span>
        </button>
      ))}
    </div>
  );
});
