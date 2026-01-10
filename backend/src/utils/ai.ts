import OpenAI from 'openai';
import { env } from '../config/env.js';
import { formatDisplayDate } from './date-helpers.js';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export interface AnalysisResult {
  summary: string;
  insights: string[];
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export async function analyzeCheckinData(data: {
  mood: number;
  stress: number;
  sleep: number;
  notes?: string;
}): Promise<AnalysisResult> {
  const prompt = `Analyze the following check-in data and provide insights:
    - Mood level: ${data.mood}/10
    - Stress level: ${data.stress}/10
    - Sleep quality: ${data.sleep}/10
    ${data.notes ? `- Notes: ${data.notes}` : ''}

    Provide a JSON response with:
    - summary: A brief summary of the individual's current state
    - insights: Array of key observations
    - recommendations: Array of actionable recommendations
    - riskLevel: "low", "medium", or "high" based on the data`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are AEGIRA AI, an expert combining clinical psychology and occupational health expertise with business analytics acumen.

CLINICAL EXPERTISE:
- You understand the biopsychosocial model: how physical health, mental state, and social factors interconnect
- You recognize warning signs: high stress + poor sleep = burnout risk; declining mood patterns = potential depression; physical health changes = possible chronic issues
- You assess psychosomatic relationships: stress manifesting as physical symptoms, sleep deprivation affecting cognitive function
- You understand workplace wellness indicators and early intervention opportunities

BUSINESS ANALYSIS EXPERTISE:
- You evaluate workforce readiness impact on productivity and safety
- You assess risk levels using data-driven metrics
- You prioritize interventions based on severity and organizational impact
- You provide ROI-conscious recommendations that balance employee wellbeing with operational needs

When analyzing check-in data:
1. Look for clinical red flags (high stress + low sleep, declining trends, extreme values)
2. Assess functional readiness for work duties
3. Consider workplace safety implications
4. Recommend evidence-based interventions

Always respond with valid JSON.`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  return JSON.parse(content) as AnalysisResult;
}

export async function generateIncidentSummary(
  incidentDescription: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are AEGIRA AI, an occupational health and safety expert. When summarizing incidents:
- Identify the nature of the incident (injury, near-miss, hazard, behavioral)
- Note any contributing factors (environmental, procedural, human factors)
- Highlight immediate safety implications
- Keep the summary factual, professional, and focused on key details for management review.`,
      },
      {
        role: 'user',
        content: `Summarize the following incident in 2-3 sentences:\n\n${incidentDescription}`,
      },
    ],
    max_tokens: 200,
  });

  return response.choices[0]?.message?.content || 'Unable to generate summary';
}

export interface MemberCheckinInfo {
  name: string;
  readinessStatus: 'GREEN' | 'YELLOW' | 'RED';
  readinessScore: number;
  mood: number;
  stress: number;
  sleep: number;
  physicalHealth: number;
  teamName?: string;
}

export interface AnalyticsSummaryData {
  totalMembers: number;
  checkinRate: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  openIncidents: number;
  pendingExceptions: number;
  memberCheckins: MemberCheckinInfo[];
  membersNotCheckedIn: string[];
}

export interface AnalyticsSummaryResult {
  summary: string;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
  memberHighlights: string[]; // Specific member insights
  overallStatus: 'healthy' | 'attention' | 'critical';
}

