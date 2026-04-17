/* ─────────────────────────────────────────────
   DataSnap AI  –  app.js
   Uses Gemini 2.5 Flash (gemini-2.5-flash)
   via the Gemini REST API (no SDK needed).
───────────────────────────────────────────── */

// ── DOM refs ──────────────────────────────────
const apiKeyInput = document.getElementById('api-key-input');
const toggleKeyBtn = document.getElementById('toggle-key-btn');
const saveKeyBtn = document.getElementById('save-key-btn');

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const filePreview = document.getElementById('file-preview');
const previewIcon = document.getElementById('preview-icon');
const previewName = document.getElementById('preview-name');
const previewSize = document.getElementById('preview-size');
const previewImg = document.getElementById('preview-img');
const clearFileBtn = document.getElementById('clear-file-btn');

const extractBtn = document.getElementById('extract-btn');
const extractBtnText = document.getElementById('extract-btn-text');

const statusBanner = document.getElementById('status-banner');
const statusIcon = document.getElementById('status-icon');
const statusMsg = document.getElementById('status-msg');
const statusClose = document.getElementById('status-close');

const loadingOverlay = document.getElementById('loading-overlay');

const resultsSection = document.getElementById('results-section');
const tableWrapper = document.getElementById('table-wrapper');
const rawOutput = document.getElementById('raw-output');
const copyBtn = document.getElementById('copy-btn');
const downloadBtn = document.getElementById('download-btn');

// ── State ─────────────────────────────────────
let selectedFile = null;
let lastRawText = '';
let lastRows = [];

// ── API Key persistence ────────────────────────
const LS_KEY = 'datasnap_gemini_key';
const LS_MOD_KEY = 'datasnap_gemini_model';
const modelSelect = document.getElementById('model-select');

(function initConfig() {
  const savedKey = localStorage.getItem(LS_KEY);
  if (savedKey) apiKeyInput.value = savedKey;
  
  const savedModel = localStorage.getItem(LS_MOD_KEY);
  if (savedModel && modelSelect) modelSelect.value = savedModel;
})();

toggleKeyBtn.addEventListener('click', () => {
  apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
  toggleKeyBtn.textContent = apiKeyInput.type === 'password' ? '👁' : '🙈';
});

saveKeyBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) { showStatus('error', '⚠️', 'Ingresa una API key válida.'); return; }
  localStorage.setItem(LS_KEY, key);
  localStorage.setItem(LS_MOD_KEY, modelSelect.value);
  showStatus('success', '✅', 'Configuración guardada en este navegador.');
});

// ── File selection ─────────────────────────────
fileInput.addEventListener('change', e => handleFile(e.target.files[0]));

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFile(e.dataTransfer.files[0]);
});

clearFileBtn.addEventListener('click', () => resetFile());

function handleFile(file) {
  if (!file) return;
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  if (!allowed.includes(file.type)) {
    showStatus('error', '❌', 'Formato no soportado. Usa JPG, PNG, WEBP o PDF.');
    return;
  }
  selectedFile = file;
  previewName.textContent = file.name;
  previewSize.textContent = formatSize(file.size);
  previewIcon.textContent = file.type === 'application/pdf' ? '📑' : '🖼️';

  if (file.type.startsWith('image/')) {
    const url = URL.createObjectURL(file);
    previewImg.src = url;
    previewImg.classList.remove('hidden');
  } else {
    previewImg.classList.add('hidden');
  }

  filePreview.classList.remove('hidden');
  extractBtn.disabled = false;
  hideStatus();
}

function resetFile() {
  selectedFile = null;
  fileInput.value = '';
  filePreview.classList.add('hidden');
  previewImg.src = '';
  extractBtn.disabled = true;
  resultsSection.classList.add('hidden');
  loadingOverlay.classList.add('hidden');
  hideStatus();
}

// ── Extraction ────────────────────────────────
extractBtn.addEventListener('click', runExtraction);

