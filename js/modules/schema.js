// Module Schema - outil de dessin pour les catégories de cotes
window.Schema = (function () {

  let canvas = null;
  let currentTool = 'pen';
  let currentColor = '#1e293b';
  let currentWidth = 3;
  let undoStack = [];
  let redoStack = [];
  let isDrawingShape = false;
  let startPoint = null;
  let tempShape = null;

  function open(categoryId) {
    if (typeof fabric === 'undefined') {
      Toast.error('Bibliothèque de dessin non chargée');
      return;
    }

    const cat = (Store.state.categoriesCotes || []).find(c => c.id === categoryId);
    if (!cat) return;

    Modal.open({
      title: `✏️ Schéma — ${cat.nom}`,
      size: 'xl',
      body: `
        <div class="schema-editor">
          <div class="schema-toolbar">
            <div class="toolbar-group">
              <button class="tool-btn tool-btn--active" data-tool="pen" title="Pinceau">✏️</button>
              <button class="tool-btn" data-tool="eraser" title="Gomme">🩹</button>
              <button class="tool-btn" data-tool="rect" title="Rectangle">▭</button>
              <button class="tool-btn" data-tool="circle" title="Cercle">○</button>
              <button class="tool-btn" data-tool="line" title="Ligne">╱</button>
              <button class="tool-btn" data-tool="arrow" title="Flèche">→</button>
              <button class="tool-btn" data-tool="text" title="Texte">T</button>
              <button class="tool-btn" data-tool="select" title="Sélectionner / déplacer">✛</button>
            </div>

            <div class="toolbar-group">
              <label class="tool-label">Couleur</label>
              <div class="color-palette">
                ${['#1e293b','#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#ffffff']
                  .map((c, i) => `<button class="color-swatch ${i === 0 ? 'is-active' : ''}" data-color="${c}" style="background:${c}" title="${c}"></button>`).join('')}
              </div>
              <input type="color" class="tool-color-picker" id="schemaColorPicker" value="${currentColor}" title="Couleur personnalisée">
            </div>

            <div class="toolbar-group">
              <label class="tool-label">Épaisseur</label>
              <input type="range" id="schemaWidthSlider" min="1" max="20" value="${currentWidth}" class="width-slider">
              <span class="width-preview" id="widthPreview">${currentWidth}</span>
            </div>

            <div class="toolbar-group">
              <button class="tool-btn" id="schemaUndo" title="Annuler">↶</button>
              <button class="tool-btn" id="schemaRedo" title="Rétablir">↷</button>
              <button class="tool-btn tool-btn--danger" id="schemaClear" title="Tout effacer">🗑</button>
            </div>
          </div>

          <div class="schema-canvas-wrap">
            <canvas id="schemaCanvas"></canvas>
          </div>

          <div class="schema-hint">
            <span id="schemaToolHint">✏️ Pinceau — dessinez en maintenant le clic</span>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="schemaSave">💾 Enregistrer le schéma</button>
      `,
      onOpen: () => {
        initCanvas(categoryId, cat);
      }
    });
  }

  function initCanvas(categoryId, cat) {
    const canvasEl = document.getElementById('schemaCanvas');
    if (!canvasEl) return;

    // Dimensions adaptées à la fenêtre
    const wrap = canvasEl.parentElement;
    const w = Math.min(1000, wrap.clientWidth - 8);
    const h = Math.min(600, window.innerHeight - 280);

    canvas = new fabric.Canvas('schemaCanvas', {
      width: w,
      height: h,
      backgroundColor: '#ffffff',
      isDrawingMode: true
    });

    // Charger un schéma existant
    if (cat.schemaData) {
      try {
        canvas.loadFromJSON(cat.schemaData, () => {
          canvas.renderAll();
          saveState(); // initial state
        });
      } catch (e) {
        console.warn('Schéma corrompu, repartir à zéro', e);
        saveState();
      }
    } else {
      saveState();
    }

    // Pinceau initial
    setupBrush();

    // Sauvegarde après chaque modification
    canvas.on('path:created', saveState);
    canvas.on('object:added', (e) => {
      // Ne pas saver pendant les loading
      if (!e.target || e.target._noSave) return;
      if (canvas.isDrawingMode) return; // path:created s'en occupe
      saveState();
    });
    canvas.on('object:modified', saveState);

    // Bind toolbar
    bindToolbar(categoryId);

    // Drawing modes pour les formes
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
  }

  function setupBrush() {
    if (!canvas) return;
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = currentTool === 'eraser' ? '#ffffff' : currentColor;
    canvas.freeDrawingBrush.width = currentTool === 'eraser' ? Math.max(currentWidth * 2, 10) : currentWidth;
  }

  function bindToolbar(categoryId) {
    // Outils
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('tool-btn--active'));
        btn.classList.add('tool-btn--active');
        setTool(btn.dataset.tool);
      });
    });

    // Palette de couleurs
    document.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('is-active'));
        sw.classList.add('is-active');
        currentColor = sw.dataset.color;
        document.getElementById('schemaColorPicker').value = currentColor;
        setupBrush();
      });
    });

    // Color picker personnalisé
    document.getElementById('schemaColorPicker')?.addEventListener('input', (e) => {
      currentColor = e.target.value;
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('is-active'));
      setupBrush();
    });

    // Épaisseur
    const slider = document.getElementById('schemaWidthSlider');
    const preview = document.getElementById('widthPreview');
    slider?.addEventListener('input', (e) => {
      currentWidth = parseInt(e.target.value);
      if (preview) preview.textContent = currentWidth;
      setupBrush();
    });

    // Undo / Redo / Clear
    document.getElementById('schemaUndo')?.addEventListener('click', undo);
    document.getElementById('schemaRedo')?.addEventListener('click', redo);
    document.getElementById('schemaClear')?.addEventListener('click', clearAll);

    // Save
    document.getElementById('schemaSave')?.addEventListener('click', () => save(categoryId));
  }

  function setTool(tool) {
    currentTool = tool;
    const hints = {
      pen: '✏️ Pinceau — dessinez en maintenant le clic',
      eraser: '🩹 Gomme — passez sur le trait à effacer',
      rect: '▭ Rectangle — cliquez et glissez',
      circle: '○ Cercle — cliquez et glissez',
      line: '╱ Ligne — cliquez et glissez',
      arrow: '→ Flèche — cliquez et glissez',
      text: 'T Texte — cliquez pour ajouter du texte',
      select: '✛ Sélection — cliquez pour sélectionner/déplacer'
    };
    const hint = document.getElementById('schemaToolHint');
    if (hint) hint.textContent = hints[tool] || '';

    if (tool === 'pen' || tool === 'eraser') {
      canvas.isDrawingMode = true;
      canvas.selection = false;
      setupBrush();
    } else {
      canvas.isDrawingMode = false;
      canvas.selection = tool === 'select';
    }
  }

  function handleMouseDown(opt) {
    if (currentTool === 'select' || currentTool === 'pen' || currentTool === 'eraser') return;

    const pointer = canvas.getPointer(opt.e);
    startPoint = { x: pointer.x, y: pointer.y };

    if (currentTool === 'text') {
      const text = new fabric.IText('Texte', {
        left: pointer.x,
        top: pointer.y,
        fontSize: 18 + currentWidth,
        fill: currentColor,
        fontFamily: 'Inter, sans-serif'
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      text.enterEditing();
      text.selectAll();
      saveState();
      return;
    }

    isDrawingShape = true;

    if (currentTool === 'rect') {
      tempShape = new fabric.Rect({
        left: startPoint.x,
        top: startPoint.y,
        width: 0,
        height: 0,
        fill: 'transparent',
        stroke: currentColor,
        strokeWidth: currentWidth,
        selectable: false
      });
      tempShape._noSave = true;
      canvas.add(tempShape);
    } else if (currentTool === 'circle') {
      tempShape = new fabric.Ellipse({
        left: startPoint.x,
        top: startPoint.y,
        rx: 0,
        ry: 0,
        fill: 'transparent',
        stroke: currentColor,
        strokeWidth: currentWidth,
        selectable: false
      });
      tempShape._noSave = true;
      canvas.add(tempShape);
    } else if (currentTool === 'line') {
      tempShape = new fabric.Line([startPoint.x, startPoint.y, startPoint.x, startPoint.y], {
        stroke: currentColor,
        strokeWidth: currentWidth,
        selectable: false
      });
      tempShape._noSave = true;
      canvas.add(tempShape);
    } else if (currentTool === 'arrow') {
      tempShape = new fabric.Line([startPoint.x, startPoint.y, startPoint.x, startPoint.y], {
        stroke: currentColor,
        strokeWidth: currentWidth,
        selectable: false
      });
      tempShape._noSave = true;
      canvas.add(tempShape);
    }
  }

  function handleMouseMove(opt) {
    if (!isDrawingShape || !tempShape) return;
    const pointer = canvas.getPointer(opt.e);

    if (currentTool === 'rect') {
      const w = pointer.x - startPoint.x;
      const h = pointer.y - startPoint.y;
      tempShape.set({
        left: w < 0 ? pointer.x : startPoint.x,
        top: h < 0 ? pointer.y : startPoint.y,
        width: Math.abs(w),
        height: Math.abs(h)
      });
    } else if (currentTool === 'circle') {
      const w = pointer.x - startPoint.x;
      const h = pointer.y - startPoint.y;
      tempShape.set({
        left: w < 0 ? pointer.x : startPoint.x,
        top: h < 0 ? pointer.y : startPoint.y,
        rx: Math.abs(w) / 2,
        ry: Math.abs(h) / 2
      });
    } else if (currentTool === 'line' || currentTool === 'arrow') {
      tempShape.set({ x2: pointer.x, y2: pointer.y });
    }

    canvas.renderAll();
  }

  function handleMouseUp() {
    if (!isDrawingShape || !tempShape) return;

    // Pour la flèche, on ajoute une "pointe"
    if (currentTool === 'arrow') {
      const x1 = tempShape.x1, y1 = tempShape.y1;
      const x2 = tempShape.x2, y2 = tempShape.y2;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLength = 12 + currentWidth * 2;

      const arrowHead1 = new fabric.Line([
        x2, y2,
        x2 - headLength * Math.cos(angle - Math.PI / 6),
        y2 - headLength * Math.sin(angle - Math.PI / 6)
      ], { stroke: currentColor, strokeWidth: currentWidth, selectable: false });
      arrowHead1._noSave = true;

      const arrowHead2 = new fabric.Line([
        x2, y2,
        x2 - headLength * Math.cos(angle + Math.PI / 6),
        y2 - headLength * Math.sin(angle + Math.PI / 6)
      ], { stroke: currentColor, strokeWidth: currentWidth, selectable: false });
      arrowHead2._noSave = true;

      // On groupe la ligne + les deux pointes
      canvas.remove(tempShape);
      const arrow = new fabric.Group([
        new fabric.Line([x1, y1, x2, y2], { stroke: currentColor, strokeWidth: currentWidth }),
        arrowHead1,
        arrowHead2
      ], {
        selectable: true,
        evented: true
      });
      canvas.add(arrow);
    } else {
      // Pour les autres formes, on rend l'objet sélectionnable
      tempShape.set({ selectable: true, evented: true });
      delete tempShape._noSave;
    }

    isDrawingShape = false;
    tempShape = null;
    startPoint = null;
    canvas.renderAll();
    saveState();
  }

  function saveState() {
    if (!canvas) return;
    try {
      const json = JSON.stringify(canvas.toJSON());
      // Ne pas pousser si identique au dernier
      if (undoStack.length > 0 && undoStack[undoStack.length - 1] === json) return;
      undoStack.push(json);
      // Limite à 50 états pour éviter de bouffer trop de RAM
      if (undoStack.length > 50) undoStack.shift();
      redoStack = []; // un nouveau dessin invalide les redo
      updateUndoRedoButtons();
    } catch (e) {
      console.warn('Erreur save state', e);
    }
  }

  function undo() {
    if (undoStack.length <= 1) return;
    const current = undoStack.pop();
    redoStack.push(current);
    const previous = undoStack[undoStack.length - 1];
    canvas.loadFromJSON(previous, () => {
      canvas.renderAll();
      updateUndoRedoButtons();
    });
  }

  function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack.pop();
    undoStack.push(next);
    canvas.loadFromJSON(next, () => {
      canvas.renderAll();
      updateUndoRedoButtons();
    });
  }

  function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('schemaUndo');
    const redoBtn = document.getElementById('schemaRedo');
    if (undoBtn) undoBtn.disabled = undoStack.length <= 1;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
  }

  function clearAll() {
    Modal.confirm({
      title: 'Tout effacer ?',
      message: 'Toutes les formes dessinées seront supprimées.',
      danger: true,
      onConfirm: () => {
        canvas.clear();
        canvas.backgroundColor = '#ffffff';
        canvas.renderAll();
        saveState();
        Toast.success('Schéma effacé');
      }
    });
  }

  function save(categoryId) {
    if (!canvas) return;
    try {
      const json = JSON.stringify(canvas.toJSON());
      const dataUrl = canvas.toDataURL({
        format: 'png',
        quality: 0.9,
        multiplier: 1
      });

      Store.updateCategorieCote(categoryId, {
        schema: dataUrl,
        schemaData: json
      });

      Toast.success('Schéma enregistré');
      Modal.close();

      // Reset state
      undoStack = [];
      redoStack = [];
      canvas = null;

      if (window.Router) Router.refresh();
    } catch (e) {
      console.error(e);
      Toast.error('Erreur lors de l\'enregistrement');
    }
  }

  return { open };
})();