export interface TeamMemberAnalytics {
  name: string;
  currentStreak: number;
  longestStreak: number;
  lastCheckinDate: Date | null;
  todayCheckedIn: boolean;
  todayStatus: 'GREEN' | 'YELLOW' | 'RED' | null;
  todayScore: number | null;
  checkinCount: number;
  expectedWorkDays: number;
  missedWorkDays: number;
  checkinRate: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  avgScore: number;
  avgMood: number;
  avgStress: number;
  avgSleep: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface TeamGradeInfo {
  score: number;        // 0-100 calculated score
  letter: string;       // A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, F
  label: string;        // Outstanding, Excellent, Good, etc.
  avgReadiness: number; // Team average readiness %
  compliance: number;   // Check-in compliance %
}

export interface LowScoreReasonCount {
  reason: string;
  label: string;
  count: number;
}

export interface TeamAnalyticsSummaryData {
  teamName: string;
  totalMembers: number;
  periodDays: number;
  memberAnalytics: TeamMemberAnalytics[];
  openIncidents: number;
  pendingExceptions: number;
  teamGrade?: TeamGradeInfo; // Team Grade for AI insights
  topReasons?: LowScoreReasonCount[]; // Top reasons for low scores
}

export async function generateTeamAnalyticsSummary(
  data: TeamAnalyticsSummaryData
): Promise<AnalyticsSummaryResult> {
  // Categorize members
  const highRiskMembers = data.memberAnalytics.filter(m => m.riskLevel === 'high');
  const mediumRiskMembers = data.memberAnalytics.filter(m => m.riskLevel === 'medium');
  const lowRiskMembers = data.memberAnalytics.filter(m => m.riskLevel === 'low');

  const notCheckedInToday = data.memberAnalytics.filter(m => !m.todayCheckedIn);
  const checkedInToday = data.memberAnalytics.filter(m => m.todayCheckedIn);

  // Top performers (highest avg score, good check-in rate)
  const topPerformers = [...data.memberAnalytics]
    .filter(m => m.checkinCount > 0)
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 3);

