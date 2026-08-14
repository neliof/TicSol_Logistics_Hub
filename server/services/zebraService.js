// server/services/zebraService.js

const config = require('../config/zebra.config');

// Utility: Convert mm to dots at given DPI
function mmToDots(mm, dpi = 203) {
  const dotsPerMm = config.dpi.dotsPerMm[dpi];
  return Math.round(mm * dotsPerMm);
}

// Utility: Convert dots back to mm
function dotsToMm(dots, dpi = 203) {
  const dotsPerMm = config.dpi.dotsPerMm[dpi];
  return dots / dotsPerMm;
}

// Generate ZPL header
function generateZPLHeader(paperWidthMm, paperHeightMm, dpi = 203) {
  const widthDots = mmToDots(paperWidthMm, dpi);
  const heightDots = mmToDots(paperHeightMm, dpi);

  return `^XA
^MMT
^PW${widthDots}
^LL${heightDots}
^LS0`;
}

// Generate ZPL footer
function generateZPLFooter() {
  return '^XZ';
}

// Estimate text height in mm based on font size and line count
function estimateTextHeightMm(fontSize, lineCount, lineSpacing = 0.5) {
  const fontHeightMm = fontSize * 0.03527;  // Approximate mm per font size
  return (fontHeightMm * lineCount) + (lineSpacing * (lineCount - 1));
}

// Build ZPL for single label
function buildLabelZPL(labelData, compactState, paperSize, dpi = 203) {
  const {
    fontSize,
    barcodeHeight,
    marginPx,
    sectionPadding,
  } = compactState;

  const marginMm = marginPx / 8;  // Approximate conversion
  const contentStartX = mmToDots(marginMm, dpi);
  const contentStartY = mmToDots(marginMm, dpi);

  let zpl = generateZPLHeader(paperSize.width, paperSize.height, dpi);

  // Section 1: Header (Sender/Recipient)
  zpl += `
^FT${contentStartX},${contentStartY}^A0N,${fontSize},${fontSize}^FDREMETENTE^FS
^FT${contentStartX},${contentStartY + 40}^A0N,${fontSize - 5},${fontSize - 5}^FD${labelData.pallet.empresa_owner}^FS`;

  // Section 2: Product Info
  let currentY = contentStartY + 100;
  zpl += `
^FT${contentStartX},${currentY}^A0N,${fontSize},${fontSize}^FDPRODUTO^FS
^FT${contentStartX},${currentY + 40}^A0N,${fontSize - 5},${fontSize - 5}^FD${labelData.pallet.artigo_descricao}^FS`;

  currentY += 80;

  // Section 3: Barcode (GS1-128)
  if (labelData.type === 'single') {
    const barcodeData = `(01)${labelData.pallet.ean_barcode}(10)${labelData.pallet.lote}(15)${labelData.data_validade.replace(/-/g, '').slice(2)}(37)${labelData.pallet.caixas_na_palete}`;
    zpl += `
^FT${contentStartX},${currentY}^BCN,${barcodeHeight},Y,N,N^FD${barcodeData}^FS`;
    currentY += barcodeHeight + 20;
  }

  // Section 4: SSCC Barcode
  zpl += `
^FT${contentStartX},${currentY}^A0N,${fontSize},${fontSize}^FDSSCC^FS
^FT${contentStartX},${currentY + 30}^BCN,${barcodeHeight},Y,N,N^FD(00)${labelData.pallet.sscc}^FS
^FT${contentStartX},${currentY + barcodeHeight + 40}^A0N,${fontSize - 5},${fontSize - 5}^FD${labelData.pallet.sscc}^FS`;

  zpl += `
${generateZPLFooter()}`;

  return zpl;
}

// Validate ZPL string (basic checks)
function validateZPL(zpl) {
  const warnings = [];
  const errors = [];

  if (!zpl.startsWith('^XA')) {
    errors.push('ZPL must start with ^XA');
  }

  if (!zpl.endsWith('^XZ')) {
    errors.push('ZPL must end with ^XZ');
  }

  if (!zpl.includes('^PW')) {
    warnings.push('No print width (^PW) specified');
  }

  if (!zpl.includes('^LL')) {
    warnings.push('No label length (^LL) specified');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

module.exports = {
  mmToDots,
  dotsToMm,
  generateZPLHeader,
  generateZPLFooter,
  estimateTextHeightMm,
  buildLabelZPL,
  validateZPL,
};
