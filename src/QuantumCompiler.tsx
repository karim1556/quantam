
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Sphere, Html } from '@react-three/drei';
import * as THREE from 'three';
import { 
  Play, Pause, RotateCcw, Zap, GitBranch, Activity, 
  TrendingDown, Grid3x3, BarChart3, Info, Cpu, Layers, 
  ArrowRight, CheckCircle2, AlertCircle 
} from 'lucide-react';

// --- REAL IMPORTS (Restored from your original code) ---
import { QuantumCircuit } from '../compiler/QuantumCircuit';
import { InteractionGraph } from '../compiler/InteractionGraph';
import { HardwareTopology } from '../hardware/Topology';
import { CostModel } from '../metrics/CostModel';
import { GreedyMapper } from '../optimizer/GreedyMapper';
import { LookAheadMapper } from '../optimizer/LookAheadMapper';
import { GeneticSwapOptimizer } from '../optimizer/GeneticSwapOptimizer';
import QubitVisualizer from '../visualization/QubitVisualizer'; // Keeping this if you need 2D fallback, though 3D is used below

// --- BENCHMARKS (Restored original logic) ---
const BENCHMARKS = {
  qft: (n: number) => {
    const circ = new QuantumCircuit(n);
    for (let i = n - 1; i >= 0; i--) {
      circ.addGate('h', [i]);
      for (let j = i - 1; j >= 0; j--) {
        circ.addGate('cx', [j, i]);
      }
    }
    return circ;
  },
  grover: (n: number) => {
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
  entangle: (n: number) => {
    const circ = new QuantumCircuit(n);
    circ.addGate('h', [0]);
    for (let i = 0; i < n - 1; i++) {
      circ.addGate('cx', [i, i + 1]);
    }
    return circ;
  }
};

// --- 3D SCENE COMPONENTS ---

// 1. The Background Quantum Field
function QuantumField() {
        const count = 200; // reduced for performance
        const mesh = useRef<THREE.InstancedMesh>(null!);
    const lines = useRef<THREE.LineSegments>(null!);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
        const particles = useMemo(() => {
            const temp: any[] = [];
            for (let i = 0; i < count; i++) {
                temp.push({
                    t: Math.random() * 100,
                    factor: 20 + Math.random() * 80,
                    speed: 0.005 + Math.random() / 300,
                    x: Math.random() * 60 - 30,
                    y: Math.random() * 60 - 30,
                    z: Math.random() * 60 - 30,
                });
            }
            return temp;
        }, [count]);

        // Throttle updates to ~30 FPS for background particles
        const lastUpdateRef = useRef(0);
        useFrame((state) => {
            const now = state.clock.getElapsedTime();
            if (now - lastUpdateRef.current < 1 / 30) return;
            lastUpdateRef.current = now;

            for (let i = 0; i < particles.length; i++) {
                const particle = particles[i];
                particle.t += particle.speed;
                const t = particle.t;
                const s = Math.cos(t) * 0.6 + 0.6;
                dummy.position.set(
                        particle.x + Math.cos(t / 2) * particle.factor + (Math.sin(t) * particle.factor) / 10,
                        particle.y + Math.sin(t / 2) * particle.factor + (Math.cos(t) * particle.factor) / 10,
                        particle.z + Math.cos(t / 2) * particle.factor + (Math.sin(t) * particle.factor) / 10
                );
                dummy.scale.setScalar(Math.max(0.1, s * 0.8));
                dummy.rotation.set(s * 1.5, s * 1.5, s * 1.5);
                dummy.updateMatrix();
                mesh.current.setMatrixAt(i, dummy.matrix);
            }
            mesh.current.instanceMatrix.needsUpdate = true;
            if (lines.current) {
                lines.current.rotation.y += 0.0007;
                lines.current.rotation.z += 0.0003;
            }
        });
  
    const lineGeometry = useMemo(() => {
        const points = [];
        for(let i=0; i<50; i++) {
            const start = new THREE.Vector3(Math.random()*100-50, Math.random()*100-50, Math.random()*100-50);
            const end = new THREE.Vector3(start.x + (Math.random()-0.5)*20, start.y + (Math.random()-0.5)*20, start.z + (Math.random()-0.5)*20);
            points.push(start, end);
        }
        return new THREE.BufferGeometry().setFromPoints(points);
    }, []);

    return (
      <>
        <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
          <sphereGeometry args={[0.2, 10, 10]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.4} />
        </instancedMesh>
        <lineSegments ref={lines} geometry={lineGeometry}>
            <lineBasicMaterial color="#0ea5e9" transparent opacity={0.18} linewidth={1} />
        </lineSegments>
      </>
    );
}

// 2. Hardware Qubit Nodes
const QubitNode = React.memo(({ position, id, isActive, isSwap }: any) => {
    const meshRef = useRef<THREE.Mesh>(null!);
    const glowRef = useRef<THREE.Mesh>(null!);
    const lastPulseRef = useRef(0);

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        // Throttle per-node animation to every 2 frames (~30-45fps) to reduce work
        if (t - lastPulseRef.current < 1 / 40) return;
        lastPulseRef.current = t;
        if (meshRef.current) {
            if (isActive) {
                const s = 1 + Math.sin(t * 8) * 0.12;
                meshRef.current.scale.setScalar(s);
            } else {
                meshRef.current.scale.setScalar(1);
            }
        }
        if (glowRef.current) {
            (glowRef.current.material as THREE.MeshBasicMaterial).opacity = isActive ? 0.6 : 0.08;
            glowRef.current.scale.setScalar(isActive ? 1.4 : 1.1);
        }
    });

    const baseColor = isSwap ? '#fb7185' : (isActive ? '#22d3ee' : '#0f1724');
    const glowColor = isSwap ? '#f43f5e' : '#0ea5e9';

    return (
        <group position={position}>
            <Sphere ref={meshRef} args={[0.35, 16, 16]}>
                <meshStandardMaterial color={baseColor} metalness={0.6} roughness={0.2} emissive={baseColor} emissiveIntensity={isActive ? 0.9 : 0.05} />
            </Sphere>
            <Sphere ref={glowRef} args={[0.45, 12, 12]}>
                <meshBasicMaterial color={glowColor} transparent opacity={isActive ? 0.5 : 0.08} side={THREE.BackSide} />
            </Sphere>
            <Html distanceFactor={12}>
                <div className="text-[10px] font-mono text-cyan-100/70 pointer-events-none select-none bg-black/40 px-1 rounded">P{id}</div>
            </Html>
        </group>
    );
});

