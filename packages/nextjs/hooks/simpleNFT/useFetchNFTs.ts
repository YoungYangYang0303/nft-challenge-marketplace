"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { Collectible } from "~~/app/myNFTs/_components/types";
import { useScaffoldContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { getMetadataFromIPFS, getTokenURI } from "~~/utils/simpleNFT/ipfs-fetch";
import nftsMetadata from "~~/utils/simpleNFT/nftsMetadata";

export const useFetchNFTs = (ownerAddress?: string) => {
  const publicClient = usePublicClient();
  const { data: collectibleContract } = useScaffoldContract({ contractName: "YourCollectible" });
  const [nfts, setNfts] = useState<Collectible[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNfts = async () => {
      if (!ownerAddress || !publicClient || !collectibleContract) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // 获取当前已铸造的最大 tokenId，避免对不存在的 token 进行 ownerOf 调用
        const fetchedNfts: Collectible[] = [];
        const maxTokenId: bigint = (await publicClient.readContract({
          address: collectibleContract.address,
          abi: collectibleContract.abi,
          functionName: "tokenIdCounter",
        })) as bigint;
        if (maxTokenId === 0n) {
          setNfts([]);
          setIsLoading(false);
          return;
        }
        for (let i = 1n; i <= maxTokenId; i++) {
          try {
            const tokenId = i;
            const ownerOf: any = await publicClient.readContract({
              address: collectibleContract.address,
              abi: collectibleContract.abi,
              functionName: "ownerOf",
              args: [tokenId],
            });

            if (ownerOf.toLowerCase() === ownerAddress.toLowerCase()) {
              const tokenURI = await getTokenURI(collectibleContract.address, tokenId);
              let ipfsHash = tokenURI as string;
              const prefix = "https://gateway.pinata.cloud/ipfs/";
              if (ipfsHash.startsWith("ipfs://")) {
                ipfsHash = ipfsHash.slice(7);
              } else if (ipfsHash.startsWith(prefix)) {
                ipfsHash = ipfsHash.substring(prefix.length);
              }
              const metadata = await getMetadataFromIPFS(ipfsHash);
              fetchedNfts.push({
                id: Number(tokenId),
                uri: tokenURI,
                owner: ownerAddress,
                ...metadata,
              });
            }
          } catch (e) {
            // This can happen if the token does not exist. We can safely ignore it.
            // console.log(`Could not fetch owner for token ${i + 1}`, e);
          }
        }
        setNfts(fetchedNfts);
      } catch (error) {
        notification.error("获取 NFTs 失败");
        console.error("获取 NFTs 时出错:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNfts();
  }, [ownerAddress, publicClient, collectibleContract?.address]);

  return { nfts, isLoading };
};
