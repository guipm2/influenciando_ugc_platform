
const DELAY_MS = 50; // Simulated network latency per request

// Mock Supabase Client
const createMockSupabase = () => {
  let requestCount = 0;

  const delay = () => new Promise(resolve => setTimeout(resolve, DELAY_MS));

  const storage = {
    from: (bucket) => ({
      upload: async (path, file, options) => {
        requestCount++;
        await delay();
        return { data: { path }, error: null };
      },
      createSignedUrl: async (path, expiresIn) => {
        requestCount++;
        await delay();
        return { data: { signedUrl: `https://mock.com/${path}?token=xyz` }, error: null };
      },
      createSignedUrls: async (paths, expiresIn) => {
        requestCount++;
        await delay();
        const data = paths.map(path => ({
          path,
          signedUrl: `https://mock.com/${path}?token=xyz`,
          error: null
        }));
        return { data, error: null };
      },
      remove: async (paths) => {
        requestCount++;
        await delay();
        return { data: {}, error: null };
      }
    })
  };

  const db = {
    from: (table) => ({
      insert: (data) => ({
        select: async () => {
          requestCount++;
          await delay();
          const inserted = Array.isArray(data) ? data : [data];
          return { data: inserted, error: null };
        }
      })
    })
  };

  return {
    storage: storage,
    from: db.from,
    getRequestCount: () => requestCount,
    resetRequestCount: () => { requestCount = 0; }
  };
};

const supabase = createMockSupabase();

async function runCurrentImplementation(files, oppId) {
  console.log('--- Running Current Implementation ---');
  supabase.resetRequestCount();
  const start = performance.now();

  const currentCount = 0;

  // Upload paralelo de todas as imagens
  const uploadPromises = files.map(async (file, index) => {
    try {
      // Create thumbnail (simulated by delay?) No need to simulate CPU bound task for request count.

      const fileName = `${oppId}/${Date.now()}-${index}.webp`;

      // Upload para Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('opportunity-images')
        .upload(fileName, file, {
          contentType: 'image/webp',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: signedUrlData } = await supabase.storage
        .from('opportunity-images')
        .createSignedUrl(fileName, 31536000);

      const publicUrl = signedUrlData?.signedUrl || '';
      const nextOrder = currentCount + index;

      return {
        fileName,
        data: {
          opportunity_id: oppId,
          image_url: publicUrl,
          display_order: nextOrder
        }
      };
    } catch (err) {
      console.error(err);
      return null;
    }
  });

  const results = await Promise.all(uploadPromises);
  const validResults = results.filter(r => r !== null);

  // Inserção em lote
  const { data: dbData } = await supabase
    .from('opportunity_images')
    .insert(validResults.map(r => r.data))
    .select();

  const end = performance.now();
  console.log(`Time: ${(end - start).toFixed(2)}ms`);
  console.log(`Requests: ${supabase.getRequestCount()}`);
  return { time: end - start, requests: supabase.getRequestCount() };
}

async function runOptimizedImplementation(files, oppId) {
  console.log('--- Running Optimized Implementation ---');
  supabase.resetRequestCount();
  const start = performance.now();

  const currentCount = 0;

  // Upload paralelo
  const uploadPromises = files.map(async (file, index) => {
    try {
      const fileName = `${oppId}/${Date.now()}-${index}.webp`;

      const { error: uploadError } = await supabase.storage
        .from('opportunity-images')
        .upload(fileName, file, {
          contentType: 'image/webp',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      return {
        fileName,
        originalIndex: index,
        display_order: currentCount + index
      };
    } catch (err) {
      console.error(err);
      return null;
    }
  });

  const results = await Promise.all(uploadPromises);
  const validUploads = results.filter(r => r !== null);

  if (validUploads.length === 0) {
      throw new Error('Falha no upload de todas as imagens');
  }

  // Batch Sign
  const fileNames = validUploads.map(r => r.fileName);
  const { data: signedUrlsData, error: signError } = await supabase.storage
    .from('opportunity-images')
    .createSignedUrls(fileNames, 31536000);

  if (signError) throw signError;

  // Map URLs back
  const insertData = validUploads.map(upload => {
    const signedUrlObj = signedUrlsData.find(s => s.path === upload.fileName);
    // Note: createSignedUrls usually returns array in order of input paths, but explicitly matching by path is safer if API guarantees are loose.
    // However, the mock returns based on input.

    if (!signedUrlObj || signedUrlObj.error) return null;

    return {
      opportunity_id: oppId,
      image_url: signedUrlObj.signedUrl,
      display_order: upload.display_order
    };
  }).filter(r => r !== null);

  // Inserção em lote
  const { data: dbData } = await supabase
    .from('opportunity_images')
    .insert(insertData)
    .select();

  const end = performance.now();
  console.log(`Time: ${(end - start).toFixed(2)}ms`);
  console.log(`Requests: ${supabase.getRequestCount()}`);
  return { time: end - start, requests: supabase.getRequestCount() };
}

async function main() {
  const files = Array(10).fill('dummy_content');
  const oppId = 'opp_123';

  await runCurrentImplementation(files, oppId);
  console.log('\n');
  await runOptimizedImplementation(files, oppId);
}

main();
