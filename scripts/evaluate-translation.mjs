import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const evalSetPath = path.join(rootDir, 'docs/final/SEMAI_TRANSLATION_EVAL_SET.json');
const reportPath = path.join(rootDir, 'docs/final/SEMAI_TRANSLATION_EVAL_REPORT.md');

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  console.error(
    'Missing VITE_SUPABASE_URL/SUPABASE_URL or VITE_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY.',
  );
  process.exit(1);
}

const normalize = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const normalizeList = (value) =>
  Array.isArray(value) ? value.map((item) => normalize(item)).filter(Boolean) : [];

const evaluateMatch = ({ testCase, normalizedOutput, normalizedExpected }) => {
  const matchType =
    testCase.match === 'exact' ? 'exact' : testCase.match === 'regex' ? 'regex' : 'contains';

  let passed =
    matchType === 'exact'
      ? normalizedOutput === normalizedExpected
      : normalizedOutput.includes(normalizedExpected);

  if (matchType === 'regex') {
    if (typeof testCase.expected_regex === 'string') {
      const pattern = new RegExp(testCase.expected_regex, 'i');
      passed = pattern.test(String(testCase.output_raw ?? ''));
    } else {
      // Warn: match=regex without expected_regex falls back to substring matching
      console.warn(
        `[${testCase.id ?? '?'}] match="regex" but expected_regex is missing — falling back to substring match`,
      );
    }
  }

  const expectedAll = normalizeList(testCase.expected_all);
  if (expectedAll.length > 0) {
    passed = passed && expectedAll.every((needle) => normalizedOutput.includes(needle));
  }

  const expectedAny = normalizeList(testCase.expected_any);
  if (expectedAny.length > 0) {
    passed = passed && expectedAny.some((needle) => normalizedOutput.includes(needle));
  }

  const forbidden = normalizeList(testCase.forbidden_terms);
  if (forbidden.length > 0) {
    passed = passed && forbidden.every((needle) => !normalizedOutput.includes(needle));
  }

  return passed;
};

const normalizeTier = (testCase) => {
  if (typeof testCase.tier === 'string') {
    const tier = testCase.tier.trim().toUpperCase();
    if (tier === 'A' || tier === 'B' || tier === 'C') {
      return tier;
    }
  }

  if (testCase.priority === 'critical') {
    return 'A';
  }

  if (testCase.priority === 'high') {
    return 'B';
  }

  return 'C';
};

const nowIso = new Date().toISOString();

const evalSetRaw = await readFile(evalSetPath, 'utf8');
const evalSet = JSON.parse(evalSetRaw);

if (!Array.isArray(evalSet) || evalSet.length === 0) {
  console.error('Evaluation set is empty or invalid.');
  process.exit(1);
}

const rows = [];

for (const testCase of evalSet) {
  let payload = {};
  let requestError = '';

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ai-translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        text: testCase.input,
        from: testCase.from,
        to: testCase.to,
      }),
    });

    payload = await response.json();
    if (!response.ok) {
      requestError = String(payload?.error ?? `HTTP ${response.status}`);
    }
  } catch (error) {
    requestError = String(error instanceof Error ? error.message : error);
  }

  const output = payload?.translated_text ?? '';
  const expected = testCase.expected ?? '';

  const normalizedOutput = normalize(output);
  const normalizedExpected = normalize(expected);
  const passed =
    requestError.length === 0 &&
    evaluateMatch({
      testCase: {
        ...testCase,
        output_raw: output,
      },
      normalizedOutput,
      normalizedExpected,
    });

  const provider = String(payload?.provider ?? 'unknown');
  const model = String(payload?.model ?? 'unknown');
  const warning = String(payload?.warning ?? '');
  const latencyMs =
    typeof payload?.meta?.latency_ms === 'number' && Number.isFinite(payload.meta.latency_ms)
      ? payload.meta.latency_ms
      : null;
  const telemetryRequired = provider === 'cerebras' || provider === 'sealion';
  const telemetryValid = !telemetryRequired || (model !== 'unknown' && latencyMs !== null);

  rows.push({
    id: testCase.id,
    tier: normalizeTier(testCase),
    priority: testCase.priority ?? 'medium',
    from: testCase.from,
    to: testCase.to,
    input: testCase.input,
    expected,
    output,
    provider,
    model,
    warning,
    latencyMs,
    telemetryRequired,
    telemetryValid,
    requestError,
    passed,
  });
}

const passedCount = rows.filter((row) => row.passed).length;
const failedCount = rows.length - passedCount;

const criticalFailed = rows.filter((row) => row.priority === 'critical' && !row.passed);
const tierAFailed = rows.filter((row) => row.tier === 'A' && !row.passed);
const telemetryFailures = rows.filter((row) => row.telemetryRequired && !row.telemetryValid);
const requestFailures = rows.filter((row) => row.requestError);

