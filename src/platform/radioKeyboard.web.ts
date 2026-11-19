import type { KeyboardEvent } from 'react';

export function radioKeyboard(
  index: number,
  selectedIndex: number,
  count: number,
  disabled: boolean,
  select: (index: number) => void,
) {
  return {
    tabIndex: disabled ? -1 : index === Math.max(0, selectedIndex) ? 0 : -1,
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      if (
        disabled ||
        !['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)
      )
        return;
      event.preventDefault();
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? count - 1
            : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + count) % count;
      const group = event.currentTarget.closest('[role="radiogroup"]');
      select(next);
      requestAnimationFrame(() =>
        group?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus(),
      );
    },
  };
}
