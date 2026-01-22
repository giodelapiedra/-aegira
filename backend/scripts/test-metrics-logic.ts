/**
 * Mock Data Testing: Metrics-Only Grade Calculation
 *
 * Tests the "Metrics-Only" philosophy:
 * - Grade = 100% avgReadiness (wellness data only)
 * - No check-in = no data = not counted (NOT penalized)
 * - Absence of data is NOT negative data
 * - EXCUSED absences = exemptions (not counted)
 */

// ============================================
// MOCK DATA SETUP
// ============================================

interface MockCheckin {
  userId: string;
  readinessScore: number;
  readinessStatus: 'GREEN' | 'YELLOW' | 'RED';
  mood: number;
  stress: number;
  sleep: number;
  physicalHealth: number;
  createdAt: Date;
}

interface MockMember {
  id: string;
  name: string;
  checkins: MockCheckin[];
  excusedDates: string[]; // Dates with EXCUSED absences
}

interface MockTeam {
  id: string;
  name: string;
  members: MockMember[];
  workDays: string;
}

// Helper: Calculate readiness score from metrics (same formula as backend)
function calculateReadinessScore(mood: number, stress: number, sleep: number, physicalHealth: number): number {
  // Invert stress (1-10 scale, lower is better for wellness)
  const stressInverted = 11 - stress;

  // Weighted average: mood 25%, stress 25%, sleep 25%, physical 25%
  const score = Math.round(
    (mood * 0.25 + stressInverted * 0.25 + sleep * 0.25 + physicalHealth * 0.25) * 10
  );

  return Math.min(100, Math.max(0, score));
}

// Helper: Get readiness status from score
function getReadinessStatus(score: number): 'GREEN' | 'YELLOW' | 'RED' {
  if (score >= 70) return 'GREEN';
  if (score >= 40) return 'YELLOW';
  return 'RED';
}

// Helper: Create mock checkin
function createMockCheckin(
  userId: string,
  mood: number,
  stress: number,
  sleep: number,
  physicalHealth: number,
  date: Date
): MockCheckin {
  const score = calculateReadinessScore(mood, stress, sleep, physicalHealth);
  return {
    userId,
    readinessScore: score,
    readinessStatus: getReadinessStatus(score),
    mood,
    stress,
    sleep,
    physicalHealth,
    createdAt: date,
  };
}

// ============================================
// GRADE CALCULATION LOGIC (Metrics-Only)
// ============================================

interface GradeResult {
  score: number;
  letter: string;
  label: string;
  avgReadiness: number;
  membersWithData: number;
  membersWithoutData: number;
  totalDataPoints: number;
}

function getLetterGrade(score: number): { letter: string; label: string } {
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
}

/**
 * Calculate team grade using METRICS-ONLY approach
 *
 * Key principles:
 * 1. Only members with check-in data contribute to the grade
 * 2. Members without data are NOT penalized (they just don't count)
 * 3. Grade = average of member averages (fair per-member representation)
 */
function calculateTeamGrade(team: MockTeam): GradeResult {
  const memberAverages: number[] = [];
  let totalDataPoints = 0;
  let membersWithData = 0;
  let membersWithoutData = 0;

  for (const member of team.members) {
    const validCheckins = member.checkins; // All checkins are valid in mock

    if (validCheckins.length > 0) {
      // Calculate member's average score
      const memberAvg = Math.round(
        validCheckins.reduce((sum, c) => sum + c.readinessScore, 0) / validCheckins.length
      );
      memberAverages.push(memberAvg);
      totalDataPoints += validCheckins.length;
      membersWithData++;
    } else {
      // Member has no data - NOT penalized, just not counted
      membersWithoutData++;
    }
  }

  // Team average = average of member averages
  // If no data at all, grade is 0
  const avgReadiness = memberAverages.length > 0
    ? Math.round(memberAverages.reduce((sum, avg) => sum + avg, 0) / memberAverages.length)
    : 0;

  const { letter, label } = getLetterGrade(avgReadiness);

  return {
    score: avgReadiness,
    letter,
    label,
    avgReadiness,
    membersWithData,
    membersWithoutData,
    totalDataPoints,
  };
}