async function runExtraction() {
  const apiKey = (apiKeyInput.value.trim()) || localStorage.getItem(LS_KEY) || '';
  if (!apiKey) { showStatus('error', '🔑', 'Guarda tu API key primero.'); return; }
  if (!selectedFile) { showStatus('error', '📁', 'Selecciona un archivo primero.'); return; }

  // UI: loading state
  extractBtn.disabled = true;
  extractBtnText.textContent = 'Analizando…';
  loadingOverlay.classList.remove('hidden');
  resultsSection.classList.add('hidden');
  hideStatus();

  try {
    const base64 = await fileToBase64(selectedFile);
    const mimeType = selectedFile.type;
    const rawText = await callGemini(apiKey, base64, mimeType);

    lastRawText = rawText;
    lastRows = parseTabSeparated(rawText);

    renderTable(lastRows);
    rawOutput.textContent = rawText;
    resultsSection.classList.remove('hidden');
    showStatus('success', '✅', `Extracción completada – ${lastRows.length} filas encontradas.`);
  } catch (err) {
    console.error(err);
    // Extraemos si es un error de quota
    let msg = err.message || 'Error al procesar el documento.';
    if (msg.includes('429') || msg.includes('Quota') || msg.includes('Too Many Requests')) {
      msg = 'El modelo seleccionado está saturado o llegaste al límite. Por favor, selecciona otro modelo en la Configuración o espera un minuto.';
    }
    showStatus('error', '❌', msg);
  } finally {
    loadingOverlay.classList.add('hidden');
    extractBtn.disabled = false;
    extractBtnText.textContent = 'Extraer Datos';
  }
}

// ── Gemini API call ────────────────────────────
const SYSTEM_PROMPT = `Eres un asistente especializado en extraer datos de documentos (imágenes o PDFs) y convertirlos a formato compatible con Excel para copiar y pegar.

REGLAS ABSOLUTAS:

1. EXTRACCIÓN COMPLETA:
   - Extrae TODO el texto visible en el documento
   - Mantén el orden exacto de arriba a abajo, izquierda a derecha
   - No omitas nada: títulos, encabezados, datos, totales, notas, fechas, nombres, etc.

2. NÚMEROS LIMPIOS PARA EXCEL:
   - Elimina TODOS los símbolos de moneda: $, USD$, COP$, €, £, etc.
   - Elimina separadores de miles (comas): 1,234.56 → 1234.56
   - Deja solo números con punto decimal: 0.38 | 2651.02 | 9378990.64
   - Esto permite que Excel reconozca los valores como números y pueda calcular

3. SEPARACIÓN DE COLUMNAS:
   - Identifica visualmente las columnas en el documento
   - Separa cada columna con TAB (tabulación)
   - Mantén coherencia: si una fila tiene 5 columnas, todas deben tener 5 columnas

4. FORMATO DE SALIDA:
   - Presenta TODO dentro de un bloque de código markdown (\`\`\`)
   - El usuario copiará el bloque completo y lo pegará en Excel

5. SIN INTERPRETACIÓN:
   - No reorganices la información
   - No agregues columnas que no existan
   - No elimines información
   - No cambies el orden
   - Solo transcribe lo que ves, adaptado para Excel

Cuando recibas un documento, simplemente extrae TODO su contenido siguiendo estas reglas y preséntalo en un bloque de código listo para copiar y pegar en Excel.`;

async function callGemini(apiKey, base64Data, mimeType) {
  // For PDFs, Gemini needs the file uploaded via the File API.
  // For images we can inline the base64 directly.
  let parts;

  if (mimeType === 'application/pdf') {
    parts = await uploadAndBuildPdfPart(apiKey, base64Data, selectedFile);
  } else {
    parts = [
      { text: SYSTEM_PROMPT + '\n\nAnaliza el documento adjunto y extrae todos sus datos.' },
      { inlineData: { mimeType, data: base64Data } }
    ];
  }

  const selectedModel = document.getElementById('model-select').value || 'gemini-flash-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `Error ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) throw new Error('La IA no devolvió contenido. Intenta de nuevo.');
  return text;
}

