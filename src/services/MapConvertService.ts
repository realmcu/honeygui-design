import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { logger } from '../utils/Logger';

/**
 * Map features
 */
export type MapFeature = 'roads' | 'water' | 'parks' | 'buildings' | 'labels';

/**
 * Convert progress information
 */
export interface ConvertProgress {
    phase: 'parsing' | 'building' | 'writing' | 'indexing';
    step: string;
    current: number;
    total: number;
}

/**
 * Convert options
 */
export interface ConvertOptions {
    inputPath: string;
    outputPath: string;
    features: MapFeature[];
    simplifyPoly?: number;
    simplifyRoads?: number;
    bbox?: {
        minLat: number;
        minLon: number;
        maxLat: number;
        maxLon: number;
    };
    onProgress?: (progress: ConvertProgress) => void;
    signal?: AbortSignal;
}

/**
 * Convert result
 */
export interface ConvertResult {
    success: boolean;
    outputPath?: string;
    stats?: {
        nodeCount: number;
        edgeCount: number;
        areaCount: number;
        labelCount: number;
    };
    error?: string;
}

/**
 * TRMAP binary format constants
 */
const MAGIC = 'TMAP';
const VERSION = 7;

// Feature flags (must match map_types.h)
const MAP_FEATURE_ROADS = 0x01;
const MAP_FEATURE_WATER = 0x02;
const MAP_FEATURE_PARKS = 0x04;
const MAP_FEATURE_BUILDINGS = 0x08;
const MAP_FEATURE_LABELS = 0x10;

// Road types (must match map_types.h)
const ROAD_TYPES: Record<string, number> = {
    'service': 0,
    'alley': 0,
    'residential': 1,
    'living_street': 1,
    'unclassified': 1,
    'path': 1,
    'footway': 1,
    'cycleway': 1,
    'pedestrian': 1,
    'track': 1,
    'steps': 1,
    'bridleway': 1,
    'tertiary': 2,
    'tertiary_link': 2,
    'secondary': 3,
    'secondary_link': 3,
    'primary': 4,
    'primary_link': 4,
    'trunk': 5,
    'trunk_link': 5,
    'motorway': 6,
    'motorway_link': 6
};

// Area types (must match map_types.h)
const AREA_WATER = 0;
const AREA_PARK = 1;
const AREA_FOREST = 2;
const AREA_GRASS = 3;
const AREA_BUILDING = 4;

// Label types (must match map_types.h)
const LABEL_ROAD = 0;
const LABEL_PLACE = 1;
const LABEL_POI = 2;
const LABEL_WATER = 3;
const LABEL_PARK = 4;

// Spatial index configuration
const SPATIAL_INDEX_CELL_SIZE_DEG = 0.005; // ~500m at equator

/**
 * OSM data structures
 */
interface OSMNode {
    id: string;
    lat: number;
    lon: number;
    tags: Map<string, string>;
}

interface OSMWay {
    id: string;
    nodes: string[]; // node IDs
    tags: Map<string, string>;
}

interface OSMRelation {
    id: string;
    members: Array<{ type: string; ref: string; role: string }>;
    tags: Map<string, string>;
}

interface Edge {
    fromNodeId: string;
    toNodeId: string;
    distance: number;
    roadType: number;
    oneway: boolean;
    roundabout: boolean;
}

interface Area {
    type: number; // 0=water, 1=park, 2=forest, 3=grass, 4=building
    points: Array<{ lat: number; lon: number }>;
}

interface Label {
    lat: number;
    lon: number;
    text: string;
    type: number; // 0=road, 1=place, 2=poi, 3=water, 4=park
    priority: number;
    roadType?: number;
    areaSqm?: number;
}

/**
 * Service for converting OSM XML to TRMAP binary format
 */
export class MapConvertService {
    /**
     * Calculate perpendicular distance from point to line segment
     */
    private perpendicularDistance(
        point: { lat: number; lon: number },
        lineStart: { lat: number; lon: number },
        lineEnd: { lat: number; lon: number }
    ): number {
        const lat = point.lat;
        const lon = point.lon;
        const lat1 = lineStart.lat;
        const lon1 = lineStart.lon;
        const lat2 = lineEnd.lat;
        const lon2 = lineEnd.lon;

        const latScale = 111320;
        const lonScale = 111320 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);

        const x = (lon - lon1) * lonScale;
        const y = (lat - lat1) * latScale;
        const x2 = (lon2 - lon1) * lonScale;
        const y2 = (lat2 - lat1) * latScale;

        const lineLenSq = x2 * x2 + y2 * y2;

        if (lineLenSq === 0) {
            return Math.sqrt(x * x + y * y);
        }

