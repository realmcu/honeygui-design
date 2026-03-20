/**
 * FastLZ Compression - 完全按照 rtk_fastlz.cpp 中的
 * RTK_FASTLZ_COMPRESSOR_LEVEL1 和 rtk_fastrlz_compressor_withheader 实现
 */

import { CompressionAlgorithm, CompressionResult } from './base';

const ALGORITHM_FASTLZ = 1;

const LITERAL_RUN = 1;
const SHORT_MATCH = 2;
const LONG_MATCH = 3;

const MAX_COPY = 32;
const MAX_LEN = 264;
const MAX_DISTANCE = 64;

const HASH_LOG = 13;
const HASH_SIZE = 1 << HASH_LOG;
const HASH_MASK = HASH_SIZE - 1;

function FASTLZ_READU16(data: Buffer, pos: number): number {
    return data[pos] | (data[pos + 1] << 8);
}

function hashFunction(data: Buffer, pos: number): number {
    let v = FASTLZ_READU16(data, pos);
    v ^= FASTLZ_READU16(data, pos + 1) ^ (v >>> (16 - HASH_LOG));
    v &= HASH_MASK;
    return v;
}

/**
 * RTK_FASTLZ_COMPRESSOR_LEVEL1 的逐行移植
 *
 * C 代码中的指针关系：
 *   ip 初始 = input (即 offset 0)
 *   ip_bound = ip + length - 2  => index: length - 2
 *   ip_limit = ip + length - 12 => index: length - 12
 *   op 初始 = output (即 offset 0)
 */