// Upload PDF using Gemini Files API, then build the parts array
async function uploadAndBuildPdfPart(apiKey, base64Data, file) {
  // Convert base64 → Blob → upload
  const byteArr = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  const blob = new Blob([byteArr], { type: 'application/pdf' });

  // Step 1: initiate resumable upload
  const startRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': blob.size,
        'X-Goog-Upload-Header-Content-Type': 'application/pdf',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ file: { display_name: file.name } })
    }
  );
  if (!startRes.ok) throw new Error(`Error iniciando upload: ${startRes.status}`);
  const uploadUrl = startRes.headers.get('X-Goog-Upload-URL');
  if (!uploadUrl) throw new Error('No se recibió URL de upload.');

  // Step 2: upload the bytes
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': blob.size,
      'X-Goog-Upload-Offset': 0,
      'X-Goog-Upload-Command': 'upload, finalize'
    },
    body: blob
  });
  if (!uploadRes.ok) throw new Error(`Error subiendo PDF: ${uploadRes.status}`);
  const fileData = await uploadRes.json();
  const fileUri = fileData?.file?.uri;
  if (!fileUri) throw new Error('No se obtuvo URI del archivo subido.');

  // Wait for processing (active state)
  await waitForFileActive(apiKey, fileData?.file?.name);

  return [
    { text: SYSTEM_PROMPT + '\n\nAnaliza el documento adjunto y extrae todos sus datos.' },
    { fileData: { mimeType: 'application/pdf', fileUri } }
  ];
}

async function waitForFileActive(apiKey, fileName) {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`
    );
    const data = await res.json();
    if (data?.state === 'ACTIVE') return;
    if (data?.state === 'FAILED') throw new Error('El PDF no pudo procesarse en Gemini.');
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Tiempo de espera agotado procesando el PDF.');
}

// ── Parse tab-separated text ──────────────────
function parseTabSeparated(raw) {
  // Strip markdown code fences
  const cleaned = raw.replace(/^```[^\n]*\n?/m, '').replace(/```\s*$/m, '').trim();
  const lines = cleaned.split('\n');
  return lines
    .filter(l => l.trim() !== '')
    .map(l => l.split('\t'));
}

// ── Render table ──────────────────────────────
function renderTable(rows) {
  if (!rows.length) {
    tableWrapper.innerHTML = '<p style="color:var(--text-muted);padding:16px">Sin datos para mostrar.</p>';
    return;
  }
  const maxCols = Math.max(...rows.map(r => r.length));
  const [header, ...body] = rows;

  let html = '<table class="data-table"><thead><tr>';
  for (let c = 0; c < maxCols; c++) {
    html += `<th>${escHtml(header[c] ?? '')}</th>`;
  }
  html += '</tr></thead><tbody>';
  for (const row of body) {
    html += '<tr>';
    for (let c = 0; c < maxCols; c++) {
      html += `<td>${escHtml(row[c] ?? '')}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  tableWrapper.innerHTML = html;
}

// ── Copy ──────────────────────────────────────
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(lastRawText);
    copyBtn.textContent = '✅ Copiado';
    setTimeout(() => { copyBtn.textContent = '📋 Copiar'; }, 2000);
  } catch {
    showStatus('error', '❌', 'No se pudo copiar al portapapeles.');
  }
});

// ── Download Excel ────────────────────────────
downloadBtn.addEventListener('click', () => {
  if (!lastRows.length) return;
  try {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(lastRows);
    XLSX.utils.book_append_sheet(wb, ws, 'DataSnap');
    const fileName = (selectedFile?.name?.replace(/\.[^.]+$/, '') || 'datasnap') + '_extraido.xlsx';
    
    // Generar como array y forzar tipo Blob para asegurar que descarga con extensión
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    // Limpiar
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showStatus('success', '⬇️', `Archivo ${fileName} descargado.`);
  } catch (e) {
    showStatus('error', '❌', 'Error al generar el Excel: ' + e.message);
  }
});

// ── Status banner helpers ─────────────────────
function showStatus(type, icon, msg) {
  statusBanner.className = `status-banner ${type}`;
  statusIcon.textContent = icon;
  statusMsg.textContent = msg;
  statusBanner.classList.remove('hidden');
}
function hideStatus() { statusBanner.classList.add('hidden'); }
statusClose.addEventListener('click', hideStatus);

// ── Utilities ─────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
