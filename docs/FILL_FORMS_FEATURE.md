# Fill Forms Feature (PDF Form Filling)

## Overview

The **Fill Forms** feature (`/whs/fill-forms`) allows WHS and authorized users to fill out PDF form templates digitally. When printed or downloaded, the form comes out with all data pre-filled in the correct positions automatically.

**Use Case Example:** NSW Certificate of Capacity/Certificate of Fitness forms for Workers Compensation claims.

## How It Works

### 1. Template Selection
- User opens `/whs/fill-forms`
- System displays all available PDF templates (uploaded by Admin)
- User selects a template to fill out

### 2. Visual Form Filling
- PDF template is displayed with overlay input fields positioned exactly where they should be on the form
- Field types supported:
  - **Text fields** - Regular text input
  - **Checkbox fields** - Check/uncheck boxes
  - **Date fields** - Date picker input
- Users fill in the fields directly on top of the PDF preview

### 3. Case Linking (Optional)
- Sidebar shows incidents/cases that need RTW certificates
- User can select a case to automatically attach the generated PDF
- Search functionality to find cases by case number, title, or reporter name

### 4. Generate & Download
- Click "Generate & Download" button
- System generates a filled PDF with all data inserted at correct positions
- PDF is automatically downloaded
- If linked to a case, the PDF is attached to that incident record

## User Roles with Access

- ADMIN
- EXECUTIVE
- WHS_CONTROL
- SUPERVISOR
- TEAM_LEAD

## Technical Components

### Frontend
- **Page:** `frontend/src/pages/whs/fill-forms.page.tsx`
- **Service:** `frontend/src/services/pdf-template.service.ts`
- **Route:** `/whs/fill-forms`

### Backend
- **Module:** `backend/src/modules/pdf-templates/`
- **Endpoints:**
  - `GET /api/pdf-templates` - List all active templates
  - `GET /api/pdf-templates/:id` - Get template details
  - `GET /api/pdf-templates/:id/file` - Get PDF file (proxy)
  - `GET /api/pdf-templates/:id/incidents` - Get incidents for linking
  - `POST /api/pdf-templates/:id/generate` - Generate filled PDF

### Database Models
- `PDFTemplate` - Stores template metadata and field positions
- `FilledPDFForm` - Stores filled form records and generated URLs

## Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Select Template │────▶│  Fill Fields    │────▶│ Link to Case    │
│  (PDF Templates) │     │  (Visual Editor)│     │ (Optional)      │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  PDF Attached   │◀────│  Download PDF   │◀────│ Generate PDF    │
│  to Incident    │     │  (Auto-download)│     │ (Server-side)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Template Field Structure

Templates store field positions in JSON format:

```typescript
interface TemplateField {
  name: string;           // Field identifier
  type: 'text' | 'checkbox' | 'date';
  page: number;           // PDF page number (1-indexed)
  x: number;              // X position from left (pixels)
  y: number;              // Y position from top (pixels)
  width: number;          // Field width (pixels)
  height: number;         // Field height (pixels)
  fontSize?: number;      // Optional font size
}
```

## Admin Template Setup

Admins can create and configure PDF templates at:
- `/admin/pdf-templates/create` - Upload PDF and define fields
- Uses visual editor to position input fields on the PDF

### Steps to Create Template:
1. Upload a PDF form (e.g., Certificate of Capacity)
2. Use visual editor to draw input field areas on the PDF
3. Specify field type (text, checkbox, date) for each area
4. Save template with name, description, and category

## Example Usage

### Certificate of Capacity Form
1. WHS user goes to `/whs/fill-forms`
2. Selects "Certificate of Capacity" template
3. Fills in worker details:
   - First name, Last name
   - Date of birth
   - Address, Suburb, State, Postcode
   - Occupation/job title
   - Employer details
   - etc.
4. Links to the worker's injury incident case
5. Clicks "Generate & Download"
6. Filled PDF is downloaded and attached to the case

## Benefits

- **Consistency:** All forms filled in same format
- **Speed:** No manual writing, instant generation
- **Accuracy:** Data from system auto-populated correctly
- **Tracking:** All generated forms linked to cases
- **Compliance:** Official forms filled correctly every time
