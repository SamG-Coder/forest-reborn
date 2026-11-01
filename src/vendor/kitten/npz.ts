import { unzipSync } from "fflate";
import type { VoiceEmbeddingMatrix, VoiceTable } from "./types";

type ParsedNpy = {
  shape: number[];
  data: Float32Array;
};

const NUMPY_MAGIC = "\u0093NUMPY";

export function parseVoicesNpz(input: ArrayBuffer | Uint8Array): VoiceTable {
  const zipEntries = unzipSync(toUint8Array(input));
  const voices: VoiceTable = {};

  for (const [filename, entryBytes] of Object.entries(zipEntries)) {
    if (!filename.endsWith(".npy")) {
      continue;
    }

    const name = filename.replace(/^.*\//, "").replace(/\.npy$/, "");
    const parsed = parseNpy(entryBytes);

    if (parsed.shape.length !== 2) {
      throw new Error(`Voice entry ${filename} is not a 2D array.`);
    }

    const [rows, cols] = parsed.shape;
    if (!rows || !cols) {
      throw new Error(`Voice entry ${filename} has invalid shape.`);
    }

    voices[name] = {
      rows,
      cols,
      values: parsed.data
    } satisfies VoiceEmbeddingMatrix;
  }

  if (!Object.keys(voices).length) {
    throw new Error("No .npy voice arrays found in voices archive.");
  }

  return voices;
}

function parseNpy(bytes: Uint8Array): ParsedNpy {
  const magic = String.fromCharCode(...bytes.subarray(0, 6));
  if (magic !== NUMPY_MAGIC) {
    throw new Error("Invalid NPY file: missing magic header.");
  }

  const major = bytes[6];
  const minor = bytes[7];
  if (!major || (major !== 1 && major !== 2)) {
    throw new Error(`Unsupported NPY version ${String(major)}.${String(minor)}.`);
  }

  const view = new DataView(toArrayBuffer(bytes));
  const headerLength = major === 1 ? view.getUint16(8, true) : view.getUint32(8, true);
  const headerOffset = major === 1 ? 10 : 12;
  const headerEnd = headerOffset + headerLength;

  const header = new TextDecoder("ascii").decode(bytes.subarray(headerOffset, headerEnd));
  const descr = extractHeaderString(header, "descr");
  const fortranOrder = extractHeaderBoolean(header, "fortran_order");
  const shape = extractHeaderShape(header);

  if (fortranOrder) {
    throw new Error("Fortran-order NPY arrays are not supported.");
  }

  const dataByteOffset = headerEnd;
  const elementCount = shape.reduce((acc, dim) => acc * dim, 1);

  return {
    shape,
    data: decodeNpyData(bytes, dataByteOffset, elementCount, descr)
  };
}

function extractHeaderString(header: string, field: string): string {
  const match = new RegExp(`'${field}'\\s*:\\s*'([^']+)'`).exec(header);
  if (!match?.[1]) {
    throw new Error(`Failed to parse NPY header field '${field}'.`);
  }
  return match[1];
}

function extractHeaderBoolean(header: string, field: string): boolean {
  const match = new RegExp(`'${field}'\\s*:\\s*(True|False)`).exec(header);
  if (!match?.[1]) {
    throw new Error(`Failed to parse NPY header field '${field}'.`);
  }
  return match[1] === "True";
}

function extractHeaderShape(header: string): number[] {
  const match = /'shape'\s*:\s*\(([^\)]*)\)/.exec(header);
  if (!match?.[1]) {
    throw new Error("Failed to parse NPY header shape.");
  }

  const shape = match[1]
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => Number.parseInt(value, 10));

  if (!shape.length || shape.some((value) => !Number.isInteger(value) || value <= 0)) {
    throw new Error(`Invalid NPY shape: (${match[1]}).`);
  }

  return shape;
}

function decodeNpyData(bytes: Uint8Array, dataByteOffset: number, elementCount: number, descr: string): Float32Array {
  const endian = descr[0];
  const dtype = descr.slice(1);

  if (endian === ">") {
    throw new Error(`Big-endian NPY arrays are not supported (${descr}).`);
  }

  switch (dtype) {
    case "f4": {
      const out = readTypedView(Float32Array, bytes, dataByteOffset, elementCount);
      return new Float32Array(out);
    }
    case "f8": {
      const out = readTypedView(Float64Array, bytes, dataByteOffset, elementCount);
      return Float32Array.from(out);
    }
    case "i8": {
      const out = readTypedView(BigInt64Array, bytes, dataByteOffset, elementCount);
      return Float32Array.from(out, (value) => Number(value));
    }
    case "i4": {
      const out = readTypedView(Int32Array, bytes, dataByteOffset, elementCount);
      return Float32Array.from(out);
    }
    case "u4": {
      const out = readTypedView(Uint32Array, bytes, dataByteOffset, elementCount);
      return Float32Array.from(out);
    }
    case "i2": {
      const out = readTypedView(Int16Array, bytes, dataByteOffset, elementCount);
      return Float32Array.from(out);
    }
    case "u2": {
      const out = readTypedView(Uint16Array, bytes, dataByteOffset, elementCount);
      return Float32Array.from(out);
    }
    case "i1": {
      const out = readTypedView(Int8Array, bytes, dataByteOffset, elementCount);
      return Float32Array.from(out);
    }
    case "u1": {
      const out = readTypedView(Uint8Array, bytes, dataByteOffset, elementCount);
      return Float32Array.from(out);
    }
    default:
      throw new Error(`Unsupported NPY dtype '${descr}'.`);
  }
}

type TypedArrayCtor<T extends ArrayBufferView> = {
  readonly BYTES_PER_ELEMENT: number;
  new (buffer: ArrayBufferLike, byteOffset: number, length: number): T;
};

function readTypedView<T extends ArrayBufferView>(
  ctor: TypedArrayCtor<T>,
  bytes: Uint8Array,
  dataByteOffset: number,
  elementCount: number
): T {
  const byteLength = elementCount * ctor.BYTES_PER_ELEMENT;
  const slice = bytes.subarray(dataByteOffset, dataByteOffset + byteLength);

  if (slice.byteOffset % ctor.BYTES_PER_ELEMENT === 0) {
    return new ctor(slice.buffer, slice.byteOffset, elementCount);
  }

  // NPY payloads are typically aligned, but this protects typed array construction.
  const alignedCopy = slice.slice();
  return new ctor(alignedCopy.buffer, alignedCopy.byteOffset, elementCount);
}

function toUint8Array(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength && bytes.buffer instanceof ArrayBuffer) {
    return bytes.buffer;
  }

  const copy = bytes.slice();
  return copy.buffer;
}
