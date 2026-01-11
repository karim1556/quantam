import React, { useRef, useEffect } from 'react';

export default function QubitVisualizer({ currentResult, step, hardware, topologyType }: any) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !hardware || !currentResult) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Ensure canvas pixel size matches CSS size for crisp rendering
    const cssW = Math.max(1, rect.width);
    const cssH = Math.max(1, rect.height);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));

    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    if (!ctx) return;

    // Reset any transform from previous draws then scale for DPR
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const w = cssW;
    const h = cssH;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    const currentStep = currentResult.steps?.[step];
    if (!currentStep) return;

    const layout = currentStep.layout || [];
    const nQ = layout.length || 0;
    const positions = layout.map((_, i) => {
      if (topologyType === 'star') {
        if (i === 0) return { x: w / 2, y: h / 2 };
        const angle = (2 * Math.PI * i) / Math.max(1, nQ);
        return { x: w / 2 + 120 * Math.cos(angle), y: h / 2 + 120 * Math.sin(angle) };
      }
      const gridSize = Math.ceil(Math.sqrt(Math.max(1, nQ)));
      return {
        x: 80 + (i % gridSize) * 100,
        y: 80 + Math.floor(i / gridSize) * 100
      };
    });

    Object.keys(hardware.graph || {}).forEach(q => {
      const q1 = parseInt(q, 10);
      (hardware.graph[q] || []).forEach((q2: number) => {
        if (q1 < q2 && positions[q1] && positions[q2]) {
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(positions[q1].x, positions[q1].y);
          ctx.lineTo(positions[q2].x, positions[q2].y);
          ctx.stroke();
        }
      });
    });

    positions.forEach((pos, i) => {
      const logicalQubit = layout.indexOf(i);
      const isActive = currentStep.qubits?.includes(i) || currentStep.physical?.includes(i);

      ctx.fillStyle = isActive ? (currentStep.inserted ? '#ef4444' : '#3b82f6') : '#1e293b';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`P${i}`, pos.x, pos.y - 6);
      ctx.font = '11px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`L${logicalQubit}`, pos.x, pos.y + 8);
    });

    if ((currentStep.type === 'swap' || currentStep.type === 'cx') && (currentStep.physical || currentStep.qubits)) {
      const qubits = currentStep.physical || currentStep.qubits;
      if (qubits.length === 2 && positions[qubits[0]] && positions[qubits[1]]) {
        ctx.strokeStyle = currentStep.inserted ? '#f87171' : '#60a5fa';
        ctx.lineWidth = 4;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(positions[qubits[0]].x, positions[qubits[0]].y);
        ctx.lineTo(positions[qubits[1]].x, positions[qubits[1]].y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

  // Listen for changes to the steps array length or the specific step layout length as well
  }, [currentResult, currentResult?.steps?.length, currentResult?.steps?.[step]?.layout?.length, step, hardware, topologyType]);

  return (
    <canvas
      ref={canvasRef}
      // width/height attributes are now managed in effect to support DPR
      className="w-full border border-slate-700 rounded bg-slate-950"
      style={{ width: '700px', height: '400px' }}
    />
  );
}
