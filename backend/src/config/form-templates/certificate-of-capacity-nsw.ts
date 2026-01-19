/**
 * Certificate of Capacity (NSW) - Form Template Definition
 *
 * This maps user-friendly field names to the actual PDF field names
 * PDF Source: SIRA NSW Official Form (3 pages, 68 fields total)
 *
 * IMPORTANT: Field mappings verified by visual inspection of:
 * backend/public/templates/certificate-of-capacity-nsw-field-mapping.pdf
 *
 * The PDF field names are arbitrary and don't match the visual layout,
 * so this mapping is based on where data actually appears when filled.
 */

export interface FormField {
  key: string; // Our field key (user-friendly)
  pdfField: string; // Actual PDF field name
  label: string; // Display label
  type: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'date' | 'textarea';
  required?: boolean;
  section: number; // Form section (1, 2, or 3)
  page: number; // PDF page number
  options?: string[]; // For dropdown/radio
  autoFillFrom?: string; // Path to auto-fill from incident data
}

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  pdfFileName: string;
  pageCount: number;
  fields: FormField[];
}

export const certificateOfCapacityNSW: FormTemplate = {
  id: 'certificate-of-capacity-nsw',
  name: 'Certificate of Capacity (NSW)',
  description: 'For use with workers compensation and CTP motor accident injury claims',
  category: 'Workers Compensation',
  pdfFileName: 'certificate-of-capacity-nsw.pdf',
  pageCount: 3,
  fields: [
    // ============================================
    // PAGE 1 - SECTION 1: Injured Person Details
    // ============================================

    // Claim Type Checkboxes (top of form)
    {
      key: 'claimType_ctp',
      pdfField: 'Check Box 232',
      label: 'CTP (Motor Accident)',
      type: 'checkbox',
      section: 1,
      page: 1,
    },
    {
      key: 'claimType_workers',
      pdfField: 'Check Box 233',
      label: 'Workers Compensation',
      type: 'checkbox',
      section: 1,
      page: 1,
    },
    {
      key: 'isInitialCertificate',
      pdfField: 'Check Box 1',
      label: 'Initial Certificate for this claim',
      type: 'checkbox',
      section: 1,
      page: 1,
    },

    // Personal Details
    {
      key: 'firstName',
      pdfField: 'FN1',
      label: 'First Name',
      type: 'text',
      required: true,
      section: 1,
      page: 1,
      autoFillFrom: 'reporter.firstName',
    },
    {
      key: 'lastName',
      pdfField: 'LN1',
      label: 'Last Name',
      type: 'text',
      required: true,
      section: 1,
      page: 1,
      autoFillFrom: 'reporter.lastName',
    },
    {
      key: 'dateOfBirth',
      pdfField: 'Text Field 1038',
      label: 'Date of Birth',
      type: 'date',
      section: 1,
      page: 1,
    },
    {
      key: 'telephone',
      pdfField: 'Text Field 1037',
      label: 'Telephone Number',
      type: 'text',
      section: 1,
      page: 1,
      autoFillFrom: 'reporter.phone',
    },

    // Address
    {
      key: 'address',
      pdfField: 'Text Field 3012',
      label: 'Address (residential - not PO Box)',
      type: 'text',
      section: 1,
      page: 1,
    },
    {
      key: 'suburb',
      pdfField: 'Text Field 3026',
      label: 'Suburb',
      type: 'text',
      section: 1,
      page: 1,
    },
    {
      key: 'state',
      pdfField: 'Combo Box 41',
      label: 'State',
      type: 'dropdown',
      section: 1,
      page: 1,
      options: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'],
    },
    {
      key: 'postcode',
      pdfField: 'Text Field 3021',
      label: 'Postcode',
      type: 'text',
      section: 1,
      page: 1,
    },

    // Claim & Medicare
    {
      key: 'claimNumber',
      pdfField: 'CN1',
      label: 'Claim Number',
      type: 'text',
      section: 1,
      page: 1,
    },
    {
      key: 'medicareNumber',
      pdfField: 'Text Field 1039',
      label: 'Medicare Number',
      type: 'text',
      section: 1,
      page: 1,
    },

    // Employment
    {
      key: 'occupation',
      pdfField: 'Text Field 3024',
      label: 'Occupation/Job Title',
      type: 'text',
      section: 1,
      page: 1,
    },
    {
      key: 'employerDetails',
      pdfField: 'Text Field 3027',
      label: "Employer's Name and Contact Details",
      type: 'text',
      section: 1,
      page: 1,
      autoFillFrom: 'company.name',
    },

    // Consent Signature Date (Section 1)
    {
      key: 'consentSignatureDate',
      pdfField: 'Text Field 327',
      label: 'Consent Signature Date',
      type: 'date',
      section: 1,
      page: 1,
    },

    // ============================================
    // PAGE 1 - SECTION 2: Medical Certification
    // ============================================

    // Diagnosis
    {
      key: 'diagnosis',
      pdfField: 'Text Field 3025',
      label: 'Diagnosis of work related injury/disease',
      type: 'textarea',
      section: 2,
      page: 1,
      autoFillFrom: 'description',
    },

    // Injury Date
    {
      key: 'injuryDate',
      pdfField: 'Text Field 1049',
      label: "Person's stated date of injury/accident",
      type: 'date',
      section: 2,
      page: 1,
      autoFillFrom: 'incidentDate',
    },

    // First Seen Date
    {
      key: 'firstSeenDate',
      pdfField: 'Text Field 1048',
      label: 'Person was first seen at this practice for this injury on',
      type: 'date',
      section: 2,
      page: 1,
    },

    // Injury Consistent with Description
    {
      key: 'injuryConsistent',
      pdfField: 'Radio Button 1',
      label: "Injury consistent with person's description",
      type: 'radio',
      section: 2,
      page: 1,
      options: ['Yes', 'No', 'Uncertain'],
    },

    // How injury related
    {
      key: 'injuryRelation',
      pdfField: 'Text Field 1055',
      label: 'How is the injury related to work or motor vehicle accident?',
      type: 'textarea',
      section: 2,
      page: 1,
    },

    // Pre-existing factors
    {
      key: 'preExistingFactors',
      pdfField: 'Text Field 1056',
      label: 'Pre-existing factors relevant to this condition',
      type: 'textarea',
      section: 2,
      page: 1,
    },

    // ============================================
    // PAGE 2 - SECTION 3: Capacity for Work
    // ============================================

    // Work Capacity Checkboxes
    {
      key: 'totallyUnfit',
      pdfField: 'Check Box 222',
      label: 'Totally unfit for work',
      type: 'checkbox',
      section: 3,
      page: 2,
    },
    {
      key: 'fitForSelectedDuties',
      pdfField: 'Check Box 223',
      label: 'Fit for selected/suitable duties',
      type: 'checkbox',
      section: 3,
      page: 2,
    },
    {
      key: 'fitForPreInjuryDuties',
      pdfField: 'Check Box 224',
      label: 'Fit for pre-injury duties',
      type: 'checkbox',
      section: 3,
      page: 2,
    },

    // Capacity Date Ranges (CORRECTED based on field-mapping.pdf)
    // "is fit for pre-injury duties/hours from" date
    {
      key: 'fitPreInjuryFromDate',
      pdfField: 'Text Field 1063',
      label: 'Fit for pre-injury duties from date',
      type: 'date',
      section: 3,
      page: 2,
    },
    // Days per week
    {
      key: 'daysPerWeek',
      pdfField: 'Text Field 1065',
      label: 'Days per week',
      type: 'text',
      section: 3,
      page: 2,
    },
    // "has capacity for selected/suitable duties from" date
    {
      key: 'capacityFromDate',
      pdfField: 'Text Field 1051',
      label: 'Has capacity from date',
      type: 'date',
      section: 3,
      page: 2,
    },
    // "to" date for capacity
    {
      key: 'capacityToDate',
      pdfField: 'Text Field 1052',
      label: 'Has capacity to date',
      type: 'date',
      section: 3,
      page: 2,
    },
    // "has no current work capacity from" date
    {
      key: 'noCapacityFromDate',
      pdfField: 'Text Field 1062',
      label: 'Has no capacity from date',
      type: 'date',
      section: 3,
      page: 2,
    },
    // "to" date for no capacity
    {
      key: 'noCapacityToDate',
      pdfField: 'Text Field 1058',
      label: 'Has no capacity to date',
      type: 'date',
      section: 3,
      page: 2,
    },

    // Physical capacity table (aaa, bbb, ccc, ddd, eee, fff)
    {
      key: 'capacitySitting',
      pdfField: 'aaa 2',
      label: 'Sitting (hours)',
      type: 'text',
      section: 3,
      page: 2,
    },
    {
      key: 'capacityStanding',
      pdfField: 'bbb 2',
      label: 'Standing (hours)',
      type: 'text',
      section: 3,
      page: 2,
    },
    {
      key: 'capacityWalking',
      pdfField: 'ccc 2',
      label: 'Walking (hours)',
      type: 'text',
      section: 3,
      page: 2,
    },
    {
      key: 'capacityDriving',
      pdfField: 'ddd 2',
      label: 'Driving (hours)',
      type: 'text',
      section: 3,
      page: 2,
    },
    {
      key: 'capacityLifting',
      pdfField: 'eee 2',
      label: 'Lifting (kg)',
      type: 'text',
      section: 3,
      page: 2,
    },
    {
      key: 'capacityOther',
      pdfField: 'fff 2',
      label: 'Other restrictions',
      type: 'text',
      section: 3,
      page: 2,
    },

    // Treatment/referral info (CORRECTED - these are text fields, not dates)
    {
      key: 'treatmentPlan',
      pdfField: 'Text Field 1054',
      label: 'Current treatment/medication',
      type: 'textarea',
      section: 3,
      page: 2,
    },
    {
      key: 'referrals',
      pdfField: 'Text Field 1053',
      label: 'Referrals to other practitioners',
      type: 'textarea',
      section: 3,
      page: 2,
    },
    {
      key: 'referrals2',
      pdfField: 'Text Field 3042',
      label: 'Additional referral details',
      type: 'textarea',
      section: 3,
      page: 2,
    },

    // Review/next appointment
    {
      key: 'nextAppointmentDate',
      pdfField: 'Text Field 1059',
      label: 'Next appointment date',
      type: 'date',
      section: 3,
      page: 2,
    },
    {
      key: 'nextReviewDate',
      pdfField: 'Text Field 1064',
      label: 'Next review date',
      type: 'date',
      section: 3,
      page: 2,
    },

    // Estimated time to return
    {
      key: 'estimatedReturnTime',
      pdfField: 'Text Field 3037',
      label: 'Estimated time to return to pre-injury duties',
      type: 'text',
      section: 3,
      page: 2,
    },

    // Comments
    {
      key: 'workplaceRehabComments',
      pdfField: 'Text Field 3043',
      label: 'Workplace rehabilitation comments',
      type: 'textarea',
      section: 3,
      page: 2,
    },
    {
      key: 'additionalComments',
      pdfField: 'Text Field 3044',
      label: 'Additional comments',
      type: 'textarea',
      section: 3,
      page: 2,
    },

    // Position description required
    {
      key: 'requirePositionDescription',
      pdfField: 'Radio Button 7',
      label: 'Do you require a copy of the position description/work duties?',
      type: 'radio',
      section: 3,
      page: 2,
      options: ['Yes', 'No'],
    },

    // ============================================
    // PAGE 3 - Practitioner Details (CORRECTED)
    // ============================================

    // Practitioner Name fields (FN2/LN2 are the actual name fields)
    {
      key: 'practitionerFirstName',
      pdfField: 'FN2',
      label: 'Practitioner First Name',
      type: 'text',
      section: 4,
      page: 3,
    },
    {
      key: 'practitionerLastName',
      pdfField: 'LN2',
      label: 'Practitioner Last Name',
      type: 'text',
      section: 4,
      page: 3,
    },

    // Provider number (CN2)
    {
      key: 'providerNumber',
      pdfField: 'CN2',
      label: 'Medicare Provider Number',
      type: 'text',
      section: 4,
      page: 3,
    },

    // Practice details (CORRECTED field mappings)
    {
      key: 'practitionerFullName',
      pdfField: 'Text Field 3045',
      label: 'Practitioner Full Name (printed)',
      type: 'text',
      section: 4,
      page: 3,
    },
    {
      key: 'practiceAddress',
      pdfField: 'Text Field 3048',
      label: 'Practice Address',
      type: 'text',
      section: 4,
      page: 3,
    },
    {
      key: 'practiceSuburb',
      pdfField: 'Text Field 3047',
      label: 'Practice Suburb',
      type: 'text',
      section: 4,
      page: 3,
    },
    {
      key: 'practiceState',
      pdfField: 'Combo Box 43',
      label: 'Practice State',
      type: 'dropdown',
      section: 4,
      page: 3,
      options: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'],
    },
    {
      key: 'practicePostcode',
      pdfField: 'Text Field 3046',
      label: 'Practice Postcode',
      type: 'text',
      section: 4,
      page: 3,
    },
    {
      key: 'practicePhone',
      pdfField: 'Text Field 10-1922295912',
      label: 'Practice Phone',
      type: 'text',
      section: 4,
      page: 3,
    },

    // Additional provider info (CORRECTED)
    {
      key: 'additionalProviderNumber',
      pdfField: 'Text Field 1060',
      label: 'Additional Provider Number',
      type: 'text',
      section: 4,
      page: 3,
    },

    // I agree to be nominated treating doctor (CORRECTED - this is on Page 3)
    {
      key: 'agreeNominatedDoctor',
      pdfField: 'Check Box 220',
      label: 'I agree to be the nominated treating doctor',
      type: 'checkbox',
      section: 4,
      page: 3,
    },

    // Practitioner signature date
    {
      key: 'practitionerSignatureDate',
      pdfField: 'Text Field 321',
      label: 'Practitioner Signature Date',
      type: 'date',
      section: 4,
      page: 3,
    },

    // ============================================
    // PAGE 3 - Employment Declaration Section
    // ============================================

    // Employment declaration (person signing section 3)
    {
      key: 'declarationFirstName',
      pdfField: 'Text Field 1046',
      label: 'Declaration - First Name',
      type: 'text',
      section: 5,
      page: 3,
    },
    {
      key: 'declarationLastName',
      pdfField: 'Text Field 1045',
      label: 'Declaration - Last Name',
      type: 'text',
      section: 5,
      page: 3,
    },
    {
      key: 'employmentDetails',
      pdfField: 'Text Field 1061',
      label: 'Employment Details',
      type: 'textarea',
      section: 5,
      page: 3,
    },

    // Position description viewed
    {
      key: 'positionDescriptionViewed',
      pdfField: 'Radio Button 8',
      label: 'I have/have not viewed the position description',
      type: 'radio',
      section: 5,
      page: 3,
      options: ['I have', 'I have not'],
    },

    // Declaration date
    {
      key: 'declarationDate',
      pdfField: 'Text Field 329',
      label: 'Declaration Date',
      type: 'date',
      section: 5,
      page: 3,
    },
  ],
};

// Export field mappings for quick lookup
export const fieldMappings = certificateOfCapacityNSW.fields.reduce(
  (acc, field) => {
    acc[field.key] = field.pdfField;
    return acc;
  },
  {} as Record<string, string>
);

// Count: Should have ~63 fillable fields (68 total - 3 signatures - 2 buttons)
