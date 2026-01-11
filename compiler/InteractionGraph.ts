export class InteractionGraph {
  circuit: any;
  graph: Map<string, any>;

  constructor(circuit: any) {
    this.circuit = circuit;
    this.graph = this.buildGraph();
  }

  buildGraph() {
    const edges = new Map();

    this.circuit.gates.forEach((gate: any, gateIdx: number) => {
      if (gate.qubits.length === 2) {
        const [q1, q2] = gate.qubits.slice().sort((a: number, b: number) => a - b);
        const key = `${q1}-${q2}`;

        if (!edges.has(key)) {
          edges.set(key, { count: 0, firstSeen: gateIdx, lastSeen: gateIdx });
        }

        const edge = edges.get(key);
        edge.count++;
        edge.lastSeen = gateIdx;
      }
    });

    return edges;
  }

  getInteractionWeight(q1: number, q2: number) {
    const key = [q1, q2].sort((a, b) => a - b).join('-');
    return this.graph.get(key)?.count || 0;
  }

  getUpcomingInteractions(currentGateIdx: number, windowSize = 5) {
    const upcoming: any[] = [];
    const endIdx = Math.min(currentGateIdx + windowSize, this.circuit.gates.length);

    for (let i = currentGateIdx; i < endIdx; i++) {
      const gate = this.circuit.gates[i];
      if (gate.qubits.length === 2) {
        upcoming.push({
          qubits: gate.qubits,
          distance: i - currentGateIdx,
          weight: 1 / (1 + (i - currentGateIdx))
        });
      }
    }

    return upcoming;
  }
}
