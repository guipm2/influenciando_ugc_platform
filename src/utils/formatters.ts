const onlyDigits = (value: string) => value.replace(/\D/g, '');

export const detectDocumentType = (value: string): 'cpf' | 'cnpj' | null => {
  const digits = onlyDigits(value);

  if (!digits.length) {
    return null;
  }

  if (digits.length > 11) {
    return 'cnpj';
  }

  if (digits.length === 11) {
    return 'cpf';
  }

  return null;
};

export const formatCPF = (value: string) => {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export const formatCNPJ = (value: string) => {
  const digits = onlyDigits(value).slice(0, 14);

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

export const formatDocument = (value: string, type?: 'cpf' | 'cnpj') => {
  const digits = onlyDigits(value);

  if (!digits.length) {
    return '';
  }

  const documentType = type ?? (digits.length > 11 ? 'cnpj' : 'cpf');

  return documentType === 'cnpj' ? formatCNPJ(digits) : formatCPF(digits);
};

export const formatCEP = (value: string) => {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

export const formatPhone = (value: string) => {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export const stripFormatting = (value: string) => onlyDigits(value);

const sanitizeHandle = (value: string) =>
  value.replace(/^@+/, '').split(/[/?#]/)[0]?.trim() ?? '';

const ensureHttps = (value: string) =>
  /^https?:\/\//i.test(value) ? value : `https://${value.replace(/^https?:\/\//i, '')}`;

const isLikelyDomain = (value: string) => /[a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?$/i.test(value);

/**
 * Normaliza links informados para oportunidades, aceitando @handles, domínios sem protocolo
 * e URLs do Instagram. Retorna string vazia para valores inválidos ou vazios.
 */
export const normalizeCompanyLink = (raw?: string | null) => {
  if (!raw) return '';

  const trimmed = raw.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^@/.test(trimmed)) {
    const handle = sanitizeHandle(trimmed);
    return handle ? `https://instagram.com/${handle}` : '';
  }

  if (/^(?:www\.)?instagram\.com\//i.test(trimmed)) {
    const withoutWww = trimmed.replace(/^www\./i, '');
    return ensureHttps(withoutWww);
  }

  if (/^www\./i.test(trimmed) || isLikelyDomain(trimmed)) {
    return ensureHttps(trimmed);
  }

  const handle = sanitizeHandle(trimmed);
  return handle ? `https://instagram.com/${handle}` : '';
};

export const isInstagramUrl = (url?: string | null) =>
  typeof url === 'string' && /instagram\.com/i.test(url);

export const formatRelativeTime = (date: string | Date): string => {
  const activityDate = new Date(date);
  const now = new Date();
  const diffInHours = (now.getTime() - activityDate.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 1) return 'Agora mesmo';
  if (diffInHours < 24) return `Há ${Math.floor(diffInHours)}h`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Ontem';
  return `Há ${diffInDays} dias`;
};
