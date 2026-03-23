"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Address as AddressType, encodeAbiParameters, formatEther, keccak256, parseEther, toHex } from "viem";
import { useAccount, useBlock } from "wagmi";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { getMetadataFromIPFS, getTokenURI } from "~~/utils/simpleNFT/ipfs-fetch";

type Auction = {
  auctionId: bigint;
  nftContract: AddressType;
  tokenId: bigint;
  seller: AddressType;
  minBid: bigint;
  commitEnd: bigint;
  revealEnd: bigint;
  finalized: boolean;
  highestBidder: AddressType;
  highestBid: bigint;
};

type AuctionWithMetadata = Auction & {
  name?: string;
  image?: string;
  description?: string;
};

const useAuctionsWithMetadata = () => {
  const {
    data: auctions,
    isLoading: isLoadingAuctions,
    refetch,
  } = useScaffoldReadContract({
    contractName: "NFTMarketplace",
    functionName: "getAllActiveBlindAuctions",
    watch: true,
  });

  const [auctionsWithMetadata, setAuctionsWithMetadata] = useState<AuctionWithMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (auctions) {
      const fetchMetadata = async () => {
        try {
          const auctionsData = [...(auctions as readonly Auction[])];
          const metadataPromises = auctionsData.map(async auction => {
            const tokenURI = await getTokenURI(auction.nftContract, auction.tokenId);
            const metadata = await getMetadataFromIPFS(tokenURI.replace("ipfs://", ""));
            return { ...auction, ...metadata };
          });
          const results = await Promise.all(metadataPromises);
          setAuctionsWithMetadata(results);
        } catch (e) {
          console.error("获取拍卖元数据时出错:", e);
          setAuctionsWithMetadata([...(auctions as readonly AuctionWithMetadata[])]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchMetadata();
    } else if (!isLoadingAuctions) {
      setIsLoading(false);
    }
  }, [auctions, isLoadingAuctions]);

  return { auctions: auctionsWithMetadata, isLoading: isLoading || isLoadingAuctions, refetch };
};

const AuctionCard = ({
  auction,
  connectedAddress,
  refetch,
}: {
  auction: AuctionWithMetadata;
  connectedAddress: AddressType | undefined;
  refetch: () => void;
}) => {
  const [bidAmount, setBidAmount] = useState("");
  const [salt, setSalt] = useState("");
  const [showCommit, setShowCommit] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { writeContractAsync: marketplaceWrite } = useScaffoldWriteContract("NFTMarketplace");

  const isSeller = connectedAddress && auction.seller.toLowerCase() === connectedAddress.toLowerCase();

  // 使用区块时间作为基准
  const { data: block } = useBlock({ watch: true });
  const [now, setNow] = useState<bigint>(BigInt(Math.floor(Date.now() / 1000)));

  useEffect(() => {
    if (block) {
      setNow(block.timestamp);
    }
  }, [block]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(prev => prev + 1n);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isCommitPhase = now < auction.commitEnd;
  // Add a small buffer (2s) to ensure chain time has caught up
  const isRevealPhase = now >= auction.commitEnd + 2n && now < auction.revealEnd;
  const isEnded = now >= auction.revealEnd;

  const handleCommitBid = async () => {
    if (!bidAmount || !salt) {
      notification.error("请输入出价和盐值。");
      return;
    }
    if (!connectedAddress) {
      notification.error("请先连接钱包。");
      return;
    }
    setIsProcessing(true);
    try {
      const bidValue = parseEther(bidAmount);
      // Solidity: keccak256(abi.encode(amount, secret, msg.sender))
      // amount: uint256, secret: bytes32, msg.sender: address
      const saltHex = toHex(salt, { size: 32 });

      const encoded = encodeAbiParameters(
        [
          { name: "amount", type: "uint256" },
          { name: "secret", type: "bytes32" },
          { name: "bidder", type: "address" },
        ],
        [bidValue, saltHex, connectedAddress],
      );

      const hashedBid = keccak256(encoded);

      await marketplaceWrite({
        functionName: "commitBlindBid",
        args: [auction.auctionId, hashedBid],
        // value: bidValue, // Commit phase does not send ETH
      } as any);
      notification.success("出价已提交！");
      setShowCommit(false);
      setBidAmount("");
      setSalt("");
      refetch();
    } catch (e) {
      console.error("提交出价时出错:", e);
      notification.error("提交出价失败。");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRevealBid = async () => {
    if (!bidAmount || !salt) {
      notification.error("请输入您的原始出价和盐值。");
      return;
    }
    setIsProcessing(true);
    try {
      const bidValue = parseEther(bidAmount);
      await marketplaceWrite({
        functionName: "revealBlindBid",
        args: [auction.auctionId, bidValue, toHex(salt, { size: 32 }) as `0x${string}`],
        value: bidValue,
      });
      notification.success("出价已揭示！");
      setShowReveal(false);
      setBidAmount("");
      setSalt("");
      refetch();
    } catch (e: any) {
      console.error("揭示出价时出错:", e);
      if (e.message.includes("Not in reveal phase")) {
        notification.error("不在揭示期内（可能太早或太晚）");
      } else {
        notification.error("揭示出价失败。");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalizeAuction = async () => {
    setIsProcessing(true);
    try {
      await marketplaceWrite({
        functionName: "finalizeBlindAuction",
        args: [auction.auctionId],
      });
      notification.success("拍卖已结束！");
      refetch();
    } catch (e) {
      console.error("结束拍卖时出错:", e);
      notification.error("结束拍卖失败。");
    } finally {
      setIsProcessing(false);
    }
  };

  const renderTimer = (endTime: bigint) => {
    const timeLeft = endTime - now;
    if (timeLeft <= 0n) return "已结束";
    const days = timeLeft / 86400n;
    const hours = (timeLeft % 86400n) / 3600n;
    const minutes = (timeLeft % 3600n) / 60n;
    const seconds = timeLeft % 60n;
    return `${days}天 ${hours}时 ${minutes}分 ${seconds}秒`;
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <figure>
        <Image
          src={auction.image || ""}
          alt={auction.name || "auction nft"}
          width={400}
          height={400}
          className="aspect-square object-cover"
          unoptimized
        />
      </figure>
      <div className="card-body p-4">
        <h2 className="card-title">{auction.name}</h2>
        <p className="text-sm text-gray-500 h-10 overflow-hidden">{auction.description}</p>
        <div className="mt-2 text-sm">
          <div>
            卖家: <Address address={auction.seller} size="xs" />
          </div>
          <p>最低出价: {formatEther(auction.minBid)} ETH</p>
        </div>

        <div className="mt-4 p-2 bg-base-200 rounded-lg text-center">
          {isCommitPhase && (
            <div>
              <p className="font-bold">承诺期</p>
              <p>剩余时间: {renderTimer(auction.commitEnd)}</p>
            </div>
          )}
          {isRevealPhase && (
            <div>
              <p className="font-bold">揭示期</p>
              <p>剩余时间: {renderTimer(auction.revealEnd)}</p>
            </div>
          )}
          {isEnded && !auction.finalized && <p className="font-bold">等待结束</p>}
          {auction.finalized && (
            <div>
              <p className="font-bold text-success">已结束</p>
              <p>最高出价: {formatEther(auction.highestBid)} ETH</p>
              <p>
                赢家: <Address address={auction.highestBidder} size="xs" />
              </p>
            </div>
          )}
        </div>

        <div className="card-actions justify-center mt-4">
          {!isSeller && isCommitPhase && !showCommit && (
            <button className="btn btn-primary" onClick={() => setShowCommit(true)}>
              提交出价
            </button>
          )}
          {!isSeller && isRevealPhase && !showReveal && (
            <button className="btn btn-secondary" onClick={() => setShowReveal(true)}>
              揭示出价
            </button>
          )}
          {isEnded && !auction.finalized && (
            <button className="btn btn-accent" onClick={handleFinalizeAuction} disabled={isProcessing}>
              {isProcessing ? "处理中..." : "结束拍卖"}
            </button>
          )}
        </div>

        {showCommit && (
          <div className="mt-4 space-y-2">
            <input
              type="text"
              placeholder="出价 (ETH)"
              className="input input-bordered w-full"
              value={bidAmount}
              onChange={e => setBidAmount(e.target.value)}
            />
            <input
              type="text"
              placeholder="盐值 (随机字符串)"
              className="input input-bordered w-full"
              value={salt}
              onChange={e => setSalt(e.target.value)}
            />
            <div className="flex justify-end space-x-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCommit(false)}>
                取消
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleCommitBid} disabled={isProcessing}>
                {isProcessing ? "提交中..." : "确认提交"}
              </button>
            </div>
          </div>
        )}

        {showReveal && (
          <div className="mt-4 space-y-2">
            <input
              type="text"
              placeholder="您的原始出价 (ETH)"
              className="input input-bordered w-full"
              value={bidAmount}
              onChange={e => setBidAmount(e.target.value)}
            />
            <input
              type="text"
              placeholder="您的原始盐值"
              className="input input-bordered w-full"
              value={salt}
              onChange={e => setSalt(e.target.value)}
            />
            <div className="flex justify-end space-x-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowReveal(false)}>
                取消
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleRevealBid} disabled={isProcessing}>
                {isProcessing ? "揭示中..." : "确认揭示"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const BlindAuctionsPage = () => {
  const { address: connectedAddress } = useAccount();
  const { auctions, isLoading, refetch } = useAuctionsWithMetadata();

  const sortedAuctions = useMemo(() => {
    return [...auctions].sort((a, b) => Number(a.auctionId) - Number(b.auctionId));
  }, [auctions]);

  if (isLoading) {
    return (
      <div className="container mx-auto my-10 text-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="container mx-auto my-10 px-4">
      <h1 className="text-4xl font-bold mb-8 text-center">盲拍市场</h1>
      {sortedAuctions.length === 0 ? (
        <p className="text-center">当前没有正在进行的盲拍。</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {sortedAuctions.map(auction => (
            <AuctionCard
              key={auction.auctionId.toString()}
              auction={auction}
              connectedAddress={connectedAddress as AddressType | undefined}
              refetch={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BlindAuctionsPage;
