"use client";

import { useEffect, useState } from "react";
import { ListingOffers } from "./ListingOffers";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { getMetadataFromIPFS, getTokenURI } from "~~/utils/simpleNFT/ipfs-fetch";
import nftsMetadata from "~~/utils/simpleNFT/nftsMetadata";

export const MyListings = () => {
  const { address: connectedAddress } = useAccount();
  const [myListings, setMyListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // State for updating price
  const [editingListingId, setEditingListingId] = useState<bigint | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [isAcceptingOffer, setIsAcceptingOffer] = useState(false);

  const { data: allListingsData, isLoading: listingsLoadingFromContract } = useScaffoldReadContract({
    contractName: "NFTMarketplace",
    functionName: "getAllActiveListings",
    watch: true,
  });

  const { writeContractAsync: marketplaceWrite } = useScaffoldWriteContract("NFTMarketplace");

  const handleAcceptOffer = async (listingId: bigint, offerIndex: number) => {
    try {
      setIsAcceptingOffer(true);
      await marketplaceWrite({
        functionName: "acceptOffer",
        args: [listingId, BigInt(offerIndex)],
      });
      notification.success("Offer accepted successfully!");
    } catch (e) {
      console.error("Error accepting offer:", e);
      notification.error("Failed to accept offer.");
    } finally {
      setIsAcceptingOffer(false);
    }
  };

  useEffect(() => {
    if (allListingsData && connectedAddress) {
      const fetchMetadata = async () => {
        try {
          // Filter listings where seller is the connected user
          const userListings = (allListingsData as any[]).filter(
            (l: any) => l.seller.toLowerCase() === connectedAddress.toLowerCase(),
          );

          const listingsWithMetadata = await Promise.all(
            userListings.map(async (l: any) => {
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
          setMyListings(listingsWithMetadata);
        } catch (e) {
          console.error("Error fetching metadata for listings:", e);
        } finally {
          setIsLoading(false);
        }
      };
      fetchMetadata();
    } else if (!listingsLoadingFromContract) {
      setIsLoading(false);
    }
  }, [allListingsData, listingsLoadingFromContract, connectedAddress]);

  const handleCancelListing = async (listingId: bigint) => {
    try {
      await marketplaceWrite({
        functionName: "cancelListing",
        args: [listingId],
      });
      notification.success("Listing cancelled successfully!");
    } catch (e) {
      console.error("Error cancelling listing:", e);
      notification.error("Failed to cancel listing.");
    }
  };

  const handlePauseListing = async (listingId: bigint) => {
    try {
      await marketplaceWrite({
        functionName: "pauseListing",
        args: [listingId],
      });
      notification.success("Listing paused successfully!");
    } catch (e) {
      console.error("Error pausing listing:", e);
      notification.error("Failed to pause listing.");
    }
  };

  const handleResumeListing = async (listingId: bigint) => {
    try {
      await marketplaceWrite({
        functionName: "resumeListing",
        args: [listingId],
      });
      notification.success("Listing resumed successfully!");
    } catch (e) {
      console.error("Error resuming listing:", e);
      notification.error("Failed to resume listing.");
    }
  };

  const handleUpdatePrice = async (listingId: bigint) => {
    if (!newPrice || isNaN(parseFloat(newPrice)) || parseFloat(newPrice) <= 0) {
      notification.error("Please enter a valid price");
      return;
    }
    try {
      await marketplaceWrite({
        functionName: "updatePrice",
        args: [listingId, parseEther(newPrice)],
      });
      notification.success("Price updated successfully!");
      setEditingListingId(null);
      setNewPrice("");
    } catch (e) {
      console.error("Error updating price:", e);
      notification.error("Failed to update price.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center mt-10">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 mt-6">
      {myListings.length === 0 ? (
        <div className="flex justify-center items-center mt-10">
          <div className="text-2xl text-primary-content">You have no active listings</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {myListings.map(listing => (
            <div key={listing.tokenId} className="card bg-base-100 shadow-xl relative">
              {listing.paused && <div className="absolute top-2 right-2 badge badge-warning z-10">Paused</div>}
              <figure>
                <img src={listing.image} alt={listing.name} className="w-full h-48 object-cover" />
              </figure>
              <div className="card-body p-4">
                <h2 className="card-title text-lg">{listing.name}</h2>
                <p className="text-sm truncate">{listing.description}</p>
                <div className="mt-2">
                  <p className="font-semibold">{formatEther(listing.price)} ETH</p>
                </div>
                <div className="card-actions justify-end mt-2 flex-col gap-2">
                  <ListingOffers
                    listingId={listing.listingId}
                    onAccept={index => handleAcceptOffer(listing.listingId, index)}
                    isAccepting={isAcceptingOffer}
                  />
                  {editingListingId === listing.listingId ? (
                    <div className="w-full space-y-2 p-2 bg-base-200 rounded-box">
                      <input
                        type="text"
                        placeholder="New Price (ETH)"
                        className="input input-bordered input-sm w-full"
                        value={newPrice}
                        onChange={e => setNewPrice(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          className="btn btn-primary btn-sm flex-1"
                          onClick={() => handleUpdatePrice(listing.listingId)}
                        >
                          Confirm
                        </button>
                        <button
                          className="btn btn-ghost btn-sm flex-1"
                          onClick={() => {
                            setEditingListingId(null);
                            setNewPrice("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn btn-info btn-sm w-full"
                      onClick={() => {
                        setEditingListingId(listing.listingId);
                        setNewPrice(formatEther(listing.price));
                      }}
                      disabled={listing.paused}
                    >
                      Change Price
                    </button>
                  )}

                  {listing.paused ? (
                    <button
                      className="btn btn-success btn-sm w-full"
                      onClick={() => handleResumeListing(listing.listingId)}
                    >
                      Resume
                    </button>
                  ) : (
                    <button
                      className="btn btn-warning btn-sm w-full"
                      onClick={() => handlePauseListing(listing.listingId)}
                    >
                      Pause
                    </button>
                  )}
                  <button
                    className="btn btn-error btn-sm w-full"
                    onClick={() => handleCancelListing(listing.listingId)}
                  >
                    Cancel Listing
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
