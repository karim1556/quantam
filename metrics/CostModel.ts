export class CostModel {
  alpha: number;
  beta: number;
  gamma: number;

  constructor(config: any = {}) {
    this.alpha = config.alpha || 10;
    this.beta = config.beta || 1;
    this.gamma = config.gamma || 5;
  }

  evaluate(result: any) {
    const swapCount = result.insertedSwaps || 0;
    const depth = result.depth || 0;
    const distancePenalty = result.distancePenalty || 0;

    return this.alpha * swapCount + this.beta * depth + this.gamma * distancePenalty;
  }

  explain() {
    return `Cost = ${this.alpha}·SWAPs + ${this.beta}·Depth + ${this.gamma}·Distance`;
  }
}
