// cli/test/smoke.ts
let passed = 0;
let failed = 0;

async function expect(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: any) {
    console.error(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// --- Tests ---

await expect("index loads", async () => {
  const { loadIndex } = await import("../src/index-loader.js");
  const idx = loadIndex();
  assert(idx.meta.total_positions > 0, "expected positions in index");
  assert(idx.positions.length > 0, "expected position array");
});

await expect("index has expected fields", async () => {
  const { loadIndex } = await import("../src/index-loader.js");
  const idx = loadIndex();
  const p = idx.positions[0];
  assert(typeof p.id === "string", "id should be string");
  assert(typeof p.year === "number", "year should be number");
  assert(typeof p.dept_name === "string", "dept_name should be string");
  assert(typeof p.position_name === "string", "position_name should be string");
});

await expect("filter by major includes 不限", async () => {
  const { loadIndex, filterPositions } = await import("../src/index-loader.js");
  const idx = loadIndex();
  const results = filterPositions(idx.positions, { major: "计算机" });
  assert(results.length > 0, "should find positions matching 计算机 or 不限");
});

// --- Summary ---
console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;
