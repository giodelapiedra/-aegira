import { Hono } from 'hono';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { generateTeamAnalyticsSummary } from '../../utils/ai.js';
import type { AppContext } from '../../types/context.js';
import { createSystemLog } from '../system-logs/index.js';
import {
  getTodayRange,
  getStartOfDay,
  getEndOfDay,
  getStartOfNextDay,
  formatLocalDate,
  isWorkDay,
  countWorkDaysInRange,
  calculateActualStreak,
  toDbDate,
  DEFAULT_TIMEZONE,
} from '../../utils/date-helpers.js';
import {
  type ChatRequest,
  type ChatResponse,
  type ChatIntent,
  TEAM_LEAD_COMMANDS,
  TEAM_LEAD_SUGGESTIONS,
} from './types.js';
import OpenAI from 'openai';

const chatbotRoutes = new Hono<AppContext>();

// Helper: Get company timezone
async function getCompanyTimezone(companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  return company?.timezone || DEFAULT_TIMEZONE;
}

// Helper: Generate unique ID
function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper: Detect command from user message (keyword-based)
function detectCommand(message: string): keyof typeof TEAM_LEAD_COMMANDS | null {
  const lowerMessage = message.toLowerCase().trim();

  for (const [command, keywords] of Object.entries(TEAM_LEAD_COMMANDS)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        return command as keyof typeof TEAM_LEAD_COMMANDS;
      }
    }
  }

  return null;
}