  // Lowest performers
  const lowestPerformers = [...data.memberAnalytics]
    .filter(m => m.checkinCount > 0)
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 3);

  // Members with longest streaks
  const streakLeaders = [...data.memberAnalytics]
    .sort((a, b) => b.currentStreak - a.currentStreak)
    .filter(m => m.currentStreak > 0)
    .slice(0, 3);

  // Build detailed member info
  let memberDetails = '';

  // HIGH RISK MEMBERS
  if (highRiskMembers.length > 0) {
    memberDetails += '\n\nHIGH RISK MEMBERS (Immediate Attention Required):\n';
    highRiskMembers.forEach((m, i) => {
      memberDetails += `${i + 1}. ${m.name}\n`;
      memberDetails += `   - Avg Score: ${m.avgScore}% | Check-in Rate: ${m.checkinRate}%\n`;
      memberDetails += `   - Status Distribution: ${m.greenCount} Green / ${m.yellowCount} Yellow / ${m.redCount} Red\n`;
      memberDetails += `   - Avg Mood: ${m.avgMood}/10 | Stress: ${m.avgStress}/10 | Sleep: ${m.avgSleep}/10\n`;
      memberDetails += `   - Missed ${m.missedWorkDays} work days out of ${m.expectedWorkDays}\n`;
      if (!m.todayCheckedIn) memberDetails += `   - NOT CHECKED IN TODAY\n`;
    });
  }

  // MEDIUM RISK MEMBERS
  if (mediumRiskMembers.length > 0) {
    memberDetails += '\n\nCAUTION MEMBERS (Monitor Closely):\n';
    mediumRiskMembers.forEach((m, i) => {
      memberDetails += `${i + 1}. ${m.name} - Avg Score: ${m.avgScore}% | Rate: ${m.checkinRate}% | ${m.greenCount}G/${m.yellowCount}Y/${m.redCount}R\n`;
      if (!m.todayCheckedIn) memberDetails += `   - NOT CHECKED IN TODAY\n`;
    });
  }

  // NOT CHECKED IN TODAY
  if (notCheckedInToday.length > 0) {
    memberDetails += `\n\nPENDING CHECK-INS TODAY (${notCheckedInToday.length} members):\n`;
    notCheckedInToday.forEach((m, i) => {
      const lastCheckin = m.lastCheckinDate ? formatDisplayDate(new Date(m.lastCheckinDate)) : 'Never';
      memberDetails += `${i + 1}. ${m.name} - Last check-in: ${lastCheckin} | Avg Score: ${m.avgScore}%\n`;
    });
  }

  // TOP PERFORMERS - for recognition
  if (topPerformers.length > 0) {
    memberDetails += '\n\nTOP PERFORMERS (Recognition Recommended):\n';
    topPerformers.forEach((m, i) => {
      memberDetails += `${i + 1}. ${m.name} - Avg Score: ${m.avgScore}% | Rate: ${m.checkinRate}% | Streak: ${m.currentStreak} days\n`;
    });
  }

  // LOWEST PERFORMERS
  if (lowestPerformers.length > 0 && lowestPerformers[0].avgScore < 70) {
    memberDetails += '\n\nLOWEST SCORES (Support Required):\n';
    lowestPerformers.forEach((m, i) => {
      memberDetails += `${i + 1}. ${m.name} - Avg Score: ${m.avgScore}% | Mood: ${m.avgMood}/10 | Stress: ${m.avgStress}/10\n`;
    });
  }

  // Calculate team averages
  const membersWithCheckins = data.memberAnalytics.filter(m => m.checkinCount > 0);
  const teamAvgScore = membersWithCheckins.length > 0
    ? Math.round(membersWithCheckins.reduce((sum, m) => sum + m.avgScore, 0) / membersWithCheckins.length)
    : 0;
  const teamAvgCheckinRate = data.memberAnalytics.length > 0
    ? Math.round(data.memberAnalytics.reduce((sum, m) => sum + m.checkinRate, 0) / data.memberAnalytics.length)
    : 0;

  // Build team grade section if available
  let teamGradeSection = '';
  if (data.teamGrade) {
    teamGradeSection = `
TEAM GRADE:
- Overall Grade: ${data.teamGrade.letter} (${data.teamGrade.label})
- Grade Score: ${data.teamGrade.score}/100
- Formula: (Avg Readiness × 60%) + (Compliance × 40%)
- Avg Readiness: ${data.teamGrade.avgReadiness}%
- Compliance Rate: ${data.teamGrade.compliance}%
`;
  }

  // Build top reasons section if available
  let topReasonsSection = '';
  if (data.topReasons && data.topReasons.length > 0) {
    topReasonsSection = '\nTOP REASONS FOR LOW SCORES (RED/YELLOW status):\n';
    data.topReasons.forEach((r, i) => {
      topReasonsSection += `${i + 1}. ${r.label}: ${r.count} occurrences\n`;
    });
    topReasonsSection += '\nThese are the most common reasons members reported when they had low readiness scores. Use this to identify patterns and provide targeted recommendations.\n';
  }

  // Calculate Team Health Score (0-100)
  // Formula: (Readiness 40%) + (Compliance 30%) + (Consistency 30%)
  const avgStreak = data.memberAnalytics.length > 0
    ? data.memberAnalytics.reduce((sum, m) => sum + m.currentStreak, 0) / data.memberAnalytics.length
    : 0;
  const consistencyScore = Math.min(100, avgStreak * 10); // 10 day streak = 100%
  const teamHealthScore = Math.round(
    (teamAvgScore * 0.4) + (teamAvgCheckinRate * 0.3) + (consistencyScore * 0.3)
  );

  // Build top performers section for response
  const topPerformersData = topPerformers.map(m => ({
    name: m.name,
    avgScore: m.avgScore,
    checkinRate: m.checkinRate,
    currentStreak: m.currentStreak,
  }));

  const prompt = `You are generating a professional team performance report for "${data.teamName}" covering the last ${data.periodDays} days.

=== TEAM METRICS ===
Total Members: ${data.totalMembers}
Team Health Score: ${teamHealthScore}/100
Average Readiness: ${teamAvgScore}%
Check-in Compliance: ${teamAvgCheckinRate}%
Today's Status: ${checkedInToday.length}/${data.totalMembers} checked in
${teamGradeSection}
=== RISK DISTRIBUTION ===
High Risk: ${highRiskMembers.length} members
Medium Risk: ${mediumRiskMembers.length} members
Low Risk: ${lowRiskMembers.length} members

=== OPERATIONAL NOTES ===
Open Incidents: ${data.openIncidents}
Pending Exceptions: ${data.pendingExceptions}
${topReasonsSection}
${memberDetails}

Generate a professional report suitable for management review. Be specific with names and metrics. Avoid excessive use of emojis - this is a formal business report.
${data.teamGrade ? `\nThe team grade is ${data.teamGrade.letter} (${data.teamGrade.label}). Explain the factors affecting this grade and provide actionable steps for improvement.` : ''}
${data.topReasons && data.topReasons.length > 0 ? `\nAddress the root causes identified in TOP REASONS FOR LOW SCORES with targeted interventions.` : ''}

Provide a JSON response with:
- summary: 2-3 sentence executive summary. Professional tone, include Team Health Score (${teamHealthScore}/100), team grade${data.teamGrade ? ` (${data.teamGrade.letter})` : ''}, and key metrics. Mention specific members requiring attention.
- highlights: Array of 2-3 positive observations. Include top performers by name and their achievements. Professional language.
- concerns: Array of 2-3 specific concerns. MUST cite member names with their metrics (e.g., "John Doe: 45% avg score, 3 missed days - recommend intervention").
- recommendations: Array of 2-3 actionable steps. Be specific with names and actions (e.g., "Schedule 1-on-1 with Maria Santos to address elevated stress levels of 8/10").
- memberHighlights: Array of 3-5 member-specific notes formatted as "[Name]: [specific observation and recommendation]"
- overallStatus: "healthy" if team health score >=75 and <20% at risk, "attention" if 50-74 or 20-40% at risk, "critical" if <50 or >40% at risk`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are AEGIRA AI, a professional workforce analytics and wellness advisor. Generate formal business reports suitable for management review.

