export class HardwareTopology {
  type: string;
  params: any;
  graph: Record<number, number[]>;
  distanceCache: Map<string, number>;

  constructor(type: string, params: any = {}) {
    this.type = type;
    this.params = params;
    this.graph = this.buildGraph();
    this.distanceCache = new Map();
  }

  buildGraph() {
    const { type, params } = this;
    const graph: Record<number, number[]> = {};

    if (type === 'lnn') {
      const n = params.qubits || 5;
      for (let i = 0; i < n; i++) {
        graph[i] = [];
        if (i > 0) graph[i].push(i - 1);
        if (i < n - 1) graph[i].push(i + 1);
      }
    } else if (type === 'grid2d') {
      const rows = params.rows || 3;
      const cols = params.cols || 3;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const id = r * cols + c;
          graph[id] = [];
          if (c > 0) graph[id].push(id - 1);
          if (c < cols - 1) graph[id].push(id + 1);
          if (r > 0) graph[id].push(id - cols);
          if (r < rows - 1) graph[id].push(id + cols);
        }
      }
    } else if (type === 'star') {
      const n = params.qubits || 5;
      graph[0] = [];
      for (let i = 1; i < n; i++) {
        graph[0].push(i);
        graph[i] = [0];
      }
    }

    return graph;
  }

  isConnected(q1: number, q2: number) {
    return this.graph[q1]?.includes(q2) || false;
  }

  distance(q1: number, q2: number) {
    const key = `${Math.min(q1, q2)}-${Math.max(q1, q2)}`;
    if (this.distanceCache.has(key)) return this.distanceCache.get(key) as number;

    const visited = new Set<number>();
    const queue: [number, number][] = [[q1, 0]];

    while (queue.length > 0) {
      const [node, dist] = queue.shift() as [number, number];
      if (node === q2) {
        this.distanceCache.set(key, dist);
        return dist;
      }
      if (visited.has(node)) continue;
      visited.add(node);

      (this.graph[node] || []).forEach(neighbor => {
        if (!visited.has(neighbor)) queue.push([neighbor, dist + 1]);
      });
    }

    this.distanceCache.set(key, Infinity);
    return Infinity;
  }

  getShortestPath(q1: number, q2: number) {
    const visited = new Set<number>();
    const queue: [number, number[]][] = [[q1, [q1]]];

    while (queue.length > 0) {
      const [node, path] = queue.shift() as [number, number[]];
      if (node === q2) return path;
      if (visited.has(node)) continue;
      visited.add(node);

      (this.graph[node] || []).forEach(neighbor => {
        if (!visited.has(neighbor)) {
          queue.push([neighbor, [...path, neighbor]]);
        }
      });
    }

    return [];
  }
}
