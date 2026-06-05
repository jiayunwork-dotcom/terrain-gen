import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import TerrainGenerator from './terrain.js';
import WaterSystem from './water.js';
import VegetationSystem from './vegetation.js';
import AtmosphereSystem from './atmosphere.js';
import HistoryManager from './history.js';
import Exporter from './exporter.js';

class TerrainEditor {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.viewport = document.getElementById('viewport');
        this.brushIndicator = document.getElementById('brush-indicator');
        
        this.terrainSize = 512;
        this.terrainResolution = 256;
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.terrain = null;
        this.water = null;
        this.vegetation = null;
        this.atmosphere = null;
        this.history = new HistoryManager();
        this.exporter = null;
        
        this.currentBrush = 'raise';
        this.brushSize = 10;
        this.brushStrength = 0.5;
        this.flattenHeight = 0;
        this.isBrushing = false;
        this.lastBrushPos = null;
        
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        this.currentFps = 60;
        
        this.init();
    }

    init() {
        this.setupScene();
        this.setupTerrain();
        this.setupWater();
        this.setupVegetation();
        this.setupAtmosphere();
        this.setupExporter();
        this.setupEventListeners();
        this.setupUI();
        
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
            antialias: true
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

    setupTerrain() {
        this.terrain = new TerrainGenerator(this.terrainSize, this.terrainResolution);
        const terrainMesh = this.terrain.createMesh();
        this.scene.add(terrainMesh);
        
        this.history.pushState(this.terrain.cloneHeightMap());
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
            this.terrain.regenerate();
            this.history.clear();
            this.history.pushState(this.terrain.cloneHeightMap());
            
            if (this.vegetation.params.enabled) {
                this.vegetation.removeFromScene(this.scene);
                this.vegetation.generate();
                this.vegetation.addToScene(this.scene);
            }
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
        });

        this.setupSlider('fog-density', (val) => {
            this.atmosphere.params.fogDensity = parseFloat(val);
            this.updateFog();
        });

        this.setupSlider('sun-intensity', (val) => {
            this.atmosphere.params.sunIntensity = parseFloat(val);
            this.atmosphere.updateLighting();
        });

        document.getElementById('export-heightmap').addEventListener('click', () => {
            const resolution = parseInt(document.getElementById('export-resolution').value);
            this.exporter.exportHeightMap(resolution);
        });

        document.getElementById('export-obj').addEventListener('click', () => {
            this.exporter.exportOBJ();
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
        this.water.setSunDirection(sunDir);
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
        const intersects = this.raycaster.intersectObject(this.terrain.mesh);
        
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
        }
    }

    undo() {
        const state = this.history.undo();
        if (state) {
            this.terrain.restoreHeightMap(state);
        }
    }

    redo() {
        const state = this.history.redo();
        if (state) {
            this.terrain.restoreHeightMap(state);
        }
    }

    onResize() {
        this.camera.aspect = this.viewport.clientWidth / this.viewport.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.viewport.clientWidth, this.viewport.clientHeight);
    }

    updatePerformanceStats(timestamp) {
        this.frameCount++;
        
        if (timestamp - this.lastFpsUpdate >= 1000) {
            this.currentFps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = timestamp;
            
            document.getElementById('fps-value').textContent = this.currentFps;
            document.getElementById('triangles-value').textContent = 
                this.terrain.getTriangleCount().toLocaleString();
            document.getElementById('vertices-value').textContent = 
                this.terrain.getVertexCount().toLocaleString();
            document.getElementById('vegetation-count-value').textContent = 
                this.vegetation.getTotalCount().toLocaleString();
        }
    }

    animate(timestamp = 0) {
        requestAnimationFrame((t) => this.animate(t));
        
        const time = timestamp * 0.001;
        
        this.controls.update();
        
        this.water.update(time, this.camera);
        
        if (this.terrain.material) {
            this.terrain.material.uniforms.uTime.value = time;
        }
        
        this.renderer.render(this.scene, this.camera);
        
        this.updatePerformanceStats(timestamp);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new TerrainEditor();
});
