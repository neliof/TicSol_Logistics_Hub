# Zebra Label Printing System — Design Spec

**Date:** 2026-08-14  
**Status:** Approved  
**Priority:** Zebra thermal printers (USB + Network)  
**Author:** Design Brainstorming

---

## Overview

Redesign label printing workflow for Zebra thermal printers with dynamic layout adjustment. Support configurable paper sizes (default 100x150mm), automatic content compaction, and multi-page splitting when overflow detected. Generate ZPL (Zebra Programming Language) natively for optimal print quality.

---

## Requirements

### Functional
- **Paper Size Customization:** Default 100x150mm, user-configurable via settings
- **Content Compaction:** Auto-reduce font sizes, margins, barcode heights (iteratively)
- **Multi-Page Support:** Split overflow content across multiple labels automatically
- **Format Support:** Generate both ZPL (native) and PDF (preview + fallback)
- **Connection Modes:** USB direct + Network (IP-based)
- **Preview Before Print:** Show layout preview with page count before sending to printer

### Non-Functional
- Zebra 203dpi (standard thermal resolution)
- Max 3 compaction iterations before warning user
- Preview renders in browser (no server-side rendering needed initially)
- Persistent printer config (localStorage)

---

## Architecture

### Frontend Stack
```
GS1LabelPrintModal (existing, extended)
├── LabelPreview (NEW) — visual preview of ZPL layout
├── PrinterConfig (NEW) — USB/Network + paper size settings
├── LabelRenderer (refactored) — abstraction for single label
└── useZebraLabel (NEW) — compilation logic hook

Data Flow:
1. User input (paper size, products, mode)
2. useZebraLabel.calculatePages() → { pages, totalPages }
3. If overflow → useZebraLabel.compactLabel() iteratively
4. LabelPreview renders pages
5. User confirms → POST /api/labels/compile-zpl
6. Backend validates ZPL → POST /api/labels/send-usb|network
```

### Backend Stack
```
Node.js Express (existing)
├── routes/labels.js (NEW)
│   ├── POST /api/labels/compile-zpl
│   ├── POST /api/labels/send-usb
│   └── POST /api/labels/send-network
└── services/zebraService.js (NEW)
    ├── compileZPL(labelData, config) → ZPL string
    ├── validateZPL(zpl) → { valid, warnings }
    ├── sendUSB(zpl, vendorId, productId) → { sent, jobId }
    └── sendNetwork(zpl, ip, port) → { sent, jobId }
```

---

## Page Compaction Algorithm

**Goal:** Fit content within paper height. Iterative reduction.

```
Input: label (with content), targetHeight (mm)
Output: CompactedLabel or error

Loop iteration 1-3:
  1. Measure rendered height (browser/server)
  2. If height ≤ targetHeight: DONE
  3. Else: reduce by priority
     - Barcode height: 50→40→30px
     - Font sizes: 25→20→16
     - Margins: 50→30→15px
     - Section padding: 2→1mm
  4. Re-measure
  5. If iteration=3 and still overflow: return MultiPage split

MultiPage split:
  - Chunk products into groups that fit
  - Generate Label 1, Label 2, ... (sequential SSCC on each)
  - Each maintains header + footer format
```

---

## Data Models

### PrinterConfig (localStorage)
```typescript
interface PrinterConfig {
  connectionMode: 'usb' | 'network';
  
  // USB
  usb?: {
    vendorId: string;  // e.g., "0a5f"
    productId: string; // e.g., "3074"
  };
  
  // Network
  network?: {
    ip: string;        // e.g., "192.168.1.100"
    port: number;      // default 9100
  };
  
  // Paper
  paperSize: {
    width: number;     // mm, e.g., 100
    height: number;    // mm, e.g., 150
  };
  
  // Zebra hardware
  dpi: 203 | 300;      // default 203
}
```

### LabelData
```typescript
interface LabelData {
  type: 'single' | 'packing-list'; // from existing modal
  pallet: PalletSSCC;
  products?: Array<PackingListProduct>;
}
```

### CompilationResult
```typescript
interface CompilationResult {
  zpl: string[];       // array of ZPL strings (one per page)
  pages: number;
  status: 'success' | 'warning' | 'error';
  message?: string;    // e.g., "Compacted to 2 pages"
  preview?: string;    // base64 PNG for browser preview
}
```

---

## Components

### LabelPreview.tsx
**Purpose:** Render visual approximation of ZPL on screen.

**Props:**
```typescript
interface LabelPreviewProps {
  compilationResult: CompilationResult;
  paperSize: { width: number; height: number };
  onAdjustSize?: () => void;
}
```

**Features:**
- Display each page in sequence (swipeable or paginated)
- Show overflow indicator (red border if content exceeds)
- Page counter: "1 / 2 pages"
- Adjust paper size button (opens PrinterConfig modal)

### PrinterConfig.tsx
**Purpose:** Modal for printer connection & paper settings.

**Features:**
- Paper size input (width × height mm)
- Connection mode toggle (USB / Network)
- USB: Vendor ID, Product ID inputs
- Network: IP + Port inputs
- Test connection button (optional)
- Save to localStorage on close

### useZebraLabel.ts
**Purpose:** Compilation logic.

