import { ethers } from "hardhat";
import { expect } from "chai";

describe("Marketplace", () => {
  let collectible: any;
  let marketplace: any;
  const sampleTokenUri = "QmTestHash";

  beforeEach(async () => {
    const collectibleFactory = await ethers.getContractFactory("YourCollectible");
  collectible = await collectibleFactory.deploy();

    const marketplaceFactory = await ethers.getContractFactory("Marketplace");
  marketplace = await marketplaceFactory.deploy(await collectible.getAddress());

    const [owner] = await ethers.getSigners();
    await collectible.mintItem(owner.address, sampleTokenUri);
  });

  it("allows the owner to list and a buyer to purchase an NFT", async () => {
    const [owner, buyer] = await ethers.getSigners();
    const marketplaceAddress = await marketplace.getAddress();
    await collectible.setApprovalForAll(marketplaceAddress, true);

    const price = ethers.parseEther("0.5");
    await expect(marketplace.listItem(1n, price))
      .to.emit(marketplace, "ItemListed")
      .withArgs(owner.address, 1n, price);

    const buyerMarketplace = marketplace.connect(buyer);
    await expect(buyerMarketplace.buyItem(1n, { value: ethers.parseEther("0.1") }))
      .to.be.revertedWithCustomError(marketplace, "PriceNotMet");

    await expect(buyerMarketplace.buyItem(1n, { value: price }))
      .to.emit(marketplace, "ItemSold")
      .withArgs(buyer.address, owner.address, 1n, price);

    expect(await collectible.ownerOf(1n)).to.equal(buyer.address);
  });

  it("allows the seller to cancel a listing", async () => {
    const marketplaceAddress = await marketplace.getAddress();
    await collectible.setApprovalForAll(marketplaceAddress, true);

    const price = ethers.parseEther("0.25");
    await marketplace.listItem(1n, price);

    await expect(marketplace.cancelListing(1n))
      .to.emit(marketplace, "ListingCanceled")
      .withArgs((await ethers.getSigners())[0].address, 1n);

    const [tokenIds] = await marketplace.getAllListings();
    expect(tokenIds.length).to.equal(0);
  });
});
