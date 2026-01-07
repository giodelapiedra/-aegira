export type Role =
  | 'ADMIN'        // Level 6 - System-wide control
  | 'EXECUTIVE'    // Level 5 - Company owner
  | 'SUPERVISOR'   // Level 4 - Multi-team oversight
  | 'CLINICIAN'    // Level 4 - Rehabilitation management (parallel)
  | 'WHS_CONTROL'  // Level 4 - Safety compliance (parallel)
  | 'TEAM_LEAD'    // Level 3 - Single team management
  | 'WORKER'       // Level 2 - Basic access (formerly MEMBER)
  | 'MEMBER';      // Legacy - will be migrated to WORKER

export type ReadinessStatus = 'GREEN' | 'YELLOW' | 'RED';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

export interface Company {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  industry?: string;
  size?: string;
  address?: string;
  phone?: string;
  website?: string;
  timezone: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  avatar?: string;
  phone?: string;
  birthDate?: string;
  gender?: Gender;
  companyId: string;
  company?: Company;
  teamId?: string;
  team?: {
    id: string;
    name: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  company: Company;
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
  timezone?: string;
}


export type LowScoreReason =
  | 'PHYSICAL_INJURY'
  | 'ILLNESS_SICKNESS'
  | 'POOR_SLEEP'
  | 'HIGH_STRESS'
  | 'PERSONAL_ISSUES'
  | 'FAMILY_EMERGENCY'
  | 'WORK_RELATED'
  | 'OTHER';

export interface Checkin {
  id: string;
  userId: string;
  companyId: string;
  mood: number;
  stress: number;
  sleep: number;
  physicalHealth: number;
  notes?: string;
  readinessStatus: ReadinessStatus;
  readinessScore: number;
  lowScoreReason?: LowScoreReason;
  lowScoreDetails?: string;
  aiAnalysis?: {
    summary: string;
    insights: string[];
    recommendations: string[];
    riskLevel: 'low' | 'medium' | 'high';
  };
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  companyId: string;
  leaderId?: string;
  workDays: string;
  shiftStart: string;
  shiftEnd: string;
  isActive: boolean;
  members?: User[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Exception {
  id: string;
  userId: string;
  companyId: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'teamId'>;
  type: 'SICK_LEAVE' | 'PERSONAL_LEAVE' | 'MEDICAL_APPOINTMENT' | 'FAMILY_EMERGENCY' | 'OTHER';
  reason: string;
  startDate: string;
  endDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: Pick<User, 'id' | 'firstName' | 'lastName'>;
  reviewedById?: string;
  reviewNote?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  notes?: string;
  createdAt: string;
}

export type IncidentActivityType =
  | 'CREATED'
  | 'STATUS_CHANGED'
  | 'ASSIGNED'
  | 'COMMENT'
  | 'SEVERITY_CHANGED'
  | 'RESOLVED';

export interface IncidentActivity {
  id: string;
  incidentId: string;
  userId: string;
  type: IncidentActivityType;
  oldValue?: string;
  newValue?: string;
  comment?: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
}

export interface IncidentReporter extends Pick<User, 'id' | 'firstName' | 'lastName' | 'email'> {
  phone?: string;
  role?: Role;
  avatar?: string;
  birthDate?: string;
  gender?: Gender;
  team?: {
    id: string;
    name: string;
    leader?: {
      id: string;
      firstName: string;
      lastName: string;
    };
  };
}

export interface Incident {
  id: string;
  caseNumber: string;
  companyId: string;
  type: 'INJURY' | 'ILLNESS' | 'MENTAL_HEALTH' | 'EQUIPMENT' | 'ENVIRONMENTAL' | 'OTHER';
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  location?: string;
  reportedBy: string;
  reporter?: IncidentReporter;
  assignedTo?: string;
  assignee?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
  teamId?: string;
  team?: {
    id: string;
    name: string;
  };
  aiSummary?: string;
  attachments?: string[];
  incidentDate?: string;
  resolvedAt?: string;
  activities?: IncidentActivity[];
  exception?: Exception; // Auto-created exception linked to this incident
  // Return to Work Certificate
  rtwCertificateUrl?: string;
  rtwCertDate?: string;
  rtwUploadedAt?: string;
  rtwUploadedBy?: string;
  rtwNotes?: string;
  rtwUploader?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface DashboardStats {
  totalMembers: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  pendingExceptions: number;
  openIncidents: number;
  checkinRate: number;
}
