import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000/api';

// Test results tracker
const testResults: { name: string; passed: boolean; error?: string; response?: any }[] = [];

async function makeRequest(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    token?: string;
  } = {}
) {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

async function runTest(name: string, testFn: () => Promise<{ passed: boolean; response?: any; error?: string }>) {
  console.log(`\n🔄 Testing: ${name}`);
  try {
    const result = await testFn();
    testResults.push({ name, ...result });
    if (result.passed) {
      console.log(`   ✅ PASSED`);
    } else {
      console.log(`   ❌ FAILED: ${result.error}`);
    }
  } catch (error: any) {
    testResults.push({ name, passed: false, error: error.message });
    console.log(`   ❌ ERROR: ${error.message}`);
  }
}

// ============================================================
// MAIN TEST FUNCTION
// ============================================================
async function runAllTests() {
  console.log('='.repeat(70));
  console.log('AEGIRA API FEATURE TESTS');
  console.log('='.repeat(70));

  // Get test users from database
  const worker = await prisma.user.findFirst({
    where: { role: 'WORKER' },
    include: { team: true }
  });

  const teamLead = await prisma.user.findFirst({
    where: { role: 'TEAM_LEAD' },
    include: { team: true }
  });

  const executive = await prisma.user.findFirst({
    where: { role: 'EXECUTIVE' }
  });

  if (!worker || !teamLead) {
    console.log('❌ Could not find test users in database');
    return;
  }

  console.log(`\n📋 Test Users:`);
  console.log(`   Worker: ${worker.email} (${worker.firstName} ${worker.lastName})`);
  console.log(`   Team Lead: ${teamLead.email} (${teamLead.firstName} ${teamLead.lastName})`);
  console.log(`   Executive: ${executive?.email || 'N/A'}`);

  // Store tokens
  let workerToken: string | null = null;
  let teamLeadToken: string | null = null;

  // ============================================================
  // 1. AUTHENTICATION TESTS
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('1. AUTHENTICATION TESTS');
  console.log('─'.repeat(70));

  // Test worker login
  await runTest('Worker Login', async () => {
    const res = await makeRequest('/auth/login', {
      method: 'POST',
      body: { email: worker.email, password: 'Test123!' }
    });

    if (res.status === 200 && res.data?.token) {
      workerToken = res.data.token;
      return { passed: true, response: { token: 'received', user: res.data.user?.email } };
    }
    return { passed: false, error: `Status ${res.status}: ${JSON.stringify(res.data)}` };
  });

  // Test team lead login
  await runTest('Team Lead Login', async () => {
    const res = await makeRequest('/auth/login', {
      method: 'POST',
      body: { email: teamLead.email, password: 'Test123!' }
    });

    if (res.status === 200 && res.data?.token) {
      teamLeadToken = res.data.token;
      return { passed: true, response: { token: 'received', user: res.data.user?.email } };
    }
    return { passed: false, error: `Status ${res.status}: ${JSON.stringify(res.data)}` };
  });

  // Test unauthorized access
  await runTest('Unauthorized Access Protection', async () => {
    const res = await makeRequest('/checkins/my');
    return {
      passed: res.status === 401,
      response: res.data,
      error: res.status !== 401 ? `Expected 401, got ${res.status}` : undefined
    };
  });

  if (!workerToken || !teamLeadToken) {
    console.log('\n❌ Cannot continue tests without valid tokens');
    printSummary();
    return;
  }

  // ============================================================
  // 2. WORKER CHECK-IN TESTS
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('2. WORKER CHECK-IN TESTS');
  console.log('─'.repeat(70));

  // Test get my checkins
  await runTest('Get Worker Check-in History', async () => {
    const res = await makeRequest('/checkins/my', { token: workerToken! });
    return {
      passed: res.status === 200 && Array.isArray(res.data?.checkins),
      response: { count: res.data?.checkins?.length },
      error: res.status !== 200 ? `Status ${res.status}` : undefined
    };
  });

  // Test check-in validation (get team schedule info)
  await runTest('Check-in Validation Info', async () => {
    const res = await makeRequest('/checkins/validation', { token: workerToken! });
    return {
      passed: res.status === 200,
      response: res.data,
      error: res.status !== 200 ? `Status ${res.status}: ${JSON.stringify(res.data)}` : undefined
    };
  });

  // Test submit check-in (GREEN status)
  await runTest('Submit Check-in (GREEN Status)', async () => {
    const res = await makeRequest('/checkins', {
      method: 'POST',
      token: workerToken!,
      body: {
        mood: 8,
        stress: 3,
        sleep: 8,
        physicalHealth: 8
      }
    });
    return {
      passed: res.status === 201 || res.status === 200 || (res.status === 400 && res.data?.error?.includes('already checked in')),
      response: res.data,
      error: res.status >= 500 ? `Status ${res.status}: ${JSON.stringify(res.data)}` : undefined
    };
  });

  // ============================================================
  // 3. WORKER HISTORY & ATTENDANCE TESTS
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('3. WORKER HISTORY & ATTENDANCE TESTS');
  console.log('─'.repeat(70));

  // Test attendance history
  await runTest('Get Attendance History', async () => {
    const res = await makeRequest('/checkins/attendance/history', { token: workerToken! });
    return {
      passed: res.status === 200,
      response: { count: res.data?.length || res.data?.attendance?.length },
      error: res.status !== 200 ? `Status ${res.status}` : undefined
    };
  });

  // Test attendance performance
  await runTest('Get Attendance Performance', async () => {
    const res = await makeRequest('/checkins/attendance/performance', { token: workerToken! });
    return {
      passed: res.status === 200,
      response: res.data,
      error: res.status !== 200 ? `Status ${res.status}: ${JSON.stringify(res.data)}` : undefined
    };
  });

  // ============================================================
  // 4. WORKER EXCEPTION REQUEST TESTS
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('4. WORKER EXCEPTION REQUEST TESTS');
  console.log('─'.repeat(70));

  // Get pending exceptions for worker
  await runTest('Get My Pending Exceptions', async () => {
    const res = await makeRequest('/exceptions/my', { token: workerToken! });
    return {
      passed: res.status === 200,
      response: { count: res.data?.exceptions?.length || res.data?.length },
      error: res.status !== 200 ? `Status ${res.status}` : undefined
    };
  });

  // Create new exception request
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  await runTest('Create Exception Request', async () => {
    const res = await makeRequest('/exceptions', {
      method: 'POST',
      token: workerToken!,
      body: {
        type: 'PERSONAL_LEAVE',
        startDate: tomorrowStr,
        endDate: tomorrowStr,
        reason: 'API Test - Personal matter'
      }
    });
    return {
      passed: res.status === 201 || res.status === 200,
      response: res.data,
      error: (res.status !== 201 && res.status !== 200) ? `Status ${res.status}: ${JSON.stringify(res.data)}` : undefined
    };
  });

  // ============================================================
  // 5. TEAM LEADER DAILY MONITORING TESTS
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('5. TEAM LEADER DAILY MONITORING TESTS');
  console.log('─'.repeat(70));

  // Get daily monitoring data
  await runTest('Get Daily Monitoring Dashboard', async () => {
    const res = await makeRequest('/daily-monitoring', { token: teamLeadToken! });
    return {
      passed: res.status === 200,
      response: {
        todayCheckins: res.data?.todayCheckins?.length,
        suddenChanges: res.data?.suddenChanges?.length,
        pendingExemptions: res.data?.pendingExemptions?.length
      },
      error: res.status !== 200 ? `Status ${res.status}: ${JSON.stringify(res.data)}` : undefined
    };
  });

  // Get team members
  await runTest('Get Team Members', async () => {
    const res = await makeRequest('/teams/my', { token: teamLeadToken! });
    return {
      passed: res.status === 200,
      response: { teamName: res.data?.name, memberCount: res.data?.members?.length },
      error: res.status !== 200 ? `Status ${res.status}` : undefined
    };
  });

  // ============================================================
  // 6. TEAM LEADER EXCEPTION APPROVAL TESTS
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('6. TEAM LEADER EXCEPTION APPROVAL TESTS');
  console.log('─'.repeat(70));

  // Get pending exception requests for team
  await runTest('Get Pending Exception Requests (Team)', async () => {
    const res = await makeRequest('/exceptions/pending', { token: teamLeadToken! });
    return {
      passed: res.status === 200,
      response: { count: res.data?.exceptions?.length || res.data?.length },
      error: res.status !== 200 ? `Status ${res.status}` : undefined
    };
  });

  // Find and approve an exception (if any)
  await runTest('Approve Exception Request', async () => {
    // Get pending exceptions
    const pendingRes = await makeRequest('/exceptions/pending', { token: teamLeadToken! });
    const pending = pendingRes.data?.exceptions || pendingRes.data || [];

    if (pending.length === 0) {
      return { passed: true, response: { message: 'No pending exceptions to approve' } };
    }

    const exceptionId = pending[0].id;
    const res = await makeRequest(`/exceptions/${exceptionId}/approve`, {
      method: 'PATCH',
      token: teamLeadToken!,
      body: { action: 'APPROVED', notes: 'API Test approval' }
    });

    return {
      passed: res.status === 200,
      response: res.data,
      error: res.status !== 200 ? `Status ${res.status}: ${JSON.stringify(res.data)}` : undefined
    };
  });

  // ============================================================
  // 7. ANALYTICS TESTS
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('7. ANALYTICS TESTS');
  console.log('─'.repeat(70));

  // Get team analytics
  await runTest('Get Team Analytics Dashboard', async () => {
    const res = await makeRequest('/analytics/dashboard', { token: teamLeadToken! });
    return {
      passed: res.status === 200,
      response: {
        hasData: !!res.data,
        keys: Object.keys(res.data || {})
      },
      error: res.status !== 200 ? `Status ${res.status}` : undefined
    };
  });

  // Get team-specific analytics
  await runTest('Get Team-Specific Analytics', async () => {
    const teamId = teamLead.teamId;
    if (!teamId) {
      return { passed: false, error: 'Team Lead has no team assigned' };
    }

    const res = await makeRequest(`/analytics/team/${teamId}`, { token: teamLeadToken! });
    return {
      passed: res.status === 200,
      response: {
        avgReadiness: res.data?.avgReadinessScore,
        checkinRate: res.data?.checkinRate
      },
      error: res.status !== 200 ? `Status ${res.status}` : undefined
    };
  });

  // ============================================================
  // 8. INCIDENT TESTS
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('8. INCIDENT TESTS');
  console.log('─'.repeat(70));

  // Get my incidents (worker)
  await runTest('Get My Incidents (Worker)', async () => {
    const res = await makeRequest('/incidents/my', { token: workerToken! });
    return {
      passed: res.status === 200,
      response: { count: res.data?.incidents?.length || res.data?.length },
      error: res.status !== 200 ? `Status ${res.status}` : undefined
    };
  });

  // Create incident report
  await runTest('Create Incident Report', async () => {
    const res = await makeRequest('/incidents', {
      method: 'POST',
      token: workerToken!,
      body: {
        title: 'API Test Incident',
        description: 'This is a test incident created via API testing',
        type: 'OTHER',
        severity: 'LOW',
        dateOccurred: new Date().toISOString()
      }
    });
    return {
      passed: res.status === 201 || res.status === 200,
      response: res.data,
      error: (res.status !== 201 && res.status !== 200) ? `Status ${res.status}: ${JSON.stringify(res.data)}` : undefined
    };
  });

  // Get team incidents (team lead)
  await runTest('Get Team Incidents (Team Lead)', async () => {
    const res = await makeRequest('/incidents', { token: teamLeadToken! });
    return {
      passed: res.status === 200,
      response: { count: res.data?.incidents?.length || res.data?.length },
      error: res.status !== 200 ? `Status ${res.status}` : undefined
    };
  });

  // ============================================================
  // 9. NOTIFICATION TESTS
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('9. NOTIFICATION TESTS');
  console.log('─'.repeat(70));

  await runTest('Get Notifications', async () => {
    const res = await makeRequest('/notifications', { token: workerToken! });
    return {
      passed: res.status === 200,
      response: { count: res.data?.notifications?.length || res.data?.length },
      error: res.status !== 200 ? `Status ${res.status}` : undefined
    };
  });

  // ============================================================
  // 10. HOLIDAY/CALENDAR TESTS
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('10. HOLIDAY/CALENDAR TESTS');
  console.log('─'.repeat(70));

  await runTest('Get Holidays', async () => {
    const res = await makeRequest('/holidays', { token: workerToken! });
    return {
      passed: res.status === 200,
      response: { count: res.data?.holidays?.length || res.data?.length },
      error: res.status !== 200 ? `Status ${res.status}` : undefined
    };
  });

  // Print summary
  printSummary();
}

function printSummary() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));

  const passed = testResults.filter(t => t.passed).length;
  const failed = testResults.filter(t => !t.passed).length;
  const total = testResults.length;

  console.log(`\nTotal Tests: ${total}`);
  console.log(`✅ Passed: ${passed} (${((passed/total)*100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failed} (${((failed/total)*100).toFixed(1)}%)`);

  if (failed > 0) {
    console.log('\n--- Failed Tests ---');
    testResults.filter(t => !t.passed).forEach(t => {
      console.log(`\n❌ ${t.name}`);
      console.log(`   Error: ${t.error}`);
    });
  }

  console.log('\n--- All Test Results ---');
  testResults.forEach((t, i) => {
    const icon = t.passed ? '✅' : '❌';
    console.log(`${i + 1}. ${icon} ${t.name}`);
    if (t.response && Object.keys(t.response).length > 0) {
      console.log(`   Response: ${JSON.stringify(t.response)}`);
    }
  });
}

// Run the tests
runAllTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
