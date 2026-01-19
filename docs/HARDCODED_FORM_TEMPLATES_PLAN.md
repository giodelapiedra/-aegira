# Hardcoded Form Templates - Implementation Plan

## Goal
Create a system where:
1. User selects a template (e.g., Certificate of Capacity)
2. User fills a simple web form
3. System generates PDF with text placed **exactly** in the correct positions
4. Output looks like a properly filled official form when printed

---

## How Text Positioning Works

### PDF Coordinate System
- PDFs use **points** as units (1 point = 1/72 inch)
- Origin (0,0) is at **bottom-left** corner
- X increases going right
- Y increases going up

```
        ┌─────────────────────────┐
        │                         │  Y = 842 (A4 top)
        │    First Name: [____]   │
        │                         │
        │                         │
        │                         │
        │                         │
  (0,0) └─────────────────────────┘
        X = 0                    X = 595 (A4 width)
```

### A4 Page Dimensions
- Width: **595 points** (210mm)
- Height: **842 points** (297mm)

---

## How to Get Field Coordinates

### Method 1: Adobe Acrobat Pro (Most Accurate)
1. Open PDF in Adobe Acrobat Pro
2. Go to Tools → Prepare Form
3. Click on each field area
4. Properties shows X, Y, Width, Height in points

### Method 2: Measure from Image (Manual Calculation)
1. Get image dimensions (e.g., 2480 x 3508 pixels for 300dpi A4)
2. Measure pixel position of each field
3. Convert to PDF points:
   ```
   pdf_x = (pixel_x / image_width) * 595
   pdf_y = 842 - (pixel_y / image_height) * 842  // Flip Y axis
   ```

### Method 3: Trial and Error with Preview
1. Estimate coordinates based on visual inspection
2. Generate test PDF
3. Adjust coordinates until aligned
4. Save final coordinates

### Method 4: Use PDF.js to Detect (Automated)
1. Load PDF in browser with PDF.js
2. Create a click handler that shows coordinates
3. Click on each field position
4. Record the coordinates

---

## Template Definition Structure

```typescript
// frontend/src/config/form-templates.ts

export interface FormFieldDefinition {
  key: string;              // Unique field identifier
  label: string;            // Display label in form
  type: 'text' | 'date' | 'checkbox' | 'select' | 'textarea';
  required?: boolean;
  options?: string[];       // For select type
  placeholder?: string;

  // PDF positioning (in points, from bottom-left)
  pdf: {
    page: number;           // Page number (1-indexed)
    x: number;              // X position from left
    y: number;              // Y position from bottom
    fontSize?: number;      // Default 10
    maxWidth?: number;      // For text wrapping
    // For checkbox
    checkMark?: string;     // Character to use (✓, X, etc.)
  };

  // Auto-fill mapping (optional)
  autoFillFrom?: string;    // e.g., 'worker.firstName', 'incident.date'
}

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  pdfFileName: string;      // Blank PDF stored in backend/public/templates/
  pageCount: number;
  fields: FormFieldDefinition[];
}
```

---

## Certificate of Capacity - Field Mapping

Based on the form image, here are the approximate field positions:

### Page 1 - Section 1 (Injured Person Details)

| Field | Label | Type | X | Y | Notes |
|-------|-------|------|---|---|-------|
| `claimType_ctp` | CTP | checkbox | 58 | 695 | Left checkbox |
| `claimType_workers` | Workers Comp | checkbox | 95 | 695 | Right checkbox |
| `isInitialCert` | Initial Certificate | checkbox | 58 | 665 | Below claim type |
| `firstName` | First Name | text | 58 | 620 | |
| `lastName` | Last Name | text | 300 | 620 | |
| `dob` | Date of Birth | date | 58 | 580 | DD/MM/YYYY format |
| `telephone` | Telephone | text | 250 | 580 | |
| `address` | Address | text | 58 | 540 | Full width |
| `suburb` | Suburb | text | 420 | 540 | |
| `state` | State | text | 58 | 500 | |
| `postcode` | Postcode | text | 130 | 500 | |
| `claimNumber` | Claim Number | text | 220 | 500 | |
| `medicareNumber` | Medicare Number | text | 400 | 500 | |
| `occupation` | Occupation | text | 58 | 460 | |
| `employerDetails` | Employer Details | text | 300 | 460 | |
| `signatureDate` | Signature Date | date | 350 | 380 | |

### Page 1 - Section 2 (Medical Practitioner)

| Field | Label | Type | X | Y | Notes |
|-------|-------|------|---|---|-------|
| `diagnosis` | Diagnosis | textarea | 58 | 310 | Multi-line |
| `injuryDate` | Injury Date | date | 300 | 270 | |
| `firstSeenDate` | First Seen Date | date | 58 | 220 | |
| `injuryConsistent_yes` | Consistent - Yes | checkbox | 320 | 220 | |
| `injuryConsistent_no` | Consistent - No | checkbox | 370 | 220 | |
| `injuryConsistent_uncertain` | Consistent - Uncertain | checkbox | 420 | 220 | |
| `injuryRelation` | How Related | textarea | 58 | 180 | |
| `preExistingFactors` | Pre-existing Factors | textarea | 58 | 120 | |

*Note: These are estimates. Actual coordinates will be calibrated during implementation.*