REPORT GUIDELINES:
1. PROFESSIONAL TONE - Use formal business language. Avoid emojis and casual expressions.
2. DATA-DRIVEN - Always cite specific metrics (percentages, scores, counts) to support observations.
3. NAME-SPECIFIC - Reference individual team members by name when discussing performance or concerns.
4. ACTIONABLE - Provide concrete, implementable recommendations with clear ownership.
5. BALANCED - Include both achievements (recognition) and areas for improvement.

ANALYSIS FRAMEWORK:
- Team Health Score: Composite metric combining readiness, compliance, and consistency
- Risk Assessment: Categorize members as High/Medium/Low risk based on attendance and wellness patterns
- Root Cause Analysis: Identify underlying factors (stress, sleep, workload) driving performance issues
- Trend Analysis: Compare current metrics against baseline/previous periods

CLINICAL INDICATORS TO FLAG:
- High stress (7+/10) combined with poor sleep (<5/10) = burnout risk
- Multiple consecutive RED statuses = wellness intervention needed
- Declining attendance pattern = engagement concern
- Physical health issues affecting readiness = accommodation review

RECOMMENDATIONS SHOULD:
- Be specific (name the person and action)
- Be practical (achievable within normal operations)
- Include timeline when appropriate
- Consider both individual and systemic interventions

OUTPUT FORMAT:
- Use clear, concise sentences
- Avoid redundancy
- Structure information logically
- Prioritize by severity/impact

Always respond with valid JSON.`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 1000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  return JSON.parse(content) as AnalyticsSummaryResult;
}

export async function generateAnalyticsSummary(
  data: AnalyticsSummaryData
): Promise<AnalyticsSummaryResult> {
  const totalCheckins = data.greenCount + data.yellowCount + data.redCount;
  const notCheckedIn = data.totalMembers - totalCheckins;

  // Identify members with lowest scores (RED status or lowest readiness scores)
  const redMembers = data.memberCheckins
    .filter((m) => m.readinessStatus === 'RED')
    .sort((a, b) => a.readinessScore - b.readinessScore)
    .slice(0, 5); // Top 5 lowest

  const yellowMembers = data.memberCheckins
    .filter((m) => m.readinessStatus === 'YELLOW')
    .sort((a, b) => a.readinessScore - b.readinessScore)
    .slice(0, 3); // Top 3 lowest yellow

  // Build member details string
  let memberDetails = '';
  if (redMembers.length > 0) {
    memberDetails += '\n\nMEMBERS REQUIRING IMMEDIATE ATTENTION (RED Status):\n';
    redMembers.forEach((member, idx) => {
      memberDetails += `${idx + 1}. ${member.name}${member.teamName ? ` (${member.teamName})` : ''} - Readiness Score: ${member.readinessScore.toFixed(1)}/10 (Mood: ${member.mood}/10, Stress: ${member.stress}/10, Sleep: ${member.sleep}/10, Physical: ${member.physicalHealth}/10)\n`;
    });
  }

  if (yellowMembers.length > 0 && redMembers.length < 3) {
    memberDetails += '\n\nMEMBERS NEEDING MONITORING (YELLOW Status):\n';
    yellowMembers.forEach((member, idx) => {
      memberDetails += `${idx + 1}. ${member.name}${member.teamName ? ` (${member.teamName})` : ''} - Readiness Score: ${member.readinessScore.toFixed(1)}/10 (Mood: ${member.mood}/10, Stress: ${member.stress}/10, Sleep: ${member.sleep}/10)\n`;
    });
  }

  if (data.membersNotCheckedIn.length > 0) {
    memberDetails += `\n\nMEMBERS NOT YET CHECKED IN TODAY (${data.membersNotCheckedIn.length}):\n`;
    data.membersNotCheckedIn.slice(0, 10).forEach((name, idx) => {
      memberDetails += `${idx + 1}. ${name}\n`;
    });
    if (data.membersNotCheckedIn.length > 10) {
      memberDetails += `... and ${data.membersNotCheckedIn.length - 10} more\n`;
    }
  }

  const prompt = `Analyze the following team/company analytics data and provide a helpful executive summary for management:

