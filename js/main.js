import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import TerrainGenerator from './terrain.js';
import WaterSystem from './water.js';
import VegetationSystem from './vegetation.js';
import AtmosphereSystem from './atmosphere.js';
import HistoryManager from './history.js';
import Exporter from './exporter.js';
import TerrainLOD from './lod.js';
import PresetManager from './presets.js';
import SnapshotManager from './snapshots.js';
import MacroManager from './macros.js';

class TerrainEditor {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.canvasCompare = document.getElementById('canvas-compare');
        this.viewport = document.getElementById('viewport');
        this.brushIndicator = document.getElementById('brush-indicator');
        
        this.terrainSize = 512;
        this.terrainResolution = 256;
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.rendererCompare = null;
        this.controls = null;
        
        this.compareScene = null;
        this.compareCamera = null;
        this.compareTerrain = null;
        this.compareWater = null;
        this.compareVegetation = null;
        this.compareAtmosphere = null;
        this.compareTerrainLOD = null;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.terrain = null;
        this.terrainLOD = null;
        this.water = null;
        this.vegetation = null;
        this.atmosphere = null;
        this.history = new HistoryManager();
        this.exporter = null;
        
        this.presetManager = new PresetManager();
        this.snapshotManager = new SnapshotManager();
        this.macroManager = new MacroManager();
        
        this.compareMode = false;
        this.compareSnapshotId = null;
        this.currentRecordingMacro = null;
        
        this.currentBrush = 'raise';
        this.brushSize = 10;
        this.brushStrength = 0.5;
        this.flattenHeight = 0;
        this.isBrushing = false;
        this.lastBrushPos = null;
        
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        this.currentFps = 60;
        
        this.compareFrameCount = 0;
        this.compareLastFpsUpdate = 0;
        this.compareFps = 60;
        
