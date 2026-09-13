/**
 * Script de prueba automatizada para Inbox & WhatsApp
 */
const {
  db,
  initializeDatabase,
  upsertConversation,
  getInboxConversations,
  upsertInboxMessage,
  getInboxMessagesByConversation,
  upsertInboxComment,
  getInboxComments,
  getInboxCommentById,
  archiveInboxComment,
  unarchiveInboxComment,
  getInboxCommentsCount,
  markCommentAnswered
} = require('./src/database/db');

const whatsappService = require('./src/services/whatsappService');
const inboxSyncService = require('./src/services/inboxSyncService');

async function runTests() {
  console.log('🧪 Iniciando verificación de Inbox & WhatsApp en MetaPulse...\n');

  // 1. Inicializar BD
  initializeDatabase();
  console.log('✅ Base de datos inicializada');

  // 2. Verificar tablas
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'inbox_%'").all();
  console.log(`✅ Tablas de inbox creadas: ${tables.map(t => t.name).join(', ')}`);
  if (tables.length < 3) {
    throw new Error('Faltan tablas de inbox en SQLite');
  }

  // 3. Probar persistencia de conversación
  const testConvId = 'test_conv_' + Date.now();
  upsertConversation({
    id: testConvId,
    platform: 'instagram',
    participant_id: 'cust_123',
    participant_name: 'Cliente de Prueba',
    participant_username: '@cliente_test',
    last_message_text: 'Hola, tienen stock?',
    last_message_at: new Date().toISOString(),
    unread_count: 1
  });

  const convs = getInboxConversations();
  const foundConv = convs.find(c => c.id === testConvId);
  if (!foundConv) throw new Error('No se pudo recuperar la conversación guardada');
  console.log('✅ Conversación guardada y recuperada correctamente:', foundConv.participant_name);

  // 4. Probar persistencia de mensaje
  const testMsgId = 'test_msg_' + Date.now();
  upsertInboxMessage({
    id: testMsgId,
    conversation_id: testConvId,
    platform: 'instagram',
    sender_id: 'cust_123',
    sender_name: 'Cliente de Prueba',
    sender_type: 'customer',
    message_text: 'Hola, tienen stock?',
    created_at: new Date().toISOString()
  });

  const msgs = getInboxMessagesByConversation(testConvId);
  if (msgs.length === 0) throw new Error('No se encontraron mensajes de la conversación');
  console.log(`✅ Mensajes asociados recuperados: ${msgs.length} mensaje(s)`);

  // 5. Probar persistencia de comentario
  const testCmtId = 'test_cmt_' + Date.now();
  upsertInboxComment({
    id: testCmtId,
    platform: 'instagram',
    post_id: 'post_abc',
    post_caption: 'Lanzamiento de temporada',
    from_id: 'user_xyz',
    from_name: 'ana_maria',
    comment_text: '¿Cuánto cuesta el envío a Algarrobo?',
    created_at: new Date().toISOString()
  });

  let comments = getInboxComments('all');
  const foundCmt = comments.find(c => c.id === testCmtId);
  if (!foundCmt) throw new Error('No se encontró el comentario guardado');
  console.log('✅ Comentario guardado correctamente:', foundCmt.comment_text);

  // 6. Probar responder comentario
  markCommentAnswered(testCmtId, '¡Hola Ana María! El envío es gratis por compras sobre $30.000.');
  comments = getInboxComments('answered');
  const answeredCmt = comments.find(c => c.id === testCmtId);
  if (!answeredCmt || answeredCmt.is_answered !== 1) throw new Error('Fallo al marcar comentario como respondido');
  console.log('✅ Comentario marcado como respondido exitosamente');

  // 7. Probar archivar comentario en la plataforma
  const testArchiveCmtId = 'test_archive_' + Date.now();
  upsertInboxComment({
    id: testArchiveCmtId,
    platform: 'instagram',
    post_id: 'post_arch',
    post_caption: 'Post con comentario que el usuario no desea responder',
    from_id: 'troll_999',
    from_name: 'spam_user',
    comment_text: 'Spam no deseado o consulta que no requiere respuesta',
    created_at: new Date().toISOString()
  });

  // Verificar que aparece en 'unanswered' antes de archivar
  let pendingBefore = getInboxComments('unanswered');
  if (!pendingBefore.some(c => c.id === testArchiveCmtId)) throw new Error('El comentario nuevo debe estar en unanswered');

  // Archivar
  archiveInboxComment(testArchiveCmtId);
  console.log('✅ Comentario archivado en BD exitosamente');

  // Verificar que NO aparece en 'unanswered' ni en 'all'
  let pendingAfter = getInboxComments('unanswered');
  let allAfter = getInboxComments('all');
  if (pendingAfter.some(c => c.id === testArchiveCmtId)) throw new Error('El comentario archivado NO debe aparecer en el queue de unanswered');
  if (allAfter.some(c => c.id === testArchiveCmtId)) throw new Error('El comentario archivado NO debe aparecer en el queue de all');
  console.log('✅ Comentario archivado retirado con éxito de las colas activas (unanswered y all)');

  // Verificar que SÍ aparece en 'archived'
  let archivedList = getInboxComments('archived');
  const foundArchived = archivedList.find(c => c.id === testArchiveCmtId);
  if (!foundArchived || foundArchived.is_archived !== 1) throw new Error('El comentario debe aparecer en el filtro archived');
  console.log('✅ Comentario archivado encontrado en la lista de archivados');

  // Probar que un upsert (simulación de sincronización Meta) no desarchive el comentario
  upsertInboxComment({
    id: testArchiveCmtId,
    platform: 'instagram',
    post_id: 'post_arch',
    from_id: 'troll_999',
    from_name: 'spam_user',
    comment_text: 'Spam no deseado o consulta que no requiere respuesta',
    created_at: new Date().toISOString()
  });
  const afterSync = getInboxCommentById(testArchiveCmtId);
  if (afterSync.is_archived !== 1) throw new Error('La sincronización de Meta no debe desarchivar un comentario archivado');
  console.log('✅ Estado archivado protegido contra sobreescritura en sincronizaciones');

  // Desarchivar
  unarchiveInboxComment(testArchiveCmtId);
  let pendingRestored = getInboxComments('unanswered');
  if (!pendingRestored.some(c => c.id === testArchiveCmtId)) throw new Error('El comentario desarchivado debe volver a unanswered');
  console.log('✅ Comentario desarchivado y restaurado en queue activo exitosamente');

  // 8. Probar normalización de teléfono en WhatsAppService
  const cleanPhone = whatsappService.normalizePhone('+56 9 8765 4321');
  console.log(`✅ Normalización de teléfono WhatsApp: "+56 9 8765 4321" -> "${cleanPhone}"`);
  if (cleanPhone !== '+56987654321') throw new Error(`Teléfono no normalizado como se esperaba: ${cleanPhone}`);

  // 8. Probar sincronización básica de inboxSyncService (en modo simulación)
  console.log('🔄 Ejecutando ciclo de syncAll()...');
  const syncResult = await inboxSyncService.syncAll();
  console.log('✅ Sincronización completada:', JSON.stringify(syncResult.stats));

  console.log('\n🎉 ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE!');
}

runTests().catch(err => {
  console.error('\n❌ ERROR EN LAS PRUEBAS:', err);
  process.exit(1);
});