// Helper: AI-based intent detection (fallback when keywords don't match)
async function detectIntentWithAI(message: string): Promise<ChatIntent> {
  if (!env.OPENAI_API_KEY) {
    return 'UNKNOWN';
  }

  try {
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    const systemPrompt = `You are an intent classifier for a team management chatbot. The chatbot helps team leaders with:
- Generating team performance reports/summaries
- Viewing past reports
- Checking team status today
- Finding at-risk workers (attendance issues)
- Getting help with commands

Classify the user's message into ONE of these intents:
- GENERATE_SUMMARY: User wants to create/generate a new report or summary
- VIEW_REPORTS: User wants to see past/previous reports or history
- TEAM_STATUS: User asks about current team status, how team is doing today
- AT_RISK: User asks about workers with problems, absent, low attendance
- HELP: User asks how to use the chatbot or what commands are available
- GREETING: User is just saying hello/hi/kamusta (no specific request)
- OUT_OF_SCOPE: Request is unrelated to team management features

Respond with ONLY the intent name, nothing else.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      max_tokens: 20,
      temperature: 0,
    });

    const intent = response.choices[0]?.message?.content?.trim().toUpperCase() as ChatIntent;

    // Validate intent
    const validIntents: ChatIntent[] = ['GENERATE_SUMMARY', 'VIEW_REPORTS', 'TEAM_STATUS', 'AT_RISK', 'HELP', 'GREETING', 'OUT_OF_SCOPE'];
    if (validIntents.includes(intent)) {
      return intent;
    }
    return 'UNKNOWN';
  } catch (error) {
    console.error('AI intent detection failed:', error);
    return 'UNKNOWN';
  }
}

// GET /chatbot/suggestions - Get available commands/suggestions for user's role
chatbotRoutes.get('/suggestions', async (c) => {
  const user = c.get('user');
  const role = user.role?.toUpperCase();

  // For now, only Team Lead has chatbot access
  // Can be extended for other roles later
  if (role === 'TEAM_LEAD') {
    return c.json({ suggestions: TEAM_LEAD_SUGGESTIONS });
  }

  // Default empty suggestions for other roles (can be extended)
  return c.json({ suggestions: [] });
});

// Constants for validation
const MAX_MESSAGE_LENGTH = 500;

// POST /chatbot/message - Process user message and return response
chatbotRoutes.post('/message', async (c) => {
  const user = c.get('user');
  const companyId = c.get('companyId');
  const body = await c.req.json() as ChatRequest;
  const { message, context } = body;

  // Validate message - required and not empty
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return c.json({ error: 'Message is required' }, 400);
  }

  // Validate message length to prevent abuse
  if (message.length > MAX_MESSAGE_LENGTH) {
    return c.json({ error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.` }, 400);
  }

  const role = user.role?.toUpperCase();

  // Currently only Team Lead is supported
  if (role !== 'TEAM_LEAD') {
    const response: ChatResponse = {
      message: {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, the AI Chat feature is currently available for Team Leaders only.',
        timestamp: new Date(),
      },
    };
    return c.json(response);
  }

  // Get user's team
  const userWithTeam = await prisma.user.findUnique({
    where: { id: user.id },
    select: { teamId: true },
  });

  // Check if user leads a team
  const team = await prisma.team.findFirst({
    where: {
      OR: [
        { leaderId: user.id, companyId, isActive: true },
        { id: userWithTeam?.teamId || '', companyId, isActive: true },
      ],
    },
    include: {
      members: {
        where: { isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          currentStreak: true,
          longestStreak: true,
          lastCheckinDate: true,
          teamJoinedAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!team) {
    const response: ChatResponse = {
      message: {
        id: generateId(),
        role: 'assistant',
        content: 'You are not assigned to lead any team. Please contact your administrator.',
        timestamp: new Date(),
      },
    };
    return c.json(response);
  }

  // Filter out the team leader from members (they're the supervisor, not a member)
  const filteredMembers = team.members.filter((m: any) => m.id !== team.leaderId);
  const teamWithFilteredMembers = { ...team, members: filteredMembers };

  // First try keyword-based detection
  let command = detectCommand(message);

  // If no keyword match, try AI-based intent detection
  if (!command) {
    const aiIntent = await detectIntentWithAI(message);

    // Map AI intent to command (only for recognized commands)
    if (aiIntent === 'GENERATE_SUMMARY') command = 'GENERATE_SUMMARY';
    else if (aiIntent === 'VIEW_REPORTS') command = 'VIEW_REPORTS';
    else if (aiIntent === 'TEAM_STATUS') command = 'TEAM_STATUS';
    else if (aiIntent === 'AT_RISK') command = 'AT_RISK';
    else if (aiIntent === 'HELP') command = 'HELP';
    // For GREETING, OUT_OF_SCOPE, UNKNOWN - fall through to helpful response
  }

  // Process based on command (use filtered members for analytics)
  switch (command) {
    case 'GENERATE_SUMMARY':
      return await handleGenerateSummary(c, user, teamWithFilteredMembers, companyId, context);

    case 'VIEW_REPORTS':
      return handleViewReports(c);

    case 'TEAM_STATUS':
      return await handleTeamStatus(c, teamWithFilteredMembers, companyId);

    case 'AT_RISK':
      return await handleAtRisk(c, teamWithFilteredMembers, companyId);

    case 'HELP':
      return handleHelp(c);

    default:
      return handleUnknownCommand(c, message);
  }
});

// Handler: Generate Summary
async function handleGenerateSummary(
  c: any,
  user: any,
  team: any,
  companyId: string,
  context?: ChatRequest['context']
) {
  // Check if OpenAI is configured
  if (!env.OPENAI_API_KEY) {
    const response: ChatResponse = {
      message: {
        id: generateId(),
        role: 'assistant',
        content: 'AI features are not configured. Please contact your administrator.',
        timestamp: new Date(),
      },
      action: { type: 'generate_summary', status: 'error' },
    };
    return c.json(response);
  }

  // Get company timezone
  const timezone = await getCompanyTimezone(companyId);

  // Parse dates (default: last 14 days) - timezone aware
  const endDate = context?.dateRange?.endDate
    ? getEndOfDay(new Date(context.dateRange.endDate), timezone)
    : getEndOfDay(new Date(), timezone);

  const startDate = context?.dateRange?.startDate
    ? getStartOfDay(new Date(context.dateRange.startDate), timezone)
    : getStartOfDay(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), timezone);

  const teamWorkDays = team.workDays || 'MON,TUE,WED,THU,FRI';
  const memberIds = team.members.map((m: any) => m.id);

  // Get today's date range (timezone-aware)
  const { start: today, end: tomorrow } = getTodayRange(timezone);

  // Fetch holidays for the period
  const holidays = await prisma.holiday.findMany({
    where: {
      companyId,
      date: { gte: startDate, lte: endDate },
    },
    select: { date: true },
  });
  const holidayDates = holidays.map(h => formatLocalDate(h.date, timezone));
  const holidaySet = new Set(holidayDates);

  // Fetch approved exemptions for all team members
  const memberExemptions = await prisma.exception.findMany({
    where: {
      userId: { in: memberIds },
      status: 'APPROVED',
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: {
      userId: true,
      startDate: true,
      endDate: true,
    },
  });

  // Fetch EXCUSED absences for all team members (TL approved = no penalty)
  const excusedAbsences = await prisma.absence.findMany({
    where: {
      userId: { in: memberIds },
      status: 'EXCUSED',
      absenceDate: { gte: startDate, lte: endDate },
    },
    select: {
      userId: true,
      absenceDate: true,
    },
  });

  // Build excused absences map by user
  const excusedAbsencesByUser = new Map<string, Set<string>>();
  for (const absence of excusedAbsences) {
    const dateStr = formatLocalDate(absence.absenceDate, timezone);
    const userAbsences = excusedAbsencesByUser.get(absence.userId) || new Set();
    userAbsences.add(dateStr);
    excusedAbsencesByUser.set(absence.userId, userAbsences);
  }

  // Build exemption map by user
  const exemptionsByUser = new Map<string, typeof memberExemptions>();
  for (const exemption of memberExemptions) {
    const userExemptions = exemptionsByUser.get(exemption.userId) || [];
    userExemptions.push(exemption);
    exemptionsByUser.set(exemption.userId, userExemptions);
  }

  // Get ALL check-ins for the period
  const allCheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      userId: true,
      readinessStatus: true,
      readinessScore: true,
      mood: true,
      stress: true,
      sleep: true,
      physicalHealth: true,
      lowScoreReason: true,
      lowScoreDetails: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Group check-ins by userId
  const checkinsByUser = new Map<string, typeof allCheckins>();
  for (const checkin of allCheckins) {
    const userCheckins = checkinsByUser.get(checkin.userId) || [];
    userCheckins.push(checkin);
    checkinsByUser.set(checkin.userId, userCheckins);
  }

  // Process each member
  const memberAnalytics = team.members.map((member: any) => {
    // Use teamJoinedAt (when user was assigned to team) with fallback to createdAt
    // Check-in requirement starts the DAY AFTER joining (not same day)
    const joinDate = member.teamJoinedAt ? new Date(member.teamJoinedAt) : new Date(member.createdAt);
    // Effective start is NEXT DAY after joining
    const memberEffectiveStart = getStartOfNextDay(joinDate, timezone);
    const effectiveStartDate = memberEffectiveStart > startDate ? memberEffectiveStart : startDate;

    // Calculate exempted work days for this member
    const userExemptions = exemptionsByUser.get(member.id) || [];
    const exemptedDatesSet = new Set<string>();
    for (const exemption of userExemptions) {
      if (!exemption.startDate || !exemption.endDate) continue;
      const exStart = exemption.startDate > effectiveStartDate ? exemption.startDate : effectiveStartDate;
      const exEnd = exemption.endDate < endDate ? exemption.endDate : endDate;
      let current = new Date(exStart);
      while (current <= exEnd) {
        const dateStr = formatLocalDate(current, timezone);
        const dayOfWeek = current.getDay();
        const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        // Only count as exempted if it's a work day and not already a holiday
        if (teamWorkDays.includes(dayNames[dayOfWeek]) && !holidaySet.has(dateStr)) {
          exemptedDatesSet.add(dateStr);
        }
        current.setDate(current.getDate() + 1);
      }
    }

    // Also add EXCUSED absences (TL approved = no penalty)
    const userExcusedAbsences = excusedAbsencesByUser.get(member.id);
    if (userExcusedAbsences) {
      for (const dateStr of userExcusedAbsences) {
        exemptedDatesSet.add(dateStr);
      }
    }

    // Calculate expected work days (excluding holidays, exemptions, and EXCUSED absences)
    const workDaysBeforeExemptions = countWorkDaysInRange(effectiveStartDate, endDate, teamWorkDays, timezone, holidayDates);
    const expectedWorkDays = Math.max(0, workDaysBeforeExemptions - exemptedDatesSet.size);

    const checkins = checkinsByUser.get(member.id) || [];

    // Find today's check-in
    const todayCheckin = checkins.find((c: any) => {
      const checkinDate = new Date(c.createdAt);
      return checkinDate >= today && checkinDate < tomorrow;
    });

    // Calculate stats
    const greenCount = checkins.filter((c: any) => c.readinessStatus === 'GREEN').length;
    const yellowCount = checkins.filter((c: any) => c.readinessStatus === 'YELLOW').length;
    const redCount = checkins.filter((c: any) => c.readinessStatus === 'RED').length;

    const avgScore = checkins.length > 0
      ? Math.round(checkins.reduce((sum: number, c: any) => sum + c.readinessScore, 0) / checkins.length)
      : 0;

    const avgMood = checkins.length > 0
      ? Math.round(checkins.reduce((sum: number, c: any) => sum + c.mood, 0) / checkins.length * 10) / 10
      : 0;

    const avgStress = checkins.length > 0
      ? Math.round(checkins.reduce((sum: number, c: any) => sum + c.stress, 0) / checkins.length * 10) / 10
      : 0;

    const avgSleep = checkins.length > 0
      ? Math.round(checkins.reduce((sum: number, c: any) => sum + c.sleep, 0) / checkins.length * 10) / 10
      : 0;

    const checkinRate = expectedWorkDays > 0
      ? Math.round((checkins.length / expectedWorkDays) * 100)
      : 0;

    const missedWorkDays = Math.max(0, expectedWorkDays - checkins.length);

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (redCount >= 3 || (checkins.length > 0 && redCount / checkins.length > 0.4)) {
      riskLevel = 'high';
    } else if (yellowCount >= 3 || redCount >= 2) {
      riskLevel = 'medium';
    }
    if (missedWorkDays >= 4) {
      riskLevel = 'high';
    } else if (missedWorkDays >= 2 && riskLevel === 'low') {
      riskLevel = 'medium';
    }

    // Calculate actual streak using date-helpers (timezone-aware)
    const actualStreak = calculateActualStreak(
      member.currentStreak,
      member.lastCheckinDate,
      teamWorkDays,
      timezone
    );

    return {
      name: `${member.firstName} ${member.lastName}`,
      currentStreak: actualStreak,
      longestStreak: member.longestStreak,
      lastCheckinDate: member.lastCheckinDate,
      todayCheckedIn: !!todayCheckin,
      todayStatus: todayCheckin?.readinessStatus || null,
      todayScore: todayCheckin?.readinessScore || null,
      checkinCount: checkins.length,
      expectedWorkDays,
      missedWorkDays,
      checkinRate,
      greenCount,
      yellowCount,
      redCount,
      avgScore,
      avgMood,
      avgStress,
      avgSleep,
      riskLevel,
    };
  });

  // Get incidents and exceptions
  const [openIncidents, pendingExceptions] = await prisma.$transaction([
    prisma.incident.count({
      where: {
        reportedBy: { in: memberIds },
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    }),
    prisma.exception.count({
      where: {
        userId: { in: memberIds },
        status: 'PENDING',
      },
    }),
  ]);

  // Query DailyTeamSummary for period compliance (same as Team Analytics)
  const dbStartDate = toDbDate(startDate, timezone);
  const dbEndDate = toDbDate(endDate, timezone);

  const dailySummaries = await prisma.dailyTeamSummary.findMany({
    where: {
      teamId: team.id,
      date: {
        gte: dbStartDate,
        lte: dbEndDate,
      },
    },
    select: {
      checkedInCount: true,
      expectedToCheckIn: true,
    },
  });

  // Sum up totals from DailyTeamSummary
  let summaryTotalCheckins = 0;
  let summaryTotalExpected = 0;
  for (const summary of dailySummaries) {
    summaryTotalCheckins += summary.checkedInCount;
    summaryTotalExpected += summary.expectedToCheckIn;
  }

  // Calculate Team Grade
  const membersWithCheckins = memberAnalytics.filter((m: any) => m.checkinCount > 0);
  const teamAvgReadiness = membersWithCheckins.length > 0
    ? membersWithCheckins.reduce((sum: number, m: any) => sum + m.avgScore, 0) / membersWithCheckins.length
    : 0;

  // Use DailyTeamSummary for compliance (consistent with Team Analytics)
  // Fallback to raw calculation if no summary data available
  const rawTeamCompliance = memberAnalytics.length > 0
    ? memberAnalytics.reduce((sum: number, m: any) => sum + m.checkinRate, 0) / memberAnalytics.length
    : 0;
  const teamCompliance = summaryTotalExpected > 0
    ? Math.round((summaryTotalCheckins / summaryTotalExpected) * 100)
    : rawTeamCompliance;

  // Grade formula: (Avg Readiness × 60%) + (Compliance × 40%)
  const gradeScore = Math.round((teamAvgReadiness * 0.6) + (teamCompliance * 0.4));

  // Calculate letter grade
  const getLetterGrade = (score: number): { letter: string; label: string } => {
    if (score >= 97) return { letter: 'A+', label: 'Outstanding' };
    if (score >= 93) return { letter: 'A', label: 'Excellent' };
    if (score >= 90) return { letter: 'A-', label: 'Excellent' };
    if (score >= 87) return { letter: 'B+', label: 'Very Good' };
    if (score >= 83) return { letter: 'B', label: 'Good' };
    if (score >= 80) return { letter: 'B-', label: 'Good' };
    if (score >= 77) return { letter: 'C+', label: 'Satisfactory' };
    if (score >= 73) return { letter: 'C', label: 'Satisfactory' };
    if (score >= 70) return { letter: 'C-', label: 'Satisfactory' };
    if (score >= 67) return { letter: 'D+', label: 'Needs Improvement' };
    if (score >= 63) return { letter: 'D', label: 'Needs Improvement' };
    if (score >= 60) return { letter: 'D-', label: 'Needs Improvement' };
    return { letter: 'F', label: 'Critical' };
  };

  const { letter, label } = getLetterGrade(gradeScore);
  const teamGrade = {
    score: gradeScore,
    letter,
    label,
    avgReadiness: Math.round(teamAvgReadiness),
    compliance: Math.round(teamCompliance),
  };

  // Calculate top reasons for low scores
  const reasonLabels: Record<string, string> = {
    PHYSICAL_INJURY: 'Physical Injury',
    ILLNESS_SICKNESS: 'Illness/Sickness',
    POOR_SLEEP: 'Poor Sleep',
    HIGH_STRESS: 'High Stress',
    PERSONAL_ISSUES: 'Personal Issues',
    FAMILY_EMERGENCY: 'Family Emergency',
    WORK_RELATED: 'Work Related',
    OTHER: 'Other',
  };

  // Count reasons only from RED/YELLOW check-ins (low scores)
  const reasonCounts = new Map<string, number>();
  for (const checkin of allCheckins) {
    // Only count if: has a reason AND is a low score check-in (RED or YELLOW)
    if (checkin.lowScoreReason && (checkin.readinessStatus === 'RED' || checkin.readinessStatus === 'YELLOW')) {
      const count = reasonCounts.get(checkin.lowScoreReason) || 0;
      reasonCounts.set(checkin.lowScoreReason, count + 1);
    }
  }

  const topReasons = Array.from(reasonCounts.entries())
    .map(([reason, count]) => ({
      reason,
      label: reasonLabels[reason] || reason,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5 reasons

  // Calculate Team Health Score (0-100)
  // Formula: (Readiness 40%) + (Compliance 30%) + (Consistency 30%)
  const avgStreak = memberAnalytics.length > 0
    ? memberAnalytics.reduce((sum: number, m: any) => sum + m.currentStreak, 0) / memberAnalytics.length
    : 0;
  const consistencyScore = Math.min(100, avgStreak * 10); // 10 day streak = 100%
  const teamHealthScore = Math.round(
    (teamAvgReadiness * 0.4) + (teamCompliance * 0.3) + (consistencyScore * 0.3)
  );

  // Get Top Performers (highest avg score with good check-in rate)
  const topPerformers = [...memberAnalytics]
    .filter((m: any) => m.checkinCount > 0 && m.checkinRate >= 80)
    .sort((a: any, b: any) => b.avgScore - a.avgScore)
    .slice(0, 3)
    .map((m: any) => ({
      name: m.name,
      avgScore: m.avgScore,
      checkinRate: m.checkinRate,
      currentStreak: m.currentStreak,
    }));

  try {
    const summary = await generateTeamAnalyticsSummary({
      teamName: team.name,
      totalMembers: team.members.length,
      periodDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
      memberAnalytics,
      openIncidents,
      pendingExceptions,
      teamGrade,
      topReasons,
    });

    // Map status
    const statusMap: Record<string, 'HEALTHY' | 'ATTENTION' | 'CRITICAL'> = {
      healthy: 'HEALTHY',
      attention: 'ATTENTION',
      critical: 'CRITICAL',
    };

    // Save to database with user's ID (privacy)
    const savedSummary = await prisma.aISummary.create({
      data: {
        companyId,
        teamId: team.id,
        generatedById: user.id, // This user generated it - only they can see it
        summary: summary.summary,
        highlights: summary.highlights,
        concerns: summary.concerns,
        recommendations: summary.recommendations,
        overallStatus: statusMap[summary.overallStatus] || 'HEALTHY',
        periodStart: startDate,
        periodEnd: endDate,
        aggregateData: {
          totalMembers: team.members.length,
          openIncidents,
          pendingExceptions,
          memberAnalytics,
          teamGrade,
          teamHealthScore,
          topPerformers,
          topReasons,
        },
      },
    });

    // Create system log for AI summary generation (use timezone-aware formatting)
    await createSystemLog({
      companyId,
      userId: user.id,
      action: 'AI_SUMMARY_GENERATED',
      entityType: 'ai_summary',
      entityId: savedSummary.id,
      description: `AI Insights report generated for team "${team.name}" (${formatLocalDate(startDate, timezone)} to ${formatLocalDate(endDate, timezone)}) - Grade: ${teamGrade.letter}, Status: ${summary.overallStatus.toUpperCase()}`,
      metadata: {
        teamId: team.id,
        teamName: team.name,
        periodStart: startDate.toISOString(),
        periodEnd: endDate.toISOString(),
        periodDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
        overallStatus: summary.overallStatus,
        totalMembers: team.members.length,
        highlightsCount: summary.highlights.length,
        concernsCount: summary.concerns.length,
        recommendationsCount: summary.recommendations.length,
        teamGrade: teamGrade.letter,
        teamGradeScore: teamGrade.score,
        topReasonsCount: topReasons.length,
        topReason: topReasons[0]?.label || null,
      },
    });

    // Build response message (professional format)
    const statusLabel = {
      healthy: 'Healthy',
      attention: 'Needs Attention',
      critical: 'Critical',
    };

    const response: ChatResponse = {
      message: {
        id: generateId(),
        role: 'assistant',
        content: `**Team Performance Report Generated**\n\n**${team.name}**\n\n| Metric | Value |\n|--------|-------|\n| Team Health Score | ${teamHealthScore}/100 |\n| Team Grade | ${teamGrade.letter} (${teamGrade.label}) |\n| Status | ${statusLabel[summary.overallStatus]} |\n| Readiness | ${teamGrade.avgReadiness}% |\n| Compliance | ${teamGrade.compliance}% |\n\n**Executive Summary:**\n${summary.summary}\n\n**Report Contents:** ${summary.highlights.length} highlights, ${summary.concerns.length} concerns, ${summary.recommendations.length} recommendations`,
        timestamp: new Date(),
        links: [
          {
            label: 'View Full Report',
            url: `/team/ai-insights/${savedSummary.id}`,
            icon: 'file-text',
          },
        ],
        summaryPreview: {
          id: savedSummary.id,
          status: summary.overallStatus,
          highlightsCount: summary.highlights.length,
          concernsCount: summary.concerns.length,
          recommendationsCount: summary.recommendations.length,
        },
      },
      action: {
        type: 'generate_summary',
        status: 'success',
        data: { summaryId: savedSummary.id },
      },
    };

    return c.json(response);
  } catch (error) {
    console.error('Chatbot AI Summary generation failed:', error);
    const response: ChatResponse = {
      message: {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, there was an error generating the summary. Please try again later.',
        timestamp: new Date(),
      },
      action: { type: 'generate_summary', status: 'error' },
    };
    return c.json(response);
  }
}

// Handler: View Reports
function handleViewReports(c: any) {
  const response: ChatResponse = {
    message: {
      id: generateId(),
      role: 'assistant',
      content: 'Here are your AI Insights reports. Click the link below to view your generated summaries.',
      timestamp: new Date(),
      links: [
        {
          label: 'View AI Insights History',
          url: '/team/ai-insights',
          icon: 'file-text',
        },
      ],
    },
    action: { type: 'view_reports', status: 'success' },
  };
  return c.json(response);
}

// Handler: Team Status
async function handleTeamStatus(c: any, team: any, companyId: string) {
  const memberIds = team.members.map((m: any) => m.id);

  // Get company timezone and today's range
  const timezone = await getCompanyTimezone(companyId);
  const { start: today, end: tomorrow } = getTodayRange(timezone);

  // Get today's check-ins
  const todayCheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      createdAt: { gte: today, lt: tomorrow },
    },
    select: {
      readinessStatus: true,
    },
  });

  const greenCount = todayCheckins.filter((c) => c.readinessStatus === 'GREEN').length;
  const yellowCount = todayCheckins.filter((c) => c.readinessStatus === 'YELLOW').length;
  const redCount = todayCheckins.filter((c) => c.readinessStatus === 'RED').length;
  const checkinRate = memberIds.length > 0
    ? Math.round((todayCheckins.length / memberIds.length) * 100)
    : 0;

  // Get pending approvals
  const pendingExceptions = await prisma.exception.count({
    where: {
      userId: { in: memberIds },
      status: 'PENDING',
    },
  });

  // Get open incidents
  const openIncidents = await prisma.incident.count({
    where: {
      reportedBy: { in: memberIds },
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
  });

  const response: ChatResponse = {
    message: {
      id: generateId(),
      role: 'assistant',
      content: `**${team.name} - Today's Status**\n\n👥 **Members:** ${memberIds.length}\n📋 **Check-in Rate:** ${checkinRate}% (${todayCheckins.length}/${memberIds.length})\n\n🟢 Green: ${greenCount}\n🟡 Yellow: ${yellowCount}\n🔴 Red: ${redCount}\n\n📝 Pending Approvals: ${pendingExceptions}\n⚠️ Open Incidents: ${openIncidents}`,
      timestamp: new Date(),
      links: [
        {
          label: 'View Team Overview',
          url: '/team/overview',
          icon: 'bar-chart',
        },
      ],
    },
    action: { type: 'none', status: 'success' },
  };

  return c.json(response);
}

// Handler: At Risk - Detect workers with attendance issues
async function handleAtRisk(c: any, team: any, companyId: string) {
  const memberIds = team.members.map((m: any) => m.id);

  // Get company timezone
  const timezone = await getCompanyTimezone(companyId);
  const teamWorkDays = team.workDays || 'MON,TUE,WED,THU,FRI';

  // Get date range for last 14 days
  const endDate = getEndOfDay(new Date(), timezone);
  const startDate = getStartOfDay(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), timezone);

  // Fetch holidays for the period
  const holidays = await prisma.holiday.findMany({
    where: {
      companyId,
      date: { gte: startDate, lte: endDate },
    },
    select: { date: true },
  });
  const holidayDates = holidays.map(h => formatLocalDate(h.date, timezone));
  const holidaySet = new Set(holidayDates);

  // Fetch exemptions for all team members
  const memberExemptions = await prisma.exception.findMany({
    where: {
      userId: { in: memberIds },
      status: 'APPROVED',
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: {
      userId: true,
      startDate: true,
      endDate: true,
    },
  });

  // Fetch EXCUSED absences for all team members (TL approved = no penalty)
  const excusedAbsences = await prisma.absence.findMany({
    where: {
      userId: { in: memberIds },
      status: 'EXCUSED',
      absenceDate: { gte: startDate, lte: endDate },
    },
    select: {
      userId: true,
      absenceDate: true,
    },
  });

  // Build excused absences map by user
  const excusedAbsencesByUser = new Map<string, Set<string>>();
  for (const absence of excusedAbsences) {
    const dateStr = formatLocalDate(absence.absenceDate, timezone);
    const userAbsences = excusedAbsencesByUser.get(absence.userId) || new Set();
    userAbsences.add(dateStr);
    excusedAbsencesByUser.set(absence.userId, userAbsences);
  }

  // Build exemption map
  const exemptionsByUser = new Map<string, typeof memberExemptions>();
  for (const exemption of memberExemptions) {
    const userExemptions = exemptionsByUser.get(exemption.userId) || [];
    userExemptions.push(exemption);
    exemptionsByUser.set(exemption.userId, userExemptions);
  }

  // Get all check-ins for the period
  const allCheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      userId: true,
      readinessStatus: true,
      readinessScore: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Group check-ins by userId
  const checkinsByUser = new Map<string, typeof allCheckins>();
  for (const checkin of allCheckins) {
    const userCheckins = checkinsByUser.get(checkin.userId) || [];
    userCheckins.push(checkin);
    checkinsByUser.set(checkin.userId, userCheckins);
  }

  // Helper to check if date is exempted for user (includes exemptions + EXCUSED absences)
  const isDateExemptedForUser = (userId: string, dateStr: string): boolean => {
    // Check exemptions (Exception model - leave requests)
    const userExemptions = exemptionsByUser.get(userId) || [];
    for (const exemption of userExemptions) {
      if (!exemption.startDate || !exemption.endDate) continue;
      const exStartStr = formatLocalDate(exemption.startDate, timezone);
      const exEndStr = formatLocalDate(exemption.endDate, timezone);
      if (dateStr >= exStartStr && dateStr <= exEndStr) {
        return true;
      }
    }
    // Check EXCUSED absences (Absence model - TL approved absences)
    const userExcusedAbsences = excusedAbsencesByUser.get(userId);
    if (userExcusedAbsences?.has(dateStr)) {
      return true;
    }
    return false;
  };

  // Process each member
  interface MemberAnalysis {
    name: string;
    checkinRate: number;
    missedDays: number;
    avgScore: number;
    redCount: number;
    yellowCount: number;
    greenCount: number;
    riskLevel: 'low' | 'medium' | 'high';
    issues: string[];
  }

  const memberAnalytics: MemberAnalysis[] = team.members.map((member: any) => {
    // Check-in requirement starts the DAY AFTER joining (not same day)
    const joinDate = member.teamJoinedAt ? new Date(member.teamJoinedAt) : new Date(member.createdAt);
    const memberEffectiveStart = getStartOfNextDay(joinDate, timezone);
    const effectiveStartDate = memberEffectiveStart > startDate ? memberEffectiveStart : startDate;

    // Count exemption days
    const userExemptions = exemptionsByUser.get(member.id) || [];
    const exemptedDatesSet = new Set<string>();
    for (const exemption of userExemptions) {
      if (!exemption.startDate || !exemption.endDate) continue;
      const exStart = exemption.startDate > effectiveStartDate ? exemption.startDate : effectiveStartDate;
      const exEnd = exemption.endDate < endDate ? exemption.endDate : endDate;
      let current = new Date(exStart);
      while (current <= exEnd) {
        const dateStr = formatLocalDate(current, timezone);
        const dayOfWeek = current.getDay();
        const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        if (teamWorkDays.includes(dayNames[dayOfWeek]) && !holidaySet.has(dateStr)) {
          exemptedDatesSet.add(dateStr);
        }
        current.setDate(current.getDate() + 1);
      }
    }

    // Also add EXCUSED absences (TL approved = no penalty)
    const userExcusedAbsences = excusedAbsencesByUser.get(member.id);
    if (userExcusedAbsences) {
      for (const dateStr of userExcusedAbsences) {
        exemptedDatesSet.add(dateStr);
      }
    }

    const workDaysBeforeExemptions = countWorkDaysInRange(effectiveStartDate, endDate, teamWorkDays, timezone, holidayDates);
    const expectedWorkDays = Math.max(0, workDaysBeforeExemptions - exemptedDatesSet.size);

    const checkins = checkinsByUser.get(member.id) || [];

    // Filter valid check-ins (not on holidays or exempted days)
    const validCheckins = checkins.filter(c => {
      const checkinDateStr = formatLocalDate(c.createdAt, timezone);
      if (holidaySet.has(checkinDateStr)) return false;
      if (isDateExemptedForUser(member.id, checkinDateStr)) return false;
      return true;
    });

    const greenCount = validCheckins.filter(c => c.readinessStatus === 'GREEN').length;
    const yellowCount = validCheckins.filter(c => c.readinessStatus === 'YELLOW').length;
    const redCount = validCheckins.filter(c => c.readinessStatus === 'RED').length;

    const avgScore = validCheckins.length > 0
      ? Math.round(validCheckins.reduce((sum, c) => sum + c.readinessScore, 0) / validCheckins.length)
      : 0;

    const checkinRate = expectedWorkDays > 0
      ? Math.min(100, Math.round((validCheckins.length / expectedWorkDays) * 100))
      : 100;

    const missedDays = Math.max(0, expectedWorkDays - validCheckins.length);

    // Determine risk level and collect issues
    const issues: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Check for missed days
    if (missedDays >= 4) {
      riskLevel = 'high';
      issues.push(`${missedDays} missed work days`);
    } else if (missedDays >= 2) {
      if (riskLevel === 'low') riskLevel = 'medium';
      issues.push(`${missedDays} missed work days`);
    }

    // Check for red status
    if (redCount >= 3 || (validCheckins.length > 0 && redCount / validCheckins.length > 0.4)) {
      riskLevel = 'high';
      issues.push(`${redCount} RED check-ins (${Math.round(redCount / validCheckins.length * 100)}%)`);
    } else if (redCount >= 2) {
      if (riskLevel === 'low') riskLevel = 'medium';
      issues.push(`${redCount} RED check-ins`);
    }

    // Check for yellow status
    if (yellowCount >= 3) {
      if (riskLevel === 'low') riskLevel = 'medium';
      issues.push(`${yellowCount} YELLOW check-ins`);
    }

    // Check for low average score
    if (avgScore > 0 && avgScore < 50) {
      if (riskLevel === 'low') riskLevel = 'medium';
      issues.push(`Low avg score: ${avgScore}%`);
    }

    // Check for low check-in rate
    if (checkinRate < 60 && expectedWorkDays > 0) {
      if (riskLevel === 'low') riskLevel = 'medium';
      issues.push(`Low check-in rate: ${checkinRate}%`);
    }

    return {
      name: `${member.firstName} ${member.lastName}`,
      checkinRate,
      missedDays,
      avgScore,
      redCount,
      yellowCount,
      greenCount,
      riskLevel,
      issues,
    };
  });

  // Filter members who have issues and sort by risk
  const atRiskMembers = memberAnalytics
    .filter((m: MemberAnalysis) => m.riskLevel !== 'low' || m.issues.length > 0)
    .sort((a: MemberAnalysis, b: MemberAnalysis) => {
      const riskOrder = { high: 0, medium: 1, low: 2 };
      if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      }
      return a.avgScore - b.avgScore;
    });

  // Format response
  let content: string;

  if (atRiskMembers.length === 0) {
    content = `✅ **Great news!** All ${team.members.length} members of **${team.name}** are doing well.\n\nNo attendance issues or concerns detected in the past 14 days.`;
  } else {
    const highRisk = atRiskMembers.filter((m: MemberAnalysis) => m.riskLevel === 'high');
    const mediumRisk = atRiskMembers.filter((m: MemberAnalysis) => m.riskLevel === 'medium');

    content = `**${team.name} - Workers Needing Attention**\n\n`;
    content += `📊 Analyzed ${team.members.length} members over the past 14 days\n\n`;

    if (highRisk.length > 0) {
      content += `🔴 **High Risk (${highRisk.length}):**\n`;
      for (const member of highRisk) {
        content += `• **${member.name}**\n`;
        for (const issue of member.issues) {
          content += `  ↳ ${issue}\n`;
        }
      }
      content += '\n';
    }

    if (mediumRisk.length > 0) {
      content += `🟡 **Medium Risk (${mediumRisk.length}):**\n`;
      for (const member of mediumRisk) {
        content += `• **${member.name}**\n`;
        for (const issue of member.issues) {
          content += `  ↳ ${issue}\n`;
        }
      }
      content += '\n';
    }

    content += `\n💡 **Tip:** Say "Generate Summary" for a detailed AI analysis with recommendations.`;
  }

  const response: ChatResponse = {
    message: {
      id: generateId(),
      role: 'assistant',
      content,
      timestamp: new Date(),
      links: atRiskMembers.length > 0 ? [
        {
          label: 'View Team Analytics',
          url: '/team/analytics',
          icon: 'bar-chart',
        },
      ] : undefined,
    },
    action: { type: 'at_risk', status: 'success' },
  };

  return c.json(response);
}

// Handler: Help
function handleHelp(c: any) {
  const helpText = `**Available Commands:**\n
📊 **"Generate Summary"** - Create an AI-powered analysis of your team's wellness data for the past 14 days. The summary will be saved to your AI Insights.

📁 **"View Reports"** - See all your previously generated AI Insights reports.

👥 **"Team Status"** - Get a quick overview of your team's check-in status for today.

⚠️ **"At Risk"** - Identify workers with attendance issues, low check-in rates, or concerning patterns that need attention.

❓ **"Help"** - Show this help message.

**Tips:**
- Each summary you generate is private - only you can see it
- Click the suggestion buttons below for quick access`;

  const response: ChatResponse = {
    message: {
      id: generateId(),
      role: 'assistant',
      content: helpText,
      timestamp: new Date(),
    },
    action: { type: 'help', status: 'success' },
  };

  return c.json(response);
}

// Handler: Fallback - proactively suggest actions with clickable buttons
function handleUnknownCommand(c: any, _originalMessage: string) {
  const response: ChatResponse = {
    message: {
      id: generateId(),
      role: 'assistant',
      content: `I can help you with the following. Just click one of the options below:`,
      timestamp: new Date(),
      quickActions: [
        {
          id: 'generate-report',
          label: 'Generate Report',
          command: 'Generate Summary',
          icon: 'bar-chart',
        },
        {
          id: 'team-status',
          label: 'Team Status',
          command: 'Team Status',
          icon: 'users',
        },
        {
          id: 'at-risk',
          label: 'At Risk Workers',
          command: 'At Risk',
          icon: 'alert-triangle',
        },
        {
          id: 'view-reports',
          label: 'Past Reports',
          command: 'View Reports',
          icon: 'file-text',
        },
      ],
    },
    action: { type: 'none', status: 'success' },
  };

  return c.json(response);
}

export { chatbotRoutes };