// 3. Hardware Connections (Edges)
const HardwareConnection = React.memo(({ start, end, active }: any) => {
        const lineRef = useRef<any>(null);
        useFrame(({ clock }) => {
                if (!lineRef.current) return;
                if (active) {
                        lineRef.current.material.dashOffset -= clock.getDelta() * 6;
                }
        });

        return (
            <Line
                ref={lineRef}
                points={[start, end]}
                color={active ? '#fb7185' : '#0ea5e9'}
                lineWidth={active ? 3 : 1.5}
                transparent
                opacity={active ? 1 : 0.45}
                dashed={active}
                dashScale={active ? 5 : 1}
                dashSize={active ? 1 : 0.6}
                gapSize={active ? 0.5 : 0.6}
            />
        );
});

// 4. Main 3D Hardware Visualizer
const ThreeDHardwareViz = ({ hardware, currentResult, step }: any) => {
    const { camera } = useThree();
    
    // Calculate positions based on grid layout
    const qubitPositions = useMemo(() => {
        if (!hardware) return [];
            const params = hardware.params || {};
            const qubits = params.qubits || Object.keys(hardware.graph || {}).length || 0;
            if (qubits === 0) return [];
            const pos: THREE.Vector3[] = [];
            const spacing = 2.0;
            const cols = params.cols || Math.ceil(Math.sqrt(qubits));
            const rows = params.rows || Math.ceil(qubits / cols);
            const offsetX = (cols - 1) * spacing / 2;
            const offsetY = (rows - 1) * spacing / 2;

            const type = hardware.type || params.type || 'grid2d';

            if (type === 'star') {
                // center node at center, others in a circle
                const center = new THREE.Vector3(0, 0, 0);
                pos.push(center);
                const radius = Math.max(2, qubits) * 0.8;
                for (let i = 1; i < qubits; i++) {
                    const angle = (i - 1) / Math.max(1, qubits - 1) * Math.PI * 2;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius * 0.6;
                    const z = Math.sin(angle * 2) * 0.4;
                    pos.push(new THREE.Vector3(x, y, z));
                }
                return pos;
            }

            if (type === 'lnn') {
                // line layout
                const lineLen = (qubits - 1) * spacing;
                for (let i = 0; i < qubits; i++) {
                    const x = i * spacing - lineLen / 2;
                    const y = 0;
                    const z = Math.sin((i / Math.max(1, qubits)) * Math.PI * 2) * 0.3;
                    pos.push(new THREE.Vector3(x, y, z));
                }
                return pos;
            }

            // default: grid2d
            for (let i = 0; i < qubits; i++) {
                const row = Math.floor(i / cols);
                const col = i % cols;
                const zOffset = Math.sin((col / Math.max(1, cols)) * Math.PI * 2) * 0.5 + Math.cos((row / Math.max(1, rows)) * Math.PI * 2) * 0.5;
                pos.push(new THREE.Vector3(col * spacing - offsetX, -(row * spacing - offsetY), zOffset));
            }
            return pos;
    }, [hardware]);

    // Auto-center camera
    useEffect(() => {
        if (!hardware) return;
        const params = hardware.params || {};
        const rows = params.rows || Math.ceil(Math.sqrt(params.qubits || 0));
        const cols = params.cols || Math.ceil((params.qubits || 0) / Math.max(1, rows));
        camera.position.set(0, 0, Math.max(rows, cols) * 1.5 + 4);
    }, [hardware, camera]);

    // Derive edges from adjacency list (with fallback if .adj doesn't exist)
    const connections = useMemo(() => {
        if (!hardware || qubitPositions.length === 0) return [];
        const edges: { start: number; end: number }[] = [];
        const params = hardware.params || {};
        const qubits = params.qubits || qubitPositions.length;
        const graph = hardware.graph || {};

        // If graph is empty, generate grid adjacency for viz using params
        if (!graph || Object.keys(graph).length === 0) {
            const cols = params.cols || Math.ceil(Math.sqrt(qubits));
            for (let i = 0; i < qubits; i++) {
                if (i + 1 < qubits && (i + 1) % cols !== 0) edges.push({ start: i, end: i + 1 });
                if (i + cols < qubits) edges.push({ start: i, end: i + cols });
            }
        } else {
            for (let i = 0; i < qubitPositions.length; i++) {
                const neighbors = graph[i] || [];
                neighbors.forEach((neighbor: number) => {
                    if (i < neighbor) edges.push({ start: i, end: neighbor });
                });
            }
        }
        return edges;
    }, [hardware, qubitPositions]);

    // Determine active elements (robust to different mapper step shapes)
    const stepData = currentResult?.steps?.[step] || {};
    // Mappers use different field names:
    // - swaps: { physical: [p1, p2], inserted: true }
    // - gates:  { qubits: [p1, p2], logical: [...], inserted: false }
    // Support both `physical` and `qubits` as the active physical indices for this step.
    const activeQubits = stepData?.physical || stepData?.qubits || stepData?.physicalQubits || stepData?.layout || [];
    // Consider a step a SWAP if its type is 'swap' or it has a `physical` pair and `inserted` is true
    const isSwapStep = stepData?.type === 'swap' || (Array.isArray(stepData?.physical) && stepData?.physical.length === 2 && !!stepData?.inserted);

    // Debugging info: log step shapes when developing (visible in browser console)
    useEffect(() => {
        // Only log when there is meaningful data and in development
        if (typeof window !== 'undefined' && (window as any).__DEV__) {
            if (!currentResult || !currentResult.steps) return;
            // eslint-disable-next-line no-console
            console.debug('ThreeDHardwareViz debug', { params: hardware?.params, qubitPositionsLength: qubitPositions.length, stepIndex: step, stepData });
        }
    }, [hardware, qubitPositions, step, stepData, currentResult]);

    return (
        <>
            <ambientLight intensity={0.1} />
            <pointLight position={[10, 10, 10]} intensity={1} color="#22d3ee" />
            <pointLight position={[-10, -10, -10]} intensity={0.5} color="#f43f5e" />
            
            <group rotation={[Math.PI/8, 0, 0]}>
                {qubitPositions.map((pos, idx) => (
                    <QubitNode 
                        key={idx} 
                        position={pos} 
                        id={idx} 
                        isActive={activeQubits.includes(idx)} 
                        isSwap={isSwapStep && activeQubits.includes(idx)}
                    />
                ))}
                {connections.map((edge, idx) => {
                    const isActive = activeQubits.includes(edge.start) && activeQubits.includes(edge.end);
                    return (
                        <HardwareConnection 
                            key={`edge-${idx}`} 
                            start={qubitPositions[edge.start]} 
                            end={qubitPositions[edge.end]} 
                            active={isActive}
                        />
                    )
                })}
            </group>
             <OrbitControls enableZoom={true} enablePan={true} autoRotate autoRotateSpeed={0.5} minPolarAngle={0} maxPolarAngle={Math.PI} />
        </>
    );
};