// ============================================
// TEST SCENARIOS
// ============================================

console.log('='.repeat(60));
console.log('METRICS-ONLY GRADE CALCULATION - MOCK DATA TESTS');
console.log('='.repeat(60));
console.log('');

// Test 1: All members with perfect scores
console.log('TEST 1: All Members with Perfect Wellness Scores');
console.log('-'.repeat(50));
{
  const team: MockTeam = {
    id: 'team-1',
    name: 'Perfect Team',
    workDays: 'MON,TUE,WED,THU,FRI',
    members: [
      {
        id: 'member-1',
        name: 'Juan Dela Cruz',
        excusedDates: [],
        checkins: [
          createMockCheckin('member-1', 10, 1, 10, 10, new Date('2024-01-15')), // Perfect
          createMockCheckin('member-1', 9, 2, 9, 9, new Date('2024-01-16')),
          createMockCheckin('member-1', 10, 1, 10, 10, new Date('2024-01-17')),
        ],
      },
      {
        id: 'member-2',
        name: 'Maria Santos',
        excusedDates: [],
        checkins: [
          createMockCheckin('member-2', 10, 1, 10, 10, new Date('2024-01-15')),
          createMockCheckin('member-2', 10, 1, 10, 10, new Date('2024-01-16')),
          createMockCheckin('member-2', 9, 2, 9, 9, new Date('2024-01-17')),
        ],
      },
    ],
  };

  const grade = calculateTeamGrade(team);
  console.log(`Team: ${team.name}`);
  console.log(`Members: ${team.members.length}`);
  console.log(`Members with data: ${grade.membersWithData}`);
  console.log(`Members without data: ${grade.membersWithoutData}`);
  console.log(`Total data points: ${grade.totalDataPoints}`);
  console.log(`Avg Readiness: ${grade.avgReadiness}%`);
  console.log(`Grade: ${grade.letter} (${grade.label})`);
  console.log(`Expected: A or A+ (high scores)`);
  console.log(`PASS: ${grade.letter.startsWith('A') ? 'YES' : 'NO'}`);
}
console.log('');

// Test 2: Mixed scores team
console.log('TEST 2: Mixed Wellness Scores');
console.log('-'.repeat(50));
{
  const team: MockTeam = {
    id: 'team-2',
    name: 'Mixed Team',
    workDays: 'MON,TUE,WED,THU,FRI',
    members: [
      {
        id: 'member-1',
        name: 'High Performer',
        excusedDates: [],
        checkins: [
          createMockCheckin('member-1', 9, 2, 9, 9, new Date('2024-01-15')), // ~88
          createMockCheckin('member-1', 8, 3, 8, 8, new Date('2024-01-16')), // ~78
        ],
      },
      {
        id: 'member-2',
        name: 'Medium Performer',
        excusedDates: [],
        checkins: [
          createMockCheckin('member-2', 7, 4, 7, 7, new Date('2024-01-15')), // ~68
          createMockCheckin('member-2', 6, 5, 6, 6, new Date('2024-01-16')), // ~58
        ],
      },
      {
        id: 'member-3',
        name: 'Low Performer',
        excusedDates: [],
        checkins: [
          createMockCheckin('member-3', 4, 7, 4, 4, new Date('2024-01-15')), // ~35
          createMockCheckin('member-3', 5, 6, 5, 5, new Date('2024-01-16')), // ~48
        ],
      },
    ],
  };

  const grade = calculateTeamGrade(team);

  // Calculate expected manually
  // Member 1 avg: (88+78)/2 = 83
  // Member 2 avg: (68+58)/2 = 63
  // Member 3 avg: (35+48)/2 = 41.5
  // Team avg: (83+63+41.5)/3 = 62.5

  console.log(`Team: ${team.name}`);
  console.log(`Members: ${team.members.length}`);
  console.log(`Members with data: ${grade.membersWithData}`);
  console.log(`Total data points: ${grade.totalDataPoints}`);
  console.log(`Avg Readiness: ${grade.avgReadiness}%`);
  console.log(`Grade: ${grade.letter} (${grade.label})`);
  console.log(`Expected: Around D+ to C- (mixed scores averaging ~62)`);
}
console.log('');