        this.init();
    }

    init() {
        this.setupScene();
        this.setupCompareScene();
        this.setupTerrain();
        this.setupLOD();
        this.setupWater();
        this.setupVegetation();
        this.setupAtmosphere();
        this.setupExporter();
        this.setupEventListeners();
        this.setupUI();
        
        this.renderPresets();
        this.renderSnapshots();
        this.setupLayers();
        this.setupMacros();
        this.renderLayers();
        this.renderMacros();
        
        this.animate();
    }

    setupScene() {
        this.scene = new THREE.Scene();
        
        this.camera = new THREE.PerspectiveCamera(
            60,
            this.viewport.clientWidth / this.viewport.clientHeight,
            0.1,
            2000
        );
        this.camera.position.set(150, 120, 150);
        this.camera.lookAt(0, 0, 0);
        
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            preserveDrawingBuffer: true
        });
        this.renderer.setSize(this.viewport.clientWidth, this.viewport.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.1;
        this.controls.minDistance = 20;
        this.controls.maxDistance = 500;
        
        window.addEventListener('resize', () => this.onResize());
    }

    setupCompareScene() {
        this.compareScene = new THREE.Scene();
        this.compareScene.background = new THREE.Color(0x87ceeb);
        
        this.compareCamera = new THREE.PerspectiveCamera(
            60,
            this.viewport.clientWidth / 2 / this.viewport.clientHeight,
            0.1,
            2000
        );
        this.compareCamera.position.copy(this.camera.position);
        this.compareCamera.quaternion.copy(this.camera.quaternion);
        this.compareCamera.updateMatrixWorld();
        
        this.rendererCompare = new THREE.WebGLRenderer({
            canvas: this.canvasCompare,
            antialias: true
        });
        this.rendererCompare.setSize(this.viewport.clientWidth / 2, this.viewport.clientHeight);
        this.rendererCompare.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.rendererCompare.shadowMap.enabled = true;
        this.rendererCompare.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    setupTerrain() {
        this.terrain = new TerrainGenerator(this.terrainSize, this.terrainResolution);
        const terrainMesh = this.terrain.createMesh();
        this.scene.add(terrainMesh);
        
        this.history.pushState(this.terrain.cloneHeightMap());
    }

    setupLOD() {
        this.terrainLOD = new TerrainLOD(this.terrain, this.terrainSize, this.terrainResolution);
        const lodGroup = this.terrainLOD.generateBlocks();
        this.scene.add(lodGroup);
    }

    setupWater() {
        this.water = new WaterSystem(this.terrainSize * 1.5);
        const waterMesh = this.water.createMesh();
        this.scene.add(waterMesh);
    }

    setupVegetation() {
        this.vegetation = new VegetationSystem(this.terrain, this.terrainSize);
        this.vegetation.generate();
        this.vegetation.addToScene(this.scene);
    }

    setupAtmosphere() {
        this.atmosphere = new AtmosphereSystem();
        this.atmosphere.addToScene(this.scene);
        this.atmosphere.update();
        
        this.updateFog();
    }

    setupExporter() {
        this.exporter = new Exporter(this.terrain, this.terrainSize);
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseLeave(e));
        this.canvas.addEventListener('wheel', (e) => { e.stopPropagation(); }, { passive: false });
    }

    setupUI() {
        document.querySelectorAll('.section-title').forEach(title => {
            title.addEventListener('click', () => {
                const section = title.dataset.section;
                const content = document.getElementById(`${section}-panel`);
                const arrow = title.querySelector('.arrow');
                
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    arrow.textContent = '▼';
                } else {
                    content.style.display = 'none';
                    arrow.textContent = '▶';
                }
            });
        });

        document.getElementById('noise-type').addEventListener('change', (e) => {
            this.terrain.params.noiseType = e.target.value;
        });

        this.setupSlider('octaves', (val) => {
            this.terrain.params.octaves = parseInt(val);
        });

        this.setupSlider('frequency', (val) => {
            this.terrain.params.frequency = parseFloat(val);
        });

        this.setupSlider('amplitude', (val) => {
            this.terrain.params.amplitude = parseFloat(val);
        });

        this.setupSlider('lacunarity', (val) => {
            this.terrain.params.lacunarity = parseFloat(val);
        });

        this.setupSlider('persistence', (val) => {
            this.terrain.params.persistence = parseFloat(val);
        });

        document.getElementById('seed').addEventListener('change', (e) => {
            this.terrain.params.seed = parseInt(e.target.value) || 0;
        });

        document.getElementById('random-seed').addEventListener('click', () => {
            const randomSeed = Math.floor(Math.random() * 100000);
            document.getElementById('seed').value = randomSeed;
            this.terrain.params.seed = randomSeed;
        });

        document.getElementById('regenerate').addEventListener('click', () => {
            this.regenerateTerrain();
        });

        document.querySelectorAll('.brush-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.brush-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentBrush = btn.dataset.brush;
                
                const flattenGroup = document.getElementById('flatten-height-group');
                flattenGroup.style.display = this.currentBrush === 'flatten' ? 'block' : 'none';
            });
        });

        this.setupSlider('brush-size', (val) => {
            this.brushSize = parseFloat(val);
        });

        this.setupSlider('brush-strength', (val) => {
            this.brushStrength = parseFloat(val);
        });

        this.setupSlider('flatten-height', (val) => {
            this.flattenHeight = parseFloat(val);
        });

        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.redo());

        this.setupSlider('grass-height', (val) => {
            this.terrain.textureParams.grassHeight = parseFloat(val);
            this.terrain.updateTextureParams();
        });

        this.setupSlider('rock-slope', (val) => {
            this.terrain.textureParams.rockSlope = parseFloat(val);
            this.terrain.updateTextureParams();
        });

        this.setupSlider('snow-height', (val) => {
            this.terrain.textureParams.snowHeight = parseFloat(val);
            this.terrain.updateTextureParams();
        });

        this.setupSlider('sand-height', (val) => {
            this.terrain.textureParams.sandHeight = parseFloat(val);
            this.terrain.updateTextureParams();
        });

        this.setupSlider('blend-range', (val) => {
            this.terrain.textureParams.blendRange = parseFloat(val);
            this.terrain.updateTextureParams();
        });

        document.getElementById('water-enabled').addEventListener('change', (e) => {
            this.water.params.enabled = e.target.checked;
            this.water.setVisible(e.target.checked);
        });

        this.setupSlider('water-level', (val) => {
            this.water.params.level = parseFloat(val);
            this.water.updateLevel();
        });

        this.setupSlider('wave-strength', (val) => {
            this.water.params.waveStrength = parseFloat(val);
        });

        this.setupSlider('water-opacity', (val) => {
            this.water.params.opacity = parseFloat(val);
        });

        document.getElementById('vegetation-enabled').addEventListener('change', (e) => {
            this.vegetation.params.enabled = e.target.checked;
            this.vegetation.setVisible(e.target.checked);
        });

        this.setupSlider('tree-density', (val) => {
            this.vegetation.params.treeDensity = parseFloat(val);
        });

        this.setupSlider('grass-density', (val) => {
            this.vegetation.params.grassDensity = parseFloat(val);
        });

        this.setupSlider('veg-max-height', (val) => {
            this.vegetation.params.maxHeight = parseFloat(val);
        });

        this.setupSlider('veg-max-slope', (val) => {
            this.vegetation.params.maxSlope = parseFloat(val);
        });

        document.getElementById('regenerate-veg').addEventListener('click', () => {
            this.vegetation.removeFromScene(this.scene);
            this.vegetation.generate();
            this.vegetation.addToScene(this.scene);
        });

        this.setupSlider('time-slider', (val) => {
            this.atmosphere.params.time = parseFloat(val);
            const hours = Math.floor(val);
            const minutes = Math.floor((val % 1) * 60);
            document.getElementById('time-value').textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            this.atmosphere.update();
            this.updateFog();
            this.updateSunDirection();
            this.updateWaterSkyColor();
        });

        this.setupSlider('fog-density', (val) => {
            this.atmosphere.params.fogDensity = parseFloat(val);
            this.updateFog();
        });

        this.setupSlider('sun-intensity', (val) => {
            this.atmosphere.params.sunIntensity = parseFloat(val);
            this.atmosphere.updateLighting();
        });

        document.getElementById('lod-enabled').addEventListener('change', (e) => {
            this.terrainLOD.enabled = e.target.checked;
            this.terrain.mesh.visible = !e.target.checked;
        });

        this.setupSlider('lod-distance', (val) => {
            const dist = parseFloat(val);
            this.terrainLOD.lodDistances = [dist * 0.5, dist, dist * 1.75, dist * 2.5];
        });

        document.getElementById('export-heightmap').addEventListener('click', () => {
            const resolution = parseInt(document.getElementById('export-resolution').value);
            this.exporter.exportHeightMap(resolution);
        });

        document.getElementById('export-obj').addEventListener('click', () => {
            this.exporter.exportOBJ();
        });

        document.getElementById('save-preset').addEventListener('click', () => {
            this.showSavePresetDialog();
        });

        document.getElementById('create-snapshot').addEventListener('click', () => {
            this.showCreateSnapshotDialog();
        });

        document.getElementById('compare-enabled').addEventListener('change', (e) => {
            this.toggleCompareMode(e.target.checked);
        });

        document.getElementById('compare-snapshot').addEventListener('change', (e) => {
            this.setCompareSnapshot(e.target.value);
        });

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') {
                    e.preventDefault();
                    this.undo();
                } else if (e.key === 'y') {
                    e.preventDefault();
                    this.redo();
                }
            }
        });
    }

    setupSlider(id, callback) {
        const slider = document.getElementById(id);
        const valueSpan = document.getElementById(`${id}-value`);
        
        slider.addEventListener('input', () => {
            if (valueSpan) {
                valueSpan.textContent = slider.value;
            }
            callback(slider.value);
        });
    }

    syncUIWithParams() {
        document.getElementById('noise-type').value = this.terrain.params.noiseType;
        
        document.getElementById('octaves').value = this.terrain.params.octaves;
        document.getElementById('octaves-value').textContent = this.terrain.params.octaves;
        
        document.getElementById('frequency').value = this.terrain.params.frequency;
        document.getElementById('frequency-value').textContent = this.terrain.params.frequency;
        
        document.getElementById('amplitude').value = this.terrain.params.amplitude;
        document.getElementById('amplitude-value').textContent = this.terrain.params.amplitude;
        
        document.getElementById('lacunarity').value = this.terrain.params.lacunarity;
        document.getElementById('lacunarity-value').textContent = this.terrain.params.lacunarity;
        
        document.getElementById('persistence').value = this.terrain.params.persistence;
        document.getElementById('persistence-value').textContent = this.terrain.params.persistence;
        
        document.getElementById('seed').value = this.terrain.params.seed;
        
        document.getElementById('grass-height').value = this.terrain.textureParams.grassHeight;
        document.getElementById('grass-height-value').textContent = this.terrain.textureParams.grassHeight;
        
        document.getElementById('rock-slope').value = this.terrain.textureParams.rockSlope;
        document.getElementById('rock-slope-value').textContent = this.terrain.textureParams.rockSlope;
        
        document.getElementById('snow-height').value = this.terrain.textureParams.snowHeight;
        document.getElementById('snow-height-value').textContent = this.terrain.textureParams.snowHeight;
        
        document.getElementById('sand-height').value = this.terrain.textureParams.sandHeight;
        document.getElementById('sand-height-value').textContent = this.terrain.textureParams.sandHeight;
        
        document.getElementById('blend-range').value = this.terrain.textureParams.blendRange;
        document.getElementById('blend-range-value').textContent = this.terrain.textureParams.blendRange;
        
        document.getElementById('water-enabled').checked = this.water.params.enabled;
        
        document.getElementById('water-level').value = this.water.params.level;
        document.getElementById('water-level-value').textContent = this.water.params.level;
        
        document.getElementById('wave-strength').value = this.water.params.waveStrength;
        document.getElementById('wave-strength-value').textContent = this.water.params.waveStrength;
        
        document.getElementById('water-opacity').value = this.water.params.opacity;
        document.getElementById('water-opacity-value').textContent = this.water.params.opacity;
        
        document.getElementById('vegetation-enabled').checked = this.vegetation.params.enabled;
        
        document.getElementById('tree-density').value = this.vegetation.params.treeDensity;
        document.getElementById('tree-density-value').textContent = this.vegetation.params.treeDensity;
        
        document.getElementById('grass-density').value = this.vegetation.params.grassDensity;
        document.getElementById('grass-density-value').textContent = this.vegetation.params.grassDensity;
        
        document.getElementById('veg-max-height').value = this.vegetation.params.maxHeight;
        document.getElementById('veg-max-height-value').textContent = this.vegetation.params.maxHeight;
        
        document.getElementById('veg-max-slope').value = this.vegetation.params.maxSlope;
        document.getElementById('veg-max-slope-value').textContent = this.vegetation.params.maxSlope;
        
        const timeVal = this.atmosphere.params.time;
        document.getElementById('time-slider').value = timeVal;
        const hours = Math.floor(timeVal);
        const minutes = Math.floor((timeVal % 1) * 60);
        document.getElementById('time-value').textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        document.getElementById('fog-density').value = this.atmosphere.params.fogDensity;
        document.getElementById('fog-density-value').textContent = this.atmosphere.params.fogDensity;
        
        document.getElementById('sun-intensity').value = this.atmosphere.params.sunIntensity;
        document.getElementById('sun-intensity-value').textContent = this.atmosphere.params.sunIntensity;
    }

    updateFog() {
        const fogParams = this.atmosphere.getFogParams();
        this.scene.fog = new THREE.FogExp2(fogParams.color, fogParams.density);
        this.water.setFog(fogParams.density, fogParams.color);
    }

    updateSunDirection() {
        const sunDir = this.atmosphere.getSunDirection();
        if (this.terrain.material) {
            this.terrain.material.uniforms.uSunDirection.value.copy(sunDir);
        }
        this.terrainLOD.setSunDirection(sunDir);
        this.water.setSunDirection(sunDir);
    }

    updateWaterSkyColor() {
        const time = this.atmosphere.params.time;
        let skyColor = new THREE.Color(0x64b5f6);
        let horizonColor = new THREE.Color(0x90caf9);
        
        if (time < 6 || time > 20) {
            skyColor.setHex(0x1a237e);
            horizonColor.setHex(0x283593);
        } else if (time >= 6 && time < 8) {
            const t = (time - 6) / 2;
            skyColor.lerpColors(new THREE.Color(0xff8a65), new THREE.Color(0x64b5f6), t);
            horizonColor.lerpColors(new THREE.Color(0xffab91), new THREE.Color(0x90caf9), t);
        } else if (time >= 17 && time < 20) {
            const t = (time - 17) / 3;
            skyColor.lerpColors(new THREE.Color(0x64b5f6), new THREE.Color(0xff8a65), t);
            horizonColor.lerpColors(new THREE.Color(0x90caf9), new THREE.Color(0xffab91), t);
        }
        
        this.water.setSkyColor(skyColor, horizonColor);
    }

    regenerateTerrain() {
        this.terrain.regenerate();
        this.terrainLOD.updateAllHeights();
        this.history.clear();
        this.history.pushState(this.terrain.cloneHeightMap());
        
        if (this.vegetation.params.enabled) {
            this.vegetation.removeFromScene(this.scene);
            this.vegetation.generate();
            this.vegetation.addToScene(this.scene);
        }
    }

    renderPresets() {
        const { builtin, custom } = this.presetManager.getAllPresets();
        
        const builtinContainer = document.getElementById('builtin-presets');
        builtinContainer.innerHTML = '';
        
        builtin.forEach(preset => {
            const btn = document.createElement('button');
            btn.className = 'preset-btn';
            btn.textContent = preset.name;
            btn.title = preset.description;
            btn.addEventListener('click', () => this.applyPreset(preset.id));
            builtinContainer.appendChild(btn);
        });
        
        const customContainer = document.getElementById('custom-presets');
        customContainer.innerHTML = '';
        
        if (custom.length === 0) {
            customContainer.innerHTML = '<div class="empty-state">暂无自定义预设</div>';
        } else {
            custom.forEach(preset => {
                const item = document.createElement('div');
                item.className = 'preset-item';
                item.innerHTML = `
                    <span class="preset-item-name">${preset.name}</span>
                    <div class="preset-item-actions">
                        <button data-action="rename" title="重命名">✏️</button>
                        <button data-action="delete" title="删除">🗑️</button>
                    </div>
                `;
                item.addEventListener('click', (e) => {
                    if (e.target.tagName !== 'BUTTON') {
                        this.applyPreset(preset.id);
                    }
                });
                item.querySelector('[data-action="rename"]').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showRenamePresetDialog(preset.id);
                });
                item.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deletePreset(preset.id);
                });
                customContainer.appendChild(item);
            });
        }
    }

    applyPreset(presetId) {
        const preset = this.presetManager.getPresetById(presetId);
        if (!preset) return;
        
        this.presetManager.applyPreset(preset, this);
        
        this.terrain.updateTextureParams();
        this.water.setVisible(this.water.params.enabled);
        this.water.updateLevel();
        this.vegetation.setVisible(this.vegetation.params.enabled);
        this.atmosphere.update();
        this.updateFog();
        this.updateSunDirection();
        this.updateWaterSkyColor();
        
        this.syncUIWithParams();
        this.regenerateTerrain();
    }

    showSavePresetDialog() {
        this.showModal({
            title: '保存预设',
            placeholder: '请输入预设名称',
            defaultValue: '',
            onConfirm: (name) => {
                if (name && name.trim()) {
                    const state = this.presetManager.extractCurrentState(this);
                    this.presetManager.createCustomPreset(name.trim(), state);
                    this.renderPresets();
                }
            }
        });
    }

    showRenamePresetDialog(presetId) {
        const preset = this.presetManager.getPresetById(presetId);
        if (!preset) return;
        
        this.showModal({
            title: '重命名预设',
            placeholder: '请输入新名称',
            defaultValue: preset.name,
            onConfirm: (name) => {
                if (name && name.trim()) {
                    this.presetManager.renameCustomPreset(presetId, name.trim());
                    this.renderPresets();
                }
            }
        });
    }

    deletePreset(presetId) {
        if (confirm('确定要删除这个预设吗？')) {
            this.presetManager.deleteCustomPreset(presetId);
            this.renderPresets();
        }
    }

    renderSnapshots() {
        const snapshots = this.snapshotManager.getSnapshots();
        const container = document.getElementById('snapshot-list');
        container.innerHTML = '';
        
        if (snapshots.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无快照，点击上方按钮创建</div>';
        } else {
            snapshots.forEach(snapshot => {
                const item = document.createElement('div');
                item.className = 'snapshot-item';
                if (snapshot.id === this.compareSnapshotId) {
                    item.classList.add('selected');
                }
                item.innerHTML = `
                    <img class="snapshot-thumbnail" src="${snapshot.thumbnail || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}" alt="缩略图">
                    <div class="snapshot-info">
                        <div class="snapshot-name">${snapshot.name}</div>
                        <div class="snapshot-time">${this.snapshotManager.formatTime(snapshot.createdAt)}</div>
                    </div>
                    <div class="snapshot-actions">
                        <button data-action="rename" title="重命名">✏️</button>
                        <button data-action="delete" title="删除">🗑️</button>
                    </div>
                `;
                item.addEventListener('click', (e) => {
                    if (e.target.tagName !== 'BUTTON') {
                        this.restoreSnapshot(snapshot.id);
                    }
                });
                item.querySelector('[data-action="rename"]').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showRenameSnapshotDialog(snapshot.id);
                });
                item.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteSnapshot(snapshot.id);
                });
                container.appendChild(item);
            });
        }
        
        this.updateCompareSnapshotOptions();
    }

    updateCompareSnapshotOptions() {
        const select = document.getElementById('compare-snapshot');
        const currentValue = select.value;
        select.innerHTML = '<option value="">-- 请选择快照 --</option>';
        
        const snapshots = this.snapshotManager.getSnapshots();
        snapshots.forEach(snapshot => {
            const option = document.createElement('option');
            option.value = snapshot.id;
            option.textContent = snapshot.name;
            select.appendChild(option);
        });
        
        select.value = currentValue;
    }

    showCreateSnapshotDialog() {
        this.showModal({
            title: '创建快照',
            placeholder: '请输入快照名称',
            defaultValue: `快照 ${this.snapshotManager.getSnapshots().length + 1}`,
            onConfirm: (name) => {
                this.renderer.render(this.scene, this.camera);
                requestAnimationFrame(() => {
                    this.renderer.render(this.scene, this.camera);
                    this.snapshotManager.createSnapshot(this, name || undefined);
                    this.renderSnapshots();
                });
            }
        });
    }

    showRenameSnapshotDialog(snapshotId) {
        const snapshot = this.snapshotManager.getSnapshotById(snapshotId);
        if (!snapshot) return;
        
        this.showModal({
            title: '重命名快照',
            placeholder: '请输入新名称',
            defaultValue: snapshot.name,
            onConfirm: (name) => {
                if (name && name.trim()) {
                    this.snapshotManager.renameSnapshot(snapshotId, name.trim());
                    this.renderSnapshots();
                }
            }
        });
    }

    restoreSnapshot(snapshotId) {
        const snapshot = this.snapshotManager.getSnapshotById(snapshotId);
        if (!snapshot) return;
        
        this.snapshotManager.restoreSnapshot(snapshot, this);
        this.syncUIWithParams();
    }

    deleteSnapshot(snapshotId) {
        if (confirm('确定要删除这个快照吗？')) {
            if (this.compareSnapshotId === snapshotId) {
                this.compareSnapshotId = null;
                document.getElementById('compare-snapshot').value = '';
                if (this.compareMode) {
                    this.toggleCompareMode(false);
                    document.getElementById('compare-enabled').checked = false;
                }
            }
            this.snapshotManager.deleteSnapshot(snapshotId);
            this.renderSnapshots();
        }
    }

    toggleCompareMode(enabled) {
        this.compareMode = enabled;
        const viewport = document.getElementById('viewport');
        const statusRight = document.getElementById('status-right');
        
        if (enabled) {
            viewport.classList.add('compare-mode');
            statusRight.style.display = 'flex';
            document.getElementById('compare-divider').style.display = 'block';
            this.canvasCompare.style.display = 'block';
            
            if (!this.compareSnapshotId) {
                const snapshots = this.snapshotManager.getSnapshots();
                if (snapshots.length > 0) {
                    this.setCompareSnapshot(snapshots[0].id);
                }
            }
            
            this.onResize();
        } else {
            viewport.classList.remove('compare-mode');
            statusRight.style.display = 'none';
            document.getElementById('compare-divider').style.display = 'none';
            this.canvasCompare.style.display = 'none';
        }
    }

    setCompareSnapshot(snapshotId) {
        this.compareSnapshotId = snapshotId;
        document.getElementById('compare-snapshot').value = snapshotId;
        this.renderSnapshots();
        
        if (snapshotId) {
            this.loadCompareScene(snapshotId);
        }
    }

    loadCompareScene(snapshotId) {
        const snapshot = this.snapshotManager.getSnapshotById(snapshotId);
        if (!snapshot) return;
        
        while (this.compareScene.children.length > 0) {
            this.compareScene.remove(this.compareScene.children[0]);
        }
        
        const terrainGenerator = new TerrainGenerator(this.terrainSize, this.terrainResolution);
        Object.assign(terrainGenerator.params, snapshot.params.terrainParams);
        Object.assign(terrainGenerator.textureParams, snapshot.params.textureParams);
        
        if (snapshot.heightMapData) {
            const heightMap = new Float32Array(snapshot.heightMapData);
            terrainGenerator.heightMap = heightMap;
        }
        
        const terrainMesh = terrainGenerator.createMesh();
        this.compareScene.add(terrainMesh);
        this.compareTerrain = terrainGenerator;
        
        const waterSystem = new WaterSystem(this.terrainSize * 1.5);
        Object.assign(waterSystem.params, snapshot.params.waterParams);
        const waterMesh = waterSystem.createMesh();
        waterSystem.setVisible(waterSystem.params.enabled);
        waterSystem.updateLevel();
        this.compareScene.add(waterMesh);
        this.compareWater = waterSystem;
        
        const vegSystem = new VegetationSystem(terrainGenerator, this.terrainSize);
        Object.assign(vegSystem.params, snapshot.params.vegetationParams);
        if (vegSystem.params.enabled) {
            vegSystem.generate();
            vegSystem.addToScene(this.compareScene);
        }
        this.compareVegetation = vegSystem;
        
        const atmoSystem = new AtmosphereSystem();
        Object.assign(atmoSystem.params, snapshot.params.atmosphereParams);
        atmoSystem.addToScene(this.compareScene);
        atmoSystem.update();
        
        const fogParams = atmoSystem.getFogParams();
        this.compareScene.fog = new THREE.FogExp2(fogParams.color, fogParams.density);
        waterSystem.setFog(fogParams.density, fogParams.color);
        
        this.compareAtmosphere = atmoSystem;
        
        const sunDir = atmoSystem.getSunDirection();
        if (terrainGenerator.material) {
            terrainGenerator.material.uniforms.uSunDirection.value.copy(sunDir);
        }
        waterSystem.setSunDirection(sunDir);
        
        const time = atmoSystem.params.time;
        let skyColor = new THREE.Color(0x64b5f6);
        let horizonColor = new THREE.Color(0x90caf9);
        if (time < 6 || time > 20) {
            skyColor.setHex(0x1a237e);
            horizonColor.setHex(0x283593);
        } else if (time >= 6 && time < 8) {
            const t = (time - 6) / 2;
            skyColor.lerpColors(new THREE.Color(0xff8a65), new THREE.Color(0x64b5f6), t);
            horizonColor.lerpColors(new THREE.Color(0xffab91), new THREE.Color(0x90caf9), t);
        } else if (time >= 17 && time < 20) {
            const t = (time - 17) / 3;
            skyColor.lerpColors(new THREE.Color(0x64b5f6), new THREE.Color(0xff8a65), t);
            horizonColor.lerpColors(new THREE.Color(0x90caf9), new THREE.Color(0xffab91), t);
        }
        waterSystem.setSkyColor(skyColor, horizonColor);
    }

    showModal({ title, placeholder, defaultValue, onConfirm }) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal">
                <div class="modal-header">${title}</div>
                <div class="modal-body">
                    <input type="text" placeholder="${placeholder}" value="${defaultValue || ''}" autofocus>
                </div>
                <div class="modal-footer">
                    <button class="cancel-btn">取消</button>
                    <button class="primary-btn">确定</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        const input = overlay.querySelector('input');
        input.focus();
        input.select();
        
        overlay.querySelector('.cancel-btn').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
        
        overlay.querySelector('.primary-btn').addEventListener('click', () => {
            const value = input.value;
            document.body.removeChild(overlay);
            onConfirm(value);
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const value = input.value;
                document.body.removeChild(overlay);
                onConfirm(value);
            } else if (e.key === 'Escape') {
                document.body.removeChild(overlay);
            }
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });
    }

    setupLayers() {
        this.terrain.layerManager.addChangeListener(() => {
            this.terrain.updateGeometryFromHeightMap();
            this.renderLayers();
        });

        document.getElementById('add-layer-blank').addEventListener('click', () => {
            const name = `图层 ${this.terrain.layerManager.layers.length + 1}`;
            this.terrain.layerManager.createLayer(name);
            this.history.pushState(this.terrain.cloneHeightMap());
        });

        document.getElementById('add-layer-copy').addEventListener('click', () => {
            const activeLayer = this.terrain.layerManager.getActiveLayer();
            if (activeLayer) {
                this.terrain.layerManager.duplicateLayer(activeLayer.id);
                this.history.pushState(this.terrain.cloneHeightMap());
            }
        });
    }

    renderLayers() {
        const container = document.getElementById('layer-list');
        const layers = this.terrain.layerManager.layers.slice().reverse();
        container.innerHTML = '';

        if (layers.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无图层</div>';
            return;
        }

        layers.forEach(layer => {
            const isActive = layer.id === this.terrain.layerManager.activeLayerId;
            const item = document.createElement('div');
            item.className = `layer-item ${isActive ? 'active' : ''} ${layer.locked ? 'locked' : ''} ${!layer.visible ? 'hidden-layer' : ''}`;
            item.dataset.layerId = layer.id;
            
            const thumbnail = layer.generateThumbnail(36);
            
            item.innerHTML = `
                <div class="layer-item-header">
                    <img class="layer-thumbnail" src="${thumbnail}" alt="缩略图">
                    <span class="layer-name" title="${layer.name}">${layer.name}</span>
                    <button class="layer-visibility-btn" title="${layer.visible ? '隐藏' : '显示'}">${layer.visible ? '👁️' : '👁️‍🗨️'}</button>
                    <button class="layer-lock-btn" title="${layer.locked ? '解锁' : '锁定'}">${layer.locked ? '🔒' : '🔓'}</button>
                </div>
                <div class="layer-controls-row">
                    <button data-action="up">⬆️</button>
                    <button data-action="down">⬇️</button>
                    <button data-action="merge">⬇️合并</button>
                    <button data-action="delete">🗑️</button>
                </div>
                <div class="layer-opacity">
                    <label>不透明度: <span class="opacity-value">${layer.opacity.toFixed(2)}</span></label>
                    <input type="range" class="layer-opacity-slider" min="0" max="1" step="0.01" value="${layer.opacity}">
                </div>
                <div class="layer-blend-mode">
                    <label>混合模式</label>
                    <select class="layer-blend-select">
                        <option value="add" ${layer.blendMode === 'add' ? 'selected' : ''}>叠加</option>
                        <option value="max" ${layer.blendMode === 'max' ? 'selected' : ''}>最大值</option>
                        <option value="min" ${layer.blendMode === 'min' ? 'selected' : ''}>最小值</option>
                        <option value="multiply" ${layer.blendMode === 'multiply' ? 'selected' : ''}>乘法</option>
                        <option value="difference" ${layer.blendMode === 'difference' ? 'selected' : ''}>差值</option>
                    </select>
                </div>
            `;

            item.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
                    this.terrain.layerManager.setActiveLayer(layer.id);
                }
            });

            item.querySelector('.layer-visibility-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                layer.visible = !layer.visible;
                this.terrain.layerManager._notifyChanged();
            });

            item.querySelector('.layer-lock-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                layer.locked = !layer.locked;
                this.renderLayers();
            });

            item.querySelector('[data-action="up"]').addEventListener('click', (e) => {
                e.stopPropagation();
                this.terrain.layerManager.moveLayer(layer.id, 'up');
                this.history.pushState(this.terrain.cloneHeightMap());
            });

            item.querySelector('[data-action="down"]').addEventListener('click', (e) => {
                e.stopPropagation();
                this.terrain.layerManager.moveLayer(layer.id, 'down');
                this.history.pushState(this.terrain.cloneHeightMap());
            });

            item.querySelector('[data-action="merge"]').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('确定要向下合并吗？')) {
                    this.terrain.layerManager.mergeDown(layer.id);
                    this.history.pushState(this.terrain.cloneHeightMap());
                }
            });

            item.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.terrain.layerManager.layers.length <= 1) {
                    alert('至少保留一个图层');
                    return;
                }
                if (confirm('确定要删除这个图层吗？')) {
                    this.terrain.layerManager.deleteLayer(layer.id);
                    this.history.pushState(this.terrain.cloneHeightMap());
                }
            });

            item.querySelector('.layer-opacity-slider').addEventListener('input', (e) => {
                layer.opacity = parseFloat(e.target.value);
                item.querySelector('.opacity-value').textContent = layer.opacity.toFixed(2);
                this.terrain.layerManager._notifyChanged();
            });

            item.querySelector('.layer-blend-select').addEventListener('change', (e) => {
                layer.blendMode = e.target.value;
                this.terrain.layerManager._notifyChanged();
                this.history.pushState(this.terrain.cloneHeightMap());
            });

            container.appendChild(item);
        });
    }

    setupMacros() {
        document.getElementById('macro-record').addEventListener('click', () => {
            this.startMacroRecording();
        });

        document.getElementById('macro-stop').addEventListener('click', () => {
            this.stopMacroRecording();
        });

        document.getElementById('macro-speed').addEventListener('change', (e) => {
            this.macroManager.setPlaybackSpeed(parseFloat(e.target.value));
        });

        this.setupSlider('macro-offsetx', (val) => {
            this.macroManager.transform.offsetX = parseFloat(val);
        });

        this.setupSlider('macro-offsetz', (val) => {
            this.macroManager.transform.offsetZ = parseFloat(val);
        });

        this.setupSlider('macro-rotation', (val) => {
            this.macroManager.transform.rotation = parseFloat(val);
        });

        document.getElementById('macro-play').addEventListener('click', () => {
            if (this.currentSelectedMacro) {
                this.playMacro(this.currentSelectedMacro);
            }
        });

        document.getElementById('macro-pause').addEventListener('click', () => {
            if (this.macroManager.isPaused) {
                this.macroManager.resumePlayback();
            } else {
                this.macroManager.pausePlayback();
            }
        });

        document.getElementById('macro-stop-playback').addEventListener('click', () => {
            this.macroManager.stopPlayback();
        });

        this.macroManager.on('recordingStarted', () => {
            document.getElementById('macro-record').disabled = true;
            document.getElementById('macro-record').classList.add('recording');
            document.getElementById('macro-stop').disabled = false;
        });

        this.macroManager.on('recordingStopped', (macro) => {
            document.getElementById('macro-record').disabled = false;
            document.getElementById('macro-record').classList.remove('recording');
            document.getElementById('macro-stop').disabled = true;
            
            if (macro && macro.operations.length > 0) {
                this.showModal({
                    title: '保存宏',
                    placeholder: '请输入宏名称',
                    defaultValue: `宏 ${this.macroManager.getMacros().length + 1}`,
                    onConfirm: (name) => {
                        if (name && name.trim()) {
                            this.macroManager.saveMacro(macro, name.trim());
                            this.renderMacros();
                        }
                    }
                });
            }
        });

        this.macroManager.on('playbackStarted', () => {
            document.getElementById('macro-play').disabled = true;
            document.getElementById('macro-pause').disabled = false;
            document.getElementById('macro-stop-playback').disabled = false;
        });

        this.macroManager.on('playbackPaused', () => {
            document.getElementById('macro-pause').textContent = '▶️ 继续';
        });

        this.macroManager.on('playbackResumed', () => {
            document.getElementById('macro-pause').textContent = '⏸️ 暂停';
        });

        this.macroManager.on('playbackFinished', () => {
            document.getElementById('macro-play').disabled = false;
            document.getElementById('macro-pause').disabled = true;
            document.getElementById('macro-stop-playback').disabled = true;
            document.getElementById('macro-pause').textContent = '⏸️ 暂停';
            this.brushIndicator.classList.remove('visible');
        });

        this.macroManager.on('playbackStopped', () => {
            document.getElementById('macro-play').disabled = false;
            document.getElementById('macro-pause').disabled = true;
            document.getElementById('macro-stop-playback').disabled = true;
            document.getElementById('macro-pause').textContent = '⏸️ 暂停';
            this.brushIndicator.classList.remove('visible');
        });

        this.macroManager.on('playbackProgress', (data) => {
            const worldX = (data.x - 0.5) * this.terrainSize;
            const worldZ = (data.z - 0.5) * this.terrainSize;
            const pos = new THREE.Vector3(worldX, 0, worldZ);
            
            const screenPos = this.worldToScreen(pos);
            this.brushIndicator.classList.add('visible');
            this.brushIndicator.style.left = screenPos.x + 'px';
            this.brushIndicator.style.top = screenPos.y + 'px';
        });
    }

    startMacroRecording() {
        this.macroManager.startRecording();
    }

    stopMacroRecording() {
        this.macroManager.stopRecording();
    }

    recordBrushOperation(brushType, x, z, size, strength, flattenHeight) {
        const normalizedX = (x + this.terrainSize / 2) / this.terrainSize;
        const normalizedZ = (z + this.terrainSize / 2) / this.terrainSize;
        this.macroManager.recordOperation(brushType, normalizedX, normalizedZ, size, strength, flattenHeight);
    }

    playMacro(macro) {
        this.history.pushState(this.terrain.cloneHeightMap());
        
        this.macroManager.playMacro(macro, (brushType, normX, normZ, size, strength, flattenHeight) => {
            const worldX = (normX - 0.5) * this.terrainSize;
            const worldZ = (normZ - 0.5) * this.terrainSize;
            this.terrain.applyBrush(worldX, worldZ, brushType, size, strength, flattenHeight);
        });
    }

    renderMacros() {
        const container = document.getElementById('macro-list');
        const macros = this.macroManager.getMacros();
        container.innerHTML = '';

        if (macros.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无录制的宏</div>';
            return;
        }

        macros.forEach(macro => {
            const item = document.createElement('div');
            item.className = 'macro-item';
            if (this.currentSelectedMacro && this.currentSelectedMacro.id === macro.id) {
                item.style.borderColor = '#e94560';
                item.style.background = 'rgba(233, 69, 96, 0.2)';
            }
            
            const duration = macro.operations.length > 0 
                ? (macro.operations[macro.operations.length - 1].timestamp / 1000).toFixed(1) 
                : 0;
            
            item.innerHTML = `
                <div class="macro-info">
                    <div class="macro-name">${macro.name}</div>
                    <div class="macro-meta">${macro.operations.length} 步 · ${duration}秒</div>
                </div>
                <div class="macro-actions">
                    <button data-action="play" title="播放">▶️</button>
                    <button data-action="rename" title="重命名">✏️</button>
                    <button data-action="delete" title="删除">🗑️</button>
                </div>
            `;

            item.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON') {
                    this.currentSelectedMacro = macro;
                    document.getElementById('macro-playback').style.display = 'block';
                    this.renderMacros();
                }
            });

            item.querySelector('[data-action="play"]').addEventListener('click', (e) => {
                e.stopPropagation();
                this.currentSelectedMacro = macro;
                document.getElementById('macro-playback').style.display = 'block';
                this.playMacro(macro);
                this.renderMacros();
            });

            item.querySelector('[data-action="rename"]').addEventListener('click', (e) => {
                e.stopPropagation();
                this.showModal({
                    title: '重命名宏',
                    placeholder: '请输入新名称',
                    defaultValue: macro.name,
                    onConfirm: (name) => {
                        if (name && name.trim()) {
                            this.macroManager.renameMacro(macro.id, name.trim());
                            this.renderMacros();
                        }
                    }
                });
            });

            item.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('确定要删除这个宏吗？')) {
                    this.macroManager.deleteMacro(macro.id);
                    if (this.currentSelectedMacro && this.currentSelectedMacro.id === macro.id) {
                        this.currentSelectedMacro = null;
                        document.getElementById('macro-playback').style.display = 'none';
                    }
                    this.renderMacros();
                }
            });

            container.appendChild(item);
        });
    }

    onMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const indicatorPos = this.getTerrainMousePosition();
        if (indicatorPos) {
            this.brushIndicator.classList.add('visible');
            const screenPos = this.worldToScreen(indicatorPos);
            this.brushIndicator.style.left = screenPos.x + 'px';
            this.brushIndicator.style.top = screenPos.y + 'px';
            
            const sizeInPixels = this.getBrushSizeInPixels(indicatorPos);
            this.brushIndicator.style.width = sizeInPixels + 'px';
            this.brushIndicator.style.height = sizeInPixels + 'px';
            
            if (this.isBrushing) {
                this.applyBrush(indicatorPos);
            }
        } else {
            this.brushIndicator.classList.remove('visible');
        }
    }

    onMouseDown(event) {
        if (event.button !== 0) return;
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        if (this.compareMode) return;
        
        const pos = this.getTerrainMousePosition();
        if (pos) {
            this.isBrushing = true;
            this.controls.enabled = false;
            this.lastBrushPos = pos.clone();
            this.history.pushState(this.terrain.cloneHeightMap());
            this.applyBrush(pos);
        }
    }

    onMouseUp(event) {
        if (this.isBrushing) {
            this.isBrushing = false;
            this.controls.enabled = true;
            this.lastBrushPos = null;
            
            this.terrainLOD.updateAllHeights();
            
            if (this.vegetation.params.enabled) {
                this.vegetation.removeFromScene(this.scene);
                this.vegetation.generate();
                this.vegetation.addToScene(this.scene);
            }
        }
    }

    onMouseLeave(event) {
        this.brushIndicator.classList.remove('visible');
        if (this.isBrushing) {
            this.isBrushing = false;
            this.controls.enabled = true;
            this.lastBrushPos = null;
        }
    }

    getTerrainMousePosition() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        let targetMesh = this.terrainLOD.enabled ? this.terrainLOD.blockGroup : this.terrain.mesh;
        const intersects = this.raycaster.intersectObject(targetMesh, true);
        
        if (intersects.length > 0) {
            return intersects[0].point;
        }
        return null;
    }

    worldToScreen(position) {
        const vector = position.clone();
        vector.project(this.camera);
        
        const rect = this.viewport.getBoundingClientRect();
        return {
            x: (vector.x + 1) / 2 * rect.width,
            y: (-vector.y + 1) / 2 * rect.height
        };
    }

    getBrushSizeInPixels(worldPos) {
        const edgePos = worldPos.clone();
        edgePos.x += this.brushSize;
        
        const screen1 = this.worldToScreen(worldPos);
        const screen2 = this.worldToScreen(edgePos);
        
        return Math.abs(screen2.x - screen1.x) * 2;
    }

    applyBrush(position) {
        if (!this.lastBrushPos) {
            this.terrain.applyBrush(
                position.x, position.z,
                this.currentBrush,
                this.brushSize,
                this.brushStrength,
                this.flattenHeight
            );
            if (this.macroManager.isRecording) {
                this.recordBrushOperation(
                    this.currentBrush,
                    position.x, position.z,
                    this.brushSize,
                    this.brushStrength,
                    this.flattenHeight
                );
            }
            this.lastBrushPos = position.clone();
            return;
        }
        
        const dist = position.distanceTo(this.lastBrushPos);
        if (dist > 0.5) {
            const steps = Math.ceil(dist / 0.5);
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const interpolatedPos = new THREE.Vector3().lerpVectors(
                    this.lastBrushPos, position, t
                );
                this.terrain.applyBrush(
                    interpolatedPos.x, interpolatedPos.z,
                    this.currentBrush,
                    this.brushSize,
                    this.brushStrength,
                    this.flattenHeight
                );
                if (this.macroManager.isRecording) {
                    this.recordBrushOperation(
                        this.currentBrush,
                        interpolatedPos.x, interpolatedPos.z,
                        this.brushSize,
                        this.brushStrength,
                        this.flattenHeight
                    );
                }
            }
            this.lastBrushPos = position.clone();
        } else {
            this.terrain.applyBrush(
                position.x, position.z,
                this.currentBrush,
                this.brushSize,
                this.brushStrength,
                this.flattenHeight
            );
            if (this.macroManager.isRecording) {
                this.recordBrushOperation(
                    this.currentBrush,
                    position.x, position.z,
                    this.brushSize,
                    this.brushStrength,
                    this.flattenHeight
                );
            }
        }
    }

    undo() {
        const state = this.history.undo();
        if (state) {
            this.terrain.restoreHeightMap(state);
            this.terrainLOD.updateAllHeights();
        }
    }

    redo() {
        const state = this.history.redo();
        if (state) {
            this.terrain.restoreHeightMap(state);
            this.terrainLOD.updateAllHeights();
        }
    }

    onResize() {
        const width = this.viewport.clientWidth;
        const height = this.viewport.clientHeight;
        
        if (this.compareMode) {
            this.camera.aspect = (width / 2) / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width / 2, height);
            
            this.compareCamera.aspect = (width / 2) / height;
            this.compareCamera.updateProjectionMatrix();
            this.rendererCompare.setSize(width / 2, height);
        } else {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }
    }

    calculateGPUMemory() {
        let totalBytes = 0;
        
        if (this.terrainLOD.enabled) {
            totalBytes += this.terrainLOD.getMemoryUsage();
        } else {
            const geo = this.terrain.geometry;
            if (geo) {
                totalBytes += geo.attributes.position.array.byteLength;
                totalBytes += geo.attributes.normal.array.byteLength;
                totalBytes += geo.attributes.uv.array.byteLength;
                totalBytes += geo.index.array.byteLength;
            }
        }
        
        totalBytes += this.water.getMemoryUsage();
        totalBytes += this.vegetation.getMemoryUsage();
        
        const framebufferBytes = this.viewport.clientWidth * this.viewport.clientHeight * 4 * 4;
        totalBytes += framebufferBytes;
        
        return totalBytes;
    }

    formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    updatePerformanceStats(timestamp) {
        this.frameCount++;
        
        if (timestamp - this.lastFpsUpdate >= 1000) {
            this.currentFps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = timestamp;
            
            document.getElementById('fps-value').textContent = this.currentFps;
            
            let triangles, vertices;
            if (this.terrainLOD.enabled) {
                triangles = this.terrainLOD.getTriangleCount();
                vertices = this.terrainLOD.getVertexCount();
            } else {
                triangles = this.terrain.getTriangleCount();
                vertices = this.terrain.getVertexCount();
            }
            
            document.getElementById('triangles-value').textContent = triangles.toLocaleString();
            document.getElementById('vertices-value').textContent = vertices.toLocaleString();
            document.getElementById('vegetation-count-value').textContent = this.vegetation.getTotalCount().toLocaleString();
            
            const gpuMemory = this.calculateGPUMemory();
            document.getElementById('gpu-memory-value').textContent = this.formatBytes(gpuMemory);
        }
    }

    updateComparePerformanceStats(timestamp) {
        this.compareFrameCount++;
        
        if (timestamp - this.compareLastFpsUpdate >= 1000) {
            this.compareFps = this.compareFrameCount;
            this.compareFrameCount = 0;
            this.compareLastFpsUpdate = timestamp;
            
            document.getElementById('fps-value-compare').textContent = this.compareFps;
            
            if (this.compareTerrain) {
                const triangles = this.compareTerrain.getTriangleCount();
                const vertices = this.compareTerrain.getVertexCount();
                document.getElementById('triangles-value-compare').textContent = triangles.toLocaleString();
                document.getElementById('vertices-value-compare').textContent = vertices.toLocaleString();
                if (this.compareVegetation) {
                    document.getElementById('vegetation-count-value-compare').textContent = this.compareVegetation.getTotalCount().toLocaleString();
                }
            }
        }
    }

    animate(timestamp = 0) {
        requestAnimationFrame((t) => this.animate(t));
        
        const time = timestamp * 0.001;
        
        this.controls.update();
        
        if (this.compareMode && this.compareCamera) {
            this.compareCamera.position.copy(this.camera.position);
            this.compareCamera.quaternion.copy(this.camera.quaternion);
            this.compareCamera.updateProjectionMatrix();
            this.compareCamera.updateMatrixWorld();
        }
        
        this.water.update(time, this.camera);
        this.vegetation.update(time);
        
        if (this.terrain.material) {
            this.terrain.material.uniforms.uTime.value = time;
        }
        this.terrainLOD.updateTime(time);
        
        this.terrainLOD.update(this.camera);
        
        this.renderer.render(this.scene, this.camera);
        
        if (this.compareMode && this.compareScene) {
            if (this.compareWater) {
                this.compareWater.update(time, this.compareCamera);
            }
            if (this.compareVegetation) {
                this.compareVegetation.update(time);
            }
            if (this.compareTerrain && this.compareTerrain.material) {
                this.compareTerrain.material.uniforms.uTime.value = time;
            }
            this.rendererCompare.render(this.compareScene, this.compareCamera);
            this.updateComparePerformanceStats(timestamp);
        }
        
        this.updatePerformanceStats(timestamp);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new TerrainEditor();
});
