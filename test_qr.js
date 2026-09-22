// Test script for QR attendance logic (node)
function esc(str){ if(str==null) return ''; return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function buildAsistenciaQRPayload(){
  const cursoId = '101';
  const curso = { nombre: 'Matemáticas' };
  const timestamp = Date.now();
  const token = `${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
  return `AULA_DIGITAL_PRO|asistencia|cursoId=${cursoId}|curso=${encodeURIComponent(curso.nombre)}|ts=${timestamp}|token=${token}`;
}
function parseAsistenciaQRPayload(rawValue){
  if(typeof rawValue !== 'string') return null;
  const value = rawValue.trim();
  if(!value || !value.startsWith('AULA_DIGITAL_PRO|asistencia|')) return null;
  const parts = value.split('|');
  if(parts.length < 6) return null;
  const cursoId = Number(parts[2].replace('cursoId=','')) || 0;
  const curso = decodeURIComponent(parts[3].replace('curso=',''));
  const ts = Number(parts[4].replace('ts=','')) || 0;
  const token = parts[5].replace('token=','');
  if(!cursoId || !ts || !token) return null;
  return { type:'asistencia', cursoId, curso, ts, token };
}

// Simulated data stores
const CURSOS = [{ id:101, nombre:'Matemáticas' }];
const ALUMNOS_POR_CURSO = {
  '101': [ { id: 11, nombre: 'Ana', apellido: 'García', dni: '12345678' } ]
};
let USERS = { alumno: null };
let ASISTENCIAS = [];

function registrarAsistenciaDesdeQR(payload){
  const parsed = parseAsistenciaQRPayload(payload);
  if(!parsed){ console.log('RESULT: invalid payload'); return false; }
  const now = Date.now();
  const ttl = 5 * 60 * 1000;
  if(now - parsed.ts > ttl){ console.log('RESULT: qr expired'); return false; }
  // Simulate persisted alumno
  if(!USERS.alumno){ USERS.alumno = ALUMNOS_POR_CURSO[parsed.cursoId] && ALUMNOS_POR_CURSO[parsed.cursoId][0]; console.log('Simulated auto-login as alumno:', USERS.alumno); }
  const alumno = USERS.alumno;
  if(!alumno){ console.log('RESULT: no alumno session'); return false; }
  const cursoId = Number(parsed.cursoId);
  const alumnosDelCurso = ALUMNOS_POR_CURSO[cursoId] || [];
  const existe = alumnosDelCurso.some(a=>Number(a.id)===Number(alumno.id));
  if(!existe){ console.log('RESULT: QR not for this student'); return false; }
  const yaRegistrado = ASISTENCIAS.some(item => item?.qrToken === parsed.token || (Number(item?.alumnoId)===Number(alumno.id) && Number(item?.cursoId)===Number(cursoId) && item?.fecha && (Date.now() - new Date(item.fecha).getTime() < ttl)));
  if(yaRegistrado){ console.log('RESULT: already registered'); return true; }
  ASISTENCIAS.push({ fecha: new Date().toISOString(), cursoId, cursoNombre: parsed.curso, alumnoId: alumno.id, alumnoNombre: alumno.nombre, alumnoApellido: alumno.apellido, presente:true, qrToken: parsed.token, source:'qr' });
  console.log(`Bienvenida a clases, ${esc(alumno.nombre)} ${esc(alumno.apellido)}. Asistencia registrada en ${parsed.curso}.`);
  return true;
}

// Run test
const payload = buildAsistenciaQRPayload();
console.log('Generated payload:', payload);
console.log('Encoded for URL:', encodeURIComponent(payload));
const ok = registrarAsistenciaDesdeQR(payload);
console.log('Registration ok:', ok);
console.log('ASISTENCIAS:', ASISTENCIAS);
