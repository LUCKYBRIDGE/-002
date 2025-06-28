// 한국화 드로잉 앱 - 메인 JavaScript 파일

class KoreanPaintingApp {
    constructor() {
        this.canvas = null;
        this.sealCanvas = null;
        this.currentTool = 'brush';
        this.currentColor = '#000000';
        this.layers = [];
        this.activeLayerId = 0;
        this.history = [];
        this.historyStep = -1;
        this.maxHistorySteps = 50;
        this.particles = [];
        this.isDrawing = false;
        this.lastPoint = null;
        this.dwellTime = 0;
        this.dwellTimer = null;
        this.storedSeal = null;
        
        // 붓 속성
        this.brushProperties = {
            size: 10,
            opacity: 1.0,
            bleedFactor: 0.5,
            textureStrength: 0.7
        };

        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupSealCanvas();
        this.setupEventListeners();
        this.setupUI();
        this.saveState(); // 초기 상태 저장
        this.startParticleAnimation();
    }

    setupCanvas() {
        const canvasElement = document.getElementById('drawingCanvas');
        this.canvas = new fabric.Canvas(canvasElement, {
            isDrawingMode: true,
            width: 800,
            height: 600,
            backgroundColor: '#fefcf8'
        });

        // 기본 브러시 설정
        this.updateBrushSettings();
        this.setupCanvasEvents();
        this.resizeCanvas();
    }

    setupSealCanvas() {
        const sealCanvasElement = document.getElementById('sealCanvas');
        this.sealCanvas = new fabric.Canvas(sealCanvasElement, {
            isDrawingMode: true,
            width: 200,
            height: 200,
            backgroundColor: '#8b4513'
        });

        // 도장용 브러시 설정
        this.sealCanvas.freeDrawingBrush.color = '#ff0000';
        this.sealCanvas.freeDrawingBrush.width = 3;
    }

    setupCanvasEvents() {
        // 그리기 시작
        this.canvas.on('path:created', (e) => {
            const path = e.path;
            path.set({
                layerId: this.activeLayerId,
                strokeLineCap: 'round',
                strokeLineJoin: 'round'
            });
            
            this.applyInkBleedEffect(path);
            this.saveState();
        });

        // 압력 감지 및 먹 번짐 효과
        this.canvas.on('mouse:down', (e) => {
            this.isDrawing = true;
            this.lastPoint = e.pointer;
            this.dwellTime = 0;
            this.startDwellTracking();
        });

        this.canvas.on('mouse:move', (e) => {
            if (this.isDrawing && this.currentTool === 'brush') {
                this.handleInkBleed(e);
            }
        });

        this.canvas.on('mouse:up', () => {
            this.isDrawing = false;
            this.stopDwellTracking();
        });

        // 객체 선택 시 레이어 하이라이트
        this.canvas.on('selection:created', (e) => {
            if (e.selected && e.selected.length > 0) {
                const layerId = e.selected[0].layerId || 0;
                this.highlightLayer(layerId);
            }
        });
    }

