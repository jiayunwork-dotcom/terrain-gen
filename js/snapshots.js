const STORAGE_KEY = 'terrain_generator_snapshots';
const MAX_SNAPSHOTS = 20;
const THUMBNAIL_SIZE = 128;

class SnapshotManager {
    constructor() {
        this.snapshots = this.loadSnapshots();
    }

    loadSnapshots() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            console.error('Failed to load snapshots:', e);
        }
        return [];
    }

    saveSnapshots() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshots));
        } catch (e) {
            console.error('Failed to save snapshots:', e);
            if (e.name === 'QuotaExceededError' || e.message.includes('quota')) {
                this.snapshots.pop();
                this.saveSnapshots();
            }
        }
    }

    createThumbnail(canvas) {
        try {
            if (!canvas || canvas.width === 0 || canvas.height === 0) {
                console.warn('Canvas is not ready for thumbnail');
                return this.createFallbackThumbnail();
            }
            
            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = THUMBNAIL_SIZE;
            offscreenCanvas.height = THUMBNAIL_SIZE;
            const ctx = offscreenCanvas.getContext('2d');
            
            ctx.fillStyle = '#1a237e';
            ctx.fillRect(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
            
            try {
                ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
            } catch (drawError) {
                console.warn('Could not draw image, using fallback:', drawError);
                return this.createFallbackThumbnail();
            }
            
            const dataUrl = offscreenCanvas.toDataURL('image/jpeg', 0.8);
            
            if (!dataUrl || dataUrl.length < 100) {
                console.warn('Generated thumbnail is too small, using fallback');
                return this.createFallbackThumbnail();
            }
            
            return dataUrl;
        } catch (e) {
            console.error('Failed to create thumbnail:', e);
            return this.createFallbackThumbnail();
        }
    }

    createFallbackThumbnail() {
        try {
            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = THUMBNAIL_SIZE;
            offscreenCanvas.height = THUMBNAIL_SIZE;
            const ctx = offscreenCanvas.getContext('2d');
            
            const gradient = ctx.createLinearGradient(0, 0, 0, THUMBNAIL_SIZE);
            gradient.addColorStop(0, '#4a90d9');
            gradient.addColorStop(0.5, '#66bb6a');
            gradient.addColorStop(1, '#8d6e63');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
            
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🏔️', THUMBNAIL_SIZE / 2, THUMBNAIL_SIZE / 2);
            
            return offscreenCanvas.toDataURL('image/jpeg', 0.8);
        } catch (e) {
            console.error('Failed to create fallback thumbnail:', e);
            return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        }
    }

    heightMapToArray(heightMap) {
        return Array.from(heightMap);
    }

    arrayToHeightMap(arr) {
        return new Float32Array(arr);
    }

    createSnapshot(editor, name) {
        const cameraState = {
            position: {
                x: editor.camera.position.x,
                y: editor.camera.position.y,
                z: editor.camera.position.z
            },
            rotation: {
                x: editor.camera.rotation.x,
                y: editor.camera.rotation.y,
                z: editor.camera.rotation.z
            },
            target: {
                x: editor.controls.target.x,
                y: editor.controls.target.y,
                z: editor.controls.target.z
            }
        };

        const heightMapData = this.heightMapToArray(editor.terrain.heightMap);

        const params = {
            terrainParams: { ...editor.terrain.params },
            textureParams: { ...editor.terrain.textureParams },
            waterParams: { ...editor.water.params },
            vegetationParams: { ...editor.vegetation.params },
            atmosphereParams: { ...editor.atmosphere.params }
        };

        const thumbnail = this.createThumbnail(editor.canvas);

        const snapshot = {
            id: 'snap_' + Date.now(),
            name: name || `快照 ${this.snapshots.length + 1}`,
            createdAt: Date.now(),
            cameraState,
            heightMapData,
            params,
            thumbnail
        };

        this.snapshots.unshift(snapshot);

        while (this.snapshots.length > MAX_SNAPSHOTS) {
            this.snapshots.pop();
        }

        this.saveSnapshots();
        return snapshot;
    }

    getSnapshots() {
        return this.snapshots;
    }

    getSnapshotById(id) {
        return this.snapshots.find(s => s.id === id);
    }

    restoreSnapshot(snapshot, editor) {
        if (!snapshot) return false;

        if (snapshot.cameraState) {
            editor.camera.position.set(
                snapshot.cameraState.position.x,
                snapshot.cameraState.position.y,
                snapshot.cameraState.position.z
            );
            editor.camera.rotation.set(
                snapshot.cameraState.rotation.x,
                snapshot.cameraState.rotation.y,
                snapshot.cameraState.rotation.z
            );
            editor.controls.target.set(
                snapshot.cameraState.target.x,
                snapshot.cameraState.target.y,
                snapshot.cameraState.target.z
            );
            editor.controls.update();
        }

        if (snapshot.heightMapData) {
            const heightMap = this.arrayToHeightMap(snapshot.heightMapData);
            editor.terrain.restoreHeightMap(heightMap);
            editor.terrainLOD.updateAllHeights();
        }

        if (snapshot.params) {
            if (snapshot.params.terrainParams) {
                Object.assign(editor.terrain.params, snapshot.params.terrainParams);
            }
            if (snapshot.params.textureParams) {
                Object.assign(editor.terrain.textureParams, snapshot.params.textureParams);
                editor.terrain.updateTextureParams();
            }
            if (snapshot.params.waterParams) {
                Object.assign(editor.water.params, snapshot.params.waterParams);
                editor.water.setVisible(editor.water.params.enabled);
                editor.water.updateLevel();
            }
            if (snapshot.params.vegetationParams) {
                Object.assign(editor.vegetation.params, snapshot.params.vegetationParams);
                editor.vegetation.setVisible(editor.vegetation.params.enabled);
                if (editor.vegetation.params.enabled) {
                    editor.vegetation.removeFromScene(editor.scene);
                    editor.vegetation.generate();
                    editor.vegetation.addToScene(editor.scene);
                }
            }
            if (snapshot.params.atmosphereParams) {
                Object.assign(editor.atmosphere.params, snapshot.params.atmosphereParams);
                editor.atmosphere.update();
                editor.updateFog();
                editor.updateSunDirection();
                editor.updateWaterSkyColor();
            }
        }

        editor.history.clear();
        editor.history.pushState(editor.terrain.cloneHeightMap());

        return true;
    }

    deleteSnapshot(id) {
        const index = this.snapshots.findIndex(s => s.id === id);
        if (index !== -1) {
            this.snapshots.splice(index, 1);
            this.saveSnapshots();
            return true;
        }
        return false;
    }

    renameSnapshot(id, newName) {
        const snapshot = this.snapshots.find(s => s.id === id);
        if (snapshot) {
            snapshot.name = newName;
            this.saveSnapshots();
            return true;
        }
        return false;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) {
            return '刚刚';
        } else if (diff < 3600000) {
            return Math.floor(diff / 60000) + ' 分钟前';
        } else if (diff < 86400000) {
            return Math.floor(diff / 3600000) + ' 小时前';
        } else {
            return date.toLocaleDateString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }
}

export default SnapshotManager;
