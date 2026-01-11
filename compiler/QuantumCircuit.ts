export class QuantumCircuit {
  nQubits: number;
  gates: any[];

  constructor(nQubits: number) {
    this.nQubits = nQubits;
    this.gates = [];
  }

  addGate(type: string, qubits: number[], params: any = {}) {
    this.gates.push({
      type,
      qubits: [...qubits],
      params,
      id: `${type}_${qubits.join('_')}_${this.gates.length}`
    });
    return this;
  }

  clone() {
    const c = new QuantumCircuit(this.nQubits);
    c.gates = this.gates.map(g => ({ ...g, qubits: [...g.qubits] }));
    return c;
  }

  getTwoQubitGates() {
    return this.gates.filter(g => g.qubits.length === 2);
  }
}