const warningCount = rows.filter((row) => row.warning).length;
const fallbackCount = rows.filter((row) =>
  ['fallback', 'glossary-fallback', 'safety-fallback'].includes(String(row.provider)),
).length;

const byProvider = rows.reduce((acc, row) => {
  const provider = String(row.provider || 'unknown');
  acc[provider] = (acc[provider] ?? 0) + 1;
  return acc;
}, {});

const tierSummary = ['A', 'B', 'C'].map((tier) => {
  const tierRows = rows.filter((row) => row.tier === tier);
  const tierPassed = tierRows.filter((row) => row.passed).length;
  return {
    tier,
    total: tierRows.length,
    passed: tierPassed,
    failed: tierRows.length - tierPassed,
  };
});

const avgLatency = (() => {
  const latencies = rows.map((row) => row.latencyMs).filter((value) => typeof value === 'number');
  if (latencies.length === 0) {
    return null;
  }
  return Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length);
})();

const lines = [
  '# Semai Translation Evaluation Report',
  '',
  `Generated: ${nowIso}`,
  '',
  `Total cases: ${rows.length}`,
  `Passed: ${passedCount}`,
  `Failed: ${failedCount}`,
  `Critical failed: ${criticalFailed.length}`,
  `Tier A failed: ${tierAFailed.length}`,
  `Telemetry failures: ${telemetryFailures.length}`,
  `Request failures: ${requestFailures.length}`,
  `Warnings returned: ${warningCount}`,
  `Fallback responses: ${fallbackCount}`,
  avgLatency == null ? 'Average latency (ms): n/a' : `Average latency (ms): ${avgLatency}`,
  '',
  '## Tier Summary',
  '',
  '| Tier | Total | Passed | Failed | Gate |',
  '|---|---:|---:|---:|---|',
  ...tierSummary.map((row) => {
    const gate = row.tier === 'A' ? (row.failed === 0 ? 'PASS' : 'FAIL') : '-';
    return `| ${row.tier} | ${row.total} | ${row.passed} | ${row.failed} | ${gate} |`;
  }),
  '',
  '## Provider Usage',
  '',
  '| Provider | Count |',
  '|---|---:|',
  ...Object.entries(byProvider).map(([provider, count]) => `| ${provider} | ${count} |`),
  '',
  '| ID | Tier | Priority | Pair | Input | Expected | Output | Provider | Model | Telemetry | Warning | Result |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((row) => {
    const pair = `${row.from}->${row.to}`;
    const result = row.passed ? 'PASS' : 'FAIL';
    const escape = (s) => String(s ?? '').replace(/\|/g, '\\|');
    const warning = row.warning ? escape(row.warning) : '';
    const telemetry = row.telemetryRequired ? (row.telemetryValid ? 'OK' : 'MISSING') : '-';
    return `| ${row.id} | ${row.tier} | ${row.priority} | ${pair} | ${escape(row.input)} | ${escape(row.expected)} | ${escape(row.output)} | ${row.provider} | ${row.model} | ${telemetry} | ${warning} | ${result} |`;
  }),
  '',
];

if (criticalFailed.length > 0) {
  lines.push('## Critical Failures');
  lines.push('');
  for (const row of criticalFailed) {
    lines.push(`- ${row.id}: expected "${row.expected}" but got "${row.output}"`);
  }
  lines.push('');
}

if (tierAFailed.length > 0) {
  lines.push('## Tier A Gate Failures');
  lines.push('');
  for (const row of tierAFailed) {
    lines.push(`- ${row.id}: expected "${row.expected}" but got "${row.output}"`);
  }
  lines.push('');
}

if (telemetryFailures.length > 0) {
  lines.push('## Telemetry Failures');
  lines.push('');
  for (const row of telemetryFailures) {
    lines.push(
      `- ${row.id}: provider=${row.provider}, model=${row.model}, latency=${row.latencyMs}`,
    );
  }
  lines.push('');
}

if (requestFailures.length > 0) {
  lines.push('## Request Failures');
  lines.push('');
  for (const row of requestFailures) {
    lines.push(`- ${row.id}: ${row.requestError}`);
  }
  lines.push('');
}

await writeFile(reportPath, `${lines.join('\n')}\n`, 'utf8');

console.log(`Report written to ${reportPath}`);
console.log(
  `Passed ${passedCount}/${rows.length} cases; critical failures: ${criticalFailed.length}; Tier A failures: ${tierAFailed.length}; telemetry failures: ${telemetryFailures.length}; request failures: ${requestFailures.length}`,
);

if (
  criticalFailed.length > 0 ||
  tierAFailed.length > 0 ||
  telemetryFailures.length > 0 ||
  requestFailures.length > 0
) {
  process.exit(2);
}
