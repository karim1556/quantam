import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Zap, GitBranch, Activity, TrendingDown, Grid3x3, BarChart3, Info } from 'lucide-react';

import { QuantumCircuit } from './compiler/QuantumCircuit';
import { InteractionGraph } from './compiler/InteractionGraph';
import { HardwareTopology } from './hardware/Topology';
import { CostModel } from './metrics/CostModel';
import { GreedyMapper } from './optimizer/GreedyMapper';
import { LookAheadMapper } from './optimizer/LookAheadMapper';
import { GeneticSwapOptimizer } from './optimizer/GeneticSwapOptimizer';
import QubitVisualizer from './visualization/QubitVisualizer';

// ========================================
// 🧪 BENCHMARK CIRCUITS
// ========================================
const BENCHMARKS = {
  qft: (n) => {
    const circ = new QuantumCircuit(n);
    for (let i = n - 1; i >= 0; i--) {
      circ.addGate('h', [i]);
      for (let j = i - 1; j >= 0; j--) {
        circ.addGate('cx', [j, i]);
      }
    }
    return circ;
  },
  grover: (n) => {
    const circ = new QuantumCircuit(n);
    for (let i = 0; i < n; i++) circ.addGate('h', [i]);
    for (let iter = 0; iter < Math.ceil(Math.sqrt(n)); iter++) {
      circ.addGate('cx', [0, n - 1]);
      for (let i = 0; i < n - 1; i++) {
        circ.addGate('h', [i]);
        if (i < n - 2) circ.addGate('cx', [i, i + 1]);
      }
    }
    return circ;
  },
  entangle: (n) => {
    const circ = new QuantumCircuit(n);
    circ.addGate('h', [0]);
    for (let i = 0; i < n - 1; i++) {
      circ.addGate('cx', [i, i + 1]);
    }
    return circ;
  }
};

