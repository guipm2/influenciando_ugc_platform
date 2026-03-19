
// Benchmark for Opportunity Images Reordering
// Comparison between N+1 Updates vs Batch Upsert

const runBenchmark = async () => {
  console.log('⚡ Starting Benchmark: Image Reordering Optimization\n');

  const IMAGES_COUNT = 50; // Simulate 50 images to make the difference obvious

  // Create dummy images
  const images = Array.from({ length: IMAGES_COUNT }, (_, i) => ({
    id: `img-${i}`,
    opportunity_id: 'opp-1',
    display_order: i, // Initially ordered
    image_url: `http://example.com/img-${i}.jpg`
  }));

  // Shuffle images to simulate reordering
  const reorderedImages = [...images].sort(() => Math.random() - 0.5);

  // Mock Supabase Client
  const createMockSupabase = () => {
    let callCount = 0;

    return {
      from: (table) => {
        return {
          update: (data) => {
            callCount++;
            return Promise.resolve({ data: null, error: null });
          },
          upsert: (data) => {
            callCount++;
            return Promise.resolve({ data: null, error: null });
          }
        };
      },
      getCallCount: () => callCount
    };
  };

  // --- Scenario 1: Unoptimized (N+1 Updates) ---
  console.log('Running Scenario 1: Unoptimized (N+1 Updates)...');
  const mockSupabaseUnopt = createMockSupabase();
  const startTimeUnopt = performance.now();

  const updatesUnopt = reorderedImages.map((img, index) =>
    mockSupabaseUnopt
      .from('opportunity_images')
      .update({ display_order: index })
  );
  await Promise.all(updatesUnopt);

  const endTimeUnopt = performance.now();
  const callsUnopt = mockSupabaseUnopt.getCallCount();
  console.log(`- Calls made: ${callsUnopt}`);
  console.log(`- Estimated Time (simulation): ${(endTimeUnopt - startTimeUnopt).toFixed(2)}ms (client-side only)`);

  // In a real network scenario, 50 calls with e.g. 50ms latency each:
  // Parallel requests might be faster than serial, but browser connection limits (usually 6) would throttle it.
  // Estimated network overhead: Max(50ms) + queuing.
  // We can't easily measure network time here, but call count is the key metric.

  console.log('\n');

  // --- Scenario 2: Optimized (Batch Upsert) ---
  console.log('Running Scenario 2: Optimized (Batch Upsert)...');
  const mockSupabaseOpt = createMockSupabase();
  const startTimeOpt = performance.now();

  const updatesOpt = reorderedImages.map((img, index) => ({
    id: img.id,
    opportunity_id: img.opportunity_id,
    display_order: index,
  }));

  await mockSupabaseOpt
    .from('opportunity_images')
    .upsert(updatesOpt);

  const endTimeOpt = performance.now();
  const callsOpt = mockSupabaseOpt.getCallCount();
  console.log(`- Calls made: ${callsOpt}`);
  console.log(`- Estimated Time (simulation): ${(endTimeOpt - startTimeOpt).toFixed(2)}ms (client-side only)`);

  console.log('\n--------------------------------------------------');
  console.log(`RESULTS:`);
  console.log(`Unoptimized Calls: ${callsUnopt}`);
  console.log(`Optimized Calls:   ${callsOpt}`);
  console.log(`Reduction:         ${((callsUnopt - callsOpt) / callsUnopt * 100).toFixed(0)}% fewer database calls`);
  console.log('--------------------------------------------------\n');
};

runBenchmark().catch(console.error);
