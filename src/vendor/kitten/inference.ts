import * as ort from "onnxruntime-web/wasm";

export type InferenceInputs = {
  inputIds: BigInt64Array;
  style: Float32Array;
  speed: number;
};

export class InferenceEngine {
  private constructor(private readonly session: ort.InferenceSession) {}

  static async create(
    modelSource: string | ArrayBuffer | Uint8Array,
    executionProvider: "webgpu" | "wasm" = "wasm"
  ): Promise<InferenceEngine> {
    const sessionOptions: ort.InferenceSession.SessionOptions = {
      executionProviders: [executionProvider]
    };
    const session =
      typeof modelSource === "string"
        ? await ort.InferenceSession.create(modelSource, sessionOptions)
        : await ort.InferenceSession.create(
            modelSource instanceof ArrayBuffer ? new Uint8Array(modelSource) : modelSource,
            sessionOptions
          );

    return new InferenceEngine(session);
  }

  async run({ inputIds, style, speed }: InferenceInputs): Promise<Float32Array> {
    const feeds: Record<string, ort.Tensor> = {
      input_ids: new ort.Tensor("int64", inputIds, [1, inputIds.length]),
      style: new ort.Tensor("float32", style, [1, style.length]),
      speed: new ort.Tensor("float32", Float32Array.from([speed]), [1])
    };

    const outputs = await this.session.run(feeds);
    const firstOutput = Object.values(outputs)[0];

    if (!firstOutput) {
      throw new Error("Inference returned no outputs.");
    }

    const data = firstOutput.data;
    return data instanceof Float32Array ? data : Float32Array.from(data as ArrayLike<number>);
  }
}

