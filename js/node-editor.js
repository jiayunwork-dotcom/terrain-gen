import Noise from './noise.js';

const NODE_COLORS = {
    noise: '#4a90d9',
    math: '#9b59b6',
    constant: '#f39c12',
    scale: '#2ecc71',
    blend: '#e74c3c',
    threshold: '#1abc9c',
    output: '#e94560'
};

const NODE_TITLES = {
    noise: '🎲 噪声源',
    math: '➕ 数学运算',
    constant: '🔢 常数',
    scale: '📏 缩放/偏移',
    blend: '🎨 混合',
    threshold: '🚪 阈值',
    output: '📤 输出'
};

const MATH_OPERATIONS = [
    { id: 'add', label: '加 (+)' },
    { id: 'subtract', label: '减 (-)' },
    { id: 'multiply', label: '乘 (×)' },
    { id: 'divide', label: '除 (÷)' },
    { id: 'max', label: '最大' },
    { id: 'min', label: '最小' },
    { id: 'power', label: '幂 (^)' }
];

const NOISE_TYPES = [
    { id: 'perlin', label: 'Perlin' },
    { id: 'simplex', label: 'Simplex' },
    { id: 'ridged', label: 'Ridged' }
];

class NodePort {
    constructor(node, isInput, name, index) {
        this.node = node;
        this.isInput = isInput;
        this.name = name;
        this.index = index;
        this.radius = 6;
        this.hovered = false;
    }

    getPosition() {
        const nodeX = this.node.x;
        const nodeY = this.node.y;
        const nodeWidth = this.node.width;
        const headerHeight = 30;
        const portSpacing = 25;
        const startY = headerHeight + 15;
        
        if (this.isInput) {
            return {
                x: nodeX,
                y: nodeY + startY + this.index * portSpacing
            };
        } else {
            return {
                x: nodeX + nodeWidth,
                y: nodeY + startY + this.index * portSpacing
            };
        }
    }

    containsPoint(canvasX, canvasY, ctx) {
        const pos = this.getPosition();
        const dx = canvasX - pos.x;
        const dy = canvasY - pos.y;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius + 4;
    }
}

class BaseNode {
    constructor(type, x, y) {
        this.id = 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = 180;
        this.height = 100;
        this.inputs = [];
        this.outputs = [];
        this.params = {};
        this.dragging = false;
        this.selected = false;
        this.hovered = false;
        this.expanded = true;
    }

    getColor() {
        return NODE_COLORS[this.type] || '#666';
    }

    getTitle() {
        return NODE_TITLES[this.type] || this.type;
    }

    initPorts() {
    }

    initParams() {
    }

    calculateHeight(x, z, graph) {
        return 0;
    }

    getInputValue(index, x, z, graph) {
        if (index >= this.inputs.length) return 0;
        const port = this.inputs[index];
        const connection = graph.getConnectionTo(port);
        if (!connection) return 0;
        return connection.fromNode.calculateHeight(x, z, graph);
    }

    containsPoint(px, py) {
        return px >= this.x && px <= this.x + this.width &&
               py >= this.y && py <= this.y + this.height;
    }

    getHeaderBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: 30
        };
    }

    isInHeader(px, py) {
        const h = this.getHeaderBounds();
        return px >= h.x && px <= h.x + h.width &&
               py >= h.y && py <= h.y + h.height;
    }

    getDeleteButtonBounds() {
        return {
            x: this.x + this.width - 24,
            y: this.y + 5,
            width: 18,
            height: 18
        };
    }

    isInDeleteButton(px, py) {
        const b = this.getDeleteButtonBounds();
        return px >= b.x && px <= b.x + b.width &&
               py >= b.y && py <= b.y + b.height;
    }

    draw(ctx) {
        const color = this.getColor();
        
        ctx.fillStyle = this.selected ? '#2a2a4a' : '#1a1a3a';
        ctx.strokeStyle = this.selected ? '#e94560' : color;
        ctx.lineWidth = this.selected ? 2 : 1;
        this.roundRect(ctx, this.x, this.y, this.width, this.height, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = color;
        this.roundRect(ctx, this.x, this.y, this.width, 30, { tl: 6, tr: 6, bl: 0, br: 0 });
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.getTitle(), this.x + 10, this.y + 15);

        const deleteBtn = this.getDeleteButtonBounds();
        ctx.fillStyle = this.hovered ? '#ff6b6b' : 'rgba(255,255,255,0.5)';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('×', deleteBtn.x + deleteBtn.width / 2, deleteBtn.y + deleteBtn.height / 2 + 1);

        this.drawPorts(ctx);
        this.drawParams(ctx);
    }

    drawPorts(ctx) {
        this.inputs.forEach(port => {
            const pos = port.getPosition();
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, port.radius, 0, Math.PI * 2);
            ctx.fillStyle = port.hovered ? '#e94560' : '#444';
            ctx.fill();
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#aaa';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(port.name, pos.x + 12, pos.y);
        });

        this.outputs.forEach(port => {
            const pos = port.getPosition();
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, port.radius, 0, Math.PI * 2);
            ctx.fillStyle = port.hovered ? '#e94560' : '#444';
            ctx.fill();
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#aaa';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(port.name, pos.x - 12, pos.y);
        });
    }

    drawParams(ctx) {
    }

    roundRect(ctx, x, y, width, height, radius) {
        if (typeof radius === 'number') {
            radius = { tl: radius, tr: radius, br: radius, bl: radius };
        }
        ctx.beginPath();
        ctx.moveTo(x + radius.tl, y);
        ctx.lineTo(x + width - radius.tr, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
        ctx.lineTo(x + width, y + height - radius.br);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
        ctx.lineTo(x + radius.bl, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
        ctx.lineTo(x, y + radius.tl);
        ctx.quadraticCurveTo(x, y, x + radius.tl, y);
        ctx.closePath();
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            x: this.x,
            y: this.y,
            params: { ...this.params }
        };
    }

    static fromJSON(data) {
        const node = createNode(data.type, data.x, data.y);
        node.id = data.id;
        node.params = { ...data.params };
        return node;
    }
}

