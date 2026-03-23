"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { NFTCard } from "./NFTCard";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import {
  useDeployedContractInfo,
  useScaffoldContract,
  useScaffoldReadContract,
  useScaffoldWriteContract,
} from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { getMetadataFromIPFS } from "~~/utils/simpleNFT/ipfs-fetch";
import nftsMetadata, { NFTMetaData } from "~~/utils/simpleNFT/nftsMetadata";
import { Collectible } from "./types";

export const MyHoldings = () => {
  const { address: connectedAddress } = useAccount();
  const [myAllCollectibles, setMyAllCollectibles] = useState<Collectible[]>([]);
  const [allCollectiblesLoading, setAllCollectiblesLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const [selectedTokenIds, setSelectedTokenIds] = useState<number[]>([]);
  const [batchListPrice, setBatchListPrice] = useState("");
  const [isBatchListing, setIsBatchListing] = useState(false);
  const [isBatchBurning, setIsBatchBurning] = useState(false);

  const { data: yourCollectibleContract } = useScaffoldContract({
    contractName: "YourCollectible",
  });
  const { writeContractAsync: marketplaceWrite, isMining: isMarketplaceMining } = useScaffoldWriteContract({
    contractName: "NFTMarketplace",
  });
  const { writeContractAsync: collectibleWrite, isMining: isCollectibleMining } = useScaffoldWriteContract({
    contractName: "YourCollectible",
  });
  const { data: marketplaceInfo } = useDeployedContractInfo({ contractName: "NFTMarketplace" });



  const { data: myTotalBalance } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "balanceOf",
    args: [connectedAddress],
    watch: true,
  });

  useEffect(() => {
    let isMounted = true;

    const updateMyCollectibles = async (): Promise<void> => {
      if (myTotalBalance === undefined || yourCollectibleContract === undefined || connectedAddress === undefined) {
        setAllCollectiblesLoading(false);
        return;
      }

      setAllCollectiblesLoading(true);
      
      const totalBalance = parseInt(myTotalBalance.toString());
      if (totalBalance === 0) {
        if (isMounted) {
          setMyAllCollectibles([]);
          setAllCollectiblesLoading(false);
        }
        return;
      }

      // 并行获取所有 Token ID
      const tokenIndices = Array.from({ length: totalBalance }, (_, i) => i);
      
      try {
        const fetchTokenData = async (tokenIndex: number) => {
          try {
            const tokenId = await yourCollectibleContract.read.tokenOfOwnerByIndex([connectedAddress, BigInt(tokenIndex)]);
            const tokenURI = await yourCollectibleContract.read.tokenURI([tokenId]);
            
            let ipfsHash = tokenURI;
            // 移除可能的硬编码前缀，提取 CID
            if (tokenURI.startsWith("https://gateway.pinata.cloud/ipfs/")) {
              ipfsHash = tokenURI.replace("https://gateway.pinata.cloud/ipfs/", "");
            } else if (tokenURI.startsWith("ipfs://")) {
              ipfsHash = tokenURI.replace("ipfs://", "");
            }

            let nftMetadata: NFTMetaData | undefined = undefined;
            
            // 尝试获取 Metadata (并行竞速)
            if (ipfsHash.length >= 10) {
              try {
                nftMetadata = await getMetadataFromIPFS(ipfsHash);
              } catch (e) {
                console.warn(`Metadata fetch failed for token ${tokenId}`, e);
              }
            }

            // Fallback
            if (!nftMetadata) {
              const localIndex = (parseInt(tokenId.toString()) - 1) % nftsMetadata.length;
              nftMetadata = nftsMetadata[localIndex];
            }

            return {
              id: parseInt(tokenId.toString()),
              uri: tokenURI,
              ...(nftMetadata || {}),
            } as Collectible;
          } catch (e) {
            console.warn(`Error fetching token at index ${tokenIndex}`, e);
            return null;
          }
        };

        // 使用分批处理来限制并发请求，避免触发 IPFS 网关的限流 (429 Too Many Requests)
        const results: (Collectible | null)[] = [];
        const batchSize = 3; // 每次并发 3 个请求
        
        for (let i = 0; i < tokenIndices.length; i += batchSize) {
          const batch = tokenIndices.slice(i, i + batchSize);
          const batchResults = await Promise.all(batch.map(fetchTokenData));
          results.push(...batchResults);
          // 批次之间稍微暂停一下
          if (i + batchSize < tokenIndices.length) {
             await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        if (isMounted) {
          const validCollectibles = results.filter((c): c is Collectible => c !== null);
          validCollectibles.sort((a, b) => a.id - b.id);
          setMyAllCollectibles(validCollectibles);
          setAllCollectiblesLoading(false);
        }
      } catch (e) {
        console.error("Error updating collectibles:", e);
        if (isMounted) setAllCollectiblesLoading(false);
      }
    };

    updateMyCollectibles();
    
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedAddress, myTotalBalance]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);







  const filteredCollectibles = useMemo(() => {
    const term = debouncedSearchTerm.toLowerCase();
    if (!term) return myAllCollectibles;
    return myAllCollectibles.filter(
      nft =>
        nft.name?.toLowerCase().includes(term) ||
        nft.description?.toLowerCase().includes(term) ||
        nft.id.toString().includes(term),
    );
  }, [myAllCollectibles, debouncedSearchTerm]);

  const paginatedCollectibles = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredCollectibles.slice(startIndex, startIndex + pageSize);
  }, [filteredCollectibles, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredCollectibles.length / pageSize);

  const handleSelectedChange = (id: number, selected: boolean) => {
    if (selected) {
      setSelectedTokenIds(prev => [...prev, id]);
    } else {
      setSelectedTokenIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleBatchBurn = async () => {
    if (selectedTokenIds.length === 0) return;
    
    if (!window.confirm(`确定要销毁这 ${selectedTokenIds.length} 个 NFT 吗？此操作不可逆！`)) {
      return;
    }

    setIsBatchBurning(true);
    const notificationId = notification.loading(`正在销毁 ${selectedTokenIds.length} 个 NFT... (请在钱包中确认每一笔交易)`);
    
    try {
      for (const id of selectedTokenIds) {
         await collectibleWrite({
          functionName: "burn",
          args: [BigInt(id)],
        });
      }
      
      notification.remove(notificationId);
      notification.success("批量销毁成功！");
      setSelectedTokenIds([]);
    } catch (e) {
      console.error("Batch burn failed:", e);
      notification.error("批量销毁失败");
      notification.remove(notificationId);
    } finally {
      setIsBatchBurning(false);
    }
  };

  const handleBatchList = async () => {
    if (selectedTokenIds.length === 0) {
      notification.error("请选择要上架的 NFT");
      return;
    }
    if (!batchListPrice || isNaN(parseFloat(batchListPrice)) || parseFloat(batchListPrice) <= 0) {
      notification.error("请输入有效的价格");
      return;
    }
    if (!marketplaceInfo || !yourCollectibleContract || !connectedAddress) {
      notification.error("合约未加载或钱包未连接");
      return;
    }

    setIsBatchListing(true);
    try {
      const price = parseEther(batchListPrice);
      
      // 1. Approve Marketplace for all selected tokens (or setApprovalForAll)
      // Check if already approved for all
      const isApprovedForAll = await yourCollectibleContract.read.isApprovedForAll([connectedAddress, marketplaceInfo.address]);
      
      if (!isApprovedForAll) {
        const notificationId = notification.loading("正在授权市场合约...");
        await collectibleWrite({
          functionName: "setApprovalForAll",
          args: [marketplaceInfo.address, true],
        });
        notification.remove(notificationId);
      }

      // 2. Batch List
      const notificationId = notification.loading(`正在批量上架 ${selectedTokenIds.length} 个 NFT...`);
      await marketplaceWrite({
        functionName: "batchListNFT",
        args: [yourCollectibleContract.address, selectedTokenIds.map(id => BigInt(id)), price],
      });
      notification.remove(notificationId);
      notification.success("批量上架成功！");
      
      setSelectedTokenIds([]);
      setBatchListPrice("");
    } catch (e) {
      console.error("Batch list failed:", e);
      notification.error("批量上架失败");
    } finally {
      setIsBatchListing(false);
    }
  };

  if (allCollectiblesLoading)
    return (
      <div className="px-5 my-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card bg-base-100 shadow-xl animate-pulse">
              <div className="aspect-square bg-base-300 rounded-t-xl" />
              <div className="card-body">
                <div className="h-4 w-2/3 bg-base-300 rounded mb-2" />
                <div className="h-3 w-full bg-base-300 rounded" />
                <div className="mt-4 h-8 w-full bg-base-300 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );

  return (
    <div className="container mx-auto px-4">
      <div className="flex justify-center my-6">
        <input
          type="text"
          placeholder="搜索名称、描述或 ID..."
          className="input input-bordered w-full max-w-md"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {selectedTokenIds.length > 0 && (
        <div className="flex justify-center items-center gap-4 mb-6 p-4 bg-base-200 rounded-lg">
          <span className="font-bold">已选择 {selectedTokenIds.length} 个 NFT</span>
          <input
            type="number"
            placeholder="设置统一价格 (ETH)"
            className="input input-bordered input-sm w-40"
            value={batchListPrice}
            onChange={e => setBatchListPrice(e.target.value)}
          />
          <button 
            className="btn btn-primary btn-sm"
            onClick={handleBatchList}
            disabled={isBatchListing}
          >
            {isBatchListing ? <span className="loading loading-spinner loading-xs"></span> : "批量上架"}
          </button>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={handleBatchBurn}
            disabled={isBatchBurning || isBatchListing}
          >
            {isBatchBurning ? <span className="loading loading-spinner loading-xs"></span> : "批量销毁"}
          </button>
          <button 
            className="btn btn-ghost btn-sm"
            onClick={() => setSelectedTokenIds([])}
          >
            取消选择
          </button>
        </div>
      )}

      {myAllCollectibles.length === 0 ? (
        <div className="flex justify-center items-center mt-10">
          <div className="text-2xl text-primary-content">No NFTs found</div>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {paginatedCollectibles.map(item => (
              <NFTCard
                nft={item}
                key={item.id}
                owner={connectedAddress}
                selectable={true}
                selected={selectedTokenIds.includes(item.id)}
                onSelectedChange={handleSelectedChange}
              />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center my-4">
              <div className="join">
                <button
                  className="join-item btn"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  «
                </button>
                <button className="join-item btn">
                  第 {currentPage} 页 / 共 {totalPages} 页
                </button>
                <button
                  className="join-item btn"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  »
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
