import { toast } from '@/lib/toast';

export async function copyText(text: string, { silent = false } = {}) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard API needs a secure context; fall back for plain-http LAN access.
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  if (!silent) toast('Copied to clipboard');
}
