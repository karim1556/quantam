import { InteractionGraph } from '../compiler/InteractionGraph';

export class LookAheadMapper {
  circuit: any;
  hardware: any;
  lookAhead: number;
  name: string;
  interactionGraph: InteractionGraph;

  constructor(circuit: any, hardware: any, lookAhead = 3) {
    this.circuit = circuit;
    this.hardware = hardware;
    this.lookAhead = lookAhead;
    this.name = `Look-Ahead (k=${lookAhead})`;
    this.interactionGraph = new InteractionGraph(circuit);
  }

  map() {
    const steps: any[] = [];
    const layout = Array.from({ length: this.circuit.nQubits }, (_, i) => i);
    let insertedSwaps = 0;
    let depth = 0;
    let distancePenalty = 0;

    this.circuit.gates.forEach((gate: any, gateIdx: number) => {
      if (gate.qubits.length === 2) {
        const [c, t] = gate.qubits;
        let physC = layout[c];
        let physT = layout[t];

        while (!this.hardware.isConnected(physC, physT)) {
          const bestSwap = this.findBestSwap(layout, gateIdx);
          if (!bestSwap) break;

          const [swapQ1, swapQ2] = bestSwap;
          const logQ1 = layout.indexOf(swapQ1);
          const logQ2 = layout.indexOf(swapQ2);

          [layout[logQ1], layout[logQ2]] = [layout[logQ2], layout[logQ1]];

          steps.push({
            type: 'swap',
            physical: [swapQ1, swapQ2],
            logical: [logQ1, logQ2],
            layout: [...layout],
            inserted: true,
            depth: depth++
          });

          insertedSwaps++;
          physC = layout[c];
          physT = layout[t];
        }

        distancePenalty += this.hardware.distance(layout[c], layout[t]) - 1;
      }

      steps.push({
        type: gate.type,
        qubits: gate.qubits.map((q: number) => layout[q]),
        logical: gate.qubits,
        layout: [...layout],
        inserted: false,
        depth: depth++
      });
    });

    return {
      steps,
      insertedSwaps,
      depth,
      distancePenalty,
      finalLayout: layout
    };
  }

  findBestSwap(layout: number[], currentGateIdx: number) {
    const upcoming = this.interactionGraph.getUpcomingInteractions(currentGateIdx, this.lookAhead);

    let bestSwap: number[] | null = null;
    let bestScore = -Infinity;

    Object.keys(this.hardware.graph).forEach(q1Str => {
      const q1 = parseInt(q1Str, 10);
      this.hardware.graph[q1].forEach((q2: number) => {
        if (q1 >= q2) return;

        const testLayout = [...layout];
        const log1 = testLayout.indexOf(q1);
        const log2 = testLayout.indexOf(q2);
        [testLayout[log1], testLayout[log2]] = [testLayout[log2], testLayout[log1]];

        let score = 0;
        upcoming.forEach(({ qubits, weight }: any) => {
          const dist = this.hardware.distance(testLayout[qubits[0]], testLayout[qubits[1]]);
          score -= dist * weight;
        });

        if (score > bestScore) {
          bestScore = score;
          bestSwap = [q1, q2];
        }
      });
    });

    return bestSwap;
  }
}
