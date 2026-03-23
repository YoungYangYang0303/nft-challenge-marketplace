import { createPublicClient, http } from "viem";
import { hardhat } from "viem/chains";
import scaffoldConfig from "~~/scaffold.config";

// 定义多个备用网关
const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/", // Pinata 通常最稳
  "https://ipfs.io/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://dweb.link/ipfs/",
];

export const getMetadataFromIPFS = async (ipfsHash: string) => {
  if (!ipfsHash || ipfsHash.length < 10) {
    throw new Error("Invalid IPFS hash");
  }

  let cid = ipfsHash;
  if (ipfsHash.startsWith("ipfs://")) {
    cid = ipfsHash.replace("ipfs://", "");
  } else if (ipfsHash.startsWith("http")) {
    const parts = ipfsHash.split("/ipfs/");
    if (parts.length > 1) {
      cid = parts[1];
    }
  }

  // 竞速模式：同时请求所有网关，取最快返回的一个
  try {
    const controller = new AbortController();
    const signal = controller.signal;
    
    const requests = IPFS_GATEWAYS.map(async (gateway) => {
      const response = await fetch(`${gateway}${cid}`, { 
        signal,
        method: 'GET',
        // 设置较短的超时，避免挂起太久
        next: { revalidate: 3600 } 
      });
      if (!response.ok) throw new Error(`Failed to fetch from ${gateway}`);
      return response.json();
    });

    // Promise.any 会等待第一个成功的 Promise
    const result = await Promise.any(requests);
    
    // 成功后取消其他正在进行的请求（虽然 fetch 的 abort 在某些环境不一定立即生效，但是个好习惯）
    controller.abort();
    
    return result;
  } catch (error) {
    console.error("All IPFS gateways failed:", error);
    throw new Error("Failed to fetch metadata from all gateways");
  }
};

export const getTokenURI = async (contractAddress: string, tokenId: bigint): Promise<string> => {
  const override = (scaffoldConfig.rpcOverrides as Record<number, string> | undefined)?.[hardhat.id];
  const publicClient = createPublicClient({
    chain: hardhat,
    transport: override ? http(override) : http(),
  });

  const tokenURI = await publicClient.readContract({
    address: contractAddress as `0x${string}`,
    abi: [
      {
        inputs: [
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256",
          },
        ],
        name: "tokenURI",
        outputs: [
          {
            internalType: "string",
            name: "",
            type: "string",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "tokenURI",
    args: [tokenId],
  });

  return tokenURI as string;
};

const fetchFromApi = ({ path, method, body }: { path: string; method: string; body?: object }) => {
  return fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
    .then((response) => response.json())
    .catch((error) => console.error("Error:", error));
};

export const addToIPFS = (yourJSON: object) => fetchFromApi({ path: "/api/ipfs/add", method: "POST", body: yourJSON });

export const uploadFileToIPFS = (file: File, options: { fileName?: string } = {}) => {
  const formData = new FormData();
  formData.append("file", file);
  if (options.fileName) {
    formData.append("fileName", options.fileName);
  }

  return fetch("/api/ipfs/file", {
    method: "POST",
    body: formData,
  }).then(async (response) => {
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "File upload failed");
    }

    return response.json();
  });
};
