import * as THREE from 'three';

class Exporter {
    constructor(terrain, size = 512) {
        this.terrain = terrain;
        this.size = size;
    }

    crc32(data) {
        const crcTable = [];
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) {
                c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
            }
            crcTable[n] = c;
        }

        let crc = 0 ^ (-1);
        for (let i = 0; i < data.length; i++) {
            crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xFF];
        }
        return (crc ^ (-1)) >>> 0;
    }

    writeUint32BE(buffer, offset, value) {
        buffer[offset] = (value >> 24) & 0xFF;
        buffer[offset + 1] = (value >> 16) & 0xFF;
        buffer[offset + 2] = (value >> 8) & 0xFF;
        buffer[offset + 3] = value & 0xFF;
    }

    writeUint16BE(buffer, offset, value) {
        buffer[offset] = (value >> 8) & 0xFF;
        buffer[offset + 1] = value & 0xFF;
    }

    createPng(width, height, pixels16Bit) {
        const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

        const ihdrData = new Uint8Array(13);
        this.writeUint32BE(ihdrData, 0, width);
        this.writeUint32BE(ihdrData, 4, height);
        ihdrData[8] = 16;
        ihdrData[9] = 0;
        ihdrData[10] = 0;
        ihdrData[11] = 0;
        ihdrData[12] = 0;

        const ihdrChunk = this.createChunk('IHDR', ihdrData);

        const rawData = new Uint8Array((width * 2 + 1) * height);
        let rawIdx = 0;
        let pixelIdx = 0;
        for (let y = 0; y < height; y++) {
            rawData[rawIdx++] = 0;
            for (let x = 0; x < width; x++) {
                rawData[rawIdx++] = (pixels16Bit[pixelIdx] >> 8) & 0xFF;
                rawData[rawIdx++] = pixels16Bit[pixelIdx] & 0xFF;
                pixelIdx++;
            }
        }

        const compressedData = this.deflate(rawData);
        const idatChunk = this.createChunk('IDAT', compressedData);
        const iendChunk = this.createChunk('IEND', new Uint8Array(0));

        const totalSize = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
        const png = new Uint8Array(totalSize);
        let offset = 0;

        png.set(signature, offset);
        offset += signature.length;
        png.set(ihdrChunk, offset);
        offset += ihdrChunk.length;
        png.set(idatChunk, offset);
        offset += idatChunk.length;
        png.set(iendChunk, offset);

        return png;
    }

    createChunk(type, data) {
        const chunk = new Uint8Array(12 + data.length);
        this.writeUint32BE(chunk, 0, data.length);
        for (let i = 0; i < 4; i++) {
            chunk[4 + i] = type.charCodeAt(i);
        }
        chunk.set(data, 8);

        const crcData = new Uint8Array(4 + data.length);
        for (let i = 0; i < 4; i++) {
            crcData[i] = type.charCodeAt(i);
        }
        crcData.set(data, 4);
        const crc = this.crc32(crcData);
        this.writeUint32BE(chunk, 8 + data.length, crc);

        return chunk;
    }

    deflate(data) {
        const adler32 = this.adler32(data);

        const blocks = [];
        const blockSize = 65535;

        for (let i = 0; i < data.length; i += blockSize) {
            const isLast = i + blockSize >= data.length;
            const blockData = data.subarray(i, Math.min(i + blockSize, data.length));

            const block = new Uint8Array(5 + blockData.length);
            block[0] = isLast ? 1 : 0;
            this.writeUint16BE(block, 1, blockData.length);
            this.writeUint16BE(block, 3, ~blockData.length & 0xFFFF);
            block.set(blockData, 5);
            blocks.push(block);
        }

        let totalLength = 2;
        blocks.forEach(b => totalLength += b.length);
        totalLength += 4;

        const result = new Uint8Array(totalLength);
        result[0] = 0x78;
        result[1] = 0x01;

        let offset = 2;
        blocks.forEach(b => {
            result.set(b, offset);
            offset += b.length;
        });

        this.writeUint32BE(result, offset, adler32);

        return result;
    }

    adler32(data) {
        let a = 1;
        let b = 0;
        const MOD = 65521;

        for (let i = 0; i < data.length; i++) {
            a = (a + data[i]) % MOD;
            b = (b + a) % MOD;
        }

        return (b << 16) | a;
    }

    exportHeightMap(resolution = 256) {
        const minMax = this.getHeightMinMax();
        const range = minMax.max - minMax.min;

        const pixels16Bit = new Uint16Array(resolution * resolution);
        const srcStep = this.terrain.resolution / resolution;

        for (let y = 0; y < resolution; y++) {
            for (let x = 0; x < resolution; x++) {
                const srcX = Math.floor(x * srcStep);
                const srcY = Math.floor(y * srcStep);
                const srcIdx = srcY * this.terrain.resolution + srcX;
                const height = this.terrain.heightMap[srcIdx];

                const normalized = (height - minMax.min) / range;
                const grayValue = Math.max(0, Math.min(65535, Math.floor(normalized * 65535)));

                const dstIdx = y * resolution + x;
                pixels16Bit[dstIdx] = grayValue;
            }
        }

        const pngData = this.createPng(resolution, resolution, pixels16Bit);

        const blob = new Blob([pngData], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `heightmap_${resolution}x${resolution}_16bit.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);

        console.log(`导出16位高度图: ${resolution}x${resolution}, 高度范围: [${minMax.min.toFixed(2)}, ${minMax.max.toFixed(2)}]`);

        return { min: minMax.min, max: minMax.max, bitDepth: 16 };
    }

    getHeightMinMax() {
        let min = Infinity;
        let max = -Infinity;

        for (let i = 0; i < this.terrain.heightMap.length; i++) {
            const h = this.terrain.heightMap[i];
            if (h < min) min = h;
            if (h > max) max = h;
        }

        return { min, max };
    }

    exportOBJ() {
        const geometry = this.terrain.geometry;
        const positions = geometry.attributes.position.array;
        const normals = geometry.attributes.normal.array;
        const uvs = geometry.attributes.uv.array;
        const indices = geometry.index.array;

        let obj = '# Terrain OBJ Export - 16 bit height precision\n';
        obj += `# Vertices: ${positions.length / 3}\n`;
        obj += `# Faces: ${indices.length / 3}\n`;
        obj += `# Height range: ${this.getHeightMinMax().min.toFixed(4)} to ${this.getHeightMinMax().max.toFixed(4)}\n\n`;

        for (let i = 0; i < positions.length; i += 3) {
            obj += `v ${positions[i].toFixed(6)} ${positions[i + 1].toFixed(6)} ${positions[i + 2].toFixed(6)}\n`;
        }

        obj += '\n';

        for (let i = 0; i < normals.length; i += 3) {
            obj += `vn ${normals[i].toFixed(6)} ${normals[i + 1].toFixed(6)} ${normals[i + 2].toFixed(6)}\n`;
        }

        obj += '\n';

        for (let i = 0; i < uvs.length; i += 2) {
            obj += `vt ${uvs[i].toFixed(6)} ${uvs[i + 1].toFixed(6)}\n`;
        }

        obj += '\n';

        for (let i = 0; i < indices.length; i += 3) {
            const i0 = indices[i] + 1;
            const i1 = indices[i + 1] + 1;
            const i2 = indices[i + 2] + 1;
            obj += `f ${i0}/${i0}/${i0} ${i1}/${i1}/${i1} ${i2}/${i2}/${i2}\n`;
        }

        const blob = new Blob([obj], { type: 'text/plain' });
        const link = document.createElement('a');
        link.download = 'terrain.obj';
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
    }

    getMemoryUsage() {
        return 0;
    }
}

export default Exporter;