class NoiseNode extends BaseNode {
    constructor(x, y) {
        super('noise', x, y);
        this.noise = new Noise(12345);
        this.initParams();
        this.initPorts();
        this.height = 170;
    }

    initParams() {
        this.params = {
            noiseType: 'perlin',
            frequency: 0.02,
            amplitude: 50,
            octaves: 6,
            lacunarity: 2.0,
            persistence: 0.5,
            seed: 12345
        };
    }

    initPorts() {
        this.outputs = [new NodePort(this, false, 'out', 0)];
    }

    calculateHeight(x, z, graph) {
        this.noise.setSeed(this.params.seed);
        return this.noise.fbm(x, z, {
            octaves: this.params.octaves,
            frequency: this.params.frequency,
            amplitude: this.params.amplitude,
            lacunarity: this.params.lacunarity,
            persistence: this.params.persistence,
            type: this.params.noiseType
        });
    }

    drawParams(ctx) {
        const startX = this.x + 10;
        const startY = this.y + 55;
        const lineHeight = 18;

        const params = [
            { label: '类型', key: 'noiseType', type: 'select', options: NOISE_TYPES },
            { label: '频率', key: 'frequency', type: 'number', step: 0.001 },
            { label: '振幅', key: 'amplitude', type: 'number', step: 1 },
            { label: '倍频', key: 'octaves', type: 'number', step: 1 },
            { label: '间隙', key: 'lacunarity', type: 'number', step: 0.1 },
            { label: '持续', key: 'persistence', type: 'number', step: 0.05 },
            { label: '种子', key: 'seed', type: 'number', step: 1 }
        ];

        params.forEach((param, i) => {
            const y = startY + i * lineHeight;
            ctx.fillStyle = '#888';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(param.label, startX, y);
            
            let value = this.params[param.key];
            if (param.type === 'select') {
                const opt = param.options.find(o => o.id === value);
                value = opt ? opt.label : value;
            }
            ctx.fillStyle = '#eee';
            ctx.font = '10px sans-serif';
            ctx.fillText(String(value), startX + 50, y);
        });
    }
}

class MathNode extends BaseNode {
    constructor(x, y) {
        super('math', x, y);
        this.initParams();
        this.initPorts();
        this.height = 100;
    }

    initParams() {
        this.params = { operation: 'add' };
    }

    initPorts() {
        this.inputs = [
            new NodePort(this, true, 'a', 0),
            new NodePort(this, true, 'b', 1)
        ];
        this.outputs = [new NodePort(this, false, 'out', 0)];
    }

    calculateHeight(x, z, graph) {
        const a = this.getInputValue(0, x, z, graph);
        const b = this.getInputValue(1, x, z, graph);
        
        switch (this.params.operation) {
            case 'add': return a + b;
            case 'subtract': return a - b;
            case 'multiply': return a * b;
            case 'divide': return b !== 0 ? a / b : 0;
            case 'max': return Math.max(a, b);
            case 'min': return Math.min(a, b);
            case 'power': return Math.pow(a, b);
            default: return 0;
        }
    }

    drawParams(ctx) {
        const startX = this.x + 10;
        const startY = this.y + 55;

        ctx.fillStyle = '#888';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('运算', startX, startY);

        const op = MATH_OPERATIONS.find(o => o.id === this.params.operation);
        const value = op ? op.label : this.params.operation;
        ctx.fillStyle = '#eee';
        ctx.font = '10px sans-serif';
        ctx.fillText(value, startX + 50, startY);
    }
}

class ConstantNode extends BaseNode {
    constructor(x, y) {
        super('constant', x, y);
        this.initParams();
        this.initPorts();
        this.height = 70;
    }

    initParams() {
        this.params = { value: 0 };
    }

    initPorts() {
        this.outputs = [new NodePort(this, false, 'out', 0)];
    }

    calculateHeight(x, z, graph) {
        return this.params.value;
    }

    drawParams(ctx) {
        const startX = this.x + 10;
        const startY = this.y + 45;

        ctx.fillStyle = '#888';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('值', startX, startY);
        
        ctx.fillStyle = '#eee';
        ctx.font = '10px sans-serif';
        ctx.fillText(String(this.params.value), startX + 50, startY);
    }
}

class ScaleNode extends BaseNode {
    constructor(x, y) {
        super('scale', x, y);
        this.initParams();
        this.initPorts();
        this.height = 90;
    }

