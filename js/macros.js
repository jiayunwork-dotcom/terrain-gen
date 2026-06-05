class MacroManager {
    constructor() {
        this.isRecording = false;
        this.isPlaying = false;
        this.isPaused = false;
        this.recordingStartTime = 0;
        this.currentMacro = null;
        this.playbackSpeed = 1;
        this.playbackIndex = 0;
        this.playbackStartTime = 0;
        this.pausedTime = 0;
        this.playbackTimer = null;
        
        this.transform = {
            offsetX: 0,
            offsetZ: 0,
            rotation: 0
        };
        
        this.savedMacros = [];
        this._listeners = {};
        this._loadFromLocalStorage();
    }

    on(event, callback) {
        if (!this._listeners[event]) {
            this._listeners[event] = [];
        }
        this._listeners[event].push(callback);
    }

    off(event, callback) {
        if (this._listeners[event]) {
            this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
        }
    }

    _emit(event, data) {
        if (this._listeners[event]) {
            this._listeners[event].forEach(cb => cb(data));
        }
    }

    startRecording() {
        if (this.isRecording || this.isPlaying) return;
        
        this.isRecording = true;
        this.recordingStartTime = performance.now();
        this.currentMacro = {
            id: 'macro_' + Date.now(),
            name: '未命名宏',
            createdAt: Date.now(),
            operations: []
        };
        this._emit('recordingStarted');
    }

    recordOperation(brushType, x, z, size, strength, flattenHeight = 0) {
        if (!this.isRecording || !this.currentMacro) return;
        
        const timestamp = performance.now() - this.recordingStartTime;
        this.currentMacro.operations.push({
            timestamp,
            brushType,
            x,
            z,
            size,
            strength,
            flattenHeight
        });
    }

    stopRecording() {
        if (!this.isRecording) return null;
        
        this.isRecording = false;
        const macro = this.currentMacro;
        this.currentMacro = null;
        this._emit('recordingStopped', macro);
        return macro;
    }

    _applyTransform(x, z) {
        const rad = (this.transform.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        const cx = x - 0.5;
        const cz = z - 0.5;
        
        const rotatedX = cx * cos - cz * sin + 0.5;
        const rotatedZ = cx * sin + cz * cos + 0.5;
        
        return {
            x: Math.max(0, Math.min(1, rotatedX + this.transform.offsetX)),
            z: Math.max(0, Math.min(1, rotatedZ + this.transform.offsetZ))
        };
    }

    playMacro(macro, onApplyBrush) {
        if (this.isPlaying || this.isRecording) return;
        
        this.isPlaying = true;
        this.isPaused = false;
        this.playbackIndex = 0;
        this.playbackStartTime = performance.now();
        this.pausedTime = 0;
        
        const totalDuration = macro.operations.length > 0 
            ? macro.operations[macro.operations.length - 1].timestamp 
            : 0;
        
        this._emit('playbackStarted', { macro, totalDuration });
        
        const playNext = () => {
            if (!this.isPlaying) return;
            
            if (this.isPaused) {
                this.playbackTimer = setTimeout(playNext, 50);
                return;
            }
            
            const currentTime = (performance.now() - this.playbackStartTime - this.pausedTime) * this.playbackSpeed;
            
            while (this.playbackIndex < macro.operations.length) {
                const op = macro.operations[this.playbackIndex];
                if (op.timestamp <= currentTime) {
                    const transformed = this._applyTransform(op.x, op.z);
                    onApplyBrush(
                        op.brushType,
                        transformed.x,
                        transformed.z,
                        op.size,
                        op.strength,
                        op.flattenHeight
                    );
                    this.playbackIndex++;
                    this._emit('playbackProgress', {
                        index: this.playbackIndex,
                        total: macro.operations.length,
                        currentTime,
                        totalDuration,
                        x: transformed.x,
                        z: transformed.z
                    });
                } else {
                    break;
                }
            }
            
            if (this.playbackIndex >= macro.operations.length) {
                this.isPlaying = false;
                this._emit('playbackFinished');
                return;
            }
            
            this.playbackTimer = setTimeout(playNext, 16);
        };
        
        playNext();
    }

    pausePlayback() {
        if (!this.isPlaying || this.isPaused) return;
        
        this.isPaused = true;
        this.pauseStartTime = performance.now();
        this._emit('playbackPaused');
    }

    resumePlayback() {
        if (!this.isPlaying || !this.isPaused) return;
        
        this.isPaused = false;
        this.pausedTime += performance.now() - this.pauseStartTime;
        this._emit('playbackResumed');
    }

    stopPlayback() {
        this.isPlaying = false;
        this.isPaused = false;
        if (this.playbackTimer) {
            clearTimeout(this.playbackTimer);
            this.playbackTimer = null;
        }
        this._emit('playbackStopped');
    }

    setPlaybackSpeed(speed) {
        this.playbackSpeed = speed;
        this._emit('speedChanged', speed);
    }

    setTransform(offsetX, offsetZ, rotation) {
        this.transform.offsetX = offsetX;
        this.transform.offsetZ = offsetZ;
        this.transform.rotation = rotation;
    }

    saveMacro(macro, name) {
        const savedMacro = {
            ...macro,
            name: name || macro.name,
            savedAt: Date.now()
        };
        this.savedMacros.push(savedMacro);
        this._saveToLocalStorage();
        this._emit('macroSaved', savedMacro);
        return savedMacro;
    }

    deleteMacro(macroId) {
        this.savedMacros = this.savedMacros.filter(m => m.id !== macroId);
        this._saveToLocalStorage();
        this._emit('macroDeleted', macroId);
    }

    renameMacro(macroId, newName) {
        const macro = this.savedMacros.find(m => m.id === macroId);
        if (macro) {
            macro.name = newName;
            this._saveToLocalStorage();
            this._emit('macroRenamed', { id: macroId, name: newName });
        }
    }

    getMacros() {
        return this.savedMacros;
    }

    getMacro(macroId) {
        return this.savedMacros.find(m => m.id === macroId);
    }

    _saveToLocalStorage() {
        try {
            localStorage.setItem('terrain_macros', JSON.stringify(this.savedMacros));
        } catch (e) {
            console.error('保存宏失败:', e);
        }
    }

    _loadFromLocalStorage() {
        try {
            const data = localStorage.getItem('terrain_macros');
            if (data) {
                this.savedMacros = JSON.parse(data);
            }
        } catch (e) {
            console.error('加载宏失败:', e);
            this.savedMacros = [];
        }
    }
}

export default MacroManager;
