import { openSync, closeSync, readSync } from "node:fs";
import { extname } from "node:path";
import type { MediaKind } from "./storage.js";

const readFileHead = (filePath: string, length: number): Buffer => {
  const fileDescriptor = openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const readBytes = readSync(fileDescriptor, buffer, 0, length, 0);
    return buffer.subarray(0, readBytes);
  } finally {
    closeSync(fileDescriptor);
  }
};

const startsWithBytes = (buffer: Buffer, bytes: number[]): boolean => {
  if (buffer.length < bytes.length) {
    return false;
  }
  return bytes.every((byte, index) => buffer[index] === byte);
};

const asciiPrefix = (buffer: Buffer, length: number): string => {
  return buffer.subarray(0, length).toString("ascii");
};

const isLikelyTextModel = (buffer: Buffer): boolean => {
  const content = buffer.toString("utf8");
  return (
    content.includes("\nv ") ||
    content.startsWith("v ") ||
    content.startsWith("o ") ||
    content.startsWith("#") ||
    content.includes("\nusemtl ") ||
    content.includes("\nmtllib ")
  );
};

const validateImageFile = (extension: string, fileHead: Buffer): boolean => {
  if (extension === ".png") {
    return startsWithBytes(fileHead, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return startsWithBytes(fileHead, [0xff, 0xd8, 0xff]);
  }
  if (extension === ".gif") {
    const header = asciiPrefix(fileHead, 6);
    return header === "GIF87a" || header === "GIF89a";
  }
  if (extension === ".webp") {
    return asciiPrefix(fileHead, 4) === "RIFF" && asciiPrefix(fileHead.subarray(8), 4) === "WEBP";
  }
  return false;
};

const validateModelFile = (extension: string, fileHead: Buffer): boolean => {
  if (extension === ".blend") {
    const header = asciiPrefix(fileHead, 16).toUpperCase();
    return header.startsWith("BLENDER") || header.includes("BLENDER");
  }
  if (extension === ".glb") {
    return asciiPrefix(fileHead, 4) === "glTF";
  }
  if (extension === ".gltf") {
    const content = fileHead.toString("utf8").trimStart();
    return content.startsWith("{") && content.includes("\"asset\"");
  }
  if (extension === ".ply") {
    const content = fileHead.toString("utf8");
    return content.startsWith("ply") && content.includes("format ");
  }
  if (extension === ".stl") {
    const ascii = fileHead.toString("utf8").trimStart();
    if (ascii.startsWith("solid")) {
      return true;
    }
    return fileHead.length >= 84;
  }
  if (extension === ".fbx") {
    const ascii = fileHead.toString("utf8");
    return ascii.startsWith("Kaydara FBX Binary") || ascii.includes("; FBX");
  }
  if (extension === ".obj") {
    return isLikelyTextModel(fileHead);
  }
  return false;
};

export const hasValidFileSignature = (
  kind: MediaKind,
  filePath: string,
  originalName: string
): boolean => {
  const extension = extname(originalName).toLowerCase();
  const fileHead = readFileHead(filePath, 2048);

  if (kind === "images") {
    return validateImageFile(extension, fileHead);
  }
  return validateModelFile(extension, fileHead);
};
