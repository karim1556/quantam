import { InteractionGraph } from '../compiler/InteractionGraph';

export class GeneticSwapOptimizer {
  circuit: any;
  hardware: any;
  name: string;
  config: any;
  interactionGraph: InteractionGraph;
  fitnessCache: Map<string, number>;

  constructor(circuit: any, hardware: any, config: any = {}) {
    this.circuit = circuit;
    this.hardware = hardware;
    this.name = 'Genetic Algorithm';
    this.config = {
      populationSize: config.populationSize || 30,
      generations: config.generations || 50,
      tournamentSize: config.tournamentSize || 3,
      eliteRatio: config.eliteRatio || 0.2,
      initialMutationRate: config.initialMutationRate || 0.3,
      minMutationRate: config.minMutationRate || 0.05,
      maxSwapsPerChromosome: config.maxSwapsPerChromosome || 8,
      plateauThreshold: config.plateauThreshold || 10
    };
    this.interactionGraph = new InteractionGraph(circuit);
    this.fitnessCache = new Map();
  }

  map() {
    let population = this.initializePopulation();
    let bestEver: any = null;
    let bestEverFitness = -Infinity;
    let plateauCounter = 0;
    let mutationRate = this.config.initialMutationRate;

    for (let gen = 0; gen < this.config.generations; gen++) {
      const evaluated = population.map(chromosome => {
        const cacheKey = this.chromosomeKey(chromosome);
        if (this.fitnessCache.has(cacheKey)) {
          return { chromosome, fitness: this.fitnessCache.get(cacheKey) };
        }
        const fitness = this.evaluateFitness(chromosome);
        this.fitnessCache.set(cacheKey, fitness);
        return { chromosome, fitness };
      });

      evaluated.sort((a, b) => b.fitness - a.fitness);

      if (evaluated[0].fitness > bestEverFitness) {
        bestEver = evaluated[0].chromosome;
        bestEverFitness = evaluated[0].fitness;
        plateauCounter = 0;
      } else {
        plateauCounter++;
      }

      if (plateauCounter >= this.config.plateauThreshold) break;

      const eliteCount = Math.floor(this.config.populationSize * this.config.eliteRatio);
      const newPopulation = evaluated.slice(0, eliteCount).map((e: any) => e.chromosome);

      while (newPopulation.length < this.config.populationSize) {
        const parent1 = this.tournamentSelect(evaluated);
        const parent2 = this.tournamentSelect(evaluated);
        let child = this.crossover(parent1, parent2);

        if (Math.random() < mutationRate) {
          child = this.mutate(child);
        }

        newPopulation.push(child);
      }

      population = newPopulation;
      mutationRate = Math.max(this.config.minMutationRate, mutationRate * 0.95);
    }

    return this.applyChromosome(bestEver);
  }

  initializePopulation() {
    const pop: any[] = [];
    const validSwaps = this.getValidSwaps();

    for (let i = 0; i < this.config.populationSize; i++) {
      const length = Math.floor(Math.random() * this.config.maxSwapsPerChromosome) + 1;
      const chromosome: any[] = [];

      for (let j = 0; j < length; j++) {
        chromosome.push(validSwaps[Math.floor(Math.random() * validSwaps.length)]);
      }

      pop.push(chromosome);
    }

    return pop;
  }

  getValidSwaps() {
    const swaps: number[][] = [];
    Object.keys(this.hardware.graph).forEach(q1Str => {
      const q1 = parseInt(q1Str, 10);
      this.hardware.graph[q1].forEach((q2: number) => {
        if (q1 < q2) swaps.push([q1, q2]);
      });
    });
    return swaps;
  }

  chromosomeKey(chromosome: any[]) {
    return chromosome.map(([a, b]: any) => `${a}-${b}`).join(',');
  }

  evaluateFitness(chromosome: any[]) {
    const result = this.applyChromosome(chromosome);
    return -(result.insertedSwaps * 10 + result.depth + result.distancePenalty * 3);
  }

  applyChromosome(chromosome: any[]) {
    const steps: any[] = [];
    const layout = Array.from({ length: this.circuit.nQubits }, (_, i) => i);
    let insertedSwaps = 0;
    let depth = 0;
    let distancePenalty = 0;
    let swapIndex = 0;

    this.circuit.gates.forEach((gate: any) => {
      if (gate.qubits.length === 2) {
        const [c, t] = gate.qubits;
        let physC = layout[c];
        let physT = layout[t];

        while (!this.hardware.isConnected(physC, physT) && swapIndex < chromosome.length) {
          const [swapQ1, swapQ2] = chromosome[swapIndex];
          const logQ1 = layout.indexOf(swapQ1);
          const logQ2 = layout.indexOf(swapQ2);

          if (logQ1 !== -1 && logQ2 !== -1) {
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
          }

          swapIndex++;
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

    return { steps, insertedSwaps, depth, distancePenalty, finalLayout: layout };
  }

  tournamentSelect(evaluated: any[]) {
    const tournament: any[] = [];
    for (let i = 0; i < this.config.tournamentSize; i++) {
      tournament.push(evaluated[Math.floor(Math.random() * evaluated.length)]);
    }
    return tournament.sort((a, b) => b.fitness - a.fitness)[0].chromosome;
  }

  crossover(p1: any[], p2: any[]) {
    if (p1.length === 0 || p2.length === 0) return p1.length > 0 ? [...p1] : [...p2];
    const point = Math.floor(Math.random() * Math.min(p1.length, p2.length));
    return [...p1.slice(0, point), ...p2.slice(point)];
  }

  mutate(chromosome: any[]) {
    const mutated = [...chromosome];
    const validSwaps = this.getValidSwaps();

    const mutationType = Math.random();

    if (mutationType < 0.4 && mutated.length > 0) {
      const idx = Math.floor(Math.random() * mutated.length);
      mutated[idx] = validSwaps[Math.floor(Math.random() * validSwaps.length)];
    } else if (mutationType < 0.7 && mutated.length < this.config.maxSwapsPerChromosome) {
      mutated.push(validSwaps[Math.floor(Math.random() * validSwaps.length)]);
    } else if (mutated.length > 1) {
      mutated.splice(Math.floor(Math.random() * mutated.length), 1);
    }

    return mutated;
  }
}