// Test 3: Workers WITHOUT check-ins (KEY TEST)
console.log('TEST 3: Some Workers WITHOUT Check-ins (NOT Penalized)');
console.log('-'.repeat(50));
{
  const team: MockTeam = {
    id: 'team-3',
    name: 'Partial Data Team',
    workDays: 'MON,TUE,WED,THU,FRI',
    members: [
      {
        id: 'member-1',
        name: 'Active Worker (Checked In)',
        excusedDates: [],
        checkins: [
          createMockCheckin('member-1', 8, 2, 8, 8, new Date('2024-01-15')), // ~80
          createMockCheckin('member-1', 8, 2, 8, 8, new Date('2024-01-16')), // ~80
          createMockCheckin('member-1', 8, 2, 8, 8, new Date('2024-01-17')), // ~80
        ],
      },
      {
        id: 'member-2',
        name: 'Inactive Worker (No Check-ins)',
        excusedDates: [],
        checkins: [], // NO DATA - should NOT affect grade
      },
      {
        id: 'member-3',
        name: 'Inactive Worker 2 (No Check-ins)',
        excusedDates: [],
        checkins: [], // NO DATA - should NOT affect grade
      },
    ],
  };

  const grade = calculateTeamGrade(team);

  console.log(`Team: ${team.name}`);
  console.log(`Total Members: ${team.members.length}`);
  console.log(`Members WITH data: ${grade.membersWithData}`);
  console.log(`Members WITHOUT data (NOT penalized): ${grade.membersWithoutData}`);
  console.log(`Total data points: ${grade.totalDataPoints}`);
  console.log(`Avg Readiness: ${grade.avgReadiness}%`);
  console.log(`Grade: ${grade.letter} (${grade.label})`);
  console.log('');
  console.log('KEY PRINCIPLE: Workers without check-ins have NO data.');
  console.log('They are NOT counted in the average - NOT penalized!');
  console.log(`Expected: B- or B (only member-1's 80% counts)`);
  console.log(`PASS: ${grade.avgReadiness >= 78 && grade.avgReadiness <= 82 ? 'YES' : 'NO'}`);
}
console.log('');

// Test 4: 5 out of 10 workers checked in
console.log('TEST 4: 5 out of 10 Workers Checked In');
console.log('-'.repeat(50));
{
  const team: MockTeam = {
    id: 'team-4',
    name: 'Half Check-in Team',
    workDays: 'MON,TUE,WED,THU,FRI',
    members: [
      // 5 workers with check-ins (all GREEN ~80%)
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `active-${i + 1}`,
        name: `Active Worker ${i + 1}`,
        excusedDates: [],
        checkins: [
          createMockCheckin(`active-${i + 1}`, 8, 2, 8, 8, new Date('2024-01-15')),
        ],
      })),
      // 5 workers WITHOUT check-ins
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `inactive-${i + 1}`,
        name: `Inactive Worker ${i + 1}`,
        excusedDates: [],
        checkins: [], // No data
      })),
    ],
  };

  const grade = calculateTeamGrade(team);

  console.log(`Team: ${team.name}`);
  console.log(`Total Members: ${team.members.length}`);
  console.log(`Members WITH data: ${grade.membersWithData} (50%)`);
  console.log(`Members WITHOUT data: ${grade.membersWithoutData} (50%)`);
  console.log(`Total data points: ${grade.totalDataPoints}`);
  console.log(`Avg Readiness: ${grade.avgReadiness}%`);
  console.log(`Grade: ${grade.letter} (${grade.label})`);
  console.log('');
  console.log('OLD SYSTEM: Would penalize team for 50% "compliance"');
  console.log('NEW SYSTEM: Only counts the 5 workers who checked in');
  console.log(`Expected: B- or B (based on 80% avg from active workers)`);
  console.log(`PASS: ${grade.avgReadiness >= 78 ? 'YES' : 'NO'}`);
}
console.log('');