CURRENT METRICS:
- Total Personnel: ${data.totalMembers}
- Today's Check-in Rate: ${data.checkinRate}%
- Checked In: ${totalCheckins} of ${data.totalMembers}
- Not Checked In: ${notCheckedIn}

READINESS BREAKDOWN:
- Green (Ready): ${data.greenCount} (${data.totalMembers > 0 ? Math.round((data.greenCount / data.totalMembers) * 100) : 0}%)
- Yellow (Caution): ${data.yellowCount} (${data.totalMembers > 0 ? Math.round((data.yellowCount / data.totalMembers) * 100) : 0}%)
- Red (At Risk): ${data.redCount} (${data.totalMembers > 0 ? Math.round((data.redCount / data.totalMembers) * 100) : 0}%)

OTHER METRICS:
- Open Incidents: ${data.openIncidents}
- Pending Exception Requests: ${data.pendingExceptions}
${memberDetails}

IMPORTANT: In your response, you MUST highlight specific members who need attention. Mention their names and specific concerns (e.g., "John Doe shows high stress levels (8/10) and poor sleep (3/10) - recommend immediate check-in").

Provide a JSON response with:
- summary: A 2-3 sentence executive summary of the current state (be specific with numbers and mention key members if any concerns)
- highlights: Array of 2-3 positive observations (if any)
- concerns: Array of 2-3 areas needing attention (be specific about member names and issues)
- recommendations: Array of 2-3 actionable next steps (include specific actions for identified members)
- memberHighlights: Array of 3-5 specific member insights (e.g., "Maria Santos (Team Alpha) - High stress (9/10) and low sleep quality (2/10) requires immediate support")
- overallStatus: "healthy" if mostly green and high check-in rate, "attention" if moderate issues, "critical" if significant concerns or multiple RED status members`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are AEGIRA AI, a senior workforce wellness consultant with dual expertise in clinical occupational health and business operations analytics.

CLINICAL ASSESSMENT FRAMEWORK:
- Triage by clinical severity: RED status members are your priority, especially those with compounding factors (high stress + poor sleep + low mood)
- Recognize burnout indicators: persistent high stress (7+/10), declining sleep quality, mood deterioration over time
- Apply the stress-recovery model: workers need adequate recovery (sleep, mood stability) to sustain performance
- Consider psychosomatic links: physical health complaints often correlate with psychological stress
- Identify members at risk of fitness-for-duty concerns for safety-sensitive roles

BUSINESS INTELLIGENCE LENS:
- Calculate workforce readiness: green% indicates operational capacity, red% indicates risk exposure
- Correlate check-in patterns with productivity/safety outcomes
- Quantify intervention priorities: members with lowest scores AND critical roles need immediate attention
- Consider the cost of inaction: unaddressed wellness issues escalate to absenteeism, incidents, and turnover
- Track compliance as a leading indicator: non-check-in often precedes disengagement

EXECUTIVE COMMUNICATION:
- Lead with the headline: overall team health status and top priority concerns
- Be specific: cite names, numbers, and metrics (e.g., "Maria Santos: stress 9/10, sleep 3/10 - recommend EAP referral")
- Recommend evidence-based interventions: EAP, workload review, schedule flexibility, peer support
- Balance concerns with recognition: acknowledge resilient performers maintaining high readiness
- Provide ROI context: wellness investments prevent costly downstream issues

Keep responses concise, clinically informed, and action-oriented. Always respond with valid JSON.`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 800,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  return JSON.parse(content) as AnalyticsSummaryResult;
}
