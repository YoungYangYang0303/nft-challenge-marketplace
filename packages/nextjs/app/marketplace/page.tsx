"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { getMetadataFromIPFS, getTokenURI } from "~~/utils/simpleNFT/ipfs-fetch";
import nftsMetadata from "~~/utils/simpleNFT/nftsMetadata";

const Marketplace = () => {
  const { address: connectedAddress } = useAccount();
  const [listings, setListings] = useState<any[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);

  // Filter and sorting states
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("price-asc");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sellerFilter, setSellerFilter] = useState("");
  const [excludeMyListings, setExcludeMyListings] = useState(false);

  const [selectedListingIds, setSelectedListingIds] = useState<number[]>([]);
  const [isBatchBuying, setIsBatchBuying] = useState(false);

  const { data: allListingsData, isLoading: listingsLoadingFromContract } = useScaffoldReadContract({
    contractName: "NFTMarketplace",
    functionName: "getAllActiveListings",
    watch: true,
  });

  const { writeContractAsync: marketplaceWrite } = useScaffoldWriteContract("NFTMarketplace");

  useEffect(() => {
    if (allListingsData) {
      const fetchMetadata = async () => {
        try {
          const listingsWithMetadata = await Promise.all(
            (allListingsData as any[]).map(async (l: any) => {
              try {
                const tokenURI = await getTokenURI(l.nftContract, l.tokenId);
                const metadata = await getMetadataFromIPFS(tokenURI);
                
                // Ensure image URL is valid for <img> tag
                if (metadata.image && metadata.image.startsWith("ipfs://")) {
                  metadata.image = `https://gateway.pinata.cloud/ipfs/${metadata.image.replace("ipfs://", "")}`;
                }
                
                return { ...l, ...metadata };
              } catch (err) {
                console.warn(`Failed to load metadata for token ${l.tokenId}:`, err);
                // Fallback to local metadata if IPFS fails
                const localIndex = (parseInt(l.tokenId.toString()) - 1) % nftsMetadata.length;
                const fallbackMetadata = nftsMetadata[localIndex];
                return { ...l, ...fallbackMetadata, name: `NFT #${l.tokenId} (Fallback)` };
              }
            }),
          );
          setListings(listingsWithMetadata);
        } catch (e) {
          console.error("Error fetching metadata for listings:", e);
          setListings(allListingsData as any[]);
        } finally {
          setListingsLoading(false);
        }
      };
      fetchMetadata();
    } else if (!listingsLoadingFromContract) {
      setListingsLoading(false);
    }
  }, [allListingsData, listingsLoadingFromContract]);

  const sortedAndFilteredListings = useMemo(() => {
    return listings
      .filter(listing => {
        const searchRegex = new RegExp(filter, "i");
        const nameMatch = searchRegex.test(listing.name || "");
        const idMatch = searchRegex.test(listing.tokenId.toString());
        const price = parseFloat(formatEther(listing.price));
        const min = minPrice ? parseFloat(minPrice) : 0;
        const max = maxPrice ? parseFloat(maxPrice) : Infinity;
        const priceMatch = price >= min && price <= max;
        const sellerMatch = !sellerFilter || listing.seller.toLowerCase() === sellerFilter.toLowerCase();
        const exclude =
          excludeMyListings && connectedAddress && listing.seller.toLowerCase() === connectedAddress.toLowerCase();
        return (nameMatch || idMatch) && priceMatch && sellerMatch && !exclude;
      })
      .sort((a, b) => {
        const priceA = parseFloat(formatEther(a.price));
        const priceB = parseFloat(formatEther(b.price));
        if (sort === "price-asc") {
          return priceA - priceB;
        }
        return priceB - priceA;
      });
  }, [listings, filter, sort, minPrice, maxPrice, sellerFilter, excludeMyListings, connectedAddress]);

  const clearFilters = () => {
    setFilter("");
    setMinPrice("");
    setMaxPrice("");
    setSellerFilter("");
    setExcludeMyListings(false);
    setSort("price-asc");
  };

  const handleSelectedChange = (listingId: number, selected: boolean) => {
    if (selected) {
      setSelectedListingIds(prev => [...prev, listingId]);
    } else {
      setSelectedListingIds(prev => prev.filter(id => id !== listingId));
    }
  };

  const handleBatchBuy = async () => {
    if (selectedListingIds.length === 0) {
      notification.error("请选择要购买的 NFT");
      return;
    }

    setIsBatchBuying(true);
    try {
      // Calculate total price
      let totalPrice = 0n;
      for (const id of selectedListingIds) {
        const listing = listings.find(l => l.listingId === id);
        if (listing) {
          totalPrice += listing.price;
        }
      }

      await marketplaceWrite({
        functionName: "batchBuyNFT",
        args: [selectedListingIds.map(id => BigInt(id))],
        value: totalPrice,
      });
      notification.success("批量购买成功！");
      setSelectedListingIds([]);
    } catch (e) {
      console.error("Batch buy failed:", e);
      notification.error("批量购买失败");
    } finally {
      setIsBatchBuying(false);
    }
  };

  const handleBuy = async (listing: any) => {
    try {
      await marketplaceWrite({
        functionName: "buyNFT",
        args: [listing.listingId],
        value: listing.price,
      });
      notification.success("NFT purchased successfully!");
    } catch (e) {
      console.error("Error buying NFT:", e);
      notification.error("Purchase failed.");
    }
  };

  const handleMakeOffer = async (listing: any, offerPriceStr: string, expirationDays: string) => {
    try {
      const offerPrice = parseEther(offerPriceStr);
      const expiration = BigInt(Math.floor(Date.now() / 1000) + parseInt(expirationDays) * 86400);

      await marketplaceWrite({
        functionName: "makeOffer",
        args: [listing.listingId, expiration],
        value: offerPrice,
      });
      notification.success("Offer made successfully!");
    } catch (e) {
      console.error("Error making offer:", e);
      notification.error("Failed to make offer.");
    }
  };

  if (listingsLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="container mx-auto pt-10 px-4">
      <h1 className="text-4xl font-bold mb-4">Marketplace</h1>

      <div className="bg-base-200 p-4 rounded-lg mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search by name or ID..."
            className="input input-bordered w-full"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <input
            type="number"
            placeholder="Min price (ETH)"
            className="input input-bordered w-full"
            value={minPrice}
            onChange={e => setMinPrice(e.target.value)}
          />
          <input
            type="number"
            placeholder="Max price (ETH)"
            className="input input-bordered w-full"
            value={maxPrice}
            onChange={e => setMaxPrice(e.target.value)}
          />
          <input
            type="text"
            placeholder="Seller address"
            className="input input-bordered w-full"
            value={sellerFilter}
            onChange={e => setSellerFilter(e.target.value)}
          />
          <div className="form-control">
            <label className="label cursor-pointer">
              <span className="label-text">Exclude my listings</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={excludeMyListings}
                onChange={e => setExcludeMyListings(e.target.checked)}
                disabled={!connectedAddress}
              />
            </label>
          </div>
          <select
            className="select select-bordered w-full"
            value={sort}
            onChange={e => setSort(e.target.value)}
          >
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
          <div className="col-span-full flex justify-end">
            <button className="btn btn-ghost" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        </div>
      </div>

      {listings.length === 0 ? (
        <div className="text-center mt-10">
          <h2 className="text-2xl font-semibold">No items found</h2>
          <p>Try adjusting the filters or check back later.</p>
        </div>
      ) : (
        <>
          {selectedListingIds.length > 0 && (
            <div className="fixed bottom-6 right-6 z-50 card bg-base-100 shadow-xl border border-primary p-4 flex flex-row items-center gap-4">
              <div>
                <p className="font-bold">已选择 {selectedListingIds.length} 个 NFT</p>
                <p className="text-sm">总价: {formatEther(selectedListingIds.reduce((acc, id) => {
                  const l = listings.find(item => item.listingId === id);
                  return acc + (l ? l.price : 0n);
                }, 0n))} ETH</p>
              </div>
              <button 
                className="btn btn-primary"
                onClick={handleBatchBuy}
                disabled={isBatchBuying}
              >
                {isBatchBuying ? <span className="loading loading-spinner"></span> : "批量购买"}
              </button>
              <button 
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedListingIds([])}
              >
                取消
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {sortedAndFilteredListings.map(listing => (
              <div key={listing.tokenId} className="card bg-base-200 shadow-xl relative">
                {connectedAddress && listing.seller.toLowerCase() !== connectedAddress.toLowerCase() && !listing.paused && (
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary absolute top-2 left-2 z-10"
                    checked={selectedListingIds.includes(listing.listingId)}
                    onChange={e => handleSelectedChange(listing.listingId, e.target.checked)}
                  />
                )}
                {listing.paused && <div className="absolute top-2 right-2 badge badge-warning z-10">Paused</div>}
                <figure>
                  <img
                    src={listing.image}
                    alt={listing.name}
                    className="w-full h-48 object-cover"
                  />
                </figure>
                <div className="card-body p-4">
                  <h2 className="card-title text-lg">{listing.name}</h2>
                  <p className="text-sm truncate">{listing.description}</p>
                  <div className="mt-2">
                    <p className="font-semibold">{formatEther(listing.price)} ETH</p>
                    <div className="text-xs">
                      Seller: <Address address={listing.seller} size="xs" />
                    </div>
                  </div>
                  <div className="card-actions justify-end mt-2">
                    {!connectedAddress ? (
                      <button className="btn btn-primary btn-sm">
                        Connect Wallet
                      </button>
                    ) : listing.seller.toLowerCase() === connectedAddress.toLowerCase() ? (
                      <span className="text-sm font-bold">Your Listing</span>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleBuy(listing)}
                          disabled={listing.paused}
                        >
                          {listingsLoading ? <span className="loading loading-spinner"></span> : "Buy Now"}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            const offerPriceStr = prompt("Enter your offer price (ETH):", "0.01");
                            const expirationDays = prompt("Enter expiration in days:", "1");
                            if (offerPriceStr && !isNaN(parseFloat(offerPriceStr)) && expirationDays) {
                              handleMakeOffer(listing, offerPriceStr, expirationDays);
                            } else {
                              notification.error("Please enter valid offer details.");
                            }
                          }}
                          disabled={listing.paused}
                        >
                          Make Offer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Marketplace;
