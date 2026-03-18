import { describe, expect, it } from 'vitest';
import {
  detectDocumentType,
  formatCEP,
  formatCPF,
  formatCNPJ,
  formatDocument,
  normalizeCompanyLink,
  stripFormatting
} from './formatters';

describe('formatters utils', () => {
  it('detecta tipo de documento corretamente', () => {
    expect(detectDocumentType('123.456.789-09')).toBe('cpf');
    expect(detectDocumentType('12.345.678/0001-90')).toBe('cnpj');
    expect(detectDocumentType('')).toBeNull();
  });

  it('formata cpf e cnpj', () => {
    expect(formatCPF('12345678909')).toBe('123.456.789-09');
    expect(formatCNPJ('12345678000190')).toBe('12.345.678/0001-90');
  });

  it('formata documento automaticamente pelo tamanho', () => {
    expect(formatDocument('12345678909')).toBe('123.456.789-09');
    expect(formatDocument('12345678000190')).toBe('12.345.678/0001-90');
  });

  it('formata cep e remove mascara', () => {
    expect(formatCEP('12345678')).toBe('12345-678');
    expect(stripFormatting('(27) 99263-0725')).toBe('27992630725');
  });

  it('normaliza links de empresa', () => {
    expect(normalizeCompanyLink('@influenciando')).toBe('https://instagram.com/influenciando');
    expect(normalizeCompanyLink('instagram.com/influenciando')).toBe(
      'https://instagram.com/influenciando'
    );
    expect(normalizeCompanyLink('example.com')).toBe('https://example.com');
  });
});
