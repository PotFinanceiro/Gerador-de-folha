"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

/**
 * Campo de assinatura digital: desenho com o dedo (celular/tablet), mouse,
 * trackpad do notebook ou caneta — usa Pointer Events num <canvas>.
 *
 * A exportação recorta o desenho (bounding box) e completa a proporção do
 * campo de assinatura do modelo da carta (≈ 2,68:1), para ocupá-lo por inteiro.
 */
const LARGURA = 800;
const ALTURA = 300;
const PROPORCAO_MODELO = 2.678;

export type AssinaturaHandle = { exportar: () => Promise<Blob | null> };

export const Assinatura = forwardRef<AssinaturaHandle, { onMudanca?: (preenchida: boolean) => void }>(
  function Assinatura({ onMudanca }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const desenhando = useRef(false);
    const [preenchida, setPreenchida] = useState(false);

    const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const r = canvasRef.current!.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * LARGURA, y: ((e.clientY - r.top) / r.height) * ALTURA };
    };

    const inicio = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      canvasRef.current!.setPointerCapture(e.pointerId);
      const ctx = canvasRef.current!.getContext("2d")!;
      const { x, y } = pos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineWidth = 4.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111";
      desenhando.current = true;
    };

    const movimento = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!desenhando.current) return;
      e.preventDefault();
      const ctx = canvasRef.current!.getContext("2d")!;
      const { x, y } = pos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      if (!preenchida) {
        setPreenchida(true);
        onMudanca?.(true);
      }
    };

    const fim = () => {
      desenhando.current = false;
    };

    const limpar = useCallback(() => {
      const c = canvasRef.current!;
      c.getContext("2d")!.clearRect(0, 0, LARGURA, ALTURA);
      setPreenchida(false);
      onMudanca?.(false);
    }, [onMudanca]);

    useImperativeHandle(ref, () => ({
      exportar: async () => {
        if (!preenchida) return null;
        const c = canvasRef.current!;
        const ctx = c.getContext("2d")!;
        // bounding box dos traços
        const img = ctx.getImageData(0, 0, LARGURA, ALTURA).data;
        let x0 = LARGURA, y0 = ALTURA, x1 = 0, y1 = 0;
        for (let y = 0; y < ALTURA; y++) {
          for (let x = 0; x < LARGURA; x++) {
            if (img[(y * LARGURA + x) * 4 + 3] > 8) {
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
              if (y < y0) y0 = y;
              if (y > y1) y1 = y;
            }
          }
        }
        if (x1 <= x0 || y1 <= y0) return null;
        // recorte com folga e completamento da proporção do modelo
        const m = 16;
        const cw = Math.min(LARGURA, x1 - x0 + m * 2);
        const ch = Math.min(ALTURA, y1 - y0 + m * 2);
        const largura = Math.max(cw, Math.round(ch * PROPORCAO_MODELO));
        const altura = Math.max(ch, Math.round(cw / PROPORCAO_MODELO));
        const saida = document.createElement("canvas");
        saida.width = largura;
        saida.height = altura;
        const sctx = saida.getContext("2d")!;
        sctx.drawImage(c, x0 - m, y0 - m, cw, ch, Math.round((largura - cw) / 2), Math.round((altura - ch) / 2), cw, ch);
        return new Promise<Blob | null>((res) => saida.toBlob((b) => res(b), "image/png"));
      },
    }));

    return (
      <div className="space-y-2">
        <canvas
          ref={canvasRef}
          width={LARGURA}
          height={ALTURA}
          onPointerDown={inicio}
          onPointerMove={movimento}
          onPointerUp={fim}
          onPointerCancel={fim}
          onPointerLeave={fim}
          role="img"
          aria-label="Área para desenhar a assinatura"
          className={`w-full touch-none rounded-lg border-2 border-dashed bg-white ${preenchida ? "border-zinc-300" : "border-zinc-300"}`}
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Assine com o dedo no celular, ou com o mouse/trackpad no notebook.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={limpar} disabled={!preenchida}>
            <Eraser className="h-4 w-4 mr-1.5" aria-hidden />
            Limpar
          </Button>
        </div>
      </div>
    );
  }
);
