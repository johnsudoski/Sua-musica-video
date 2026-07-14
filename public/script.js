/* ═══════════════════════════════════════════════
   Vídeo Homenagem — Frontend Logic
═══════════════════════════════════════════════ */

// ─── Pré-preenche campos vindos do redirect da página principal ───
(function prefillFromQuery() {
  var params = new URLSearchParams(window.location.search);
  var map = {
    nome:    'nomeDestinatario',
    relacao: 'relacao',
    memoria: 'memoria',
    email:   'emailEntrega',
  };
  Object.keys(map).forEach(function(key) {
    var value = params.get(key);
    var el = document.getElementById(map[key]);
    if (value && el) el.value = value;
  });

  var genero = params.get('genero');
  if (genero) {
    var gEl = document.querySelector('input[name="genero"][value="' + genero + '"]');
    if (gEl) gEl.checked = true;
  }
  var voz = params.get('voz');
  if (voz) {
    var vEl = document.querySelector('input[name="voz"][value="' + voz + '"]');
    if (vEl) vEl.checked = true;
  }
})();

// ─── Lista de arquivos selecionados ───
var filesInput = document.getElementById('files');
var fileList   = document.getElementById('fileList');
if (filesInput) {
  filesInput.addEventListener('change', function() {
    var names = Array.prototype.map.call(filesInput.files, function(f) { return f.name; });
    fileList.textContent = names.length ? ('Selecionados: ' + names.join(', ')) : '';
  });
}

// ─── Submit ───
var form       = document.getElementById('videoForm');
var submitBtn  = document.getElementById('submitBtn');
var loadingSec = document.getElementById('loadingSection');
var errorMsg   = document.getElementById('errorMsg');

if (form) {
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    errorMsg.classList.add('hidden');

    if (!filesInput.files || filesInput.files.length === 0) {
      errorMsg.textContent = 'Envie pelo menos uma foto ou vídeo.';
      errorMsg.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';
    loadingSec.classList.remove('hidden');

    var formData = new FormData();
    formData.append('nome',    document.getElementById('nomeDestinatario').value.trim());
    formData.append('relacao', document.getElementById('relacao').value);
    formData.append('memoria', document.getElementById('memoria').value.trim());
    var gEl = document.querySelector('input[name="genero"]:checked');
    formData.append('genero', gEl ? gEl.value : '');
    var vEl = document.querySelector('input[name="voz"]:checked');
    formData.append('voz', vEl ? vEl.value : 'feminino');
    formData.append('brief', document.getElementById('brief').value.trim());
    formData.append('email', document.getElementById('emailEntrega').value.trim());
    Array.prototype.forEach.call(filesInput.files, function(f) {
      formData.append('files', f);
    });

    fetch('/api/request', { method: 'POST', body: formData })
      .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, data: data }; }); })
      .then(function(result) {
        if (!result.ok || !result.data.success) {
          throw new Error(result.data.error || 'Erro ao enviar seu pedido.');
        }
        window.location.href = result.data.checkoutUrl;
      })
      .catch(function(err) {
        loadingSec.classList.add('hidden');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Continuar para o pagamento →';
        errorMsg.textContent = err.message || 'Erro inesperado. Tente novamente.';
        errorMsg.classList.remove('hidden');
      });
  });
}
