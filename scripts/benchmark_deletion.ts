
async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function mockDelete() {
  await delay(100); // Simulate 100ms network latency
  return { error: null };
}

async function serialExecution() {
  const start = performance.now();
  await mockDelete(); // opportunities
  await mockDelete(); // conversations
  await mockDelete(); // messages
  await mockDelete(); // notifications
  await mockDelete(); // analysts (for analyst settings)
  const end = performance.now();
  return end - start;
}

async function parallelExecution() {
  const start = performance.now();
  await Promise.all([
    mockDelete(),
    mockDelete(),
    mockDelete(),
    mockDelete(),
    mockDelete()
  ]);
  const end = performance.now();
  return end - start;
}

async function runBenchmark() {
  console.log('Running Deletion Performance Benchmark (Simulated)...');

  const serialTime = await serialExecution();
  console.log(`Serial Execution Time: ${serialTime.toFixed(2)}ms`);

  const parallelTime = await parallelExecution();
  console.log(`Parallel Execution Time: ${parallelTime.toFixed(2)}ms`);

  const improvement = ((serialTime - parallelTime) / serialTime) * 100;
  console.log(`Performance Improvement: ${improvement.toFixed(2)}%`);
}

runBenchmark();