    initParams() {
        this.params = { scale: 1, offset: 0 };
    }

    initPorts() {
        this.inputs = [new NodePort(this, true, 'in', 0)];
        this.outputs = [new NodePort(this, false, 'out', 0)];
    }

    calculateHeight(x, z, graph) {
        const input = this.getInputValue(0, x, z, graph);
        return input * this.params.scale + this.params.offset;
    }

    drawParams(ctx) {
        const startX = this.x + 10;
        const startY = this.y + 55;
        const lineHeight = 18;

        ctx.fillStyle = '#888';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('缩放', startX, startY);
        ctx.fillText('偏移', startX, startY + lineHeight);
        
        ctx.fillStyle = '#eee';
        ctx.font = '10px sans-serif';
        ctx.fillText(String(this.params.scale), startX + 50, startY);
        ctx.fillText(String(this.params.offset), startX + 50, startY + lineHeight);
    }
}

class BlendNode extends BaseNode {
    constructor(x, y) {
        super('blend', x, y);
        this.initParams();
        this.initPorts();
        this.height = 105;
    }

    initParams() {
        this.params = { factor: 0.5 };
    }

    initPorts() {
        this.inputs = [
            new NodePort(this, true, 'a', 0),
            new NodePort(this, true, 'b', 1),
            new NodePort(this, true, 't', 2)
        ];
        this.outputs = [new NodePort(this, false, 'out', 0)];
    }

    calculateHeight(x, z, graph) {
        const a = this.getInputValue(0, x, z, graph);
        const b = this.getInputValue(1, x, z, graph);
        const tInput = this.inputs[2];
        const tConn = graph.getConnectionTo(tInput);
        let t = tConn ? tConn.fromNode.calculateHeight(x, z, graph) : this.params.factor;
        t = Math.max(0, Math.min(1, t));
        return a * (1 - t) + b * t;
    }

    drawParams(ctx) {
        const startX = this.x + 10;
        const startY = this.y + 70;

        ctx.fillStyle = '#888';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('因子', startX, startY);
        
        ctx.fillStyle = '#eee';
        ctx.font = '10px sans-serif';
        ctx.fillText(this.params.factor.toFixed(2), startX + 50, startY);
    }
}

class ThresholdNode extends BaseNode {
    constructor(x, y) {
        super('threshold', x, y);
        this.initParams();
        this.initPorts();
        this.height = 100;
    }

    initParams() {
        this.params = { threshold: 0, width: 1 };
    }

    initPorts() {
        this.inputs = [new NodePort(this, true, 'in', 0)];
        this.outputs = [new NodePort(this, false, 'out', 0)];
    }

    calculateHeight(x, z, graph) {
        const input = this.getInputValue(0, x, z, graph);
        const t = this.params.threshold;
        const w = this.params.width;
        
        if (w <= 0) {
            return input > t ? 1 : 0;
        }
        
        if (input < t - w / 2) return 0;
        if (input > t + w / 2) return 1;
        return (input - (t - w / 2)) / w;
    }

    drawParams(ctx) {
        const startX = this.x + 10;
        const startY = this.y + 55;
        const lineHeight = 18;

        ctx.fillStyle = '#888';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('阈值', startX, startY);
        ctx.fillText('宽度', startX, startY + lineHeight);
        
        ctx.fillStyle = '#eee';
        ctx.font = '10px sans-serif';
        ctx.fillText(String(this.params.threshold), startX + 50, startY);
        ctx.fillText(String(this.params.width), startX + 50, startY + lineHeight);
    }
}

class OutputNode extends BaseNode {
    constructor(x, y) {
        super('output', x, y);
        this.initParams();
        this.initPorts();
        this.height = 70;
    }

    initParams() {
        this.params = {};
    }

    initPorts() {
        this.inputs = [new NodePort(this, true, 'in', 0)];
    }

    calculateHeight(x, z, graph) {
        return this.getInputValue(0, x, z, graph);
    }
}

function createNode(type, x, y) {
    switch (type) {
        case 'noise': return new NoiseNode(x, y);
        case 'math': return new MathNode(x, y);
        case 'constant': return new ConstantNode(x, y);
        case 'scale': return new ScaleNode(x, y);
        case 'blend': return new BlendNode(x, y);
        case 'threshold': return new ThresholdNode(x, y);
        case 'output': return new OutputNode(x, y);
        default: return new BaseNode(type, x, y);
    }
}

class NodeConnection {
    constructor(fromNode, fromPort, toNode, toPort) {
        this.id = 'conn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.fromNode = fromNode;
        this.fromPort = fromPort;
        this.toNode = toNode;
        this.toPort = toPort;
        this.selected = false;
    }

    draw(ctx) {
        const fromPos = this.fromPort.getPosition();
        const toPos = this.toPort.getPosition();

        const dx = toPos.x - fromPos.x;
        const cpOffset = Math.min(Math.abs(dx) * 0.5, 100);

        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        ctx.bezierCurveTo(
            fromPos.x + cpOffset, fromPos.y,
            toPos.x - cpOffset, toPos.y,
            toPos.x, toPos.y
        );
        ctx.strokeStyle = this.selected ? '#e94560' : '#666';
        ctx.lineWidth = this.selected ? 3 : 2;
        ctx.stroke();
    }

