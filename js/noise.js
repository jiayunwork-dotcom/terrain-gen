class Noise {
    constructor(seed = 12345) {
        this.seed = seed;
        this.perm = this.generatePermutation(seed);
        this.gradP = this.generateGradients();
    }

    generatePermutation(seed) {
        const p = [];
        for (let i = 0; i < 256; i++) p[i] = i;
        
        let n, q;
        for (let i = 255; i > 0; i--) {
            seed = (seed * 16807) % 2147483647;
            n = seed % (i + 1);
            q = p[i];
            p[i] = p[n];
            p[n] = q;
        }
        
        const perm = new Array(512);
        for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
        return perm;
    }

    generateGradients() {
        const grad3 = [
            [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
            [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
            [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
        ];
        
        const gradP = new Array(512);
        for (let i = 0; i < 512; i++) {
            gradP[i] = grad3[this.perm[i] % 12];
        }
        return gradP;
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(a, b, t) {
        return (1 - t) * a + t * b;
    }

    perlin2(x, y) {
        let X = Math.floor(x);
        let Y = Math.floor(y);
        x = x - X;
        y = y - Y;
        X = X & 255;
        Y = Y & 255;

        const n00 = this.dotGridGradient(X, Y, x, y);
        const n01 = this.dotGridGradient(X, Y + 1, x, y - 1);
        const n10 = this.dotGridGradient(X + 1, Y, x - 1, y);
        const n11 = this.dotGridGradient(X + 1, Y + 1, x - 1, y - 1);

        const u = this.fade(x);
        const v = this.fade(y);

        return this.lerp(this.lerp(n00, n10, u), this.lerp(n01, n11, u), v);
    }

    dotGridGradient(ix, iy, x, y) {
        const gradient = this.gradP[ix + this.perm[iy]];
        return x * gradient[0] + y * gradient[1];
    }

    simplex2(xin, yin) {
        const F2 = 0.5 * (Math.sqrt(3) - 1);
        const G2 = (3 - Math.sqrt(3)) / 6;

        let n0, n1, n2;
        const s = (xin + yin) * F2;
        const i = Math.floor(xin + s);
        const j = Math.floor(yin + s);
        const t = (i + j) * G2;
        const X0 = i - t;
        const Y0 = j - t;
        const x0 = xin - X0;
        const y0 = yin - Y0;

        let i1, j1;
        if (x0 > y0) { i1 = 1; j1 = 0; }
        else { i1 = 0; j1 = 1; }

        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1 + 2 * G2;
        const y2 = y0 - 1 + 2 * G2;

        const ii = i & 255;
        const jj = j & 255;

        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 < 0) n0 = 0;
        else {
            t0 *= t0;
            const gi0 = this.gradP[ii + this.perm[jj]];
            n0 = t0 * t0 * (gi0[0] * x0 + gi0[1] * y0);
        }

        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 < 0) n1 = 0;
        else {
            t1 *= t1;
            const gi1 = this.gradP[ii + i1 + this.perm[jj + j1]];
            n1 = t1 * t1 * (gi1[0] * x1 + gi1[1] * y1);
        }

        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 < 0) n2 = 0;
        else {
            t2 *= t2;
            const gi2 = this.gradP[ii + 1 + this.perm[jj + 1]];
            n2 = t2 * t2 * (gi2[0] * x2 + gi2[1] * y2);
        }

        return 70 * (n0 + n1 + n2);
    }

    ridgedMulti2(x, y, octaves, lacunarity, persistence) {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let weight = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            let noiseVal = Math.abs(this.simplex2(x * frequency, y * frequency));
            noiseVal = 1 - noiseVal * noiseVal;
            noiseVal *= weight;
            weight = Math.max(0, Math.min(1, noiseVal * 2));
            value += noiseVal * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return value / maxValue;
    }

    fbm(x, y, options = {}) {
        const {
            octaves = 6,
            frequency = 0.02,
            amplitude = 50,
            lacunarity = 2,
            persistence = 0.5,
            type = 'perlin'
        } = options;

        let value = 0;
        let amp = amplitude;
        let freq = frequency;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            let noiseVal;
            if (type === 'simplex') {
                noiseVal = this.simplex2(x * freq, y * freq);
            } else if (type === 'ridged') {
                noiseVal = this.ridgedMulti2(x * freq, y * freq, 1, lacunarity, persistence) * 2 - 1;
            } else {
                noiseVal = this.perlin2(x * freq, y * freq);
            }
            
            value += noiseVal * amp;
            maxValue += amp;
            amp *= persistence;
            freq *= lacunarity;
        }

        return value;
    }

    setSeed(seed) {
        this.seed = seed;
        this.perm = this.generatePermutation(seed);
        this.gradP = this.generateGradients();
    }
}

export default Noise;