    setupEventListeners() {
        // 도구 선택
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectTool(e.target.dataset.tool);
            });
        });

        // 색상 선택
        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                this.selectColor(e.target.dataset.color);
            });
        });

        // 브러시 속성 조절
        this.setupSliderControls();

        // 파일 관리
        document.getElementById('saveProject').addEventListener('click', () => this.saveProject());
        document.getElementById('loadProject').addEventListener('click', () => this.loadProject());
        document.getElementById('exportPNG').addEventListener('click', () => this.exportPNG());

        // 실행 취소/재실행
        document.getElementById('undo').addEventListener('click', () => this.undo());
        document.getElementById('redo').addEventListener('click', () => this.redo());

        // 줌 컨트롤
        document.getElementById('zoomIn').addEventListener('click', () => this.zoom(1.2));
        document.getElementById('zoomOut').addEventListener('click', () => this.zoom(0.8));
        document.getElementById('zoomReset').addEventListener('click', () => this.resetZoom());

        // 레이어 관리
        document.getElementById('addLayer').addEventListener('click', () => this.addLayer());
        document.getElementById('deleteLayer').addEventListener('click', () => this.deleteLayer());
        document.getElementById('mergeLayer').addEventListener('click', () => this.mergeLayer());

        // 낙관 기능
        document.getElementById('sealDesigner').addEventListener('click', () => this.openSealDesigner());
        document.getElementById('applySeal').addEventListener('click', () => this.applySeal());

        // 낙관 모달
        document.getElementById('saveSeal').addEventListener('click', () => this.saveSeal());
        document.getElementById('cancelSeal').addEventListener('click', () => this.closeSealDesigner());
        document.querySelector('.modal-close').addEventListener('click', () => this.closeSealDesigner());

        // UI 토글
        document.getElementById('toggleUI').addEventListener('click', () => this.toggleUI());

        // 키보드 단축키
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // 창 크기 조절
        window.addEventListener('resize', () => this.resizeCanvas());

        // 파일 입력
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileLoad(e));
    }

    setupSliderControls() {
        const sliders = [
            { id: 'brushSize', property: 'size', suffix: '' },
            { id: 'brushOpacity', property: 'opacity', suffix: '%', divider: 100 },
            { id: 'bleedFactor', property: 'bleedFactor', suffix: '%', divider: 100 },
            { id: 'textureStrength', property: 'textureStrength', suffix: '%', divider: 100 }
        ];

        sliders.forEach(slider => {
            const element = document.getElementById(slider.id);
            const valueElement = document.getElementById(slider.id + 'Value');
            
            element.addEventListener('input', (e) => {
                let value = parseFloat(e.target.value);
                if (slider.divider) value /= slider.divider;
                
                this.brushProperties[slider.property] = value;
                valueElement.textContent = e.target.value + slider.suffix;
                this.updateBrushSettings();
            });
        });
    }

    selectTool(tool) {
        this.currentTool = tool;
        
        // UI 업데이트
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tool="${tool}"]`).classList.add('active');

        // 캔버스 모드 설정
        switch(tool) {
            case 'brush':
                this.canvas.isDrawingMode = true;
                this.canvas.selection = false;
                break;
            case 'pencil':
                this.canvas.isDrawingMode = true;
                this.canvas.selection = false;
                this.brushProperties.bleedFactor = 0; // 연필은 번짐 없음
                break;
            case 'eraser':
                this.canvas.isDrawingMode = true;
                this.canvas.selection = false;
                break;
            default:
                this.canvas.isDrawingMode = false;
                this.canvas.selection = true;
        }

        this.updateBrushSettings();
    }

    selectColor(color) {
        this.currentColor = color;
        
        // UI 업데이트
        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.classList.remove('active');
        });
        document.querySelector(`[data-color="${color}"]`).classList.add('active');

        this.updateBrushSettings();
    }

    updateBrushSettings() {
        if (!this.canvas.freeDrawingBrush) return;

        const brush = this.canvas.freeDrawingBrush;
        
        switch(this.currentTool) {
            case 'brush':
                brush.color = this.currentColor;
                brush.width = this.brushProperties.size;
                brush.opacity = this.brushProperties.opacity;
                break;
            case 'pencil':
                brush.color = this.currentColor;
                brush.width = Math.max(1, this.brushProperties.size * 0.7);
                brush.opacity = this.brushProperties.opacity * 0.8;
                break;
            case 'eraser':
                brush.color = '#fefcf8'; // 배경색
                brush.width = this.brushProperties.size * 1.5;
                brush.opacity = 1.0;
                break;
        }

        this.canvas.renderAll();
    }

    // 먹 번짐 효과 구현
    applyInkBleedEffect(path) {
        if (this.currentTool !== 'brush' || this.brushProperties.bleedFactor === 0) {
            return;
        }

        const points = path.path;
        if (!points || points.length < 2) return;

        // 패스의 포인트들을 기반으로 입자 생성
        for (let i = 0; i < points.length; i += 3) {
            if (points[i] && points[i][1] && points[i][2]) {
                const x = points[i][1];
                const y = points[i][2];
                this.createInkParticles(x, y, this.brushProperties.bleedFactor);
            }
        }
    }

    createInkParticles(x, y, intensity) {
        const particleCount = Math.floor(intensity * 10 + this.dwellTime * 0.01);
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * intensity * 2;
            const life = Math.random() * 100 + 50;
            
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed + 0.1, // 약간의 중력
                life: life,
                maxLife: life,
                opacity: Math.random() * 0.3 + 0.1,
                size: Math.random() * 3 + 1,
                color: this.currentColor
            });
        }
    }

    handleInkBleed(e) {
        if (!this.lastPoint) return;

        const currentPoint = e.pointer;
        const distance = Math.sqrt(
            Math.pow(currentPoint.x - this.lastPoint.x, 2) + 
            Math.pow(currentPoint.y - this.lastPoint.y, 2)
        );
        
        const speed = distance / 16; // 대략적인 속도 계산
        
        // 속도가 느릴수록 더 많은 번짐
        if (speed < 2) {
            this.createInkParticles(
                currentPoint.x, 
                currentPoint.y, 
                this.brushProperties.bleedFactor * (2 - speed)
            );
        }

        this.lastPoint = currentPoint;
    }

    startDwellTracking() {
        this.dwellTimer = setInterval(() => {
            this.dwellTime += 16; // 16ms마다 증가
        }, 16);
    }

    stopDwellTracking() {
        if (this.dwellTimer) {
            clearInterval(this.dwellTimer);
            this.dwellTimer = null;
            this.dwellTime = 0;
        }
    }

    startParticleAnimation() {
        const animate = () => {
            this.updateParticles();
            this.renderParticles();
            requestAnimationFrame(animate);
        };
        animate();
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life--;
            particle.opacity = (particle.life / particle.maxLife) * 0.3;
            
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    renderParticles() {
        const ctx = this.canvas.getContext();
        
        this.particles.forEach(particle => {
            ctx.save();
            ctx.globalAlpha = particle.opacity;
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    // 레이어 관리
    addLayer() {
        const layerId = this.layers.length;
        const layerName = `레이어 ${layerId + 1}`;
        
        this.layers.push({
            id: layerId,
            name: layerName,
            visible: true,
            objects: []
        });

        this.createLayerUI(layerId, layerName);
        this.setActiveLayer(layerId);
    }

    createLayerUI(layerId, layerName) {
        const layerList = document.getElementById('layerList');
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        layerItem.dataset.layerId = layerId;
        
        layerItem.innerHTML = `
            <span class="layer-visibility" title="표시/숨김">👁</span>
            <span class="layer-name">${layerName}</span>
        `;

        layerItem.addEventListener('click', () => this.setActiveLayer(layerId));
        
        layerItem.querySelector('.layer-visibility').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleLayerVisibility(layerId);
        });

        layerList.appendChild(layerItem);
    }

    setActiveLayer(layerId) {
        this.activeLayerId = layerId;
        
        // UI 업데이트
        document.querySelectorAll('.layer-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-layer-id="${layerId}"]`).classList.add('active');
    }

    toggleLayerVisibility(layerId) {
        const layer = this.layers[layerId];
        if (!layer) return;

        layer.visible = !layer.visible;
        
        // 해당 레이어의 모든 객체 표시/숨김
        this.canvas.getObjects().forEach(obj => {
            if (obj.layerId === layerId) {
                obj.visible = layer.visible;
            }
        });

        // UI 업데이트
        const visibilityIcon = document.querySelector(`[data-layer-id="${layerId}"] .layer-visibility`);
        visibilityIcon.textContent = layer.visible ? '👁' : '🚫';

        this.canvas.renderAll();
    }

    deleteLayer() {
        if (this.layers.length <= 1) {
            alert('최소 하나의 레이어는 유지되어야 합니다.');
            return;
        }

        // 현재 레이어의 모든 객체 삭제
        const objectsToRemove = this.canvas.getObjects().filter(obj => 
            obj.layerId === this.activeLayerId
        );
        
        objectsToRemove.forEach(obj => this.canvas.remove(obj));

        // 레이어 제거
        this.layers.splice(this.activeLayerId, 1);
        
        // UI에서 레이어 아이템 제거
        const layerItem = document.querySelector(`[data-layer-id="${this.activeLayerId}"]`);
        if (layerItem) layerItem.remove();

        // 이전 레이어로 전환
        this.setActiveLayer(Math.max(0, this.activeLayerId - 1));
        this.saveState();
    }

    mergeLayer() {
        // 간단한 논리적 병합 구현
        if (this.activeLayerId === 0) {
            alert('첫 번째 레이어는 병합할 수 없습니다.');
            return;
        }

        const targetLayerId = this.activeLayerId - 1;
        
        // 현재 레이어의 모든 객체를 이전 레이어로 이동
        this.canvas.getObjects().forEach(obj => {
            if (obj.layerId === this.activeLayerId) {
                obj.layerId = targetLayerId;
            }
        });

        this.deleteLayer();
    }

    highlightLayer(layerId) {
        this.setActiveLayer(layerId);
    }

    // 낙관 (도장) 기능
    openSealDesigner() {
        document.getElementById('sealModal').style.display = 'block';
        this.sealCanvas.clear();
    }

    closeSealDesigner() {
        document.getElementById('sealModal').style.display = 'none';
    }

    saveSeal() {
        const sealText = document.getElementById('sealText').value;
        const sealEffect = document.getElementById('sealEffect').value;
        const sealShape = document.getElementById('sealShape').value;

        if (sealText) {
            this.createTextSeal(sealText, sealEffect, sealShape);
        }

        // 캔버스 내용을 이미지로 저장
        this.storedSeal = this.sealCanvas.toDataURL();
        
        // UI 업데이트
        document.getElementById('applySeal').disabled = false;
        
        this.closeSealDesigner();
        alert('낙관이 저장되었습니다. "도장 찍기" 버튼을 클릭하여 사용하세요.');
    }

    createTextSeal(text, effect, shape) {
        const ctx = this.sealCanvas.getContext();
        ctx.clearRect(0, 0, 200, 200);

        // 배경 (도장 바탕)
        ctx.fillStyle = '#8b4513';
        if (shape === 'circle') {
            ctx.beginPath();
            ctx.arc(100, 100, 90, 0, Math.PI * 2);
            ctx.fill();
        } else if (shape === 'square') {
            ctx.fillRect(10, 10, 180, 180);
        }

        // 텍스트 렌더링 with 음각/양각 효과
        ctx.font = 'bold 24px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (effect === 'emboss') {
            // 양각 효과
            ctx.shadowColor = 'rgba(255,255,255,0.7)';
            ctx.shadowOffsetX = -1;
            ctx.shadowOffsetY = -1;
            ctx.shadowBlur = 1;
            ctx.fillStyle = '#ff0000';
            ctx.fillText(text, 100, 100);

            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.fillText(text, 100, 100);
        } else {
            // 음각 효과
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowOffsetX = -1;
            ctx.shadowOffsetY = -1;
            ctx.shadowBlur = 1;
            ctx.fillStyle = '#cd5c5c';
            ctx.fillText(text, 100, 100);

            ctx.shadowColor = 'rgba(255,255,255,0.7)';
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.fillText(text, 100, 100);
        }

        ctx.shadowColor = 'transparent';
    }

    applySeal() {
        if (!this.storedSeal) {
            alert('먼저 낙관을 디자인해주세요.');
            return;
        }

        fabric.Image.fromURL(this.storedSeal, (img) => {
            img.set({
                left: 100,
                top: 100,
                scaleX: 0.5,
                scaleY: 0.5,
                layerId: this.activeLayerId
            });
            
            this.canvas.add(img);
            this.canvas.setActiveObject(img);
            this.saveState();
        });
    }

    // 파일 관리
    saveProject() {
        const projectData = {
            version: '1.0',
            canvas: this.canvas.toJSON(['layerId']),
            layers: this.layers,
            timestamp: new Date().toISOString()
        };

        const dataStr = JSON.stringify(projectData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `korean-painting-${Date.now()}.json`;
        link.click();
    }

    loadProject() {
        document.getElementById('fileInput').click();
    }

    handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const projectData = JSON.parse(e.target.result);
                
                this.canvas.clear();
                this.canvas.loadFromJSON(projectData.canvas, () => {
                    this.layers = projectData.layers || [];
                    this.rebuildLayerUI();
                    this.canvas.renderAll();
                    this.saveState();
                });
            } catch (error) {
                alert('프로젝트 파일을 불러오는데 실패했습니다.');
                console.error(error);
            }
        };
        reader.readAsText(file);
    }

    exportPNG() {
        const dataURL = this.canvas.toDataURL({
            format: 'png',
            quality: 1.0,
            multiplier: 2 // 고해상도
        });

        const link = document.createElement('a');
        link.href = dataURL;
        link.download = `korean-painting-${Date.now()}.png`;
        link.click();
    }

    rebuildLayerUI() {
        const layerList = document.getElementById('layerList');
        layerList.innerHTML = '';
        
        this.layers.forEach((layer, index) => {
            this.createLayerUI(index, layer.name);
        });
        
        if (this.layers.length > 0) {
            this.setActiveLayer(0);
        }
    }

    // 실행 취소/재실행
    saveState() {
        if (this.historyStep < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyStep + 1);
        }

        this.history.push(this.canvas.toJSON(['layerId']));
        
        if (this.history.length > this.maxHistorySteps) {
            this.history.shift();
        } else {
            this.historyStep++;
        }

        this.updateUndoRedoButtons();
    }

    undo() {
        if (this.historyStep > 0) {
            this.historyStep--;
            this.loadState(this.history[this.historyStep]);
        }
    }

    redo() {
        if (this.historyStep < this.history.length - 1) {
            this.historyStep++;
            this.loadState(this.history[this.historyStep]);
        }
    }

    loadState(state) {
        this.canvas.loadFromJSON(state, () => {
            this.canvas.renderAll();
            this.updateUndoRedoButtons();
        });
    }

    updateUndoRedoButtons() {
        document.getElementById('undo').disabled = this.historyStep <= 0;
        document.getElementById('redo').disabled = this.historyStep >= this.history.length - 1;
    }

    // 줌 기능
    zoom(factor) {
        const zoom = this.canvas.getZoom() * factor;
        this.canvas.setZoom(zoom);
        this.canvas.renderAll();
    }

    resetZoom() {
        this.canvas.setZoom(1);
        this.canvas.absolutePan(new fabric.Point(0, 0));
        this.canvas.renderAll();
    }

    // UI 토글
    toggleUI() {
        const toolPanel = document.getElementById('toolPanel');
        const layerPanel = document.getElementById('layerPanel');
        
        toolPanel.classList.toggle('hidden');
        layerPanel.classList.toggle('hidden');
    }

    // 키보드 단축키
    handleKeyboard(e) {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                    break;
                case 's':
                    e.preventDefault();
                    this.saveProject();
                    break;
                case 'o':
                    e.preventDefault();
                    this.loadProject();
                    break;
            }
        }

        // 도구 단축키
        switch(e.key) {
            case 'b':
                this.selectTool('brush');
                break;
            case 'p':
                this.selectTool('pencil');
                break;
            case 'e':
                this.selectTool('eraser');
                break;
        }
    }

    // 반응형 캔버스
    resizeCanvas() {
        const container = document.querySelector('.canvas-wrapper');
        const containerWidth = container.clientWidth - 40; // 패딩 고려
        const containerHeight = container.clientHeight - 40;
        
        const maxWidth = Math.min(containerWidth, 1200);
        const maxHeight = Math.min(containerHeight, 800);
        
        // 비율 유지하면서 크기 조절
        const aspectRatio = 4 / 3;
        let newWidth, newHeight;
        
        if (maxWidth / maxHeight > aspectRatio) {
            newHeight = maxHeight;
            newWidth = newHeight * aspectRatio;
        } else {
            newWidth = maxWidth;
            newHeight = newWidth / aspectRatio;
        }

        this.canvas.setDimensions({
            width: newWidth,
            height: newHeight
        });
    }

    setupUI() {
        // 초기 레이어 설정
        this.layers.push({
            id: 0,
            name: '메인 레이어',
            visible: true,
            objects: []
        });

        // 초기 상태 버튼 업데이트
        this.updateUndoRedoButtons();
    }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    new KoreanPaintingApp();
});

// 압력 감지 이벤트 (Pointer Events API)
if ('PointerEvent' in window) {
    document.addEventListener('pointermove', (e) => {
        if (e.pressure && e.pressure > 0 && window.koreanPaintingApp) {
            // 압력에 따른 브러시 크기 조절
            const pressureFactor = e.pressure;
            const baseBrushSize = window.koreanPaintingApp.brushProperties.size;
            const adjustedSize = baseBrushSize * (0.5 + pressureFactor * 0.5);
            
            if (window.koreanPaintingApp.canvas.freeDrawingBrush) {
                window.koreanPaintingApp.canvas.freeDrawingBrush.width = adjustedSize;
            }
        }
    });
}

// 전역 앱 인스턴스 참조 (압력 감지용)
window.addEventListener('load', () => {
    window.koreanPaintingApp = new KoreanPaintingApp();
});