export function onSpace(callback: () => void) {
  const handler = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (
      event.code !== 'Space' ||
      event.repeat ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName) ||
      target.getAttribute('role') === 'button'
    )
      return;
    event.preventDefault();
    callback();
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