    getDistanceToPoint(px, py) {
        const fromPos = this.fromPort.getPosition();
        const toPos = this.toPort.getPosition();
        
        const dx = toPos.x - fromPos.x;
        const dy = toPos.y - fromPos.y;
        const lengthSq = dx * dx + dy * dy;
        
        if (lengthSq === 0) {
            const ddx = px - fromPos.x;
            const ddy = py - fromPos.y;
            return Math.sqrt(ddx * ddx + ddy * ddy);
        }
        
        let t = ((px - fromPos.x) * dx + (py - fromPos.y) * dy) / lengthSq;
        t = Math.max(0, Math.min(1, t));
        
        const closestX = fromPos.x + t * dx;
        const closestY = fromPos.y + t * dy;
        
        const finalDx = px - closestX;
        const finalDy = py - closestY;
        return Math.sqrt(finalDx * finalDx + finalDy * finalDy);
    }

    toJSON() {
        return {
            id: this.id,
            fromNodeId: this.fromNode.id,
            fromPortIndex: this.fromPort.index,
            toNodeId: this.toNode.id,
            toPortIndex: this.toPort.index
        };
    }
}

class NodeGraph {
    constructor() {
        this.nodes = [];
        this.connections = [];
        this.changeListeners = [];
    }

    addNode(node) {
        this.nodes.push(node);
        this.notifyChanged();
        return node;
    }

    removeNode(node) {
        this.connections = this.connections.filter(c => 
            c.fromNode !== node && c.toNode !== node
        );
        this.nodes = this.nodes.filter(n => n !== node);
        this.notifyChanged();
    }

    addConnection(fromNode, fromPort, toNode, toPort) {
        const existing = this.getConnectionTo(toPort);
        if (existing) {
            this.removeConnection(existing);
        }
        
        if (fromNode === toNode) return null;
        
        if (this.wouldCreateCycle(fromNode, toNode)) return null;
        
        const conn = new NodeConnection(fromNode, fromPort, toNode, toPort);
        this.connections.push(conn);
        this.notifyChanged();
        return conn;
    }

    removeConnection(conn) {
        this.connections = this.connections.filter(c => c !== conn);
        this.notifyChanged();
    }

    getConnectionTo(inputPort) {
        return this.connections.find(c => c.toPort === inputPort);
    }

    wouldCreateCycle(fromNode, toNode) {
        const visited = new Set();
        const stack = [toNode];
        
        while (stack.length > 0) {
            const current = stack.pop();
            if (current === fromNode) return true;
            if (visited.has(current)) continue;
            visited.add(current);
            
            current.inputs.forEach(input => {
                const conn = this.getConnectionTo(input);
                if (conn) {
                    stack.push(conn.fromNode);
                }
            });
        }
        return false;
    }

    getOutputNode() {
        return this.nodes.find(n => n.type === 'output');
    }

    calculateHeight(x, z) {
        const outputNode = this.getOutputNode();
        if (!outputNode) return 0;
        return outputNode.calculateHeight(x, z, this);
    }

    addChangeListener(callback) {
        this.changeListeners.push(callback);
    }

    notifyChanged() {
        this.changeListeners.forEach(cb => cb());
    }

    toJSON() {
        return {
            nodes: this.nodes.map(n => n.toJSON()),
            connections: this.connections.map(c => c.toJSON())
        };
    }

    fromJSON(data) {
        this.nodes = [];
        this.connections = [];

        const nodeMap = {};
        data.nodes.forEach(nodeData => {
            const node = BaseNode.fromJSON(nodeData);
            nodeMap[node.id] = node;
            this.nodes.push(node);
        });

        data.connections.forEach(connData => {
            const fromNode = nodeMap[connData.fromNodeId];
            const toNode = nodeMap[connData.toNodeId];
            if (fromNode && toNode) {
                const fromPort = fromNode.outputs[connData.fromPortIndex];
                const toPort = toNode.inputs[connData.toPortIndex];
                if (fromPort && toPort) {
                    const conn = new NodeConnection(fromNode, fromPort, toNode, toPort);
                    conn.id = connData.id;
                    this.connections.push(conn);
                }
            }
        });

        this.notifyChanged();
    }
}

class NodeEditor {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.graph = new NodeGraph();
        
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 1;
        
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        
        this.draggedNode = null;
        this.nodeDragOffsetX = 0;
        this.nodeDragOffsetY = 0;
        
        this.connecting = false;
        this.connectionStart = null;
        this.connectionEndX = 0;
        this.connectionEndY = 0;
        
        this.selectedNode = null;
        this.selectedConnection = null;
        
        this.hoveredPort = null;
        this.lastClickTime = 0;
        this.lastClickPos = { x: 0, y: 0 };
        
        this.menu = document.getElementById('node-menu');
        this.menuTargetPos = { x: 0, y: 0 };
        
        this.terrainGenerator = null;
        this.terrainSize = 512;
        this.terrainResolution = 256;
        
        this.editingParam = null;
        this.paramInputElement = null;
        
