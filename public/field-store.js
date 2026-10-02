/* Shared by the offline collection page and the catalog. No catalog or credentials are cached. */
(() => {
  const DB = 'campo-field-v1';
  let running;
  function open() {
    return new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) return reject(new Error('Armazenamento local indisponível.'));
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('queue', { keyPath: 'id' });
        request.result.createObjectStore('context', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Feche outras abas do Campo e tente novamente.'));
    });
  }
  async function run(store, mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const request = action(tx.objectStore(store));
      let value;
      request.onsuccess = () => { value = request.result; };
      tx.oncomplete = () => { db.close(); resolve(value); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error('Não foi possível guardar os dados neste aparelho.')); };
    });
  }
  const changed = () => window.dispatchEvent(new Event('campo-field-change'));
  const list = async () => (await run('queue', 'readonly', store => store.getAll())).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  const put = async record => { await run('queue', 'readwrite', store => store.put(record)); changed(); };
  async function requestJSON(url, options) {
    let response;
    try { response = await fetch(url, { ...options, cache: 'no-store' }); }
    catch { throw Object.assign(new Error('Sem conexão. O registro continua neste aparelho.'), { status: 0 }); }
    let data;
    try { data = await response.json(); }
    catch { throw Object.assign(new Error('Resposta inválida do servidor. Tente novamente.'), { status: response.status >= 500 ? response.status : 503 }); }
    if (!response.ok) throw Object.assign(new Error(response.status === 401 ? 'Entre no catálogo e tente sincronizar novamente.' : data.error || `Falha HTTP ${response.status}.`), { status: response.status });
    return data;
  }
  const json = value => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  async function sendCapture(record) {
    const context = await requestJSON('/api/field/context');
    if ((context.scope || null) !== (record.scope || null)) throw Object.assign(new Error('Esta coleta pertence a outra conta ou organização. Entre no espaço original e tente novamente.'), { status: 409 });
    const scopedJSON = (url, options) => requestJSON(url, { ...options, headers: { ...options?.headers, ...(record.scope ? { 'X-Campo-Scope': record.scope } : {}) } });
    const known = await scopedJSON(`/api/field/observations/${record.id}`);
    if (known.observation) return known;
    const config = await requestJSON('/api/storage');
    const capture = { clientId: record.id, data: record.data, scientificName: record.scientificName || '' };
    if (!config.direct) {
      const form = new FormData(); form.set('data', JSON.stringify(capture));
      for (const photo of record.photos) form.append('photos', new File([photo.blob], photo.name, { type: photo.type }));
      return scopedJSON('/api/field/observations', { method: 'POST', body: form });
    }
    const uploads = [];
    for (const photo of record.photos) {
      const file = new File([photo.blob], photo.name, { type: photo.type });
      const upload = await scopedJSON('/api/uploads', json({ name: file.name, type: file.type, size: file.size, purpose: 'photo' }));
      const body = new FormData(); body.append('cacheControl', '3600'); body.append('', file);
      const response = await fetch(upload.url, { method: 'PUT', body, headers: { 'x-upsert': 'false' } });
      if (!response.ok) throw Object.assign(new Error(`Falha no upload HTTP ${response.status}.`), { status: response.status });
      uploads.push(upload.ticket);
    }
    return scopedJSON('/api/field/observations', json({ capture, uploads }));
  }
  async function work(retryErrors) {
    if (!navigator.onLine) return;
    for (const record of (await list()).reverse()) {
      if (record.status === 'synced' || (record.status === 'error' && !retryErrors)) continue;
      record.status = 'pending'; record.error = ''; await put(record);
      try {
        const result = await sendCapture(record);
        if (!result.observation || result.observation.id !== record.id || !/^CAMPO-\d{6,}$/.test(result.observation.code))
          throw Object.assign(new Error('Recebimento não confirmado pelo servidor.'), { status: 503 });
        await put({ ...record, status: 'synced', syncedAt: new Date().toISOString(), code: result.observation.code, photos: [], error: '' });
      } catch (error) {
        record.status = !error.status || error.status >= 500 ? 'pending' : 'error';
        record.error = error.message || 'Não foi possível sincronizar.'; await put(record);
        if (!error.status || error.status === 401 || error.status >= 500) break;
      }
    }
  }
  async function sync(retryErrors = false) {
    if (running) return running;
    running = (navigator.locks ? navigator.locks.request('campo-field-sync', { ifAvailable: true }, lock => lock ? work(retryErrors) : undefined) : work(retryErrors))
      .finally(() => { running = undefined; });
    return running;
  }
  window.CampoField = {
    list, sync,
    enqueue: async record => {
      const previous = await run('queue', 'readonly', store => store.get(record.id));
      if (previous && previous.status !== 'error') throw new Error('Este registro já está na fila.');
      const context = (await run('context', 'readonly', store => store.get('field')))?.value;
      const scope = previous ? previous.scope || null : context?.scope || null;
      await put({ ...record, scope, status: 'local', error: '', updatedAt: new Date().toISOString() });
    },
    getContext: async () => (await run('context', 'readonly', store => store.get('field')))?.value || null,
    prepare: async () => {
      const value = await requestJSON('/api/field/context');
      if (!Array.isArray(value.projects) || !Array.isArray(value.campaigns) || !Array.isArray(value.samplingSites)) throw new Error('Contexto de campo inválido.');
      await run('context', 'readwrite', store => store.put({ id: 'field', value, savedAt: new Date().toISOString() }));
      return value;
    },
    clearSynced: async () => { for (const record of await list()) if (record.status === 'synced') await run('queue', 'readwrite', store => store.delete(record.id)); changed(); },
  };
})();
