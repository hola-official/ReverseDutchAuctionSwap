const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReverseDutchAuctionSwap", function () {
  let auction, tokenA, tokenB, seller, buyer, addr3;
  let startPrice, duration, priceDecreaseRate;

  beforeEach(async function () {
    [seller, buyer, addr3] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    tokenA = await MockERC20.deploy("Token A", "TKNA");
    tokenB = await MockERC20.deploy("Token B", "TKNB");

    // Deploy auction contract
    const ReverseDutchAuction = await ethers.getContractFactory(
      "ReverseDutchAuctionSwap"
    );
    auction = await ReverseDutchAuction.deploy();

    // Setup test parameters
    startPrice = ethers.parseEther("100");
    duration = 3600;
    priceDecreaseRate = BigInt(startPrice) / BigInt(duration);

    // Mint and approve tokens
    await tokenA.mint(seller.address, ethers.parseEther("1000"));
    await tokenB.mint(buyer.address, ethers.parseEther("1000"));
    await tokenA
      .connect(seller)
      .approve(auction.target, ethers.parseEther("1000"));
    await tokenB
      .connect(buyer)
      .approve(auction.target, ethers.parseEther("1000"));
  });

  describe("Price Decrease", function () {
    it("should decrease price linearly over time", async function () {
      await auction
        .connect(seller)
        .createAuction(
          tokenA.target,
          tokenB.target,
          ethers.parseEther("100"),
          startPrice,
          duration,
          priceDecreaseRate
        );

      const initialPrice = await auction.getCurrentPrice(0);
      await network.provider.send("evm_increaseTime", [1800]); // 30 minutes
      await network.provider.send("evm_mine");

      const halfTimePrice = await auction.getCurrentPrice(0);
      expect(halfTimePrice).to.be.lt(initialPrice);
      expect(halfTimePrice).to.be.closeTo(
        BigInt(startPrice) / BigInt(2),
        ethers.parseEther("1") // Allow 1 token deviation
      );
    });
  });

  describe("Auction Execution", function () {
    beforeEach(async function () {
      await auction
        .connect(seller)
        .createAuction(
          tokenA.target,
          tokenB.target,
          ethers.parseEther("100"),
          startPrice,
          duration,
          priceDecreaseRate
        );
    });

    it("should allow only one buyer per auction", async function () {
      await auction.connect(buyer).executeAuction(0);
      await expect(auction.connect(addr3).executeAuction(0)).to.be.revertedWith(
        "Auction is not active"
      );
    });

    it("should transfer tokens correctly", async function () {
      const sellerInitialBalanceA = await tokenA.balanceOf(seller.address);
      const buyerInitialBalanceB = await tokenB.balanceOf(buyer.address);

      await auction.connect(buyer).executeAuction(0);

      expect(await tokenA.balanceOf(buyer.address)).to.equal(
        ethers.parseEther("100")
      );
      expect(await tokenB.balanceOf(seller.address)).to.equal(
        await auction.getCurrentPrice(0)
      );
    });

    it("should handle auction expiration", async function () {
      await network.provider.send("evm_increaseTime", [3601]); // After duration
      await network.provider.send("evm_mine");

      await expect(auction.connect(buyer).executeAuction(0)).to.be.revertedWith(
        "Auction has ended"
      );
    });
  });

  describe("Edge Cases", function () {
    it("should not allow seller to buy their own auction", async function () {
      await auction
        .connect(seller)
        .createAuction(
          tokenA.target,
          tokenB.target,
          ethers.parseEther("100"),
          startPrice,
          duration,
          priceDecreaseRate
        );

      await expect(
        auction.connect(seller).executeAuction(0)
      ).to.be.revertedWith("Seller cannot buy");
    });

    it("should handle insufficient allowance", async function () {
      await auction
        .connect(seller)
        .createAuction(
          tokenA.target,
          tokenB.target,
          ethers.parseEther("100"),
          startPrice,
          duration,
          priceDecreaseRate
        );

      await tokenB.connect(buyer).approve(auction.target, 0);

      await expect(auction.connect(buyer).executeAuction(0)).to.be.reverted;
    });
  });
});
