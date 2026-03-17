import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/Logger';

/**
 * Bounding box for map area
 */
export interface BoundingBox {
    minLat: number;
    minLon: number;
    maxLat: number;
    maxLon: number;
}

/**
 * Map features to download
 */
export type MapFeature = 'roads' | 'water' | 'parks' | 'buildings' | 'labels';

/**
 * Download progress information
 */
export interface DownloadProgress {
    phase: 'querying' | 'downloading' | 'validating' | 'merging';
    current: number;
    total: number;
    currentChunk?: number;
    totalChunks?: number;
    message?: string;
    speed?: number;
}

/**
 * Download options
 */
export interface DownloadOptions {
    bbox: BoundingBox;
    features: MapFeature[];
    outputPath: string;
    chunkedEnabled?: boolean;
    chunkSize?: number;
    maxRetries?: number;
    useCache?: boolean;
    onProgress?: (progress: DownloadProgress) => void;
    signal?: AbortSignal;
}

/**
 * Download result
 */
export interface DownloadResult {
    success: boolean;
    outputPath?: string;
    fileSizeKB?: number;
    error?: string;
}

/**
 * Overpass API server configuration
 */
const OVERPASS_SERVERS = [
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter',
    'https://overpass.nchc.org.tw/api/interpreter',
];

/**
 * Maximum area size in square degrees before chunking (0.1 deg ~= 10km)
 */
const MAX_CHUNK_SIZE = 0.1;

/**
 * Request timeout in milliseconds
 */
const REQUEST_TIMEOUT = 600000; // 10 minutes

/**
 * Service for downloading OSM data from Overpass API
 */
export class MapDownloadService {
    private currentServerIndex = 0;
    private lastSuccessfulServer: string | null = null;