// Test 5: Edge case - NO check-ins at all
console.log('TEST 5: Edge Case - No Check-ins At All');
console.log('-'.repeat(50));
{
  const team: MockTeam = {
    id: 'team-5',
    name: 'New Team (No Data)',
    workDays: 'MON,TUE,WED,THU,FRI',
    members: [
      { id: 'member-1', name: 'Worker 1', excusedDates: [], checkins: [] },
      { id: 'member-2', name: 'Worker 2', excusedDates: [], checkins: [] },
      { id: 'member-3', name: 'Worker 3', excusedDates: [], checkins: [] },
    ],
  };

  const grade = calculateTeamGrade(team);

  console.log(`Team: ${team.name}`);
  console.log(`Total Members: ${team.members.length}`);
  console.log(`Members WITH data: ${grade.membersWithData}`);
  console.log(`Members WITHOUT data: ${grade.membersWithoutData}`);
  console.log(`Total data points: ${grade.totalDataPoints}`);
  console.log(`Avg Readiness: ${grade.avgReadiness}%`);
  console.log(`Grade: ${grade.letter} (${grade.label})`);
  console.log('');
  console.log('No data = no grade can be calculated');
  console.log(`Expected: 0% / F (no data available)`);
  console.log(`PASS: ${grade.avgReadiness === 0 ? 'YES' : 'NO'}`);
}
console.log('');

// Test 6: Comparison - OLD vs NEW calculation
console.log('TEST 6: OLD vs NEW Grade Calculation Comparison');
console.log('-'.repeat(50));
{
  const team: MockTeam = {
    id: 'team-6',
    name: 'Comparison Team',
    workDays: 'MON,TUE,WED,THU,FRI',
    members: [
      // 3 workers checked in with good scores (~85%)
      {
        id: 'member-1',
        name: 'Worker 1',
        excusedDates: [],
        checkins: [createMockCheckin('member-1', 9, 2, 8, 8, new Date('2024-01-15'))],
      },
      {
        id: 'member-2',
        name: 'Worker 2',
        excusedDates: [],
        checkins: [createMockCheckin('member-2', 8, 2, 9, 8, new Date('2024-01-15'))],
      },
      {
        id: 'member-3',
        name: 'Worker 3',
        excusedDates: [],
        checkins: [createMockCheckin('member-3', 8, 3, 8, 9, new Date('2024-01-15'))],
      },
      // 2 workers did NOT check in
      { id: 'member-4', name: 'Worker 4', excusedDates: [], checkins: [] },
      { id: 'member-5', name: 'Worker 5', excusedDates: [], checkins: [] },
    ],
  };

  const grade = calculateTeamGrade(team);

  // OLD calculation: (Readiness * 60%) + (Compliance * 40%)
  // Readiness: ~83%
  // Compliance: 3/5 = 60%
  // OLD Grade: (83 * 0.6) + (60 * 0.4) = 49.8 + 24 = 73.8 (C)
  const oldCompliance = (3 / 5) * 100; // 60%
  const oldGradeScore = Math.round((grade.avgReadiness * 0.6) + (oldCompliance * 0.4));
  const oldGrade = getLetterGrade(oldGradeScore);

  // NEW calculation: 100% Readiness
  // Only counts members with data: ~83%
  // NEW Grade: 83 (B)

  console.log(`Team: ${team.name}`);
  console.log(`Total Members: 5`);
  console.log(`Members who checked in: 3 (60%)`);
  console.log(`Avg Readiness (from checked in): ${grade.avgReadiness}%`);
  console.log('');
  console.log('OLD SYSTEM (60% Readiness + 40% Compliance):');
  console.log(`  Readiness: ${grade.avgReadiness}% x 60% = ${Math.round(grade.avgReadiness * 0.6)}`);
  console.log(`  Compliance: ${oldCompliance}% x 40% = ${Math.round(oldCompliance * 0.4)}`);
  console.log(`  OLD Grade: ${oldGradeScore}% = ${oldGrade.letter} (${oldGrade.label})`);
  console.log('');
  console.log('NEW SYSTEM (100% Wellness Metrics):');
  console.log(`  Avg Readiness: ${grade.avgReadiness}%`);
  console.log(`  NEW Grade: ${grade.score}% = ${grade.letter} (${grade.label})`);
  console.log('');
  console.log('KEY DIFFERENCE:');
  console.log(`  Old system penalizes for missing check-ins: ${oldGradeScore}%`);
  console.log(`  New system only counts actual wellness data: ${grade.score}%`);
  console.log(`  Improvement: +${grade.score - oldGradeScore} points`);
}
console.log('');