// ========================================
// 🎨 REACT COMPONENT
// ========================================
export default function QuantumCompiler() {
  const [circuit, setCircuit] = useState(null);
  const [hardware, setHardware] = useState(null);
  const [results, setResults] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeMapper, setActiveMapper] = useState('genetic');
  const [step, setStep] = useState(0);
  const [topologyType, setTopologyType] = useState('lnn');
  const [nQubits, setNQubits] = useState(5);
  const [benchmark, setBenchmark] = useState('qft');
  const [showInfo, setShowInfo] = useState(false);
  const costModel = new CostModel({ alpha: 10, beta: 1, gamma: 5 });

  useEffect(() => {
    const hw = new HardwareTopology(topologyType, {
      qubits: nQubits,
      rows: Math.ceil(Math.sqrt(nQubits)),
      cols: Math.ceil(Math.sqrt(nQubits))
    });
    setHardware(hw);

    const circ = BENCHMARKS[benchmark](nQubits);
    setCircuit(circ);
  }, [topologyType, nQubits, benchmark]);

  const runOptimization = () => {
    if (!circuit || !hardware) return;
    setRunning(true);

    // Run mapping in a Web Worker to avoid blocking the UI
    try {
      const worker = new Worker(new URL('/src/worker/mapperWorker.ts', import.meta.url), { type: 'module' });

      const timeout = setTimeout(() => {
        // worker seems unresponsive -> terminate and fallback
        try { worker.terminate(); } catch (e) {}
        console.warn('Worker timeout, falling back to main-thread mapping');
        setRunning(false);
        // fallback on main thread
        const mappers = [
          new GreedyMapper(circuit, hardware),
          new LookAheadMapper(circuit, hardware, 3),
          new GeneticSwapOptimizer(circuit, hardware)
        ];
        const comparisonResults = mappers.map(mapper => {
          const result = mapper.map();
          const cost = costModel.evaluate(result);
          return { ...result, mapper: mapper.name, cost };
        });
        setResults(comparisonResults);
        setStep(0);
      }, 8000);

      worker.postMessage({
        circuitData: { nQubits: circuit.nQubits, gates: circuit.gates },
        hardwareData: { type: hardware.type, params: hardware.params }
      });

      worker.addEventListener('message', (ev) => {
        clearTimeout(timeout);
        if (ev.data.error) {
          console.error('Worker reported error:', ev.data.error);
          try { worker.terminate(); } catch (e) {}
          setRunning(false);
          return;
        }
        const comparisonResults = ev.data.results;
        setResults(comparisonResults);
        setStep(0);
        setPlaying(false);
        setRunning(false);
        worker.terminate();
      });

      worker.addEventListener('error', (err) => {
        clearTimeout(timeout);
        console.error('Worker error', err);
        try { worker.terminate(); } catch (e) {}
        setRunning(false);
      });
    } catch (e) {
      console.warn('Worker creation failed, running on main thread', e);
      // fallback: run on main thread (may block UI)
      const mappers = [
        new GreedyMapper(circuit, hardware),
        new LookAheadMapper(circuit, hardware, 3),
        new GeneticSwapOptimizer(circuit, hardware)
      ];

      const comparisonResults = mappers.map(mapper => {
        const result = mapper.map();
        const cost = costModel.evaluate(result);
        return { ...result, mapper: mapper.name, cost };
      });

      setResults(comparisonResults);
      setStep(0);
      setPlaying(false);
      setRunning(false);
    }
  };

  useEffect(() => {
    if (playing && results) {
      const currentResult = results.find(r => r.mapper === getMapperName(activeMapper));
      if (currentResult && step < currentResult.steps.length - 1) {
        const timer = setTimeout(() => setStep(step + 1), 400);
        return () => clearTimeout(timer);
      } else {
        setPlaying(false);
      }
    }
  }, [playing, step, results, activeMapper]);

  const getMapperName = (key) => {
    if (key === 'greedy') return 'Greedy Baseline';
    if (key === 'lookahead') return 'Look-Ahead (k=3)';
    return 'Genetic Algorithm';
  };

  // visualization is handled in QubitVisualizer component

  const currentResult = results?.find(r => r.mapper === getMapperName(activeMapper));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-blue-400 text-transparent bg-clip-text">
            Quantum Circuit Compiler Framework
          </h1>
          <p className="text-slate-400">Hardware-Aware Heuristic Optimization for NP-Hard Gate Mapping</p>
        </div>

        {showInfo && (
          <div className="bg-blue-950/30 border border-blue-800/50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-300 mb-2">Research Framework Disclaimer</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              This tool performs <strong>compiler-level optimization</strong> for quantum circuits mapped to hardware topologies. 
              It does NOT simulate quantum states or compute physical fidelities. All "costs" are normalized heuristics for comparing mapping strategies.
              The problem of optimal qubit routing is NP-hard, so these algorithms provide practical approximations.
            </p>
            <p className="text-sm text-slate-300 mt-2">
              <strong>Cost Formula:</strong> {costModel.explain()} — This is a relative metric for algorithm comparison, not a physical error rate.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Grid3x3 className="w-4 h-4" /> Hardware Topology
            </h3>
            <select 
              value={topologyType}
              onChange={(e) => setTopologyType(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm mb-2"
            >
              <option value="lnn">Linear Nearest-Neighbor</option>
              <option value="grid2d">2D Grid</option>
              <option value="star">Star Topology</option>
            </select>
            <label className="text-xs text-slate-400 block mb-1">Qubits: {nQubits}</label>
            <input 
              type="range" 
              min="3" 
              max="9" 
              value={nQubits}
              onChange={(e) => setNQubits(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <GitBranch className="w-4 h-4" /> Benchmark Circuit
            </h3>
            <select 
              value={benchmark}
              onChange={(e) => setBenchmark(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm mb-2"
            >
              <option value="qft">Quantum Fourier Transform</option>
              <option value="grover">Grover-Style Search</option>
              <option value="entangle">Linear Entanglement</option>
            </select>
            <button
              onClick={runOptimization}
              disabled={running}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 px-3 py-1.5 rounded text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Zap className="w-3 h-3" /> Run All Mappers
            </button>
          </div>

          <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Mapper Selection
            </h3>
            <select 
              value={activeMapper}
              onChange={(e) => setActiveMapper(e.target.value)}
              disabled={!results}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm mb-2 disabled:opacity-50"
            >
              <option value="greedy">Greedy Baseline</option>
              <option value="lookahead">Look-Ahead (k=3)</option>
              <option value="genetic">Genetic Algorithm</option>
            </select>
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="w-full bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-sm flex items-center justify-center gap-2"
            >
              <Info className="w-3 h-3" /> {showInfo ? 'Hide' : 'Show'} Info
            </button>
          </div>

          {currentResult && (
            <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" /> Current Metrics
              </h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">SWAPs:</span>
                  <span className="font-mono text-red-400">{currentResult.insertedSwaps}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Depth:</span>
                  <span className="font-mono text-blue-400">{currentResult.depth}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Dist Penalty:</span>
                  <span className="font-mono text-yellow-400">{currentResult.distancePenalty}</span>
                </div>
                <div className="flex justify-between border-t border-slate-700 pt-1 mt-1">
                  <span className="text-slate-400 font-semibold">Total Cost:</span>
                  <span className="font-mono text-cyan-400 font-bold">{currentResult.cost.toFixed(1)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {results && (
          <>
            <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" /> Algorithm Comparison
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 px-3 text-slate-400">Mapper</th>
                      <th className="text-right py-2 px-3 text-slate-400">SWAPs</th>
                      <th className="text-right py-2 px-3 text-slate-400">Depth</th>
                      <th className="text-right py-2 px-3 text-slate-400">Distance Penalty</th>
                      <th className="text-right py-2 px-3 text-slate-400">Total Cost</th>
                      <th className="text-right py-2 px-3 text-slate-400">vs Greedy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, idx) => {
                      const greedyCost = results[0].cost;
                      const improvement = ((greedyCost - result.cost) / greedyCost * 100);
                      const improvementStr = improvement.toFixed(1);
                      return (
                        <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-semibold">{result.mapper}</td>
                          <td className="py-2 px-3 text-right font-mono text-red-400">{result.insertedSwaps}</td>
                          <td className="py-2 px-3 text-right font-mono text-blue-400">{result.depth}</td>
                          <td className="py-2 px-3 text-right font-mono text-yellow-400">{result.distancePenalty}</td>
                          <td className="py-2 px-3 text-right font-mono text-cyan-400 font-bold">{result.cost.toFixed(1)}</td>
                          <td className="py-2 px-3 text-right font-mono">
                            {idx === 0 ? (
                              <span className="text-slate-500">baseline</span>
                            ) : (
                              <span className={improvement > 0 ? 'text-green-400' : 'text-red-400'}>
                                {improvement > 0 ? '+' : ''}{improvementStr}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Cost formula: <code>{costModel.explain()}</code> — Lower is better. 
                This is a heuristic metric for comparing mappers, not a physical error rate.
              </p>
            </div>

            <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Visualization: {getMapperName(activeMapper)}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPlaying(!playing)}
                    disabled={!currentResult}
                    className="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded flex items-center gap-2 disabled:opacity-50 text-sm"
                  >
                    {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    {playing ? 'Pause' : 'Play'}
                  </button>
                  <button
                    onClick={() => setStep(0)}
                    disabled={!currentResult}
                    className="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded disabled:opacity-50 text-sm"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              </div>
              
              <QubitVisualizer currentResult={currentResult} step={step} hardware={hardware} topologyType={topologyType} />

              {currentResult && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-400">
                      Step {step + 1} / {currentResult.steps.length}
                    </span>
                    <span className={currentResult.steps[step]?.inserted ? 'text-red-400 font-semibold' : 'text-blue-400'}>
                      {currentResult.steps[step]?.type?.toUpperCase()}
                      {currentResult.steps[step]?.inserted && ' ← INSERTED SWAP'}
                    </span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max={currentResult.steps.length - 1}
                    value={step}
                    onChange={(e) => setStep(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3">Legend</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-slate-800 border-2 border-slate-600 rounded-full"></div>
                    <span>Idle Qubit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                    <span>Active Gate</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                    <span>Inserted SWAP</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-slate-600 rounded"></div>
                    <span>Hardware Edge</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  <strong>P#</strong> = Physical qubit ID<br />
                  <strong>L#</strong> = Logical qubit mapping
                </p>
              </div>

              <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3">Algorithm Notes</h3>
                <ul className="text-xs space-y-1 text-slate-300">
                  <li><strong>Greedy:</strong> Inserts SWAPs along shortest path, no look-ahead</li>
                  <li><strong>Look-Ahead:</strong> Evaluates future gates within window k=3</li>
                  <li><strong>Genetic:</strong> Evolves SWAP sequences with adaptive mutation</li>
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}