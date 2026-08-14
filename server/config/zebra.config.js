// server/config/zebra.config.js

module.exports = {
  dpi: {
    default: 203,
    standard: 203,
    high: 300,
    dotsPerMm: {
      203: 8,
      300: 11.8,
    },
  },

  paperSizes: {
    small: { width: 100, height: 150 },   // mm
    medium: { width: 150, height: 200 },
    large: { width: 200, height: 300 },
  },

  compaction: {
    maxIterations: 3,
    targets: [
      { iteration: 0, fontSize: 25, barcodeHeight: 50, marginPx: 50 },
      { iteration: 1, fontSize: 20, barcodeHeight: 40, marginPx: 30 },
      { iteration: 2, fontSize: 16, barcodeHeight: 30, marginPx: 15 },
      { iteration: 3, fontSize: 12, barcodeHeight: 25, marginPx: 10 },
    ],
  },

  usb: {
    zebra: {
      vendorId: '0x0a5f',
      productIds: ['0x3074', '0x3175'],  // Common Zebra models
    },
  },
};