    /**
     * Download OSM data for the specified bounding box
     */
    public async download(options: DownloadOptions): Promise<DownloadResult> {
        try {
            // Validate bounding box
            this.validateBbox(options.bbox);

            // Check if chunking is needed
            const chunks = this.calculateChunks(options.bbox);
            
            if (chunks.length === 1) {
                // Single request
                return await this.downloadSingle(options);
            } else {
                // Chunked download
                return await this.downloadChunked(options, chunks);
            }
        } catch (error: any) {
            logger.error(`Download failed: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Validate bounding box
     */
    private validateBbox(bbox: BoundingBox): void {
        if (bbox.minLat >= bbox.maxLat) {
            throw new Error('Invalid bbox: minLat must be less than maxLat');
        }
        if (bbox.minLon >= bbox.maxLon) {
            throw new Error('Invalid bbox: minLon must be less than maxLon');
        }
        if (bbox.minLat < -90 || bbox.maxLat > 90) {
            throw new Error('Invalid bbox: latitude must be between -90 and 90');
        }
        if (bbox.minLon < -180 || bbox.maxLon > 180) {
            throw new Error('Invalid bbox: longitude must be between -180 and 180');
        }
    }

    /**
     * Calculate chunks for large areas
     */
    private calculateChunks(bbox: BoundingBox): BoundingBox[] {
        const area = (bbox.maxLat - bbox.minLat) * (bbox.maxLon - bbox.minLon);
        
        if (area <= MAX_CHUNK_SIZE * MAX_CHUNK_SIZE) {
            return [bbox]; // No chunking needed
        }

        const chunks: BoundingBox[] = [];
        const divisions = Math.ceil(Math.sqrt(area / (MAX_CHUNK_SIZE * MAX_CHUNK_SIZE)));
        const latStep = (bbox.maxLat - bbox.minLat) / divisions;
        const lonStep = (bbox.maxLon - bbox.minLon) / divisions;

        for (let i = 0; i < divisions; i++) {
            for (let j = 0; j < divisions; j++) {
                chunks.push({
                    minLat: bbox.minLat + i * latStep,
                    maxLat: bbox.minLat + (i + 1) * latStep,
                    minLon: bbox.minLon + j * lonStep,
                    maxLon: bbox.minLon + (j + 1) * lonStep,
                });
            }
        }

        logger.info(`Large area detected, split into ${chunks.length} chunks`);
        return chunks;
    }

    /**
     * Download single chunk
     */
    private async downloadSingle(options: DownloadOptions): Promise<DownloadResult> {
        const { bbox, features, outputPath, onProgress } = options;

        // Report progress
        onProgress?.({
            phase: 'querying',
            current: 0,
            total: 100,
            message: 'Building Overpass query...'
        });

        // Build Overpass query
        const query = this.buildOverpassQuery(bbox, features);

        // Download data
        const startTime = Date.now();
        let lastProgressTime = startTime;
        let lastBytes = 0;
        
        onProgress?.({
            phase: 'downloading',
            current: 0,
            total: 100,
            message: 'Downloading OSM data...'
        });

        const osmData = await this.queryOverpass(query, options.signal);
        
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        const bytes = osmData.length;
        const speed = duration > 0 ? bytes / duration : 0;
        
        onProgress?.({
            phase: 'downloading',
            current: 50,
            total: 100,
            message: 'Download complete',
            speed: speed
        });

        // Save to file
        onProgress?.({
            phase: 'validating',
            current: 90,
            total: 100,
            message: 'Saving to file...'
        });

        fs.writeFileSync(outputPath, osmData, 'utf-8');
        const fileSizeKB = Math.round(osmData.length / 1024);

        onProgress?.({
            phase: 'validating',
            current: 100,
            total: 100,
            message: 'Download complete'
        });

        logger.info(`Downloaded OSM data: ${fileSizeKB} KB`);

        return {
            success: true,
            outputPath,
            fileSizeKB
        };
    }

    /**
     * Download chunked data and merge
     */
    private async downloadChunked(options: DownloadOptions, chunks: BoundingBox[]): Promise<DownloadResult> {
        const { features, outputPath, onProgress, signal } = options;
        const maxRetries = options.maxRetries ?? 3;

        const chunkData: string[] = [];
        let currentChunk = 0;

        for (const chunk of chunks) {
            currentChunk++;

            onProgress?.({
                phase: 'downloading',
                current: currentChunk,
                total: chunks.length,
                currentChunk,
                totalChunks: chunks.length,
                message: `Downloading chunk ${currentChunk}/${chunks.length}...`
            });

            // Check for cancellation
            if (signal?.aborted) {
                throw new Error('Download cancelled');
            }

            const query = this.buildOverpassQuery(chunk, features);
            
            // Retry loop for each chunk
            let retryCount = 0;
            let chunkSuccess = false;
            let data = '';

            while (retryCount < maxRetries && !chunkSuccess) {
                try {
                    const startTime = Date.now();
                    data = await this.queryOverpass(query, signal);
                    const elapsedSec = (Date.now() - startTime) / 1000;
                    const speedKBps = data.length / elapsedSec / 1024;

                    onProgress?.({
                        phase: 'downloading',
                        current: currentChunk,
                        total: chunks.length,
                        currentChunk,
                        totalChunks: chunks.length,
                        message: `Chunk ${currentChunk}/${chunks.length} downloaded`,
                        speed: speedKBps
                    });

                    chunkSuccess = true;
                } catch (error: any) {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        const retryDelay = 2000 * Math.pow(2, retryCount - 1); // Exponential backoff
                        logger.warn(`Chunk ${currentChunk} failed (attempt ${retryCount}/${maxRetries}), retrying in ${retryDelay / 1000}s...`);
                        await this.delay(retryDelay);
                    } else {
                        throw new Error(`Chunk ${currentChunk} failed after ${maxRetries} attempts: ${error.message}`);
                    }
                }
            }

            chunkData.push(data);

            // Delay between chunks to avoid rate limiting
            if (currentChunk < chunks.length) {
                await this.delay(2000);
            }
        }

        // Merge chunks
        onProgress?.({
            phase: 'merging',
            current: 0,
            total: 100,
            message: 'Merging chunks...'
        });

        const mergedData = this.mergeOsmData(chunkData);
        fs.writeFileSync(outputPath, mergedData, 'utf-8');
        const fileSizeKB = Math.round(mergedData.length / 1024);

        onProgress?.({
            phase: 'merging',
            current: 100,
            total: 100,
            message: 'Download complete'
        });

        logger.info(`Downloaded ${chunks.length} chunks, merged: ${fileSizeKB} KB`);

        return {
            success: true,
            outputPath,
            fileSizeKB
        };
    }

    /**
     * Build Overpass QL query
     */
    private buildOverpassQuery(bbox: BoundingBox, features: MapFeature[]): string {
        const bboxStr = `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`;
        const parts: string[] = [];

        // Always include place labels
        parts.push(`node["place"~"city|town|village|suburb"](${bboxStr});`);

        if (features.includes('roads')) {
            parts.push(`way["highway"](${bboxStr});`);
        }
        if (features.includes('water')) {
            parts.push(`way["natural"="water"](${bboxStr});`);
            parts.push(`way["waterway"~"river|stream"](${bboxStr});`);
            parts.push(`relation["natural"="water"](${bboxStr});`);
        }
        if (features.includes('parks')) {
            parts.push(`way["leisure"="park"](${bboxStr});`);
            parts.push(`way["landuse"~"forest|grass"](${bboxStr});`);
            parts.push(`relation["leisure"="park"](${bboxStr});`);
        }
        if (features.includes('buildings')) {
            parts.push(`way["building"](${bboxStr});`);
            parts.push(`relation["building"](${bboxStr});`);
        }

        // Get nodes referenced by ways
        parts.push(`node(w);`);

        return `[out:xml][timeout:600];(${parts.join('\n')});out body;>;out skel qt;`;
    }

    /**
     * Query Overpass API with multi-server fallback
     */
    private async queryOverpass(query: string, signal?: AbortSignal): Promise<string> {
        // Try preferred server first
        if (this.lastSuccessfulServer) {
            try {
                return await this.httpPost(this.lastSuccessfulServer, query, signal);
            } catch (error) {
                logger.warn(`Preferred server failed, trying others...`);
                this.lastSuccessfulServer = null;
            }
        }

        // Try all servers
        const errors: string[] = [];
        
        for (let i = 0; i < OVERPASS_SERVERS.length; i++) {
            const serverIndex = (this.currentServerIndex + i) % OVERPASS_SERVERS.length;
            const server = OVERPASS_SERVERS[serverIndex];

            try {
                logger.info(`Trying Overpass server: ${server}`);
                const data = await this.httpPost(server, query, signal);
                
                // Success - remember this server
                this.lastSuccessfulServer = server;
                this.currentServerIndex = serverIndex;
                
                return data;
            } catch (error: any) {
                const errorMsg = `${server}: ${error.message}`;
                errors.push(errorMsg);
                logger.warn(errorMsg);
            }
        }

        // All servers failed
        throw new Error(`All Overpass servers failed:\n${errors.join('\n')}`);
    }

    /**
     * Perform HTTP POST request
     */
    private httpPost(url: string, data: string, signal?: AbortSignal): Promise<string> {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';
            const client = isHttps ? https : http;

            const postData = `data=${encodeURIComponent(data)}`;

            const options: https.RequestOptions = {
                method: 'POST',
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData),
                    'User-Agent': 'HoneyGUI-MapTools/1.0'
                },
                timeout: REQUEST_TIMEOUT
            };

            const req = client.request(options, (res) => {
                let body = '';

                res.on('data', (chunk) => {
                    body += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(body);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    }
                });

                res.on('error', (error) => {
                    reject(error);
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            // Handle abort signal
            if (signal) {
                signal.addEventListener('abort', () => {
                    req.destroy();
                    reject(new Error('Request cancelled'));
                });
            }

            req.write(postData);
            req.end();
        });
    }

    /**
     * Merge multiple OSM XML chunks into one
     */
    private mergeOsmData(chunks: string[]): string {
        if (chunks.length === 0) {
            return '';
        }
        if (chunks.length === 1) {
            return chunks[0];
        }

        // Parse first chunk as base
        const baseMatch = chunks[0].match(/<osm[^>]*>([\s\S]*)<\/osm>/);
        if (!baseMatch) {
            throw new Error('Invalid OSM XML format');
        }

        let mergedContent = baseMatch[1];
        const seenIds = new Set<string>();

        // Extract IDs from first chunk
        this.extractIds(chunks[0], seenIds);

        // Merge remaining chunks
        for (let i = 1; i < chunks.length; i++) {
            const chunkMatch = chunks[i].match(/<osm[^>]*>([\s\S]*)<\/osm>/);
            if (!chunkMatch) {
                logger.warn(`Skipping invalid chunk ${i + 1}`);
                continue;
            }

            // Extract nodes, ways, relations from chunk
            const elements = this.extractElements(chunks[i]);
            
            for (const element of elements) {
                const idMatch = element.match(/id="(\d+)"/);
                if (idMatch) {
                    const id = idMatch[1];
                    if (!seenIds.has(id)) {
                        mergedContent += element;
                        seenIds.add(id);
                    }
                }
            }
        }

        // Reconstruct OSM XML
        return `<?xml version="1.0" encoding="UTF-8"?>\n<osm version="0.6">\n${mergedContent}</osm>`;
    }

    /**
     * Extract element IDs from OSM XML
     */
    private extractIds(xml: string, ids: Set<string>): void {
        const idRegex = /id="(\d+)"/g;
        let match;
        while ((match = idRegex.exec(xml)) !== null) {
            ids.add(match[1]);
        }
    }

    /**
     * Extract node/way/relation elements from OSM XML
     */
    private extractElements(xml: string): string[] {
        const elements: string[] = [];
        const nodeRegex = /<node[^>]*>[\s\S]*?<\/node>/g;
        const wayRegex = /<way[^>]*>[\s\S]*?<\/way>/g;
        const relationRegex = /<relation[^>]*>[\s\S]*?<\/relation>/g;

        let match;
        
        while ((match = nodeRegex.exec(xml)) !== null) {
            elements.push(match[0]);
        }
        while ((match = wayRegex.exec(xml)) !== null) {
            elements.push(match[0]);
        }
        while ((match = relationRegex.exec(xml)) !== null) {
            elements.push(match[0]);
        }

        return elements;
    }

    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
