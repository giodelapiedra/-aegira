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
  formatLocalDate,
  isWorkDay,
  countWorkDaysInRange,
  calculateActualStreak,
  DEFAULT_TIMEZONE,
} from '../../utils/date-helpers.js';
import {
  type ChatRequest,
  type ChatResponse,
  TEAM_LEAD_COMMANDS,
  TEAM_LEAD_SUGGESTIONS,
} from './types.js';

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

// Helper: Detect command from user message
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

  // Detect command
  const command = detectCommand(message);

  // Process based on command
  switch (command) {
    case 'GENERATE_SUMMARY':
      return await handleGenerateSummary(c, user, team, companyId, context);

    case 'VIEW_REPORTS':
      return handleViewReports(c);

    case 'TEAM_STATUS':
      return await handleTeamStatus(c, team, companyId);

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
    // This ensures we don't count days before the user was in this team
    const joinDate = member.teamJoinedAt ? new Date(member.teamJoinedAt) : new Date(member.createdAt);
    const memberJoinDate = getStartOfDay(joinDate, timezone);
    const effectiveStartDate = memberJoinDate > startDate ? memberJoinDate : startDate;
    const expectedWorkDays = countWorkDaysInRange(effectiveStartDate, endDate, teamWorkDays, timezone);

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

  // Calculate Team Grade
  const membersWithCheckins = memberAnalytics.filter((m: any) => m.checkinCount > 0);
  const teamAvgReadiness = membersWithCheckins.length > 0
    ? membersWithCheckins.reduce((sum: number, m: any) => sum + m.avgScore, 0) / membersWithCheckins.length
    : 0;
  const teamCompliance = memberAnalytics.length > 0
    ? memberAnalytics.reduce((sum: number, m: any) => sum + m.checkinRate, 0) / memberAnalytics.length
    : 0;

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

  const reasonCounts = new Map<string, number>();
  for (const checkin of allCheckins) {
    if (checkin.lowScoreReason) {
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

    // Build response message
    const statusEmoji = {
      healthy: '🟢',
      attention: '🟡',
      critical: '🔴',
    };

    const gradeEmoji = gradeScore >= 80 ? '🏆' : gradeScore >= 60 ? '📈' : '⚠️';

    const response: ChatResponse = {
      message: {
        id: generateId(),
        role: 'assistant',
        content: `AI Summary for ${team.name} has been generated!\n\n${gradeEmoji} **Team Grade: ${teamGrade.letter}** (${teamGrade.label})\n${statusEmoji[summary.overallStatus]} **Status: ${summary.overallStatus.toUpperCase()}**\n\n**Summary:**\n${summary.summary}\n\n📊 ${summary.highlights.length} highlights, ${summary.concerns.length} concerns, ${summary.recommendations.length} recommendations`,
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

// Handler: Help
function handleHelp(c: any) {
  const helpText = `**Available Commands:**\n
📊 **"Generate Summary"** - Create an AI-powered analysis of your team's wellness data for the past 14 days. The summary will be saved to your AI Insights.

📁 **"View Reports"** - See all your previously generated AI Insights reports.

👥 **"Team Status"** - Get a quick overview of your team's check-in status for today.

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

// Handler: Unknown Command
function handleUnknownCommand(c: any, originalMessage: string) {
  // Sanitize user input to prevent XSS - only show first 50 chars
  const sanitizedMessage = originalMessage
    .slice(0, 50)
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .trim();

  const response: ChatResponse = {
    message: {
      id: generateId(),
      role: 'assistant',
      content: `I didn't understand "${sanitizedMessage}"${originalMessage.length > 50 ? '...' : ''}.\n\nTry these commands:\n- "Generate Summary" - Create an AI analysis of your team\n- "View Reports" - View your past AI insights\n- "Team Status" - See your team's status today\n- "Help" - Show all available commands`,
      timestamp: new Date(),
    },
    action: { type: 'none', status: 'success' },
  };

  return c.json(response);
}

export { chatbotRoutes };
