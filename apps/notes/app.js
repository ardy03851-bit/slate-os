/* Notes — WebPad external app */
(function () {
  const style = document.createElement('style');
  style.textContent = `
    .notes-root { background: #f2f2f7; min-height: 100%; display: flex; flex-direction: column; }
    .notes-list { flex: 1; overflow: auto; }
    .note-row { padding: 14px 20px; background: #fff; border-bottom: 1px solid rgba(0,0,0,.06); cursor: pointer; }
    .note-row:active { background: #e5e5ea; }
    .note-row .t { font-weight: 600; font-size: 16px; }
    .note-row .p { font-size: 13px; color: #8e8e93; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .notes-empty { text-align: center; color: #8e8e93; padding: 60px 20px; font-size: 15px; }
    .notes-editor { position: absolute; inset: 0; top: 30px; background: #fff; display: flex; flex-direction: column; z-index: 10; }
    .notes-editor .bar { display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: rgba(242,242,247,.9); backdrop-filter: blur(10px); }
    .notes-editor textarea { flex: 1; border: none; resize: none; padding: 18px 20px; font-size: 16px; line-height: 1.55; outline: none; font-family: inherit; }
  `;
  document.head.append(style);

  window.WebPadApps.notes = {
    mount(el, win, api) {
      el.classList.add('notes-root');

      let notes = api.storage.get('notes', []);
      if (!Array.isArray(notes)) notes = [];

      const header = document.createElement('div');
      header.className = 'app-header';
      header.innerHTML = `<h1>Notes</h1><div class="spacer"></div>`;
      const addBtn = document.createElement('button');
      addBtn.className = 'btn';
      addBtn.textContent = 'New Note';
      header.append(addBtn);
      const list = document.createElement('div');
      list.className = 'notes-list';
      el.append(header, list);

      function persist() { api.storage.set('notes', notes); }

      function renderList() {
        list.innerHTML = '';
        if (!notes.length) {
          list.append(Object.assign(document.createElement('div'), { className: 'notes-empty', textContent: 'No notes yet. Tap “New Note” to write one.' }));
        }
        for (const n of [...notes].sort((a, b) => b.updated - a.updated)) {
          const row = document.createElement('div');
          row.className = 'note-row';
          row.innerHTML = `<div class="t"></div><div class="p"></div>`;
          row.querySelector('.t').textContent = n.title || 'New Note';
          row.querySelector('.p').textContent = (n.body || 'No additional text').split('\n')[0];
          row.addEventListener('click', () => openEditor(n.id));
          list.append(row);
        }
      }

      function openEditor(id) {
        const note = notes.find(n => n.id === id) || { id: 'n' + Date.now(), title: '', body: '', updated: Date.now() };
        if (!notes.find(n => n.id === note.id)) notes.push(note);

        const editor = document.createElement('div');
        editor.className = 'notes-editor';
        const bar = document.createElement('div');
        bar.className = 'bar';
        const back = document.createElement('button');
        back.className = 'btn'; back.textContent = 'Notes';
        const del = document.createElement('button');
        del.className = 'btn danger'; del.textContent = 'Delete';
        const title = document.createElement('input');
        title.type = 'text'; title.placeholder = 'Title';
        title.value = note.title;
        title.style.cssText = 'border:none;background:transparent;font-size:19px;font-weight:700;padding:6px 4px';
        const ta = document.createElement('textarea');
        ta.placeholder = 'Start writing…';
        ta.value = note.body;
        bar.append(back, title, del);
        editor.append(bar, ta);
        el.append(editor);

        const save = () => {
          note.title = title.value; note.body = ta.value; note.updated = Date.now();
          persist(); renderList();
        };
        title.addEventListener('input', save);
        ta.addEventListener('input', save);
        back.addEventListener('click', () => { save(); editor.remove(); });
        del.addEventListener('click', () => {
          notes = notes.filter(n => n.id !== note.id);
          persist(); renderList(); editor.remove();
          api.toast('Note deleted');
        });
        setTimeout(() => ta.focus(), 100);
      }

      addBtn.addEventListener('click', () => openEditor('n' + Date.now()));
      renderList();
    },
  };
})();