function RTK_FASTLZ_COMPRESSOR_LEVEL1(input: Buffer, length: number): Buffer {
    const output = Buffer.alloc(length * 2);
    let op = 0;
    let ip = 0;

    // C: const flzuint8* ip_bound = ip + length - 2;
    const ip_bound = length - 2;
    // C: const flzuint8* ip_limit = ip + length - 12;
    const ip_limit = length - 12;

    const htab = new Int32Array(HASH_SIZE);
    // C: for (hslot = htab; hslot < htab + HASH_SIZE; hslot++) *hslot = ip;
    // ip = 0 at this point, Int32Array defaults to 0, so this is correct.

    // C: if (length < 4)
    if (length < 4) {
        if (length) {
            // C: *op++ = length - 1;
            output[op++] = length - 1;
            // C: ip_bound++; while (ip <= ip_bound) *op++ = *ip++;
            for (let i = 0; i < length; i++) {
                output[op++] = input[i];
            }
            return output.subarray(0, op);
        } else {
            return Buffer.alloc(0);
        }
    }

    // C: instruction_type = LITERAL_RUN;
    // C: copy = 2;
    // C: *op++ = MAX_COPY - 1;
    // C: *op++ = *ip++;
    // C: *op++ = *ip++;
    let copy = 2;
    output[op++] = MAX_COPY - 1;
    output[op++] = input[ip++];
    output[op++] = input[ip++];

    // C: while (ip < ip_limit)
    while (ip < ip_limit) {
        // C: const flzuint8* anchor = ip;
        const anchor = ip;
        let ref: number;
        let distance: number;
        let len = 3;
        let instruction_type: number;

        // C: HASH_FUNCTION(hval, ip);
        const hval = hashFunction(input, ip);
        // C: ref = htab[hval];
        ref = htab[hval];
        // C: distance = anchor - ref;
        distance = anchor - ref;
        // C: *hslot = anchor;
        htab[hval] = anchor;

        // C: if ((distance == 0) || (distance >= MAX_DISTANCE)
        //       || (*ref++ != *ip++) || (*ref++ != *ip++) || (*ref++ != *ip++))
        if (distance === 0 || distance >= MAX_DISTANCE ||
            input[ref] !== input[ip] ||
            input[ref + 1] !== input[ip + 1] ||
            input[ref + 2] !== input[ip + 2]) {
            instruction_type = LITERAL_RUN;
        } else {
            // C: if (copy) *(op - copy - 1) = copy - 1; else op--;
            if (copy) {
                output[op - copy - 1] = copy - 1;
            } else {
                op--;
            }
            // C: copy = 0;
            copy = 0;

            // C: distance--;
            distance--;
            // C: ip = anchor + len;  (len=3)
            ip = anchor + len;
            ref = ref + len;

            // C: while (ip < ip_bound) if (*ref++ != *ip++) break;
            // 注意：C 中 *ref++ != *ip++ 即使 break，ip 也已自增
            while (ip < ip_bound) {
                if (input[ref++] !== input[ip++]) { break; }
            }
            // C: ip -= 1;
            ip--;
            // C: len = ip - anchor;
            len = ip - anchor;

            if ((len - 2) < 7) {
                instruction_type = SHORT_MATCH;
            } else {
                instruction_type = LONG_MATCH;
            }
        }

        // C: output code for each instruction
        if (instruction_type === LITERAL_RUN) {
            // C: *op++ = *anchor++;
            output[op++] = input[anchor];
            // C: ip = anchor;  (anchor was incremented, so ip = anchor + 1)
            ip = anchor + 1;
            // C: copy++;
            copy++;
            // C: if (copy == MAX_COPY) { copy = 0; *op++ = MAX_COPY - 1; }
            if (copy === MAX_COPY) {
                copy = 0;
                output[op++] = MAX_COPY - 1;
            }
        } else if (instruction_type === SHORT_MATCH) {
            // C: *op++ = ((len - 2) << 5) + (distance >> 8);
            output[op++] = ((len - 2) << 5) + (distance >> 8);
            // C: *op++ = (distance & 255);
            output[op++] = distance & 255;

            // C: HASH_FUNCTION(hval, (ip - 1)); htab[hval] = (ip - 1);
            htab[hashFunction(input, ip - 1)] = ip - 1;
            // C: HASH_FUNCTION(hval, (ip - 2)); htab[hval] = (ip - 2);
            htab[hashFunction(input, ip - 2)] = ip - 2;

            // C: *op++ = MAX_COPY - 1;
            output[op++] = MAX_COPY - 1;
        } else {
            // LONG_MATCH
            // C: if (len > MAX_LEN) { while (len > MAX_LEN) { ... len -= MAX_LEN - 2; } }
            if (len > MAX_LEN) {
                while (len > MAX_LEN) {
                    output[op++] = (7 << 5) + (distance >> 8);
                    output[op++] = MAX_LEN - 2 - 7 - 2;
                    output[op++] = distance & 255;
                    len -= MAX_LEN - 2;
                }
            }
            // C: len -= 2;
            len -= 2;
            if (len < 7) {
                output[op++] = (len << 5) + (distance >> 8);
                output[op++] = distance & 255;
            } else {
                output[op++] = (7 << 5) + (distance >> 8);
                output[op++] = len - 7;
                output[op++] = distance & 255;
            }

            htab[hashFunction(input, ip - 1)] = ip - 1;
            htab[hashFunction(input, ip - 2)] = ip - 2;

            output[op++] = MAX_COPY - 1;
        }
    }

    // C: ip_bound++;
    // C: while (ip <= ip_bound) { *op++ = *ip++; copy++; ... }
    const finalBound = ip_bound + 1;  // length - 1
    while (ip <= finalBound) {
        output[op++] = input[ip++];
        copy++;
        if (copy === MAX_COPY) {
            copy = 0;
            output[op++] = MAX_COPY - 1;
        }
    }

    // C: if (copy) *(op - copy - 1) = copy - 1; else op--;
    if (copy) {
        output[op - copy - 1] = copy - 1;
    } else {
        op--;
    }

    return output.subarray(0, op);
}

export class FastLzCompression implements CompressionAlgorithm {
    compress(
        pixelData: Buffer,
        width: number,
        height: number,
        pixelBytes: number,
        bytesPerLine?: number
    ): CompressionResult {
        const actualBytesPerLine = bytesPerLine ?? (width * pixelBytes);
        const compressedBlocks: Buffer[] = [];

        for (let line = 0; line < height; line++) {
            const blockStart = line * actualBytesPerLine;
            const blockData = pixelData.subarray(blockStart, blockStart + actualBytesPerLine);
            const compressed = RTK_FASTLZ_COMPRESSOR_LEVEL1(blockData, actualBytesPerLine);

            // C: if (compressed_line_counter != 0)
            //      output_data_buffer[0] = (output_data_buffer[0] & 0x1F);
            if (line !== 0 && compressed.length > 0) {
                compressed[0] = compressed[0] & 0x1F;
            }

            compressedBlocks.push(compressed);
        }

        const parts: Buffer[] = [];
        const lineOffsets: number[] = [];
        let offset = 0;

        for (let i = 0; i < compressedBlocks.length; i++) {
            lineOffsets.push(offset);
            parts.push(compressedBlocks[i]);
            offset += compressedBlocks[i].length;
        }

        return {
            compressedData: Buffer.concat(parts),
            lineOffsets,
            params: { feature_1: 0, feature_2: 0 },
        };
    }

    getAlgorithmType(): number {
        return ALGORITHM_FASTLZ;
    }
}
