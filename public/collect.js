(() => {
  const store = window.CampoField;
  const form = document.getElementById('capture-form');
  const status = document.getElementById('status');
  const contextStatus = document.getElementById('context-status');
  const gpsStatus = document.getElementById('gps-status');
  const fields = form.elements;
  const params = new URLSearchParams(location.search);
  let context = { projects: [], campaigns: [], samplingSites: [] };
  let files = [], urls = [], editing, gpsSequence = 0, initialSelection = true;
  const element = (tag, text) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
  const option = (value, label) => { const node = element('option', label); node.value = value; return node; };
  const message = (text, error = false) => { status.textContent = text; status.className = error ? 'error' : ''; };
  const definitions = () => context.projects.find(p => p.id === fields.projectId.value)?.fieldDefinitions || [];
  function projectOptions() {
    const selected = editing ? editing.data.projectId || '' : fields.projectId.value || (initialSelection ? params.get('project') : '') || '';
    fields.projectId.replaceChildren(option('', 'Pessoal · sem projeto'), ...context.projects.map(p => option(p.id, p.name)));
    if (selected && !context.projects.some(p => p.id === selected)) fields.projectId.append(option(selected, 'Projeto indisponível · atualize ou escolha outro'));
    fields.projectId.value = selected;
    campaignOptions(editing ? editing.data.campaignId || '' : fields.campaignId.value || (initialSelection ? params.get('campaign') : '') || '');
    siteOptions(editing ? editing.data.samplingSiteId : fields.samplingSiteId.value);
    customFields(editing?.data.customValues || {});
  }
  function campaignOptions(selected = '') {
    const choices = context.campaigns.filter(c => c.projectId === fields.projectId.value);
    fields.campaignId.replaceChildren(option('', 'Sem campanha'), ...choices.map(c => option(c.id,c.name)));
    fields.campaignId.value = selected || ''; fields.campaignId.disabled = !fields.projectId.value;
  }
  function siteOptions(selected = '') {
    const choices = context.samplingSites.filter(s => s.projectId === fields.projectId.value && (!s.archived || s.id === selected));
    fields.samplingSiteId.replaceChildren(option('', 'Sem ponto / parcela'), ...choices.map(s => option(s.id,s.name)));
    fields.samplingSiteId.value = selected || ''; fields.samplingSiteId.disabled = !fields.projectId.value;
  }
  function customFields(values) {
    const container = document.getElementById('custom-fields'); container.replaceChildren();
    for (const field of definitions().filter(f => !f.archived)) {
      const label = element('label', `${field.label}${field.unit ? ` (${field.unit})` : ''}${field.required ? ' *' : ''}`);
      let input;
      const value = values[field.id];
      if (field.type === 'coordinate') {
        const grid = element('div'); grid.className = 'grid';
        for (const [part,min,max] of [['latitude',-90,90],['longitude',-180,180]]) {
          const sublabel = element('label', part === 'latitude' ? `${field.label}: latitude` : `${field.label}: longitude`);
          const number = element('input'); number.type = 'number'; number.step = 'any'; number.min = min; number.max = max; number.name = `custom-${field.id}-${part}`; number.value = value?.[part] ?? ''; number.required = field.required; sublabel.append(number); grid.append(sublabel);
        }
        container.append(label,grid); continue;
      }
      if (field.type === 'multi_select') {
        const choices = element('div'); choices.className = 'choices';
        for (const choice of field.options) { const sublabel = element('label'); const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.name = `custom-${field.id}`; checkbox.value = choice; checkbox.checked = Array.isArray(value) && value.includes(choice); sublabel.append(checkbox, document.createTextNode(choice)); choices.append(sublabel); }
        const group = element("fieldset"); group.append(element("legend", label.textContent), choices); container.append(group); continue;
      }
      if (field.type === 'select' || field.type === 'boolean') {
        input = element('select'); input.append(option('', 'Selecione…'));
        if (field.type === 'boolean') input.append(option('true','Sim'), option('false','Não'));
        else input.append(...field.options.map(v => option(v,v)));
        input.value = value === undefined ? '' : String(value);
      } else if (field.type === 'note') { input = element('textarea'); input.value = value || ''; input.maxLength = 30000; }
      else { input = element('input'); input.type = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'; if (field.type === 'number') input.step = 'any'; input.value = value ?? ''; input.maxLength = 30000; }
      input.name = `custom-${field.id}`; input.required = field.required; label.append(input); container.append(label);
    }
  }
  function collectCustom() {
    const data = new FormData(form), result = { ...(editing?.data.customValues || {}) };
    for (const field of definitions().filter(f => !f.archived)) {
      const key = `custom-${field.id}`;
      const value = String(data.get(key) || '');
      delete result[field.id];
      if (field.type === 'multi_select') { const choices = data.getAll(key).map(String); if (field.required && !choices.length) throw new Error(`Preencha ${field.label}.`); if (choices.length) result[field.id] = choices; }
      else if (field.type === 'coordinate') { const lat = String(data.get(key+'-latitude') || ''), lon = String(data.get(key+'-longitude') || ''); if (Boolean(lat) !== Boolean(lon)) throw new Error(`Informe as duas coordenadas de ${field.label}.`); if (lat && lon) result[field.id] = { latitude: Number(lat), longitude: Number(lon) }; }
      else if (value) result[field.id] = field.type === 'number' ? Number(value) : field.type === 'boolean' ? value === 'true' : value;
    }
    return result;
  }
  function previews() {
    urls.forEach(URL.revokeObjectURL); urls = files.map(file => URL.createObjectURL(file));
    document.getElementById('photo-previews').replaceChildren(...files.map((file,index) => {
      const wrapper = element('div'); const image = element('img'); image.src = urls[index]; image.alt = file.name;
      const remove = element('button','Remover'); remove.type = 'button'; remove.className = 'secondary'; remove.setAttribute('aria-label', `Remover foto ${index+1}`); remove.onclick = () => { files.splice(index,1); previews(); }; wrapper.append(image,remove); return wrapper;
    }));
  }
  fields.photos.addEventListener('change', () => { files = Array.from(fields.photos.files || []); previews(); });
  fields.camera.addEventListener('change', () => { files.push(...Array.from(fields.camera.files || [])); previews(); });
  fields.projectId.addEventListener('change', () => { if (editing) editing.data.customValues = {}; campaignOptions(); siteOptions(); customFields({}); });
  for (const name of ['latitude','longitude']) fields[name].addEventListener('input', () => { gpsSequence++; });
  function locate() {
    const sequence = ++gpsSequence; gpsStatus.textContent = 'Buscando GPS…';
    if (!navigator.geolocation) { gpsStatus.textContent = 'GPS indisponível. Informe as coordenadas.'; return; }
    navigator.geolocation.getCurrentPosition(position => {
      if (gpsSequence !== sequence) return;
      fields.latitude.value = position.coords.latitude; fields.longitude.value = position.coords.longitude;
      if (position.coords.altitude !== null) fields.altitude.value = Math.max(-500, Math.min(10000, position.coords.altitude));
      gpsStatus.textContent = `GPS atualizado · precisão aproximada ${Math.round(position.coords.accuracy)} m`;
    }, () => { if (gpsSequence === sequence) gpsStatus.textContent = 'GPS não disponível. Informe as coordenadas ou registre sem localização.'; }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  }
  document.getElementById('locate').onclick = locate;
  document.getElementById('prepare').onclick = async () => {
    try { context = await store.prepare(); projectOptions(); contextStatus.textContent = 'Projetos e formulários atualizados para uso offline.'; }
    catch (error) { contextStatus.textContent = error.message; }
  };
  function resetEdit() { editing = undefined; document.getElementById('cancel-edit').hidden = true; form.reset(); files = []; previews(); projectOptions(); }
  document.getElementById('cancel-edit').onclick = resetEdit;
  async function edit(record) {
    if (record.status !== 'error') return;
    editing = structuredClone(record); projectOptions();
    for (const key of ['group','region','latitude','longitude','altitude','habitat','substrate','notes']) fields[key].value = record.data[key] ?? '';
    fields.scientificName.value = record.scientificName || '';
    const date = new Date(record.data.observedAt); if (!Number.isNaN(date.getTime())) { const local = new Date(date.getTime() - date.getTimezoneOffset()*60000); fields.observedAt.value = local.toISOString().slice(0,16); }
    files = record.photos.map(p => new File([p.blob],p.name,{ type: p.type })); previews(); document.getElementById('cancel-edit').hidden = false;
    message('Corrija os dados e salve novamente.'); form.scrollIntoView();
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); const fieldset = document.getElementById('capture-fields');
    try {
      if (files.length > 5 || files.some(f => !f.size || f.size > 20*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(f.type))) throw new Error('Use até 5 fotos JPEG, PNG ou WebP, com até 20 MB cada.');
      const lat = fields.latitude.value, lon = fields.longitude.value;
      if (Boolean(lat) !== Boolean(lon)) throw new Error('Informe latitude e longitude juntas.');
      if (fields.projectId.value && !context.projects.some(p => p.id === fields.projectId.value)) throw new Error('Atualize os projetos no aparelho antes de registrar neste projeto.');
      const customValues = collectCustom(); const now = new Date().toISOString();
      const record = { id: editing?.id || crypto.randomUUID(), createdAt: editing?.createdAt || now,
        scientificName: fields.scientificName.value.trim(), data: {
          projectId: fields.projectId.value || null, campaignId: fields.campaignId.value || null, samplingSiteId: fields.samplingSiteId.value || null,
          customValues, group: fields.group.value, observedAt: fields.observedAt.value ? new Date(fields.observedAt.value).toISOString() : now,
          region: fields.region.value, habitat: fields.habitat.value, substrate: fields.substrate.value,
          latitude: lat ? Number(lat) : null, longitude: lon ? Number(lon) : null, altitude: fields.altitude.value ? Number(fields.altitude.value) : null,
          notes: fields.notes.value, vegetation: '', light: '', morphology: {},
        }, photos: files.map(file => ({ blob: file, name: file.name, type: file.type })) };
      fieldset.disabled = true; await store.enqueue(record);
      const project = fields.projectId.value, campaign = fields.campaignId.value, site = fields.samplingSiteId.value;
      editing = undefined; document.getElementById('cancel-edit').hidden = true;
      form.reset(); fields.projectId.value = project; campaignOptions(campaign); siteOptions(site); customFields({}); files = []; previews();
      message('Coleta salva localmente. Aguardando sincronização.');
      await renderQueue(); void synchronize(false); locate();
    } catch (error) { message(error.message || 'Não foi possível salvar. As fotos continuam no formulário.', true); }
    finally { fieldset.disabled = false; }
  });
  async function renderQueue() {
    try {
      const records = await store.list(), container = document.getElementById('queue'); container.replaceChildren();
      if (!records.length) container.append(element('p','Nenhuma coleta neste aparelho.'));
      const labels = { local: 'Salvo localmente', pending: 'Aguardando sincronização', synced: 'Sincronizado', error: 'Erro' };
      for (const record of records) {
        const item = element('div'); item.className = 'queue-item'; item.append(element('strong', record.code || record.data.region || 'Nova observação'), element('span',labels[record.status]));
        if (record.error) { const error = element('small',record.error); error.className = 'error'; item.append(error); }
        if (record.status === 'error') { const button = element('button','Corrigir'); button.className = 'secondary'; button.onclick = () => { void edit(record); }; item.append(button); }
        container.append(item);
      }
      return records;
    } catch (error) { message(error.message,true); return []; }
  }
  async function synchronize(retry) {
    const button = document.getElementById('sync'); button.disabled = true;
    try { await store.sync(retry); await renderQueue(); } catch (error) { message(error.message,true); } finally { button.disabled = false; }
  }
  document.getElementById('sync').onclick = () => { void synchronize(true); };
  document.getElementById('clear').onclick = async () => { try { await store.clearSynced(); await renderQueue(); } catch (error) { message(error.message,true); } };
  window.addEventListener('campo-field-change', () => { void renderQueue(); });
  window.addEventListener('online', () => { void synchronize(false); });
  setInterval(() => { if (!document.hidden) void synchronize(false); },20000);
  (async () => {
    try {
      context = await store.getContext() || context; projectOptions();
      contextStatus.textContent = context.projects.length ? 'Projetos e formulários disponíveis neste aparelho.' : 'Modo pessoal disponível offline. Abra esta página com conexão para preparar projetos.';
      if (navigator.onLine) try { context = await store.prepare(); projectOptions(); contextStatus.textContent = 'Projetos e formulários atualizados para uso offline.'; } catch (error) { contextStatus.textContent += ` ${error.message}`; }
      initialSelection = false;
      const records = await renderQueue(); const record = records.find(r => r.id === params.get('edit'));
      if (record) await edit(record); else locate();
      void synchronize(false);
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    } catch (error) { message(error.message,true); }
  })();
})();
