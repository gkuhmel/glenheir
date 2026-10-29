/** Message bref affiché au-dessus de la barre du bas. */
export function showToast(message: string, durationMs = 3500): void {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  document.getElementById('ui')?.appendChild(toast);
  window.setTimeout(() => toast.remove(), durationMs);
}
