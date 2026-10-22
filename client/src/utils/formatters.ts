export function formatCurrency(amount: number): string {
  const rounded = Math.round(amount || 0);
  return `Rs. ${new Intl.NumberFormat('en-PK').format(rounded)}`;
}

export function formatDateTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('en-PK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Karachi',
    }).format(d);
  } catch (e) {
    return isoString;
  }
}

export function formatTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('en-PK', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Karachi',
    }).format(d);
  } catch (e) {
    return isoString;
  }
}

export function formatDate(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('en-PK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Karachi',
    }).format(d);
  } catch (e) {
    return isoString;
  }
}

export function getStatusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'available':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'ready':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'preparing':
    case 'occupied':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'pending':
    case 'reserved':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'cancelled':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}
