/**
 * GS1 Utilities for TicSol Logistics Hub WMS
 * Handles SSCC-18 generation, GS1-128 string formatting, Modulo-10 checksums,
 * and Code128 pattern drawing for high-precision SVG labels.
 */

// Calculate GS1 Modulo 10 Check Digit for SSCC / GTIN
export function calculateGS1CheckDigit(digits17: string): number {
  if (digits17.length !== 17 || !/^\d+$/.test(digits17)) {
    throw new Error('SSCC input must be exactly 17 numeric digits before check digit.');
  }

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const digit = parseInt(digits17[16 - i], 10);
    // Position 1 (rightmost, index 16) is multiplied by 3, position 2 by 1, position 3 by 3...
    const weight = i % 2 === 0 ? 3 : 1;
    sum += digit * weight;
  }

  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

// Generate valid SSCC-18 string
export function generateSSCC(
  extensionDigit: number = 3,
  companyPrefix: string = '5601234',
  serialNum: number = Math.floor(Math.random() * 899999999) + 100000000
): { ssccFull: string; ssccFormatted: string; checkDigit: number } {
  const serialPadded = serialNum.toString().padStart(9, '0').slice(0, 9);
  const base17 = `${extensionDigit}${companyPrefix}${serialPadded}`;
  const checkDigit = calculateGS1CheckDigit(base17);
  const ssccFull = `${base17}${checkDigit}`;

  // Formatted as standard GS1 readable: (00) 3 5601234 000000123 4
  const ssccFormatted = `(00) ${ssccFull.slice(0, 1)} ${ssccFull.slice(1, 8)} ${ssccFull.slice(8, 17)} ${ssccFull.slice(17)}`;

  return { ssccFull, ssccFormatted, checkDigit };
}

// Generate standard GS1-128 Application Identifier string for logistic pallets
export function buildGS1128String(params: {
  sscc: string;
  gtinEan?: string;
  lote: string;
  validadeYYMMDD: string;
  qtdCaixas: number;
}): string {
  const ssccClean = params.sscc.replace(/\D/g, '');
  const eanClean = (params.gtinEan || '05601234567890').replace(/\D/g, '').padStart(14, '0');
  const qtdStr = params.qtdCaixas.toString().padStart(4, '0');
  
  // Format: (00)SSCC (01)GTIN (10)LOTE (15)VALIDADE (37)QTD
  return `(00)${ssccClean}(01)${eanClean}(10)${params.lote}(15)${params.validadeYYMMDD}(37)${qtdStr}`;
}

// Format Date YYYY-MM-DD to GS1 YYMMDD
export function formatToGS1Date(dateIsoString: string): string {
  if (!dateIsoString) return '261231';
  const parts = dateIsoString.split('-');
  if (parts.length < 3) return '261231';
  const yy = parts[0].slice(2, 4);
  const mm = parts[1];
  const dd = parts[2];
  return `${yy}${mm}${dd}`;
}

/**
 * Minimal Code 128 / GS1-128 SVG Barcode Pattern Generator
 * Generates bar width patterns (0s and 1s) for crisp rendering.
 */
const CODE128_PATTERNS: { [key: number]: string } = {
  0: '212222', 1: '222122', 2: '222221', 3: '121223', 4: '121322', 5: '131222', 6: '122213',
  7: '122312', 8: '132212', 9: '221213', 10: '221312', 11: '231212', 12: '112232', 13: '122132',
  14: '122231', 15: '113222', 16: '123122', 17: '123221', 18: '223211', 19: '221132', 20: '221231',
  21: '213212', 22: '223112', 23: '312131', 24: '311222', 25: '321122', 26: '321221', 27: '312212',
  28: '322112', 29: '322211', 30: '212123', 31: '212321', 32: '232121', 33: '111323', 34: '131123',
  35: '131321', 36: '112313', 37: '132113', 38: '132311', 39: '211313', 40: '231113', 41: '231311',
  42: '112133', 43: '112331', 44: '132131', 45: '113123', 46: '113321', 47: '133121', 48: '313121',
  49: '211331', 50: '231131', 51: '213113', 52: '213311', 53: '213131', 54: '311123', 55: '311321',
  56: '331121', 57: '312113', 58: '312311', 59: '332111', 60: '314111', 61: '221411', 62: '431111',
  63: '111224', 64: '111422', 65: '121124', 66: '121421', 67: '141122', 68: '141221', 69: '112214',
  70: '112412', 71: '122114', 72: '122411', 73: '142112', 74: '142211', 75: '241211', 76: '221114',
  77: '413111', 78: '241112', 79: '134111', 80: '111242', 81: '121142', 82: '121241', 83: '114212',
  84: '124112', 85: '124211', 86: '411212', 87: '421112', 88: '421211', 89: '212141', 90: '214121',
  91: '412121', 92: '111143', 93: '111341', 94: '113141', 95: '114113', 96: '114311', 97: '411113',
  98: '411311', 99: '113114', 100: '114131', 101: '311141', 102: '411131', 103: '211412', 104: '211214',
  105: '211232', 106: '2331112'
};

/**
 * Encodes numeric string into Code128-C pattern bars (width ratios).
 */
export function encodeCode128C(digits: string): string {
  const clean = digits.replace(/\D/g, '');
  const pairs: number[] = [];
  
  let i = 0;
  if (clean.length % 2 !== 0) {
    // If odd length, handle leading single digit or pad
    pairs.push(parseInt(clean[0], 10));
    i = 1;
  }
  
  for (; i < clean.length; i += 2) {
    pairs.push(parseInt(clean.slice(i, i + 2), 10));
  }

  // Start C Code = 105
  const codeSequence = [105, ...pairs];
  
  // Calculate checksum
  let checksum = 105;
  for (let idx = 1; idx < codeSequence.length; idx++) {
    checksum += codeSequence[idx] * idx;
  }
  const checkSymbol = checksum % 103;
  codeSequence.push(checkSymbol);
  
  // Stop Code = 106
  codeSequence.push(106);

  // Convert to pattern sequence of bar widths
  let patternStr = '';
  codeSequence.forEach(val => {
    patternStr += CODE128_PATTERNS[val] || '211214';
  });

  return patternStr;
}