        this.init();
    }

    init() {
        this.resize();
        this.setupEventListeners();
        this.setupMenu();
        this.setupToolbar();
        this.createDefaultGraph();
        this.animate();
        
        this.graph.addChangeListener(() => {
            this.updateTerrain();
        });
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.draw();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        window.addEventListener('resize', () => this.resize());
        document.addEventListener('click', (e) => {
            if (!this.menu.contains(e.target) && e.target !== this.canvas) {
                this.hideMenu();
            }
            if (this.paramInputElement && e.target !== this.paramInputElement) {
                this.finishParamEdit();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.selectedConnection) {
                    this.graph.removeConnection(this.selectedConnection);
                    this.selectedConnection = null;
                    this.draw();
                } else if (this.selectedNode && !this.paramInputElement) {
                    if (this.selectedNode.type !== 'output') {
                        this.graph.removeNode(this.selectedNode);
                        this.selectedNode = null;
                        this.draw();
                    }
                }
            }
            if (e.key === 'Escape') {
                this.connecting = false;
                this.connectionStart = null;
                this.hideMenu();
                this.finishParamEdit();
                this.draw();
            }
        });
    }

    getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;
        return {
            x: (clientX - this.offsetX) / this.scale,
            y: (clientY - this.offsetY) / this.scale,
            clientX,
            clientY
        };
    }

    onMouseDown(e) {
        const pos = this.getCanvasPos(e);
        
        const now = Date.now();
        const doubleClick = now - this.lastClickTime < 300 &&
            Math.abs(pos.clientX - this.lastClickPos.x) < 5 &&
            Math.abs(pos.clientY - this.lastClickPos.y) < 5;
        
        this.lastClickTime = now;
        this.lastClickPos = { x: pos.clientX, y: pos.clientY };
        
        if (doubleClick) {
            this.onDoubleClick(e);
            return;
        }
        
        if (e.button === 2) {
            this.showMenu(pos.clientX, pos.clientY, pos.x, pos.y);
            return;
        }
        
        let portClicked = null;
        for (const node of this.graph.nodes) {
            for (const port of [...node.inputs, ...node.outputs]) {
                if (port.containsPoint(pos.x, pos.y, this.ctx)) {
                    portClicked = port;
                    break;
                }
            }
            if (portClicked) break;
        }
        
        if (portClicked) {
            if (!portClicked.isInput) {
                this.connecting = true;
                this.connectionStart = portClicked;
                this.connectionEndX = pos.x;
                this.connectionEndY = pos.y;
            }
            return;
        }
        
        let connClicked = null;
        for (const conn of this.graph.connections) {
            if (conn.getDistanceToPoint(pos.x, pos.y) < 8) {
                connClicked = conn;
                break;
            }
        }
        
        if (connClicked) {
            this.selectedConnection = connClicked;
            this.selectedNode = null;
            this.graph.nodes.forEach(n => n.selected = false);
            this.graph.connections.forEach(c => c.selected = false);
            connClicked.selected = true;
            return;
        }
        
        let nodeClicked = null;
        for (let i = this.graph.nodes.length - 1; i >= 0; i--) {
            const node = this.graph.nodes[i];
            if (node.containsPoint(pos.x, pos.y)) {
                nodeClicked = node;
                break;
            }
        }
        
        if (nodeClicked) {
            if (nodeClicked.isInDeleteButton(pos.x, pos.y)) {
                this.graph.removeNode(nodeClicked);
                return;
            }
            
            this.selectedNode = nodeClicked;
            this.selectedConnection = null;
            this.graph.nodes.forEach(n => n.selected = false);
            this.graph.connections.forEach(c => c.selected = false);
            nodeClicked.selected = true;
            
            const paramInfo = this.getParamAtPosition(nodeClicked, pos.x, pos.y);
            if (paramInfo) {
                this.startParamEdit(nodeClicked, paramInfo, pos.clientX, pos.clientY);
                return;
            }
            
            if (nodeClicked.isInHeader(pos.x, pos.y)) {
                this.draggedNode = nodeClicked;
                this.nodeDragOffsetX = pos.x - nodeClicked.x;
                this.nodeDragOffsetY = pos.y - nodeClicked.y;
                
                const index = this.graph.nodes.indexOf(nodeClicked);
                if (index > -1) {
                    this.graph.nodes.splice(index, 1);
                    this.graph.nodes.push(nodeClicked);
                }
            }
            return;
        }
        
        this.selectedNode = null;
        this.selectedConnection = null;
        this.graph.nodes.forEach(n => n.selected = false);
        this.graph.connections.forEach(c => c.selected = false);
        
        this.isDragging = true;
        this.dragStartX = pos.clientX;
        this.dragStartY = pos.clientY;
        this.dragOffsetX = this.offsetX;
        this.dragOffsetY = this.offsetY;
    }

    onMouseMove(e) {
        const pos = this.getCanvasPos(e);
        
        if (this.connecting && this.connectionStart) {
            this.connectionEndX = pos.x;
            this.connectionEndY = pos.y;
            this.draw();
            return;
        }
        
        if (this.draggedNode) {
            this.draggedNode.x = pos.x - this.nodeDragOffsetX;
            this.draggedNode.y = pos.y - this.nodeDragOffsetY;
            this.draw();
            return;
        }
        
        if (this.isDragging) {
            const dx = pos.clientX - this.dragStartX;
            const dy = pos.clientY - this.dragStartY;
            this.offsetX = this.dragOffsetX + dx;
            this.offsetY = this.dragOffsetY + dy;
            this.draw();
            return;
        }
        
        let foundPort = null;
        for (const node of this.graph.nodes) {
            for (const port of [...node.inputs, ...node.outputs]) {
                port.hovered = port.containsPoint(pos.x, pos.y, this.ctx);
                if (port.hovered) foundPort = port;
            }
            node.hovered = node.containsPoint(pos.x, pos.y);
        }
        this.hoveredPort = foundPort;
        
        this.draw();
    }

    onMouseUp(e) {
        const pos = this.getCanvasPos(e);
        
        if (this.connecting && this.connectionStart) {
            let targetPort = null;
            for (const node of this.graph.nodes) {
                for (const port of node.inputs) {
                    if (port.containsPoint(pos.x, pos.y, this.ctx)) {
                        targetPort = port;
                        break;
                    }
                }
                if (targetPort) break;
            }
            
            if (targetPort && targetPort.isInput && targetPort.node !== this.connectionStart.node) {
                this.graph.addConnection(
                    this.connectionStart.node,
                    this.connectionStart,
                    targetPort.node,
                    targetPort
                );
            }
            
            this.connecting = false;
            this.connectionStart = null;
            this.draw();
            return;
        }
        
        if (this.draggedNode) {
            this.draggedNode = null;
            this.graph.notifyChanged();
            return;
        }
        
        if (this.isDragging) {
            this.isDragging = false;
            return;
        }
    }

    onWheel(e) {
        e.preventDefault();
        const pos = this.getCanvasPos(e);
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.2, Math.min(3, this.scale * zoomFactor));
        
        this.offsetX = pos.clientX - (pos.clientX - this.offsetX) * (newScale / this.scale);
        this.offsetY = pos.clientY - (pos.clientY - this.offsetY) * (newScale / this.scale);
        this.scale = newScale;
        
        this.draw();
    }

    onDoubleClick(e) {
        const pos = this.getCanvasPos(e);
        let clickedNode = null;
        for (const node of this.graph.nodes) {
            if (node.containsPoint(pos.x, pos.y)) {
                clickedNode = node;
                break;
            }
        }
        
        if (!clickedNode) {
            this.showMenu(pos.clientX, pos.clientY, pos.x, pos.y);
        }
    }

    showMenu(clientX, clientY, worldX, worldY) {
        this.menuTargetPos = { x: worldX, y: worldY };
        this.menu.style.left = clientX + 'px';
        this.menu.style.top = clientY + 'px';
        this.menu.classList.remove('hidden');
    }

    hideMenu() {
        this.menu.classList.add('hidden');
    }

    setupMenu() {
        this.menu.querySelectorAll('.node-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type;
                this.createNode(type, this.menuTargetPos.x, this.menuTargetPos.y);
                this.hideMenu();
            });
        });
    }

    setupToolbar() {
        document.getElementById('node-new').addEventListener('click', () => {
            this.newGraph();
        });
        
        document.getElementById('node-save').addEventListener('click', () => {
            this.showSaveDialog();
        });
        
        document.getElementById('node-load').addEventListener('click', () => {
            this.showLoadDialog();
        });
        
        document.getElementById('node-toggle').addEventListener('click', () => {
            const editor = document.getElementById('node-editor');
            const btn = document.getElementById('node-toggle');
            editor.classList.toggle('collapsed');
            btn.textContent = editor.classList.contains('collapsed') ? '🔼' : '🔽';
        });
    }
    
    getParamDefinitions(node) {
        switch (node.type) {
            case 'noise':
                return [
                    { key: 'noiseType', label: '类型', type: 'select', options: NOISE_TYPES, yOffset: 55 },
                    { key: 'frequency', label: '频率', type: 'number', step: 0.001, yOffset: 73 },
                    { key: 'amplitude', label: '振幅', type: 'number', step: 1, yOffset: 91 },
                    { key: 'octaves', label: '倍频', type: 'number', step: 1, yOffset: 109 },
                    { key: 'lacunarity', label: '间隙', type: 'number', step: 0.1, yOffset: 127 },
                    { key: 'persistence', label: '持续', type: 'number', step: 0.05, yOffset: 145 },
                    { key: 'seed', label: '种子', type: 'number', step: 1, yOffset: 163 }
                ];
            case 'math':
                return [
                    { key: 'operation', label: '运算', type: 'select', options: MATH_OPERATIONS, yOffset: 55 }
                ];
            case 'constant':
                return [
                    { key: 'value', label: '值', type: 'number', step: 0.1, yOffset: 45 }
                ];
            case 'scale':
                return [
                    { key: 'scale', label: '缩放', type: 'number', step: 0.1, yOffset: 55 },
                    { key: 'offset', label: '偏移', type: 'number', step: 0.1, yOffset: 73 }
                ];
            case 'blend':
                return [
                    { key: 'factor', label: '因子', type: 'number', step: 0.05, yOffset: 70 }
                ];
            case 'threshold':
                return [
                    { key: 'threshold', label: '阈值', type: 'number', step: 0.1, yOffset: 55 },
                    { key: 'width', label: '宽度', type: 'number', step: 0.1, yOffset: 73 }
                ];
            default:
                return [];
        }
    }
    
    getParamAtPosition(node, x, y) {
        const params = this.getParamDefinitions(node);
        for (const param of params) {
            const valueX = node.x + 60;
            const valueY = node.y + param.yOffset;
            const valueWidth = 80;
            const valueHeight = 16;
            
            if (x >= valueX && x <= valueX + valueWidth &&
                y >= valueY - 2 && y <= valueY + valueHeight) {
                return param;
            }
        }
        return null;
    }
    
    startParamEdit(node, paramInfo, clientX, clientY) {
        this.finishParamEdit();
        
        this.editingParam = { node, paramInfo };
        
        const rect = this.canvas.getBoundingClientRect();
        const value = node.params[paramInfo.key];
        
        if (paramInfo.type === 'select') {
            this.paramInputElement = document.createElement('select');
            this.paramInputElement.className = 'node-select-field';
            paramInfo.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.id;
                option.textContent = opt.label;
                if (opt.id === value) option.selected = true;
                this.paramInputElement.appendChild(option);
            });
        } else {
            this.paramInputElement = document.createElement('input');
            this.paramInputElement.type = 'number';
            this.paramInputElement.className = 'node-input-field';
            this.paramInputElement.value = value;
            this.paramInputElement.step = paramInfo.step || 0.1;
        }
        
        this.paramInputElement.style.position = 'absolute';
        this.paramInputElement.style.left = (rect.left + (node.x + 60) * this.scale + this.offsetX) + 'px';
        this.paramInputElement.style.top = (rect.top + (node.y + paramInfo.yOffset) * this.scale + this.offsetY - 2) + 'px';
        this.paramInputElement.style.transform = 'scale(' + this.scale + ')';
        this.paramInputElement.style.transformOrigin = 'top left';
        this.paramInputElement.style.zIndex = '100';
        
        document.body.appendChild(this.paramInputElement);
        this.paramInputElement.focus();
        if (this.paramInputElement.select) this.paramInputElement.select();
        
        const finish = () => {
            this.finishParamEdit();
        };
        
        this.paramInputElement.addEventListener('change', finish);
        this.paramInputElement.addEventListener('blur', finish);
        this.paramInputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                finish();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelParamEdit();
            }
        });
    }
    
    finishParamEdit() {
        if (!this.paramInputElement || !this.editingParam) return;
        
        const { node, paramInfo } = this.editingParam;
        
        let newValue;
        if (paramInfo.type === 'select') {
            newValue = this.paramInputElement.value;
        } else {
            newValue = parseFloat(this.paramInputElement.value);
            if (isNaN(newValue)) newValue = node.params[paramInfo.key];
        }
        
        node.params[paramInfo.key] = newValue;
        
        document.body.removeChild(this.paramInputElement);
        this.paramInputElement = null;
        this.editingParam = null;
        
        this.graph.notifyChanged();
        this.draw();
    }
    
    cancelParamEdit() {
        if (this.paramInputElement) {
            document.body.removeChild(this.paramInputElement);
            this.paramInputElement = null;
        }
        this.editingParam = null;
        this.draw();
    }

    createNode(type, x, y) {
        if (type === 'output') {
            const existing = this.graph.nodes.find(n => n.type === 'output');
            if (existing) {
                alert('只能有一个输出节点');
                return;
            }
        }
        
        const node = createNode(type, x - 90, y - 30);
        this.graph.addNode(node);
        this.draw();
    }

    createDefaultGraph() {
        const noiseNode = createNode('noise', 50, 50);
        const outputNode = createNode('output', 350, 80);
        
        this.graph.addNode(noiseNode);
        this.graph.addNode(outputNode);
        
        this.graph.addConnection(
            noiseNode, noiseNode.outputs[0],
            outputNode, outputNode.inputs[0]
        );
        
        this.draw();
    }

    newGraph() {
        if (this.graph.nodes.length > 0) {
            if (!confirm('确定要新建节点图吗？当前图将丢失。')) {
                return;
            }
        }
        this.graph.nodes = [];
        this.graph.connections = [];
        this.createDefaultGraph();
    }

    showSaveDialog() {
        const modal = document.createElement('div');
        modal.className = 'save-load-modal';
        modal.innerHTML = '\
            <div class="save-load-content">\
                <div class="save-load-header">保存节点图</div>\
                <div class="save-load-body">\
                    <input type="text" class="save-load-input" placeholder="输入名称..." id="save-name-input">\
                </div>\
                <div class="save-load-footer">\
                    <button class="cancel-btn">取消</button>\
                    <button class="primary-btn">保存</button>\
                </div>\
            </div>\
        ';
        document.body.appendChild(modal);
        
        const input = modal.querySelector('#save-name-input');
        input.focus();
        
        modal.querySelector('.cancel-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.querySelector('.primary-btn').addEventListener('click', () => {
            const name = input.value.trim();
            if (name) {
                this.saveGraph(name);
                document.body.removeChild(modal);
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const name = input.value.trim();
                if (name) {
                    this.saveGraph(name);
                    document.body.removeChild(modal);
                }
            }
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    saveGraph(name) {
        const saved = JSON.parse(localStorage.getItem('nodeGraphs') || '{}');
        saved[name] = {
            data: this.graph.toJSON(),
            createdAt: Date.now()
        };
        localStorage.setItem('nodeGraphs', JSON.stringify(saved));
        alert('保存成功！');
    }

    showLoadDialog() {
        const saved = JSON.parse(localStorage.getItem('nodeGraphs') || '{}');
        const names = Object.keys(saved);
        
        const modal = document.createElement('div');
        modal.className = 'save-load-modal';
        
        let listHtml = '';
        if (names.length === 0) {
            listHtml = '<div class="empty-state">暂无保存的节点图</div>';
        } else {
            listHtml = '<div class="save-load-list">';
            names.forEach(name => {
                listHtml += '\
                    <div class="save-load-item" data-name="' + name + '">\
                        <span class="save-load-item-name">' + name + '</span>\
                        <div class="save-load-item-actions">\
                            <button data-action="load">加载</button>\
                            <button data-action="delete">删除</button>\
                        </div>\
                    </div>\
                ';
            });
            listHtml += '</div>';
        }
        
        modal.innerHTML = '\
            <div class="save-load-content">\
                <div class="save-load-header">加载节点图</div>\
                <div class="save-load-body">\
                    ' + listHtml + '\
                </div>\
                <div class="save-load-footer">\
                    <button class="cancel-btn">关闭</button>\
                </div>\
            </div>\
        ';
        document.body.appendChild(modal);
        
        modal.querySelector('.cancel-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.querySelectorAll('.save-load-item').forEach(item => {
            const name = item.dataset.name;
            item.querySelector('[data-action="load"]').addEventListener('click', (e) => {
                e.stopPropagation();
                this.loadGraph(name);
                document.body.removeChild(modal);
            });
            item.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('确定要删除 "' + name + '" 吗？')) {
                    this.deleteGraph(name);
                    document.body.removeChild(modal);
                    this.showLoadDialog();
                }
            });
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    loadGraph(name) {
        const saved = JSON.parse(localStorage.getItem('nodeGraphs') || '{}');
        if (saved[name]) {
            this.graph.fromJSON(saved[name].data);
            this.draw();
        }
    }

    deleteGraph(name) {
        const saved = JSON.parse(localStorage.getItem('nodeGraphs') || '{}');
        delete saved[name];
        localStorage.setItem('nodeGraphs', JSON.stringify(saved));
    }

    setTerrainGenerator(generator) {
        this.terrainGenerator = generator;
        if (generator) {
            this.terrainSize = generator.size;
            this.terrainResolution = generator.resolution;
        }
    }

    updateTerrain() {
        if (!this.terrainGenerator) return;
        
        const heightMap = new Float32Array(this.terrainResolution * this.terrainResolution);
        const halfSize = this.terrainSize / 2;
        const step = this.terrainSize / (this.terrainResolution - 1);
        
        for (let z = 0; z < this.terrainResolution; z++) {
            for (let x = 0; x < this.terrainResolution; x++) {
                const worldX = x * step - halfSize;
                const worldZ = z * step - halfSize;
                heightMap[z * this.terrainResolution + x] = this.graph.calculateHeight(worldX, worldZ);
            }
        }
        
        this.terrainGenerator.heightMap = heightMap;
        this.terrainGenerator.updateGeometryFromHeightMap();
    }

    draw() {
        const ctx = this.ctx;
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        ctx.save();
        ctx.clearRect(0, 0, width, height);
        
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, width, height);
        
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.scale, this.scale);
        
        this.drawGrid(ctx);
        
        this.graph.connections.forEach(conn => conn.draw(ctx));
        
        if (this.connecting && this.connectionStart) {
            const fromPos = this.connectionStart.getPosition();
            ctx.beginPath();
            ctx.moveTo(fromPos.x, fromPos.y);
            
            const dx = this.connectionEndX - fromPos.x;
            const cpOffset = Math.min(Math.abs(dx) * 0.5, 100);
            
            ctx.bezierCurveTo(
                fromPos.x + cpOffset, fromPos.y,
                this.connectionEndX - cpOffset, this.connectionEndY,
                this.connectionEndX, this.connectionEndY
            );
            ctx.strokeStyle = '#e94560';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        this.graph.nodes.forEach(node => node.draw(ctx));
        
        ctx.restore();
    }

    drawGrid(ctx) {
        const gridSize = 50;
        const rect = this.canvas.getBoundingClientRect();
        
        const startX = Math.floor(-this.offsetX / this.scale / gridSize) * gridSize;
        const startY = Math.floor(-this.offsetY / this.scale / gridSize) * gridSize;
        const endX = startX + rect.width / this.scale + gridSize * 2;
        const endY = startY + rect.height / this.scale + gridSize * 2;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        
        for (let x = startX; x < endX; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
            ctx.stroke();
        }
        
        for (let y = startY; y < endY; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
    }
}

let nodeEditorInstance = null;

function initNodeEditor() {
    const canvas = document.getElementById('node-canvas');
    if (canvas && !nodeEditorInstance) {
        nodeEditorInstance = new NodeEditor(canvas);
    }
    return nodeEditorInstance;
}

window.initNodeEditor = initNodeEditor;
window.getNodeEditor = () => nodeEditorInstance;

export default NodeEditor;