// --- UI HELPER COMPONENTS ---

const HoloCard = ({ children, className = "" }: any) => (
    <div className={`bg-slate-900/40 backdrop-blur-xl border border-cyan-900/50 shadow-[0_0_15px_rgba(8,145,178,0.1)] rounded-2xl p-6 relative overflow-hidden group ${className}`}>
      <div className="absolute inset-0 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAADCAYAAABS3WWgAAAAD0lEQVQYV2NgYGD4z8DAAAAATgD/EEsQhAAAAABJRU5ErkJggg==')] opacity-[0.03] pointer-events-none z-0"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0 pointer-events-none"></div>
      <div className="relative z-10">
          {children}
      </div>
    </div>
);

const StatCard = ({ label, value, color, icon: Icon }: any) => (
  <div className="bg-slate-900/60 border border-slate-700/50 p-4 rounded-xl flex items-center justify-between backdrop-blur-md hover:border-cyan-500/50 transition-all group relative overflow-hidden">
     <div className={`absolute right-0 top-0 w-16 h-16 bg-gradient-to-br ${color.replace('text-','from-')}/10 to-transparent blur-xl -z-10`}></div>
    <div>
      <p className="text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-1 drop-shadow">{label}</p>
      <p className={`text-2xl font-mono font-bold ${color} drop-shadow-lg filter`}>{value}</p>
    </div>
    <div className={`p-2 rounded-lg bg-slate-950/50 border border-slate-800 group-hover:scale-110 transition-transform shadow-lg`}>
      <Icon className={`w-5 h-5 ${color}`} />
    </div>
  </div>
);