        const cross = Math.abs(x2 * y - y2 * x);
        return cross / Math.sqrt(lineLenSq);
    }

    /**
     * Douglas-Peucker simplification algorithm
     */
    private douglasPeucker(
        points: Array<{ lat: number; lon: number }>,
        epsilon: number
    ): Array<{ lat: number; lon: number }> {
        if (points.length <= 2) {
            return points;
        }

        let maxDist = 0;
        let maxIdx = 0;

        for (let i = 1; i < points.length - 1; i++) {
            const dist = this.perpendicularDistance(points[i], points[0], points[points.length - 1]);
            if (dist > maxDist) {
                maxDist = dist;
                maxIdx = i;
            }
        }

        if (maxDist > epsilon) {
            const left = this.douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
            const right = this.douglasPeucker(points.slice(maxIdx), epsilon);
            return left.slice(0, -1).concat(right);
        } else {
            return [points[0], points[points.length - 1]];
        }
    }

    /**
     * Simplify polygon with Douglas-Peucker
     */
    private simplifyPolygon(
        points: Array<{ lat: number; lon: number }>,
        epsilon: number,
        minPoints: number = 4
    ): Array<{ lat: number; lon: number }> {
        if (points.length <= minPoints) {
            return points;
        }

        const isClosed = points.length >= 2 &&
            points[0].lat === points[points.length - 1].lat &&
            points[0].lon === points[points.length - 1].lon;

        if (isClosed) {
            const openPoints = points.slice(0, -1);

            if (openPoints.length >= 3) {
                const result = this.douglasPeucker(openPoints, epsilon);

                if (result.length < minPoints - 1) {
                    return points;
                }

                if (result[0].lat !== result[result.length - 1].lat ||
                    result[0].lon !== result[result.length - 1].lon) {
                    result.push(result[0]);
                }

                return result;
            }
        }

        const simplified = this.douglasPeucker(points, epsilon);
        return simplified.length >= minPoints ? simplified : points;
    }
    /**
     * Convert OSM XML to TRMAP binary format
     */
    public async convert(options: ConvertOptions): Promise<ConvertResult> {
        try {
            // Check abort signal
            if (options.signal?.aborted) {
                return { success: false, error: 'Aborted' };
            }

            // Parse feature bitmask
            const featureBitmask = this.parseFeatures(options.features);

            // Phase 1: Parse OSM XML
            options.onProgress?.({
                phase: 'parsing',
                step: 'Loading OSM file',
                current: 0,
                total: 0
            });

            const osmData = await this.parseOSMFile(options.inputPath, options.bbox);
            
            if (options.signal?.aborted) {
                return { success: false, error: 'Aborted' };
            }

            // Phase 2: Build graph structures
            options.onProgress?.({
                phase: 'building',
                step: 'Building graph',
                current: 0,
                total: 0
            });

            const graph = await this.buildGraph(
                osmData,
                featureBitmask,
                options.signal,
                options.simplifyPoly,
                options.simplifyRoads
            );

            if (options.signal?.aborted) {
                return { success: false, error: 'Aborted' };
            }

            // Phase 3: Build spatial index
            options.onProgress?.({
                phase: 'indexing',
                step: 'Building spatial index',
                current: 0,
                total: 0
            });

            const spatialIndex = this.buildSpatialIndex(graph);

            if (options.signal?.aborted) {
                return { success: false, error: 'Aborted' };
            }

            // Phase 4: Write binary file
            options.onProgress?.({
                phase: 'writing',
                step: 'Writing TRMAP file',
                current: 0,
                total: 0
            });

            await this.writeTRMAPFile(options.outputPath, graph, spatialIndex, featureBitmask);

            return {
                success: true,
                outputPath: options.outputPath,
                stats: {
                    nodeCount: graph.nodes.length,
                    edgeCount: graph.edges.length,
                    areaCount: graph.areas.length,
                    labelCount: graph.labels.length
                }
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`MapConvertService: Convert failed - ${errorMsg}`);
            return {
                success: false,
                error: errorMsg
            };
        }
    }

    /**
     * Parse feature list to bitmask
     */
    private parseFeatures(features: MapFeature[]): number {
        let bitmask = 0;
        for (const feature of features) {
            switch (feature) {
                case 'roads':
                    bitmask |= MAP_FEATURE_ROADS;
                    break;
                case 'water':
                    bitmask |= MAP_FEATURE_WATER;
                    break;
                case 'parks':
                    bitmask |= MAP_FEATURE_PARKS;
                    break;
                case 'buildings':
                    bitmask |= MAP_FEATURE_BUILDINGS;
                    break;
                case 'labels':
                    bitmask |= MAP_FEATURE_LABELS;
                    break;
            }
        }
        return bitmask;
    }

    /**
     * Parse OSM XML file
     */
    private async parseOSMFile(
        filePath: string,
        bbox?: { minLat: number; minLon: number; maxLat: number; maxLon: number }
    ): Promise<{
        nodes: Map<string, OSMNode>;
        ways: OSMWay[];
        relations: OSMRelation[];
    }> {
        const xmlContent = await fs.promises.readFile(filePath, 'utf-8');

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
            textNodeName: 'text',
            isArray: (name) => ['node', 'way', 'relation', 'tag', 'nd', 'member'].includes(name)
        });

        const result = parser.parse(xmlContent);
        const osm = result.osm;

        const nodes = new Map<string, OSMNode>();
        const ways: OSMWay[] = [];
        const relations: OSMRelation[] = [];

        const isInBbox = (lat: number, lon: number): boolean => {
            if (!bbox) return true;
            return lat >= bbox.minLat && lat <= bbox.maxLat &&
                   lon >= bbox.minLon && lon <= bbox.maxLon;
        };

        // Parse nodes
        if (osm.node) {
            for (const nodeData of osm.node) {
                const lat = parseFloat(nodeData.lat);
                const lon = parseFloat(nodeData.lon);

                if (!isInBbox(lat, lon)) {
                    continue;
                }

                const node: OSMNode = {
                    id: nodeData.id,
                    lat,
                    lon,
                    tags: new Map()
                };

                if (nodeData.tag) {
                    for (const tag of nodeData.tag) {
                        node.tags.set(tag.k, tag.v);
                    }
                }

                nodes.set(node.id, node);
            }
        }

        // Parse ways
        if (osm.way) {
            for (const wayData of osm.way) {
                const way: OSMWay = {
                    id: wayData.id,
                    nodes: [],
                    tags: new Map()
                };

                if (wayData.nd) {
                    for (const nd of wayData.nd) {
                        way.nodes.push(nd.ref);
                    }
                }

                if (wayData.tag) {
                    for (const tag of wayData.tag) {
                        way.tags.set(tag.k, tag.v);
                    }
                }

                ways.push(way);
            }
        }

        // Parse relations
        if (osm.relation) {
            for (const relData of osm.relation) {
                const relation: OSMRelation = {
                    id: relData.id,
                    members: [],
                    tags: new Map()
                };

                if (relData.member) {
                    for (const member of relData.member) {
                        relation.members.push({
                            type: member.type,
                            ref: member.ref,
                            role: member.role
                        });
                    }
                }

                if (relData.tag) {
                    for (const tag of relData.tag) {
                        relation.tags.set(tag.k, tag.v);
                    }
                }

                relations.push(relation);
            }
        }

        return { nodes, ways, relations };
    }

    /**
     * Build graph from OSM data
     */
    private async buildGraph(
        osmData: { nodes: Map<string, OSMNode>; ways: OSMWay[]; relations: OSMRelation[] },
        featureBitmask: number,
        signal?: AbortSignal,
        simplifyPoly?: number,
        simplifyRoads?: number
    ): Promise<{
        nodes: OSMNode[];
        edges: Edge[];
        areas: Area[];
        labels: Label[];
        bounds: { minLat: number; minLon: number; maxLat: number; maxLon: number };
        nodeIndexMap: Map<string, number>;
    }> {
        const { nodes: osmNodes, ways, relations } = osmData;
        
        // Calculate bounds
        let minLat = 90, minLon = 180, maxLat = -90, maxLon = -180;
        osmNodes.forEach(node => {
            minLat = Math.min(minLat, node.lat);
            minLon = Math.min(minLon, node.lon);
            maxLat = Math.max(maxLat, node.lat);
            maxLon = Math.max(maxLon, node.lon);
        });

        const edges: Edge[] = [];
        const areas: Area[] = [];
        const labels: Label[] = [];
        const usedNodeIds = new Set<string>();

        // Identify junction nodes for road simplification
        const nodeUsageCount = new Map<string, number>();
        if (simplifyRoads && simplifyRoads > 0) {
            for (const way of ways) {
                if (way.tags.has('highway')) {
                    for (const nodeId of way.nodes) {
                        nodeUsageCount.set(nodeId, (nodeUsageCount.get(nodeId) || 0) + 1);
                    }
                }
            }
        }

        const junctionNodes = new Set<string>();
        if (simplifyRoads && simplifyRoads > 0) {
            nodeUsageCount.forEach((count, nodeId) => {
                if (count >= 2) {
                    junctionNodes.add(nodeId);
                }
            });
            for (const way of ways) {
                if (way.tags.has('highway') && way.nodes.length >= 2) {
                    junctionNodes.add(way.nodes[0]);
                    junctionNodes.add(way.nodes[way.nodes.length - 1]);
                }
            }
        }

        // Process ways
        for (const way of ways) {
            if (signal?.aborted) throw new Error('Aborted');

            // Process roads
            if ((featureBitmask & MAP_FEATURE_ROADS) && way.tags.has('highway')) {
                const roadType = this.getRoadType(way.tags.get('highway')!);
                const oneway = way.tags.get('oneway') === 'yes';
                const roundabout = way.tags.get('junction') === 'roundabout';

                let roadNodeIds = way.nodes;

                if (simplifyRoads && simplifyRoads > 0 && way.nodes.length > 2) {
                    const points: Array<{ lat: number; lon: number }> = [];
                    const validNodeIds: string[] = [];
                    for (const nodeId of way.nodes) {
                        const node = osmNodes.get(nodeId);
                        if (node) {
                            points.push({ lat: node.lat, lon: node.lon });
                            validNodeIds.push(nodeId);
                        }
                    }

                    if (points.length >= 2) {
                        let epsilon = simplifyRoads;
                        if (roadType >= 4) {
                            epsilon = Math.max(epsilon * 0.5, 2.0);
                        } else if (roadType >= 2) {
                            epsilon = Math.max(epsilon * 0.7, 3.0);
                        }

                        const simplifiedPoints = this.douglasPeucker(points, epsilon);
                        const simplifiedSet = new Set(simplifiedPoints.map(p => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`));

                        const simplifiedNodeIds: string[] = [];
                        for (let i = 0; i < validNodeIds.length; i++) {
                            const nodeId = validNodeIds[i];
                            const point = points[i];
                            const key = `${point.lat.toFixed(6)},${point.lon.toFixed(6)}`;
                            if (simplifiedSet.has(key) || junctionNodes.has(nodeId)) {
                                if (!simplifiedNodeIds.includes(nodeId)) {
                                    simplifiedNodeIds.push(nodeId);
                                }
                            }
                        }

                        if (simplifiedNodeIds.length >= 2) {
                            roadNodeIds = simplifiedNodeIds;
                        }
                    }
                }

                for (let i = 0; i < roadNodeIds.length - 1; i++) {
                    const fromId = roadNodeIds[i];
                    const toId = roadNodeIds[i + 1];
                    const fromNode = osmNodes.get(fromId);
                    const toNode = osmNodes.get(toId);

                    if (fromNode && toNode) {
                        usedNodeIds.add(fromId);
                        usedNodeIds.add(toId);

                        const distance = this.haversineDistance(
                            fromNode.lat, fromNode.lon,
                            toNode.lat, toNode.lon
                        );

                        edges.push({ fromNodeId: fromId, toNodeId: toId, distance, roadType, oneway, roundabout });

                        if (!oneway && !roundabout) {
                            edges.push({ fromNodeId: toId, toNodeId: fromId, distance, roadType, oneway: false, roundabout: false });
                        }
                    }
                }

                // Road label
                const roadName = way.tags.get('name') || way.tags.get('name:zh') || way.tags.get('name:en');
                if (roadName && roadNodeIds.length > 0) {
                    const midIdx = Math.floor(roadNodeIds.length / 2);
                    const midNode = osmNodes.get(roadNodeIds[midIdx]);
                    if (midNode) {
                        labels.push({
                            lat: midNode.lat,
                            lon: midNode.lon,
                            text: roadName,
                            type: LABEL_ROAD,
                            priority: roadType >= 4 ? 6 : roadType,
                            roadType
                        });
                    }
                }
            }

            // Process areas
            const areaType = this.getAreaType(way.tags);
            if (areaType !== null && this.isClosedWay(way)) {
                const shouldInclude = 
                    (areaType === AREA_WATER && (featureBitmask & MAP_FEATURE_WATER)) ||
                    ([AREA_PARK, AREA_FOREST, AREA_GRASS].includes(areaType) && (featureBitmask & MAP_FEATURE_PARKS)) ||
                    (areaType === AREA_BUILDING && (featureBitmask & MAP_FEATURE_BUILDINGS));

                if (shouldInclude) {
                    let points: Array<{ lat: number; lon: number }> = [];
                    for (const nodeId of way.nodes) {
                        const node = osmNodes.get(nodeId);
                        if (node) {
                            points.push({ lat: node.lat, lon: node.lon });
                        }
                    }

                    if (points.length >= 3) {
                        if (simplifyPoly && simplifyPoly > 0) {
                            let epsilon = simplifyPoly;
                            if (areaType === AREA_BUILDING) {
                                epsilon = Math.min(epsilon, 5.0);
                            }
                            const simplified = this.simplifyPolygon(points, epsilon);
                            if (simplified.length >= 3 && simplified.length < points.length) {
                                points = simplified;
                            }
                        }

                        areas.push({ type: areaType, points });

                        // Area label
                        const areaName = way.tags.get('name') || way.tags.get('name:zh') || way.tags.get('name:en');
                        if (areaName) {
                            const centerLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
                            const centerLon = points.reduce((sum, p) => sum + p.lon, 0) / points.length;
                            
                            labels.push({
                                lat: centerLat,
                                lon: centerLon,
                                text: areaName,
                                type: areaType === AREA_WATER ? LABEL_WATER : LABEL_PARK,
                                priority: 5
                            });
                        }
                    }
                }
            }
        }

        // Process relations (multipolygons)
        for (const relation of relations) {
            if (signal?.aborted) throw new Error('Aborted');

            if (relation.tags.get('type') === 'multipolygon') {
                const areaType = this.getAreaType(relation.tags);
                if (areaType !== null) {
                    const shouldInclude = 
                        (areaType === AREA_WATER && (featureBitmask & MAP_FEATURE_WATER)) ||
                        ([AREA_PARK, AREA_FOREST, AREA_GRASS].includes(areaType) && (featureBitmask & MAP_FEATURE_PARKS)) ||
                        (areaType === AREA_BUILDING && (featureBitmask & MAP_FEATURE_BUILDINGS));

                    if (shouldInclude) {
                        // Extract outer ways
                        const outerWays: string[][] = [];
                        for (const member of relation.members) {
                            if (member.type === 'way' && member.role === 'outer') {
                                const way = ways.find(w => w.id === member.ref);
                                if (way && way.nodes.length >= 2) {
                                    outerWays.push([...way.nodes]);
                                }
                            }
                        }

                        // Merge ways into polygons
                        const polygons = this.mergeWaysToPolygons(outerWays);
                        
                        for (const polygon of polygons) {
                            const points: Array<{ lat: number; lon: number }> = [];
                            for (const nodeId of polygon) {
                                const node = osmNodes.get(nodeId);
                                if (node) {
                                    points.push({ lat: node.lat, lon: node.lon });
                                }
                            }

                            if (points.length >= 3) {
                                areas.push({ type: areaType, points });
                            }
                        }
                    }
                }
            }
        }

        // Build node list from used nodes
        const nodeList: OSMNode[] = [];
        const nodeIndexMap = new Map<string, number>();
        let index = 0;
        
        for (const nodeId of Array.from(usedNodeIds).sort()) {
            const node = osmNodes.get(nodeId);
            if (node) {
                nodeList.push(node);
                nodeIndexMap.set(nodeId, index++);
            }
        }

        return {
            nodes: nodeList,
            edges,
            areas,
            labels,
            bounds: { minLat, minLon, maxLat, maxLon },
            nodeIndexMap
        };
    }

    /**
     * Build spatial index for fast rendering
     */
    private buildSpatialIndex(graph: {
        nodes: OSMNode[];
        edges: Edge[];
        areas: Area[];
        bounds: { minLat: number; minLon: number; maxLat: number; maxLon: number };
        nodeIndexMap: Map<string, number>;
    }): {
        gridCols: number;
        gridRows: number;
        cellOffsets: number[];
        cellEdges: number[];
        areaCellOffsets: number[];
        areaCellIndices: number[];
    } {
        const { bounds, edges, areas, nodeIndexMap, nodes } = graph;
        const { minLat, minLon, maxLat, maxLon } = bounds;

        const latRange = maxLat - minLat;
        const lonRange = maxLon - minLon;

        // Calculate grid dimensions
        let gridCols = Math.max(1, Math.floor(lonRange / SPATIAL_INDEX_CELL_SIZE_DEG) + 1);
        let gridRows = Math.max(1, Math.floor(latRange / SPATIAL_INDEX_CELL_SIZE_DEG) + 1);

        // Limit grid size
        if (gridCols * gridRows > 10000) {
            const scale = Math.sqrt(10000 / (gridCols * gridRows));
            gridCols = Math.max(1, Math.floor(gridCols * scale));
            gridRows = Math.max(1, Math.floor(gridRows * scale));
        }

        const totalCells = gridCols * gridRows;
        const cellLat = latRange / gridRows;
        const cellLon = lonRange / gridCols;

        // Build edge spatial index
        const cellEdgesLists: number[][] = Array.from({ length: totalCells }, () => []);

        for (let edgeIdx = 0; edgeIdx < edges.length; edgeIdx++) {
            const edge = edges[edgeIdx];
            const fromIdx = nodeIndexMap.get(edge.fromNodeId);
            const toIdx = nodeIndexMap.get(edge.toNodeId);

            if (fromIdx === undefined || toIdx === undefined) continue;

            const fromNode = nodes[fromIdx];
            const toNode = nodes[toIdx];

            const edgeMinLat = Math.min(fromNode.lat, toNode.lat);
            const edgeMaxLat = Math.max(fromNode.lat, toNode.lat);
            const edgeMinLon = Math.min(fromNode.lon, toNode.lon);
            const edgeMaxLon = Math.max(fromNode.lon, toNode.lon);

            const colStart = Math.max(0, Math.floor((edgeMinLon - minLon) / cellLon));
            const colEnd = Math.min(gridCols - 1, Math.floor((edgeMaxLon - minLon) / cellLon));
            const rowStart = Math.max(0, Math.floor((edgeMinLat - minLat) / cellLat));
            const rowEnd = Math.min(gridRows - 1, Math.floor((edgeMaxLat - minLat) / cellLat));

            for (let row = rowStart; row <= rowEnd; row++) {
                for (let col = colStart; col <= colEnd; col++) {
                    const cellIdx = row * gridCols + col;
                    cellEdgesLists[cellIdx].push(edgeIdx);
                }
            }
        }

        // Flatten edge spatial index
        const cellOffsets: number[] = [];
        const cellEdges: number[] = [];
        let offset = 0;

        for (const cellList of cellEdgesLists) {
            cellOffsets.push(offset);
            cellEdges.push(...cellList);
            offset += cellList.length;
        }
        cellOffsets.push(offset);

        // Build area spatial index
        const cellAreasLists: number[][] = Array.from({ length: totalCells }, () => []);

        for (let areaIdx = 0; areaIdx < areas.length; areaIdx++) {
            const area = areas[areaIdx];
            if (area.points.length < 3) continue;

            const areaLats = area.points.map(p => p.lat);
            const areaLons = area.points.map(p => p.lon);
            const areaMinLat = Math.min(...areaLats);
            const areaMaxLat = Math.max(...areaLats);
            const areaMinLon = Math.min(...areaLons);
            const areaMaxLon = Math.max(...areaLons);

            const colStart = Math.max(0, Math.floor((areaMinLon - minLon) / cellLon));
            const colEnd = Math.min(gridCols - 1, Math.floor((areaMaxLon - minLon) / cellLon));
            const rowStart = Math.max(0, Math.floor((areaMinLat - minLat) / cellLat));
            const rowEnd = Math.min(gridRows - 1, Math.floor((areaMaxLat - minLat) / cellLat));

            for (let row = rowStart; row <= rowEnd; row++) {
                for (let col = colStart; col <= colEnd; col++) {
                    const cellIdx = row * gridCols + col;
                    cellAreasLists[cellIdx].push(areaIdx);
                }
            }
        }

        // Flatten area spatial index
        const areaCellOffsets: number[] = [];
        const areaCellIndices: number[] = [];
        offset = 0;

        for (const cellList of cellAreasLists) {
            areaCellOffsets.push(offset);
            areaCellIndices.push(...cellList);
            offset += cellList.length;
        }
        areaCellOffsets.push(offset);

        return {
            gridCols,
            gridRows,
            cellOffsets,
            cellEdges,
            areaCellOffsets,
            areaCellIndices
        };
    }

    /**
     * Write TRMAP binary file
     */
    private async writeTRMAPFile(
        outputPath: string,
        graph: {
            nodes: OSMNode[];
            edges: Edge[];
            areas: Area[];
            labels: Label[];
            bounds: { minLat: number; minLon: number; maxLat: number; maxLon: number };
            nodeIndexMap: Map<string, number>;
        },
        spatialIndex: {
            gridCols: number;
            gridRows: number;
            cellOffsets: number[];
            cellEdges: number[];
            areaCellOffsets: number[];
            areaCellIndices: number[];
        },
        featureBitmask: number
    ): Promise<void> {
        const buffers: Buffer[] = [];

        // Prepare label text data
        const labelTextData: Buffer[] = [];
        const labelRecords: Array<{
            lat: number;
            lon: number;
            textOffset: number;
            textLength: number;
            type: number;
            priority: number;
            roadType: number;
            areaSqm: number;
        }> = [];

        let textOffset = 0;
        for (const label of graph.labels) {
            const textBuffer = Buffer.from(label.text + '\0', 'utf-8');
            labelTextData.push(textBuffer);
            
            labelRecords.push({
                lat: label.lat,
                lon: label.lon,
                textOffset,
                textLength: textBuffer.length - 1,
                type: label.type,
                priority: label.priority,
                roadType: label.roadType || 0,
                areaSqm: label.areaSqm || 0
            });

            textOffset += textBuffer.length;
        }

        const totalLabelTextSize = textOffset;
        const totalAreaPoints = graph.areas.reduce((sum, area) => sum + area.points.length, 0);

        // Build adjacency list
        const adjList = this.buildAdjacencyList(graph);

        // Header (80 bytes for v7)
        const header = Buffer.alloc(80);
        let offset = 0;
        
        header.write(MAGIC, offset, 'ascii'); offset += 4;
        header.writeUInt32LE(VERSION, offset); offset += 4;
        header.writeUInt32LE(graph.nodes.length, offset); offset += 4;
        header.writeUInt32LE(graph.edges.length, offset); offset += 4;
        header.writeFloatLE(graph.bounds.minLat, offset); offset += 4;
        header.writeFloatLE(graph.bounds.minLon, offset); offset += 4;
        header.writeFloatLE(graph.bounds.maxLat, offset); offset += 4;
        header.writeFloatLE(graph.bounds.maxLon, offset); offset += 4;
        header.writeUInt32LE(featureBitmask, offset); offset += 4;
        header.writeUInt32LE(graph.areas.length, offset); offset += 4;
        header.writeUInt32LE(totalAreaPoints, offset); offset += 4;
        header.writeUInt32LE(0, offset); offset += 4; // Reserved
        header.writeUInt32LE(labelRecords.length, offset); offset += 4;
        header.writeUInt32LE(totalLabelTextSize, offset); offset += 4;
        header.writeUInt32LE(adjList.list.length, offset); offset += 4;
        header.writeUInt16LE(spatialIndex.gridCols, offset); offset += 2;
        header.writeUInt16LE(spatialIndex.gridRows, offset); offset += 2;
        header.writeUInt32LE(spatialIndex.cellEdges.length, offset); offset += 4;
        header.writeUInt32LE(spatialIndex.areaCellIndices.length, offset); offset += 4;
        // Remaining bytes already zero

        buffers.push(header);

        // Node Table (12 bytes per node)
        const nodeTable = Buffer.alloc(graph.nodes.length * 12);
        offset = 0;
        for (let i = 0; i < graph.nodes.length; i++) {
            const node = graph.nodes[i];
            nodeTable.writeUInt32LE(i, offset); offset += 4;
            nodeTable.writeFloatLE(node.lat, offset); offset += 4;
            nodeTable.writeFloatLE(node.lon, offset); offset += 4;
        }
        buffers.push(nodeTable);

        // Edge Table (16 bytes per edge)
        const edgeTable = Buffer.alloc(graph.edges.length * 16);
        offset = 0;
        for (const edge of graph.edges) {
            const fromIdx = graph.nodeIndexMap.get(edge.fromNodeId)!;
            const toIdx = graph.nodeIndexMap.get(edge.toNodeId)!;
            
            edgeTable.writeUInt32LE(fromIdx, offset); offset += 4;
            edgeTable.writeUInt32LE(toIdx, offset); offset += 4;
            edgeTable.writeFloatLE(edge.distance, offset); offset += 4;
            edgeTable.writeUInt8(edge.roadType, offset); offset += 1;
            
            let flags = 0;
            if (edge.oneway) flags |= 0x01;
            if (edge.roundabout) flags |= 0x02;
            edgeTable.writeUInt8(flags, offset); offset += 1;
            
            edgeTable.writeUInt16LE(0, offset); offset += 2; // Reserved
        }
        buffers.push(edgeTable);

        // Area Table (12 bytes per area) + Area Points (8 bytes per point)
        const areaTable = Buffer.alloc(graph.areas.length * 12);
        const areaPoints = Buffer.alloc(totalAreaPoints * 8);
        
        let areaOffset = 0;
        let pointOffset = 0;
        let globalPointOffset = 0;

        for (const area of graph.areas) {
            areaTable.writeUInt32LE(globalPointOffset, areaOffset); areaOffset += 4;
            areaTable.writeUInt16LE(area.points.length, areaOffset); areaOffset += 2;
            areaTable.writeUInt8(area.type, areaOffset); areaOffset += 1;
            areaTable.writeUInt8(0, areaOffset); areaOffset += 1; // Flags
            areaTable.writeUInt32LE(0, areaOffset); areaOffset += 4; // Reserved

            for (const point of area.points) {
                areaPoints.writeFloatLE(point.lat, pointOffset); pointOffset += 4;
                areaPoints.writeFloatLE(point.lon, pointOffset); pointOffset += 4;
            }

            globalPointOffset += area.points.length;
        }

        buffers.push(areaTable);
        buffers.push(areaPoints);

        // Label Table (20 bytes per label)
        const labelTable = Buffer.alloc(labelRecords.length * 20);
        offset = 0;
        for (const label of labelRecords) {
            labelTable.writeFloatLE(label.lat, offset); offset += 4;
            labelTable.writeFloatLE(label.lon, offset); offset += 4;
            labelTable.writeUInt32LE(label.textOffset, offset); offset += 4;
            labelTable.writeUInt16LE(label.textLength, offset); offset += 2;
            labelTable.writeUInt8(label.type, offset); offset += 1;
            labelTable.writeUInt8(label.priority, offset); offset += 1;
            labelTable.writeUInt8(label.roadType, offset); offset += 1;
            labelTable.writeUInt8(0, offset); offset += 1; // Flags
            labelTable.writeUInt16LE(label.areaSqm, offset); offset += 2;
        }
        buffers.push(labelTable);

        // Label Text
        buffers.push(Buffer.concat(labelTextData));

        // Adjacency Offsets (4 bytes each, node_count + 1 entries)
        const adjOffsets = Buffer.alloc((graph.nodes.length + 1) * 4);
        offset = 0;
        for (const off of adjList.offsets) {
            adjOffsets.writeUInt32LE(off, offset);
            offset += 4;
        }
        buffers.push(adjOffsets);

        // Adjacency List (8 bytes per entry)
        const adjListBuffer = Buffer.alloc(adjList.list.length * 8);
        offset = 0;
        for (const entry of adjList.list) {
            adjListBuffer.writeUInt32LE(entry.toNode, offset); offset += 4;
            const distanceDm = Math.min(Math.round(entry.distance * 10), 65535);
            adjListBuffer.writeUInt16LE(distanceDm, offset); offset += 2;
            adjListBuffer.writeUInt8(entry.roadType, offset); offset += 1;
            adjListBuffer.writeUInt8(0, offset); offset += 1; // Reserved
        }
        buffers.push(adjListBuffer);

        // Spatial Index - Cell Offsets
        const spatialCellOffsets = Buffer.alloc(spatialIndex.cellOffsets.length * 4);
        offset = 0;
        for (const off of spatialIndex.cellOffsets) {
            spatialCellOffsets.writeUInt32LE(off, offset);
            offset += 4;
        }
        buffers.push(spatialCellOffsets);

        // Spatial Index - Cell Edges
        const spatialCellEdges = Buffer.alloc(spatialIndex.cellEdges.length * 4);
        offset = 0;
        for (const edgeIdx of spatialIndex.cellEdges) {
            spatialCellEdges.writeUInt32LE(edgeIdx, offset);
            offset += 4;
        }
        buffers.push(spatialCellEdges);

        // Area Spatial Index - Cell Offsets
        const areaCellOffsets = Buffer.alloc(spatialIndex.areaCellOffsets.length * 4);
        offset = 0;
        for (const off of spatialIndex.areaCellOffsets) {
            areaCellOffsets.writeUInt32LE(off, offset);
            offset += 4;
        }
        buffers.push(areaCellOffsets);

        // Area Spatial Index - Cell Indices
        const areaCellIndices = Buffer.alloc(spatialIndex.areaCellIndices.length * 4);
        offset = 0;
        for (const areaIdx of spatialIndex.areaCellIndices) {
            areaCellIndices.writeUInt32LE(areaIdx, offset);
            offset += 4;
        }
        buffers.push(areaCellIndices);

        // Write to file
        const dir = path.dirname(outputPath);
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(outputPath, Buffer.concat(buffers));
    }

    /**
     * Build adjacency list for pathfinding
     */
    private buildAdjacencyList(graph: {
        nodes: OSMNode[];
        edges: Edge[];
        nodeIndexMap: Map<string, number>;
    }): {
        offsets: number[];
        list: Array<{ toNode: number; distance: number; roadType: number }>;
    } {
        const nodeCount = graph.nodes.length;
        const edgesByFromNode: Array<Array<{ toNode: number; distance: number; roadType: number }>> = 
            Array.from({ length: nodeCount }, () => []);

        for (const edge of graph.edges) {
            const fromIdx = graph.nodeIndexMap.get(edge.fromNodeId);
            const toIdx = graph.nodeIndexMap.get(edge.toNodeId);

            if (fromIdx !== undefined && toIdx !== undefined) {
                edgesByFromNode[fromIdx].push({
                    toNode: toIdx,
                    distance: edge.distance,
                    roadType: edge.roadType
                });
            }
        }

        const offsets: number[] = [];
        const list: Array<{ toNode: number; distance: number; roadType: number }> = [];

        let offset = 0;
        for (let i = 0; i < nodeCount; i++) {
            offsets.push(offset);
            const nodeEdges = edgesByFromNode[i];
            list.push(...nodeEdges);
            offset += nodeEdges.length;
        }
        offsets.push(offset);

        return { offsets, list };
    }

    /**
     * Haversine distance in meters
     */
    private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371000; // Earth radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) ** 2 +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) ** 2;

        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /**
     * Get road type from OSM highway tag
     */
    private getRoadType(highway: string): number {
        return ROAD_TYPES[highway] || 7; // 7 = OTHER
    }

    /**
     * Get area type from OSM tags
     */
    private getAreaType(tags: Map<string, string>): number | null {
        // Water
        if (tags.get('natural') === 'water') return AREA_WATER;
        if (['river', 'stream', 'canal', 'riverbank'].includes(tags.get('waterway') || '')) return AREA_WATER;
        if (['reservoir', 'basin'].includes(tags.get('landuse') || '')) return AREA_WATER;

        // Park
        if (['park', 'garden'].includes(tags.get('leisure') || '')) return AREA_PARK;

        // Forest
        if (tags.get('landuse') === 'forest') return AREA_FOREST;
        if (tags.get('natural') === 'wood') return AREA_FOREST;

        // Grass
        if (['grass', 'meadow'].includes(tags.get('landuse') || '')) return AREA_GRASS;
        if (tags.get('natural') === 'grassland') return AREA_GRASS;

        // Building
        if (tags.has('building')) return AREA_BUILDING;

        return null;
    }

    /**
     * Check if way forms a closed polygon
     */
    private isClosedWay(way: OSMWay): boolean {
        if (way.nodes.length < 4) return false;
        return way.nodes[0] === way.nodes[way.nodes.length - 1];
    }

    /**
     * Merge ways into closed polygons
     */
    private mergeWaysToPolygons(ways: string[][]): string[][] {
        if (ways.length === 0) return [];

        const remaining = ways.map(w => [...w]);
        const polygons: string[][] = [];

        while (remaining.length > 0) {
            let current = remaining.shift()!;
            let changed = true;

            while (changed && remaining.length > 0) {
                changed = false;

                for (let i = 0; i < remaining.length; i++) {
                    const way = remaining[i];
                    if (way.length < 2) continue;

                    const currentStart = current[0];
                    const currentEnd = current[current.length - 1];
                    const wayStart = way[0];
                    const wayEnd = way[way.length - 1];

                    if (currentEnd === wayStart) {
                        current = current.concat(way.slice(1));
                        remaining.splice(i, 1);
                        changed = true;
                        break;
                    } else if (currentEnd === wayEnd) {
                        current = current.concat(way.slice(0, -1).reverse());
                        remaining.splice(i, 1);
                        changed = true;
                        break;
                    } else if (currentStart === wayEnd) {
                        current = way.slice(0, -1).concat(current);
                        remaining.splice(i, 1);
                        changed = true;
                        break;
                    } else if (currentStart === wayStart) {
                        current = way.slice(0, -1).reverse().concat(current);
                        remaining.splice(i, 1);
                        changed = true;
                        break;
                    }
                }
            }

            // Close polygon if needed
            if (current.length >= 3 && current[0] !== current[current.length - 1]) {
                current.push(current[0]);
            }

            if (current.length >= 3) {
                polygons.push(current);
            }
        }

        return polygons;
    }
}
