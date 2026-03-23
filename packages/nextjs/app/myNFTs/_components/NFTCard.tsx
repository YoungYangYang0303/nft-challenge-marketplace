import { useState } from "react";
import Image from "next/image";
import { Listing } from "./types";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { Address, AddressInput } from "~~/components/scaffold-eth";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

export const NFTCard = ({
  nft,
  owner,
  isListing,
  onSelectedChange,
  selectable,
  selected,
}: {
  nft: Listing;
  owner?: string;
  isListing?: boolean;
  onSelectedChange?: (id: number, selected: boolean) => void;
  selectable?: boolean;
  selected?: boolean;
}) => {
  const { address: connectedAddress } = useAccount();
  const [transferTo, setTransferTo] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [showSell, setShowSell] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showBlind, setShowBlind] = useState(false);
  const [isCreatingBlind, setIsCreatingBlind] = useState(false);
  const [minBid, setMinBid] = useState("");
  const [commitDuration, setCommitDuration] = useState("3600");
  const [revealDuration, setRevealDuration] = useState("1800");
  const [showBurn, setShowBurn] = useState(false);

  const { writeContractAsync: writeYourCollectibleContract } = useScaffoldWriteContract("YourCollectible");
  const { writeContractAsync: writeMarketplaceContract } = useScaffoldWriteContract("NFTMarketplace");
  const { data: marketplaceInfo } = useDeployedContractInfo("NFTMarketplace");
  const { data: collectibleInfo } = useDeployedContractInfo("YourCollectible");

  const handleSellNFT = async () => {
    if (!collectibleInfo?.address || !marketplaceInfo?.address) {
      notification.error("合约地址不可用。");
      return;
    }
    const collectibleAddress = collectibleInfo.address;
    const marketplaceAddress = marketplaceInfo.address;

    try {
      // 首先批准市场合约转移 NFT
      await writeYourCollectibleContract({
        functionName: "approve",
        args: [marketplaceAddress, BigInt(nft.id.toString())],
      });

      // 然后在市场上列出 NFT
      await writeMarketplaceContract({
        functionName: "listNFT",
        args: [collectibleAddress, BigInt(nft.id.toString()), parseEther(sellPrice)],
      });

      setShowSell(false);
      notification.success("NFT 上架成功！");
    } catch (e) {
      console.error("上架 NFT 时出错：", e);
      notification.error("上架 NFT 失败。");
    }
  };

  const handleTransfer = async () => {
    try {
      await writeYourCollectibleContract({
        functionName: "transferFrom",
        args: [connectedAddress, transferTo, BigInt(nft.id)],
      });
      setShowTransfer(false);
      setTransferTo("");
      notification.success("NFT 转移成功！");
    } catch (e) {
      console.error("转移 NFT 时出错：", e);
      notification.error("转移 NFT 失败。");
    }
  };

  const handleCreateBlindAuction = async () => {
    if (!collectibleInfo?.address || !marketplaceInfo?.address) {
      notification.error("合约地址不可用。");
      return;
    }
    const collectibleAddress = collectibleInfo.address;
    const marketplaceAddress = marketplaceInfo.address;

    setIsCreatingBlind(true);
    try {
      await writeYourCollectibleContract({
        functionName: "approve",
        args: [marketplaceAddress, BigInt(nft.id.toString())],
      });

      await writeMarketplaceContract({
        functionName: "createBlindAuction",
        args: [
          collectibleAddress,
          BigInt(nft.id.toString()),
          parseEther(minBid),
          BigInt(commitDuration),
          BigInt(revealDuration),
        ],
      });
      setShowBlind(false);
      notification.success("盲拍创建成功！");
    } catch (e) {
      console.error("创建盲拍时出错：", e);
      notification.error("创建盲拍失败。");
    } finally {
      setIsCreatingBlind(false);
    }
  };

  const handleBurn = async () => {
    try {
      await writeYourCollectibleContract({
        functionName: "burn",
        args: [BigInt(nft.id)],
      });
      setShowBurn(false);
      notification.success("NFT 销毁成功！");
    } catch (e) {
      console.error("销毁 NFT 时出错：", e);
      notification.error("销毁 NFT 失败。");
    }
  };

  const isOwner = owner ? owner.toLowerCase() === connectedAddress?.toLowerCase() : false;

  return (
    <div
      className={`card bg-base-100 shadow-xl relative transition-transform duration-200 hover:scale-[1.01] ${
        selected ? "border-2 border-primary" : "border-2 border-transparent"
      }`}
    >
      {selectable && (
        <input
          type="checkbox"
          className="checkbox checkbox-primary absolute top-2 right-2 z-10"
          checked={selected}
          onChange={e => onSelectedChange?.(nft.id, e.target.checked)}
        />
      )}
      <figure className="relative">
        <Image
          src={(() => {
            const imageUrl = nft.image || "";
            if (imageUrl.startsWith("ipfs://")) {
              // 根据刚才的测试，Pinata 网关是唯一能通的，所以改回使用 Pinata
              return `https://gateway.pinata.cloud/ipfs/${imageUrl.substring(7)}`;
            }
            return imageUrl;
          })()}
          alt={nft.name || "NFT"}
          width={400}
          height={400}
          className="aspect-square object-cover rounded-xl"
          unoptimized={true}
          onError={e => {
            const img = e.target as HTMLImageElement;
            // 如果 Pinata 失败，尝试切换到 ipfs.io
            if (img.src.includes("gateway.pinata.cloud/ipfs/")) {
              img.src = img.src.replace("gateway.pinata.cloud/ipfs/", "ipfs.io/ipfs/");
            }
            // 如果 ipfs.io 也失败，尝试 dweb.link
            else if (img.src.includes("ipfs.io/ipfs/")) {
              img.src = img.src.replace("ipfs.io/ipfs/", "dweb.link/ipfs/");
            }
          }}
        />
        {isListing && nft.paused && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="badge badge-lg badge-warning font-bold text-white">已暂停</div>
          </div>
        )}
      </figure>
      <div className="card-body p-4">
        <h2 className="card-title text-lg">
          {nft.name}
          <span className="text-xs font-normal text-base-content/50 ml-2">#{nft.id}</span>
        </h2>
        <p className="text-sm text-base-content/70 line-clamp-2">{nft.description}</p>

        <div className="mt-2">
          {nft.attributes?.map((attr, index) => (
            <div key={index} className="badge badge-outline mr-1 mb-1">
              {attr.trait_type}: {attr.value}
            </div>
          ))}
        </div>

        <div className="card-actions justify-between items-center mt-4">
          <div className="flex flex-col">
            {isListing && nft.price && (
              <>
                <div className="text-lg font-bold">{formatEther(nft.price)} ETH</div>
                <div className="text-xs">
                  所有者: <Address address={nft.owner} size="xs" />
                </div>
              </>
            )}
            {!isListing && isOwner && (
              <div className="text-sm font-semibold">
                所有者: <Address address={connectedAddress} size="xs" />
              </div>
            )}
          </div>

          {!showTransfer && !showSell && !showBlind && !showBurn ? (
            <div className="flex space-x-2">
              {isOwner && !isListing && (
                <>
                  <button className="btn btn-primary btn-sm flex-1" onClick={() => setShowSell(true)}>
                    出售
                  </button>
                  <button className="btn btn-secondary btn-sm flex-1" onClick={() => setShowTransfer(true)}>
                    转移
                  </button>
                  <button className="btn btn-accent btn-sm flex-1" onClick={() => setShowBlind(true)}>
                    盲拍
                  </button>
                  <button className="btn btn-error btn-sm flex-1" onClick={() => setShowBurn(true)}>
                    销毁
                  </button>
                </>
              )}
            </div>
          ) : showTransfer ? (
            <div className="w-full space-y-2">
              <AddressInput
                placeholder="转移到地址"
                value={transferTo}
                onChange={newValue => setTransferTo(newValue)}
              />
              <div className="flex justify-end space-x-2">
                <button className="btn btn-ghost btn-sm" onClick={() => setShowTransfer(false)}>
                  取消
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleTransfer} disabled={!transferTo}>
                  确认转移
                </button>
              </div>
            </div>
          ) : showSell ? (
            <div className="w-full space-y-2">
              <input
                type="text"
                placeholder="价格 (ETH)"
                className="input input-bordered w-full"
                value={sellPrice}
                onChange={e => setSellPrice(e.target.value)}
              />
              <div className="flex justify-end space-x-2">
                <button className="btn btn-ghost btn-sm" onClick={() => setShowSell(false)}>
                  取消
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSellNFT}
                  disabled={!sellPrice || parseFloat(sellPrice) <= 0}
                >
                  确认上架
                </button>
              </div>
            </div>
          ) : showBlind ? (
            <div className="w-full space-y-2">
              <h3 className="font-bold text-center">创建盲拍</h3>
              <input
                type="text"
                placeholder="最低出价 (ETH)"
                className="input input-bordered w-full"
                value={minBid}
                onChange={e => setMinBid(e.target.value)}
              />
              <input
                type="text"
                placeholder="承诺期 (秒)"
                className="input input-bordered w-full"
                value={commitDuration}
                onChange={e => setCommitDuration(e.target.value)}
              />
              <input
                type="text"
                placeholder="揭示期 (秒)"
                className="input input-bordered w-full"
                value={revealDuration}
                onChange={e => setRevealDuration(e.target.value)}
              />
              <div className="flex justify-end space-x-2">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setShowBlind(false);
                    setMinBid("");
                    setCommitDuration("3600");
                    setRevealDuration("1800");
                  }}
                >
                  取消
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleCreateBlindAuction}
                  disabled={!minBid || parseFloat(minBid) <= 0 || isCreatingBlind}
                >
                  {isCreatingBlind ? "创建中..." : "确认创建"}
                </button>
              </div>
            </div>
          ) : showBurn ? (
            <div className="w-full space-y-2">
              <h3 className="font-bold text-center text-error">确认销毁?</h3>
              <p className="text-xs text-center">此操作不可逆，NFT 将永久丢失。</p>
              <div className="flex justify-end space-x-2">
                <button className="btn btn-ghost btn-sm" onClick={() => setShowBurn(false)}>
                  取消
                </button>
                <button className="btn btn-error btn-sm" onClick={handleBurn}>
                  确认销毁
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