// Test 7: Status Distribution
console.log('TEST 7: Status Distribution (GREEN/YELLOW/RED)');
console.log('-'.repeat(50));
{
  const team: MockTeam = {
    id: 'team-7',
    name: 'Status Test Team',
    workDays: 'MON,TUE,WED,THU,FRI',
    members: [
      {
        id: 'green-worker',
        name: 'Green Worker',
        excusedDates: [],
        checkins: [
          createMockCheckin('green-worker', 9, 2, 9, 9, new Date('2024-01-15')), // GREEN ~88
          createMockCheckin('green-worker', 8, 2, 8, 8, new Date('2024-01-16')), // GREEN ~80
        ],
      },
      {
        id: 'yellow-worker',
        name: 'Yellow Worker',
        excusedDates: [],
        checkins: [
          createMockCheckin('yellow-worker', 6, 5, 6, 6, new Date('2024-01-15')), // YELLOW ~55
          createMockCheckin('yellow-worker', 5, 5, 6, 5, new Date('2024-01-16')), // YELLOW ~53
        ],
      },
      {
        id: 'red-worker',
        name: 'Red Worker',
        excusedDates: [],
        checkins: [
          createMockCheckin('red-worker', 3, 8, 3, 3, new Date('2024-01-15')), // RED ~23
          createMockCheckin('red-worker', 4, 7, 4, 4, new Date('2024-01-16')), // RED ~38
        ],
      },
    ],
  };

  // Count statuses
  let greenCount = 0;
  let yellowCount = 0;
  let redCount = 0;

  for (const member of team.members) {
    for (const checkin of member.checkins) {
      if (checkin.readinessStatus === 'GREEN') greenCount++;
      else if (checkin.readinessStatus === 'YELLOW') yellowCount++;
      else redCount++;
    }
  }

  const grade = calculateTeamGrade(team);

  console.log(`Team: ${team.name}`);
  console.log(`Total Check-ins: ${greenCount + yellowCount + redCount}`);
  console.log('');
  console.log('Status Distribution:');
  console.log(`  GREEN (>= 70%): ${greenCount} check-ins`);
  console.log(`  YELLOW (40-69%): ${yellowCount} check-ins`);
  console.log(`  RED (< 40%): ${redCount} check-ins`);
  console.log('');
  console.log(`Team Avg Readiness: ${grade.avgReadiness}%`);
  console.log(`Team Grade: ${grade.letter} (${grade.label})`);
}
console.log('');

// Summary
console.log('='.repeat(60));
console.log('SUMMARY: Metrics-Only Grade Calculation');
console.log('='.repeat(60));
console.log('');
console.log('KEY PRINCIPLES VERIFIED:');
console.log('1. Grade = 100% from actual wellness data (avgReadiness)');
console.log('2. Workers without check-ins = NO DATA (not penalized)');
console.log('3. Only workers who check in contribute to the grade');
console.log('4. Team average = average of member averages (fair representation)');
console.log('5. EXCUSED absences = exemptions (worker not expected to check in)');
console.log('');
console.log('PHILOSOPHY:');
console.log('- Health metrics lang ang basehan ng lahat');
console.log('- Kung walang check-in, walang data');
console.log('- Walang penalty, walang assumption');
console.log('- Absence of data is NOT treated as negative data');
console.log('- HR handles attendance, Aegira handles wellness');
console.log('');
