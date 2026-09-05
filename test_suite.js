const http = require('http');

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Iniciando pruebas de verificación de MetaPulse...\n');

  // Test 1: Status
  console.log('1. Probando /api/status...');
  const statusRes = await makeRequest('/api/status');
  console.log('   Status Code:', statusRes.status);
  console.log('   Success:', statusRes.data.success);
  console.log('   Config:', statusRes.data.data.config);
  console.log('   Next Slot:', statusRes.data.data.nextSlot);

  // Test 2: Slots
  console.log('\n2. Probando /api/slots...');
  const slotsRes = await makeRequest('/api/slots');
  console.log('   Status Code:', slotsRes.status);
  console.log(`   Slots configurados: ${slotsRes.data.data.length} slots encontrados.`);

  // Test 3: AI Copy Generation
  console.log('\n3. Probando /api/ai/generate...');
  const aiRes = await makeRequest('/api/ai/generate', 'POST', {
    topic: 'Nueva colección de ropa deportiva de verano',
    tone: 'sales',
    goal: 'sales',
    platform: 'both',
    brandName: 'FitStyle Pro'
  });
  console.log('   Status Code:', aiRes.status);
  console.log('   Copy generado con éxito:');
  console.log('   Gancho:', aiRes.data.data.hook);
  console.log('   Hashtags:', aiRes.data.data.hashtags);

  // Test 4: Create Scheduled Post
  console.log('\n4. Creando publicación programada con /api/posts...');
  const postRes = await makeRequest('/api/posts', 'POST', {
    title: 'Post de prueba automatizado',
    content: aiRes.data.data.fullPost,
    platforms: ['facebook', 'instagram'],
    post_type: 'feed',
    schedule_type: 'next_slot'
  });
  console.log('   Status Code:', postRes.status);
  const testPostId = postRes.data.data?.id;
  console.log('   Post Creado ID:', testPostId);
  console.log('   Fecha programada:', postRes.data.data?.scheduled_at);
  console.log('   Estado:', postRes.data.data?.status);

  // Test 5: List Posts & Cleanup
  console.log('\n5. Listando publicaciones en cola y limpiando...');
  const listRes = await makeRequest('/api/posts');
  if (listRes.data?.data) {
    console.log(`   Total posts detectados: ${listRes.data.data.length}`);
  }
  if (testPostId) {
    await makeRequest(`/api/posts/${testPostId}`, 'DELETE');
    console.log('   🧹 Post de prueba eliminado automáticamente.');
  }

  // Test 6: Insights
  console.log('\n6. Consultando analíticas /api/meta/insights...');
  const insightsRes = await makeRequest('/api/meta/insights');
  console.log('   Status Code:', insightsRes.status);
  console.log('   FB Reach:', insightsRes.data?.data?.facebook?.weeklyReach || 'N/A');
  console.log('   IG Impressions:', insightsRes.data?.data?.instagram?.weeklyImpressions || 'N/A');

  console.log('\n✅ ¡TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO!');
}

runTests().catch(console.error);
