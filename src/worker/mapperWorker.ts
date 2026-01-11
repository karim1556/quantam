import { QuantumCircuit } from '../../compiler/QuantumCircuit';
import { HardwareTopology } from '../../hardware/Topology';
import { GreedyMapper } from '../../optimizer/GreedyMapper';
import { LookAheadMapper } from '../../optimizer/LookAheadMapper';
import { GeneticSwapOptimizer } from '../../optimizer/GeneticSwapOptimizer';
import { CostModel } from '../../metrics/CostModel';

self.addEventListener('message', (ev: MessageEvent) => {
  const { circuitData, hardwareData } = ev.data;

  try {
    console.log('worker: received message', { circuitN: circuitData.nQubits, gates: circuitData.gates?.length });
    // Rebuild instances inside worker
    const circ = new QuantumCircuit(circuitData.nQubits);
    circ.gates = circuitData.gates;

    const hw = new HardwareTopology(hardwareData.type, hardwareData.params);

    const costModel = new CostModel({ alpha: 10, beta: 1, gamma: 5 });

    const cfg = ev.data.config || {};
    const mappers: any[] = [
      new GreedyMapper(circ, hw),
      new LookAheadMapper(circ, hw, 3)
    ];

    // only add Genetic mapper when explicitly requested (avoids long runs)
    if (cfg.useGenetic) {
      mappers.push(new GeneticSwapOptimizer(circ, hw, cfg.genetic || {}));
    }

    const comparisonResults = mappers.map(mapper => {
      const result = mapper.map();
      const cost = costModel.evaluate(result);
      return { ...result, mapper: mapper.name, cost };
    });

    // send back results
    (self as any).postMessage({ results: comparisonResults });
    console.log('worker: posted results');
  } catch (err) {
    (self as any).postMessage({ error: String((err as any)?.message || err) });
  }
});
