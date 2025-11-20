import neo4j, {
  type Driver,
  type Record as Neo4jRecord,
  type PathSegment,
  type Session,
} from 'neo4j-driver';

export interface Neo4jConfig {
  uri: string;
  user: string;
  password?: string;
  database?: string;
}

export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
}

export interface GraphRelationship {
  id: string;
  type: string;
  startNodeId: string;
  endNodeId: string;
  properties: Record<string, unknown>;
}

export interface GraphPath {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  length: number;
}

export interface GraphMetrics {
  nodeCount: number;
  relationshipCount: number;
  labels: string[];
  relationshipTypes: string[];
}

export class Neo4jService {
  private driver: Driver;
  private database?: string;

  constructor(config: Neo4jConfig) {
    this.driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.user, config.password || '')
    );
    this.database = config.database;
  }

  async close(): Promise<void> {
    await this.driver.close();
  }

  async verifyConnection(): Promise<boolean> {
    try {
      const serverInfo = await this.driver.getServerInfo();
      console.log(
        `Connected to Neo4j: ${serverInfo.address} (${serverInfo.agent})`
      );
      return true;
    } catch (error) {
      console.error('Neo4j connection failed:', error);
      return false;
    }
  }

  private getSession(mode: 'READ' | 'WRITE' = 'READ'): Session {
    return this.driver.session({
      database: this.database,
      defaultAccessMode:
        mode === 'READ' ? neo4j.session.READ : neo4j.session.WRITE,
    });
  }

  async executeQuery(
    cypher: string,
    params: Record<string, unknown> = {},
    mode: 'READ' | 'WRITE' = 'READ'
  ): Promise<Neo4jRecord[]> {
    const session = this.getSession(mode);
    try {
      const result = await session.run(cypher, params);
      return result.records;
    } finally {
      await session.close();
    }
  }

  // ============================================================================
  // Node Operations
  // ============================================================================

  async createOrUpdateNode(
    label: string,
    id: string,
    properties: Record<string, unknown>
  ): Promise<GraphNode> {
    const cypher = `
      MERGE (n:${label} {id: $id})
      SET n += $properties, n.updatedAt = datetime()
      RETURN n
    `;
    const records = await this.executeQuery(
      cypher,
      { id, properties },
      'WRITE'
    );
    const node = records[0].get('n');
    return {
      id: node.properties.id,
      labels: node.labels,
      properties: node.properties,
    };
  }

  async getNode(label: string, id: string): Promise<GraphNode | null> {
    const cypher = `
      MATCH (n:${label} {id: $id})
      RETURN n
    `;
    const records = await this.executeQuery(cypher, { id });
    if (records.length === 0) return null;

    const node = records[0].get('n');
    return {
      id: node.properties.id,
      labels: node.labels,
      properties: node.properties,
    };
  }

  // ============================================================================
  // Relationship Operations
  // ============================================================================

  async createRelationship(
    fromLabel: string,
    fromId: string,
    toLabel: string,
    toId: string,
    type: string,
    properties: Record<string, unknown> = {}
  ): Promise<GraphRelationship> {
    const cypher = `
      MATCH (a:${fromLabel} {id: $fromId})
      MATCH (b:${toLabel} {id: $toId})
      MERGE (a)-[r:${type}]->(b)
      SET r += $properties, r.updatedAt = datetime()
      RETURN r, a, b
    `;
    const records = await this.executeQuery(
      cypher,
      { fromId, toId, properties },
      'WRITE'
    );
    const rel = records[0].get('r');
    const start = records[0].get('a');
    const end = records[0].get('b');

    return {
      id: rel.identity.toString(),
      type: rel.type,
      startNodeId: start.properties.id,
      endNodeId: end.properties.id,
      properties: rel.properties,
    };
  }

  // ============================================================================
  // Graph Traversal & Analytics
  // ============================================================================

  async findRelatedNodes(
    startLabel: string,
    startId: string,
    maxDepth: number = 2,
    relationshipTypes: string[] = []
  ): Promise<GraphPath[]> {
    const relTypeClause =
      relationshipTypes.length > 0
        ? `[:${relationshipTypes.join('|')}*1..${maxDepth}]`
        : `[*1..${maxDepth}]`;

    const cypher = `
      MATCH p = (start:${startLabel} {id: $startId})-${relTypeClause}-(end)
      RETURN p
    `;

    const records = await this.executeQuery(cypher, { startId });

    return records.map((record) => {
      const path = record.get('p');
      return {
        nodes: path.segments.map((s: PathSegment) => ({
          id: s.end.properties.id,
          labels: s.end.labels,
          properties: s.end.properties,
        })),
        relationships: path.segments.map((s: PathSegment) => ({
          id: s.relationship.identity.toString(),
          type: s.relationship.type,
          startNodeId: s.start.properties.id,
          endNodeId: s.end.properties.id,
          properties: s.relationship.properties,
        })),
        length: path.length,
      };
    });
  }

  async getGraphMetrics(): Promise<GraphMetrics> {
    const nodeCountCypher = 'MATCH (n) RETURN count(n) as count';
    const relCountCypher = 'MATCH ()-[r]->() RETURN count(r) as count';
    const labelsCypher = 'CALL db.labels()';
    const relTypesCypher = 'CALL db.relationshipTypes()';

    const [nodeCount, relCount, labels, relTypes] = await Promise.all([
      this.executeQuery(nodeCountCypher),
      this.executeQuery(relCountCypher),
      this.executeQuery(labelsCypher),
      this.executeQuery(relTypesCypher),
    ]);

    return {
      nodeCount: nodeCount[0].get('count').toNumber(),
      relationshipCount: relCount[0].get('count').toNumber(),
      labels: labels.map((r) => r.get('label')),
      relationshipTypes: relTypes.map((r) => r.get('relationshipType')),
    };
  }
}