**Functions:**
```typescript
function calculatePages(
  labelData: LabelData,
  paperSize: { width; height },
  dpi: number
): { pages: Label[]; totalPages: number; overflow: boolean };

function compactLabel(
  label: Label,
  targetHeightMm: number,
  maxIterations?: number
): CompactedLabel | null;

function generateZPL(label: Label, dpi: number): string;

function estimateHeight(content: React.ReactNode): number;
```

---

## API Endpoints

### POST /api/labels/compile-zpl
Validate & optimize ZPL for printer.

**Request:**
```json
{
  "labelData": { ... },
  "paperSize": { "width": 100, "height": 150 },
  "dpi": 203
}
```

**Response:**
```json
{
  "zpl": ["^XA^MMT^PW832...^XZ", "^XA^MMT^PW832...^XZ"],
  "pages": 2,
  "status": "success",
  "message": "Compacted to 2 pages. Ready to print.",
  "preview": "data:image/png;base64,..."
}
```

### POST /api/labels/send-usb
Send ZPL to USB-connected Zebra printer.

**Request:**
```json
{
  "zpl": ["..."],
  "vendorId": "0a5f",
  "productId": "3074"
}
```

**Response:**
```json
{
  "sent": true,
  "jobId": "uuid",
  "message": "Sent 2 labels to USB printer"
}
```

### POST /api/labels/send-network
Send ZPL to network Zebra printer.

**Request:**
```json
{
  "zpl": ["..."],
  "ip": "192.168.1.100",
  "port": 9100
}
```

**Response:**
```json
{
  "sent": true,
  "jobId": "uuid",
  "message": "Sent 2 labels to 192.168.1.100:9100"
}
```

---

## ZPL Template

**Base structure:**
```zpl
^XA
^MMT
^PW{width_dots}
^LL{height_dots}
^LS0
^FT{x},{y}^A0N,{font_height},{font_width}^FD{text}^FS
^FT{x},{y}^BCN,{barcode_height},Y,N,N^FD{barcode_data}^FS
^XZ
```

**Conversion:** mm → dots at DPI
- 1 inch = 25.4 mm
- 203 DPI = 8 dots/mm
- Example: 100mm = 100 × 8 = 800 dots

**Dynamic compaction targets:**
| Iteration | Font | Barcode | Margins |
|-----------|------|---------|---------|
| 1         | 25   | 50px    | 50px    |
| 2         | 20   | 40px    | 30px    |
| 3         | 16   | 30px    | 15px    |

---

## User Workflow

```
1. User in GS1LabelPrintModal
2. Clicks "Print on Zebra"
3. PrinterConfig pops (if first time)
   - Selects USB or Network
   - Confirms paper size (100×150mm default)
   - Saves settings
4. LabelPreview renders
   - Shows page 1
   - If multi-page: shows "2 / 2" + page indicator
   - If overflow after compaction: warning "Content compacted. Review?"
5. User reviews preview
6. Clicks "Send to Printer"
7. Frontend POST /compile-zpl (validation)
8. Backend returns ZPL + preview
9. Frontend POST /send-usb or /send-network
10. Success toast: "2 labels sent to USB printer"
```

---

## Files to Create/Modify

### New Files
- `src/components/LabelPreview.tsx`
- `src/components/PrinterConfig.tsx`
- `src/hooks/useZebraLabel.ts`
- `src/types/label.ts` (types for Label, CompilationResult, etc.)
- `server/routes/labels.js`
- `server/services/zebraService.js`
- `server/config/zebra.config.js` (optional defaults)

### Modify
- `src/components/GS1LabelPrintModal.tsx` — add Zebra mode + mode toggle
- `server/package.json` — add `node-usb`, `pdfkit` (optional)
- `server/server.js` — mount `routes/labels.js`

---

## Dependencies (Backend)

```json
{
  "node-usb": "^1.9.2",        // USB communication
  "pdfkit": "^0.13.0",          // PDF generation (preview fallback)
  "jsbarcode": "^3.11.5"        // Barcode rendering
}
```

---

## Testing Strategy

### Unit Tests (vitest)
- `useZebraLabel.test.ts` — calculatePages, compactLabel, generateZPL logic
- `zebraService.test.js` — ZPL generation, validation

### Integration Tests (e2e, playwright)
- Open modal → select Zebra → confirm paper size → preview shows correct pages → send to mock printer

### Manual QA
- Print test labels to actual Zebra (USB + Network)
- Verify overflow handling (3+ products → 2+ pages)
- Verify compaction (font/barcode reduction)

---

## Rollout Plan

**Phase 1 (this sprint):**
- LabelPreview + PrinterConfig components
- useZebraLabel hook + ZPL generator
- Backend compile-zpl endpoint

**Phase 2:**
- USB communication (node-usb integration)
- Network printer support
- E2E testing

**Phase 3:**
- A4 support (future)
- PDF export for archived labels

---

## Success Criteria

- [x] User can select Zebra printer mode in modal
- [x] Preview shows layout before print
- [x] Paper size customizable (100×150mm default)
- [x] Automatic compaction for overflow
- [x] Multi-page support for large packing lists
- [x] ZPL validated & sent to printer (USB + Network)
- [x] No manual ZPL editing needed by user