// --- MAIN EXPORT ---

export default function QuantumCompiler3DUI() {
  const [circuit, setCircuit] = useState<any | null>(null);
  const [hardware, setHardware] = useState<any | null>(null);
  const [results, setResults] = useState<any[] | null>(null);
  const [playing, setPlaying] = useState(false);
  const [activeMapper, setActiveMapper] = useState('genetic');
  const [step, setStep] = useState(0);
  const [topologyType, setTopologyType] = useState('grid2d'); 
  const [nQubits, setNQubits] = useState(9); // Default 3x3 for good viz
  const [benchmark, setBenchmark] = useState('qft');
  const [showInfo, setShowInfo] = useState(false);
  const [running, setRunning] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);
  
  // Instantiating your CostModel
  const costModel = useMemo(() => new CostModel({ alpha: 10, beta: 1, gamma: 5 }), []);

  // Initialize Hardware and Circuit
  useEffect(() => {
    const rows = Math.ceil(Math.sqrt(nQubits));
    const cols = Math.ceil(nQubits / rows);
    
    // Using your real HardwareTopology class
    const hw = new HardwareTopology(topologyType, {
      qubits: nQubits,
      rows: rows,
      cols: cols
    });
    setHardware(hw);

    const circ = BENCHMARKS[benchmark](nQubits);
    setCircuit(circ);
  }, [topologyType, nQubits, benchmark]);

  // The Real Optimization Logic
  const runOptimization = () => {
    if (!circuit || !hardware) return;
    setRunning(true);
    setWorkerError(null);

    // Using setTimeout to allow React to render the "Running" state before the main thread blocks
    setTimeout(() => {
        try {
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
        } catch (err) {
            console.error('Mapping failed on main thread', err);
            setWorkerError(String((err as any)?.message || err));
        } finally {
            setRunning(false);
        }
    }, 100);
  };

  // Animation Loop
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

  // Helper to match mapper names in dropdown to mapper names in results
  const getMapperName = (key: string) => {
    if (key === 'greedy') return 'Greedy Baseline'; // Adjust these strings to match what your Mappers return as .name
    if (key === 'lookahead') return 'Look-Ahead (k=3)';
    if (key === 'genetic') return 'Genetic Algorithm';
    return key; 
  };

  const currentResult = results?.find(r => r.mapper === getMapperName(activeMapper));

    const vizContainerRef = useRef<HTMLDivElement | null>(null);
    const [vizFullscreen, setVizFullscreen] = useState(false);

    useEffect(() => {
        const onFsChange = () => setVizFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    const toggleVizFullscreen = async () => {
        try {
            if (!vizContainerRef.current) return;
            if (!document.fullscreenElement) {
                await (vizContainerRef.current as HTMLElement).requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('Fullscreen toggle failed', err);
        }
    };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-cyan-500/30 overflow-hidden relative">
      
      {/* BACKGROUND: 3D QUANTUM FIELD */}
      <div className="fixed inset-0 z-0">
          <Canvas className="w-full h-full" camera={{ position: [0, 0, 80], fov: 60 }}>
              <QuantumField />
          </Canvas>
      </div>

      {/* FOREGROUND: UI */}
      <div className="relative z-10 max-w-[1400px] mx-auto p-6 lg:p-8 space-y-8 h-screen overflow-y-auto no-scrollbar">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between pb-6 gap-4">
          <div className="animate-in slide-in-from-top duration-700">
            <div className="flex items-center gap-3 mb-2">
                <Cpu className="w-8 h-8 text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-300 via-white to-blue-400 text-transparent bg-clip-text tracking-tight drop-shadow-sm">
                QUANTUM COMPILER <span className="text-lg font-mono text-cyan-600">v3.0</span>
                </h1>
            </div>
            <p className="text-cyan-200/70 flex items-center gap-2 text-sm font-medium tracking-wide">
                <Activity className="w-4 h-4" />
                Hardware-Aware Topological Optimization
            </p>
          </div>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="flex items-center gap-2 text-xs font-bold tracking-widest text-cyan-500/80 hover:text-cyan-300 transition-colors bg-cyan-950/30 px-4 py-2 rounded-full border border-cyan-900/50 hover:border-cyan-500/50 backdrop-blur-md"
          >
            <Info className="w-4 h-4" />
            {showInfo ? 'CLOSE INTEL' : 'SYSTEM INTEL'}
          </button>
        </header>

        {showInfo && (
          <HoloCard className="animate-in fade-in slide-in-from-top-4">
            <h3 className="font-bold text-cyan-300 mb-2 flex items-center gap-2 uppercase tracking-wider">
                <AlertCircle className="w-4 h-4"/> System Disclaimer
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed max-w-3xl font-medium">
              This tool performs compiler-level optimization for quantum circuits mapped to hardware topologies. 
              Costs are normalized heuristics. It approximates NP-hard qubit routing.
              <br/><br/>
              <span className="font-mono text-xs bg-cyan-950/50 border border-cyan-800 px-3 py-1.5 rounded text-cyan-300 drop-shadow">
                Cost Model: {costModel.explain()}
              </span>
            </p>
          </HoloCard>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Config */}
            <div className="lg:col-span-3 space-y-4 flex flex-col">
                <HoloCard className="flex-grow">
                    <h3 className="text-xs font-black text-cyan-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2 border-b border-cyan-900/50 pb-3">
                        <Layers className="w-4 h-4" /> Configuration
                    </h3>
                    
                    <div className="space-y-6">
                        {/* Topology */}
                        <div className="space-y-2 group">
                            <label className="text-[10px] text-cyan-300/70 font-bold uppercase tracking-wider group-hover:text-cyan-300 transition-colors">Topology</label>
                            <div className="relative">
                                <Grid3x3 className="absolute left-3 top-3 w-4 h-4 text-cyan-600 z-10" />
                                <select 
                                    value={topologyType}
                                    onChange={(e) => setTopologyType(e.target.value)}
                                    className="w-full bg-slate-950/80 border border-slate-800 text-cyan-100 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all appearance-none shadow-inner font-medium hover:border-cyan-700"
                                >
                                    <option value="lnn">Linear Nearest-Neighbor</option>
                                    <option value="grid2d">2D Grid Lattice</option>
                                    <option value="star">Star Topology</option>
                                </select>
                            </div>
                        </div>

                        {/* Qubits */}
                        <div className="space-y-3 group">
                            <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold">
                                <label className="text-cyan-300/70 group-hover:text-cyan-300 transition-colors">Physical Qubits</label>
                                <span className="font-mono text-cyan-300 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">{nQubits} Q</span>
                            </div>
                            <input 
                                type="range" 
                                min="4" 
                                max="16" 
                                value={nQubits}
                                onChange={(e) => setNQubits(parseInt(e.target.value))}
                                className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-500/80 hover:accent-cyan-400 border border-slate-800"
                            />
                        </div>

                        {/* Benchmark */}
                        <div className="space-y-2 group">
                            <label className="text-[10px] text-cyan-300/70 font-bold uppercase tracking-wider group-hover:text-cyan-300 transition-colors">Circuit</label>
                            <div className="relative">
                                <GitBranch className="absolute left-3 top-3 w-4 h-4 text-cyan-600 z-10" />
                                <select 
                                    value={benchmark}
                                    onChange={(e) => setBenchmark(e.target.value)}
                                    className="w-full bg-slate-950/80 border border-slate-800 text-cyan-100 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all appearance-none shadow-inner font-medium hover:border-cyan-700"
                                >
                                    <option value="qft">Quantum Fourier Transform</option>
                                    <option value="grover">Grover Search</option>
                                    <option value="entangle">Entanglement</option>
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={runOptimization}
                            disabled={running}
                            className={`w-full relative group overflow-hidden rounded-xl py-4 text-sm font-black tracking-widest transition-all duration-300 ${
                                running 
                                ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed border border-slate-700' 
                                : 'bg-gradient-to-r from-cyan-600 via-blue-600 to-cyan-600bg-[length:200%_auto] hover:bg-[position:right_center] text-white shadow-[0_0_20px_rgba(8,145,178,0.4)] border border-cyan-500/50'
                            }`}
                        >
                            <div className="flex items-center justify-center gap-3 relative z-10">
                                {running ? 'PROCESSING...' : 'EXECUTE MAPPERS'}
                            </div>
                        </button>
                        
                        {workerError && (
                          <div className="text-xs text-rose-400 bg-rose-950/30 p-2 rounded border border-rose-500/30">
                            Error: {workerError}
                          </div>
                        )}
                    </div>
                </HoloCard>
            </div>

            {/* Center/Right: Viz & Metrics */}
            <div className="lg:col-span-9 flex flex-col gap-6 h-full">
                
                {currentResult ? (
                    <>
                        {/* HUD Metrics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in zoom-in-95 duration-500">
                            <StatCard label="Added SWAPs" value={currentResult.insertedSwaps} color="text-rose-400" icon={Activity} />
                            <StatCard label="Depth" value={currentResult.depth} color="text-indigo-400" icon={Layers} />
                            <StatCard label="Dist Penalty" value={currentResult.distancePenalty} color="text-amber-400" icon={TrendingDown} />
                            <StatCard label="Total Cost" value={currentResult.cost.toFixed(1)} color="text-cyan-300" icon={Zap} />
                        </div>

                        {/* 3D Visualizer Container */}
                        <HoloCard className="p-0 overflow-hidden flex flex-col h-[500px] lg:h-auto lg:flex-grow border-cyan-500/30 shadow-[0_0_30px_rgba(8,145,178,0.2)]">
                            
                             {/* Controls Header */}
                            <div className="flex items-center justify-between bg-slate-950/80 px-6 py-3 border-b border-cyan-900/50 backdrop-blur-md z-10 relative">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <select 
                                            value={activeMapper}
                                            onChange={(e) => { setActiveMapper(e.target.value); setStep(0); setPlaying(false); }}
                                            className="bg-slate-900/90 border border-cyan-900/50 text-cyan-300 rounded-md pl-3 pr-8 py-1.5 text-xs font-bold uppercase tracking-wider focus:ring-1 focus:ring-cyan-500 outline-none appearance-none hover:border-cyan-500/50 transition-colors"
                                        >
                                            <option value="greedy">Greedy</option>
                                            <option value="lookahead">Look-Ahead</option>
                                            <option value="genetic">Genetic</option>
                                        </select>
                                        <Activity className="absolute right-2 top-2 w-3 h-3 text-cyan-600 pointer-events-none" />
                                    </div>
                                     <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_10px_#22d3ee]"></span>
                                        <span className="text-[10px] font-mono text-cyan-500/70 uppercase tracking-widest">Live 3D Render</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button onClick={() => setPlaying(!playing)} className="p-2 hover:bg-cyan-950/50 rounded-md text-cyan-400 transition-all">
                                        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                    </button>
                                    <button onClick={() => setStep(0)} className="p-2 hover:bg-cyan-950/50 rounded-md text-slate-400 hover:text-cyan-400 transition-all">
                                        <RotateCcw className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Canvas */}
                                                        <div ref={vizContainerRef} className="flex-grow relative bg-slate-950/20">
                                <div className="absolute inset-0 bg-[linear-gradient(rgba(8,145,178,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(8,145,178,0.1)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0"></div>
                                                                                        <Canvas className="w-full h-full" dpr={[1, 1.3]} gl={{ antialias: false, powerPreference: 'high-performance' }}>
                                                                                            <ThreeDHardwareViz hardware={hardware} currentResult={currentResult} step={step} />
                                                                                        </Canvas>
                                                                <button
                                                                    onClick={toggleVizFullscreen}
                                                                    className="absolute top-3 right-3 z-20 bg-slate-900/60 border border-cyan-900/40 text-cyan-300 p-2 rounded-md hover:bg-slate-900/80"
                                                                    title={vizFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                                                                >
                                                                    {vizFullscreen ? '⤢' : '⤢'}
                                                                </button>
                                {/* Legend */}
                                <div className="absolute bottom-4 right-4 bg-slate-950/80 border border-cyan-900/50 p-3 rounded-xl backdrop-blur-md text-[10px] font-mono text-cyan-300/70 space-y-1.5 z-10 pointer-events-none">
                                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#22d3ee]"></span> Active Qubit</div>
                                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#fb7185]"></span> SWAP Operation</div>
                                </div>
                            </div>

                            {/* Timeline Slider */}
                            <div className="bg-slate-950/90 px-6 py-4 border-t border-cyan-900/50 backdrop-blur-xl relative z-10">
                                <div className="flex justify-between text-xs mb-3 font-mono items-center">
                                    <span className="text-cyan-500/70 font-bold">OP {step + 1} / {currentResult.steps.length}</span>
                                    <span className={`px-3 py-1 rounded-full border ${currentResult.steps[step]?.inserted ? 'bg-rose-950/50 border-rose-500/50 text-rose-300' : 'bg-cyan-950/50 border-cyan-500/50 text-cyan-300'} font-bold uppercase tracking-wider text-[10px]`}>
                                        {currentResult.steps[step]?.type?.toUpperCase()}
                                        {currentResult.steps[step]?.inserted && ' [INSERTED]'}
                                    </span>
                                </div>
                                <input 
                                    type="range"
                                    min="0"
                                    max={currentResult.steps.length - 1}
                                    value={step}
                                    onChange={(e) => setStep(parseInt(e.target.value))}
                                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                            </div>
                        </HoloCard>
                    </>
                ) : (
                    <HoloCard className="h-full min-h-[400px] flex flex-col items-center justify-center border-dashed border-2 border-cyan-900/50 animate-pulse">
                        <Cpu className="w-16 h-16 mb-6 text-cyan-800" />
                        <p className="text-lg font-bold text-cyan-300/70 uppercase tracking-widest">System Idle</p>
                        <p className="text-sm text-slate-500 mt-2 font-mono">Initiate compilation to view topological mapping.</p>
                    </HoloCard>
                )}
            </div>
        </div>

        {/* Comparison Table */}
        {results && (
            <HoloCard className="animate-in slide-in-from-bottom-8">
                <h3 className="text-sm font-black text-cyan-300 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                    <BarChart3 className="w-5 h-5" /> Metric Analysis
                </h3>
                <div className="overflow-x-auto rounded-lg border border-cyan-900/30">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-cyan-950/50 text-cyan-300/70 text-[10px] uppercase tracking-widest font-bold">
                            <tr>
                                <th className="py-4 pl-6">Strategy</th>
                                <th className="py-4 text-right">SWAPs</th>
                                <th className="py-4 text-right">Depth</th>
                                <th className="py-4 text-right">Cost</th>
                                <th className="py-4 pr-6 text-right">Delta</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-cyan-900/30 bg-slate-950/30">
                            {results.map((result, idx) => {
                                const baselineCost = results[0].cost;
                                const improvementValue = baselineCost > 0 ? (baselineCost - result.cost) / baselineCost * 100 : 0;
                                const isActive = getMapperName(activeMapper) === result.mapper;

                                return (
                                    <tr 
                                        key={idx} 
                                        className={`group transition-all duration-300 hover:bg-cyan-900/20 ${isActive ? 'bg-cyan-900/30' : ''}`}
                                        onClick={() => { setActiveMapper(result.mapper === 'Greedy Baseline' ? 'greedy' : result.mapper === 'Look-Ahead (k=3)' ? 'lookahead' : 'genetic'); setStep(0); setPlaying(false); }}
                                        style={{cursor: 'pointer'}}
                                    >
                                        <td className="py-5 pl-6 font-bold flex items-center gap-3">
                                            {isActive && <ArrowRight className="w-4 h-4 text-cyan-500" />}
                                            <span className={isActive ? 'text-cyan-200' : 'text-slate-300'}>{result.mapper}</span>
                                        </td>
                                        <td className="py-5 text-right font-mono text-rose-300">{result.insertedSwaps}</td>
                                        <td className="py-5 text-right font-mono text-indigo-300">{result.depth}</td>
                                        <td className="py-5 text-right font-mono font-black text-cyan-300">{result.cost.toFixed(1)}</td>
                                        <td className="py-5 pr-6 text-right font-mono text-emerald-300">
                                            {idx > 0 && `${improvementValue.toFixed(1)}%`}
                                            {idx === 0 && <span className="text-slate-600">REF</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </HoloCard>
        )}
            </div>
            <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </div>
  );
}