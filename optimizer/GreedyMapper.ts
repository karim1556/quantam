export class GreedyMapper {
  circuit: any;
  hardware: any;
  name: string;

  constructor(circuit: any, hardware: any) {
    this.circuit = circuit;
    this.hardware = hardware;
    this.name = 'Greedy Baseline';
  }

  map() {
    const steps: any[] = [];
    const layout = Array.from({ length: this.circuit.nQubits }, (_, i) => i);
    let insertedSwaps = 0;
    let depth = 0;
    let distancePenalty = 0;

    this.circuit.gates.forEach((gate: any) => {
      if (gate.qubits.length === 2) {
        const [c, t] = gate.qubits;
        let physC = layout[c];
        let physT = layout[t];

        while (!this.hardware.isConnected(physC, physT)) {
          const path = this.hardware.getShortestPath(physC, physT);
          if (path.length < 2) break;

          const [swapQ1, swapQ2] = [path[0], path[1]];
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
          // update physical positions after performing the swap
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
}
