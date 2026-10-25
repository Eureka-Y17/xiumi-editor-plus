import type { Server } from "node:http";
export function publicIPv4(ip: string): boolean;
export function imageBytes(src: string): {
  data: Buffer;
  mime: string;
  name: string;
};
export function remoteImage(
  src: string,
  redirects?: number,
): Promise<{ data: Buffer; mime: string; name: string }>;
export function createBridge(options?: {
  token?: string;
  bases?: string[];
  fetchImpl?: typeof fetch;
  imageLoader?: typeof remoteImage;
  now?: () => number;
  appid?: string;
  secret?: string;
}): { server: Server; token: string; close: () => Promise<void> };
