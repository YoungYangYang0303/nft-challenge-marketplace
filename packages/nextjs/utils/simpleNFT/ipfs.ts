// TODO: 强烈建议把下面两个 key 放到 .env 文件中通过 process.env 读取，避免泄漏。
const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY || "254ee6f77e5b387d49fe"; // placeholder
const PINATA_SECRET_API_KEY = process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY || process.env.PINATA_SECRET_API_KEY || "463137d7cae62df48196b56f322bc1fc06e77292fe17270cb4bd85e1518475c8"; // placeholder

const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export async function addFileToIPFS(
  file: File,
  options: { fileName?: string; maxSizeBytes?: number } = {}
): Promise<{ IpfsHash: string; PinSize: number; Timestamp: string }> {
  if (!file) {
    throw new Error("No file provided for IPFS upload");
  }

  const { fileName, maxSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES } = options;
  if (typeof file.size === "number" && file.size > maxSizeBytes) {
    const mb = (maxSizeBytes / (1024 * 1024)).toFixed(1);
    throw new Error(`File is too large. Limit ${mb}MB`);
  }

  const resolvedFileName = (fileName || (file as File).name || "upload")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  const formData = new FormData();
  formData.append("file", file, resolvedFileName);
  formData.append("pinataMetadata", JSON.stringify({ name: resolvedFileName.slice(0, 120) }));
  formData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_SECRET_API_KEY,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error("Pinata pinFileToIPFS failed: " + text);
  }

  return res.json();
}

// 使用 Pinata pinJSONToIPFS 接口上传 JSON （metadata）
export async function addJSONToIPFS(json: object): Promise<{ IpfsHash: string; PinSize: number; Timestamp: string }> {
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_SECRET_API_KEY,
    },
    body: JSON.stringify({ pinataContent: json }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error("Pinata pinJSONToIPFS failed: " + text);
  }
  return res.json();
}

// 从 Pinata 网关获取 JSON Metadata
const MEM_METADATA_CACHE: Record<string, any> = {};
const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://w3s.link/ipfs/",
];

export async function getNFTMetadataFromIPFS(ipfsHash: string, options: { force?: boolean } = {}) {
  const { force = false } = options;
  const cleanHash = ipfsHash.replace(/^ipfs:\/\//, "");
  // 明显不是合法 CID（长度太短），直接抛出特定错误，外层可用本地占位回退
  if (cleanHash.length < 10) {
    throw new Error(`Invalid IPFS hash: ${cleanHash}`);
  }
  if (!force && MEM_METADATA_CACHE[cleanHash]) return MEM_METADATA_CACHE[cleanHash];

  let lastError: any = null;
  for (let gatewayIndex = 0; gatewayIndex < IPFS_GATEWAYS.length; gatewayIndex++) {
    const base = IPFS_GATEWAYS[gatewayIndex];
    const url = base + cleanHash;
    // 指数退避重试 3 次
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          MEM_METADATA_CACHE[cleanHash] = data;
          return data;
        } else if (res.status === 429 || res.status >= 500) {
          // 等待退避后再重试
          await new Promise(r => setTimeout(r, 500 * 2 ** attempt + Math.random() * 200));
          continue;
        } else if (res.status === 404) {
          lastError = new Error(`Metadata not found at ${url}`);
          break; // 换下一个网关
        } else {
          lastError = new Error(`Gateway ${url} responded ${res.status}`);
          break;
        }
      } catch (err: any) {
        clearTimeout(timeout);
        lastError = err;
        // 网络错误：退避后再试
        await new Promise(r => setTimeout(r, 500 * 2 ** attempt));
        continue;
      }
    }
  }
  throw lastError || new Error("Failed to fetch metadata from all gateways");
}

// 可选：获取图片直链（若 metadata 中 image 字段是 ipfs:// 格式，可在前端使用）
export function ipfsToHttp(urlOrCid: string) {
  if (!urlOrCid) return "";
  if (urlOrCid.startsWith("http://") || urlOrCid.startsWith("https://")) return urlOrCid;
  const cid = urlOrCid.replace(/^ipfs:\/\//, "");
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}
