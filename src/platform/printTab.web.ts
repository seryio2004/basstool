import { printDocument } from '../core/tabPrint';
export function printTab(...args: Parameters<typeof printDocument>) {
  const tab = window.open('', '_blank');
  if (!tab) throw new Error('Permite la ventana de impresión para guardar el PDF.');
  tab.opener = null;
  tab.document.open();
  tab.document.write(printDocument(...args));
  tab.document.close();
  tab.focus();
  tab.print();
}
