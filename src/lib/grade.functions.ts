import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  image: z.string().startsWith("data:image/").max(12_000_000),
  total: z.number().int().min(1).max(20),
});

export const readAnswerSheet = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    const letters = "ABCDE";
    const once = async () => {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Esta é a foto de um gabarito/folha de respostas de prova de múltipla escolha com ${data.total} questões (alternativas A-E). Leia com máxima atenção a alternativa marcada pelo aluno em cada questão de 1 a ${data.total}. Se não houver marcação, ou houver mais de uma, use "-". Leia também o nome do aluno se existir (senão string vazia). Retorne apenas o JSON.`,
              },
              { type: "input_image", image_url: data.image, detail: "high" },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "gabarito",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["student", "answers"],
              properties: {
                student: { type: "string" },
                answers: {
                  type: "array",
                  items: { type: "string", enum: [...letters.split(""), "-"] },
                },
              },
            },
          },
        },
      });
      let txt = "";
      for (const item of res.output ?? []) {
        if (item.type === "message") {
          for (const c of item.content) if (c.type === "output_text") txt += c.text;
        }
      }
      const parsed = JSON.parse(txt) as { student: string; answers: string[] };
      const answers = Array.from({ length: data.total }, (_, i) => parsed.answers[i] ?? "-");
      return { student: parsed.student, answers };
    };
    try {
      // Duas leituras independentes; divergências são marcadas para conferência.
      const [a, b] = await Promise.all([once(), once()]);
      const doubtful = a.answers.map((x, i) => (x !== b.answers[i] ? i : -1)).filter((i) => i >= 0);
      return { student: a.student || b.student, answers: a.answers, doubtful };
    } catch (e) {
      if (e instanceof GatewayError) {
        if (e.httpStatus === 402) throw new Error("Créditos de IA esgotados.");
        if (e.httpStatus === 429) throw new Error("Muitas correções seguidas. Aguarde um pouco.");
      }
      throw new Error("Não foi possível ler o gabarito. Tente uma foto mais nítida.");
    }
  });