---

## PDF Generation Process

### Using pdf-lib (JavaScript Library)

```typescript
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

async function generateFilledPDF(
  templatePath: string,
  fieldValues: Record<string, any>,
  fieldDefinitions: FormFieldDefinition[]
): Promise<Uint8Array> {
  // 1. Load the blank template PDF
  const templateBytes = await fetch(templatePath).then(res => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(templateBytes);

  // 2. Get font
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // 3. For each field, draw text at specified position
  for (const field of fieldDefinitions) {
    const value = fieldValues[field.key];
    if (!value) continue;

    const page = pdfDoc.getPage(field.pdf.page - 1); // 0-indexed
    const fontSize = field.pdf.fontSize || 10;

    if (field.type === 'checkbox') {
      if (value === true) {
        page.drawText('✓', {
          x: field.pdf.x,
          y: field.pdf.y,
          size: fontSize,
          font,
        });
      }
    } else {
      const text = field.type === 'date'
        ? formatDate(value)
        : String(value);

      page.drawText(text, {
        x: field.pdf.x,
        y: field.pdf.y,
        size: fontSize,
        font,
        maxWidth: field.pdf.maxWidth,
      });
    }
  }

  // 4. Save and return
  return await pdfDoc.save();
}
```

---

## Coordinate Calibration Tool

To make positioning easier, we can create a simple calibration tool:

### Option A: Browser-based Coordinate Picker

```tsx
// A page that shows the PDF and lets you click to get coordinates
function CoordinatePicker({ pdfUrl }: { pdfUrl: string }) {
  const handleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert to PDF points (assuming rendered at 1:1 scale)
    const pdfX = x;
    const pdfY = 842 - y; // Flip Y for PDF coordinates

    console.log(`Position: x=${pdfX.toFixed(0)}, y=${pdfY.toFixed(0)}`);
    alert(`x: ${pdfX.toFixed(0)}, y: ${pdfY.toFixed(0)}`);
  };

  return (
    <div onClick={handleClick} style={{ cursor: 'crosshair' }}>
      <PDFViewer url={pdfUrl} scale={1} />
    </div>
  );
}
```

### Option B: Grid Overlay

Add a grid overlay on the PDF preview to estimate positions visually.

---

## Implementation Steps

### Step 1: Store Blank PDF Template
```
backend/
  public/
    templates/
      certificate-of-capacity-nsw.pdf    <- Blank official form
```

### Step 2: Create Template Definition
```typescript
// frontend/src/config/form-templates/certificate-of-capacity.ts
export const certificateOfCapacityTemplate: FormTemplate = {
  id: 'certificate-of-capacity-nsw',
  name: 'Certificate of Capacity (NSW)',
  // ... field definitions with calibrated coordinates
};
```

### Step 3: Create Form Fill Page
```
/whs/forms/certificate-of-capacity
```
- Clean web form with all fields
- Optional: auto-fill from selected incident
- Preview button (shows filled PDF)
- Generate & Download button

### Step 4: Backend PDF Generation Endpoint
```
POST /api/forms/generate
Body: { templateId: string, values: Record<string, any>, incidentId?: string }
Response: { pdfBase64: string }
```

### Step 5: Calibrate Coordinates
- Generate test PDF with sample data
- Compare with blank form
- Adjust X, Y values until perfectly aligned
- Save final coordinates in template definition

---

## File Structure

```
frontend/
  src/
    config/
      form-templates/
        index.ts                           # Export all templates
        certificate-of-capacity.ts         # NSW Certificate of Capacity
        return-to-work-plan.ts            # RTW Plan template
        # ... more templates
    pages/
      whs/
        forms/
          index.page.tsx                   # Template selection
          [templateId].page.tsx            # Dynamic form fill page
    services/
      form-generation.service.ts           # API calls for PDF generation

backend/
  public/
    templates/
      certificate-of-capacity-nsw.pdf      # Blank PDF
  src/
    modules/
      forms/
        index.ts                           # Routes
        pdf-generator.ts                   # pdf-lib logic
```

---

## Auto-Fill Mapping

Fields can automatically populate from incident/worker data:

```typescript
const autoFillMappings = {
  'firstName': 'incident.reporter.firstName',
  'lastName': 'incident.reporter.lastName',
  'dob': 'incident.reporter.dateOfBirth',
  'address': 'incident.reporter.address',
  'telephone': 'incident.reporter.phone',
  'occupation': 'incident.reporter.jobTitle',
  'employerDetails': 'incident.company.name',
  'injuryDate': 'incident.incidentDate',
  'diagnosis': 'incident.injuryDescription',
};
```

When user selects an incident, these fields auto-populate but remain editable.

---

## Summary

1. **Blank PDF stored in backend** - official form without any filled data
2. **Field coordinates hardcoded** - calibrated X, Y positions for each field
3. **User fills web form** - clean form UI, not PDF overlay
4. **pdf-lib generates filled PDF** - places text at exact coordinates
5. **Output is print-ready** - looks like properly filled official form

This approach is:
- **Simpler** than visual PDF overlay editor
- **More reliable** - coordinates don't drift
- **Faster setup** - one-time calibration per template
- **Better UX** - clean form instead of clunky PDF editor
