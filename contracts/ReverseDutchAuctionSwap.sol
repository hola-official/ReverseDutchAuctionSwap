// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ReverseDutchAuctionSwap is ReentrancyGuard {
    // State variables
    uint256 public nextAuctionId;

    struct Auction {
        address seller;
        address tokenToSell;
        address tokenToBuy;
        uint256 tokenAmount;
        uint256 startPrice;
        uint256 startTime;
        uint256 duration;
        uint256 priceDecreaseRate;
        bool active;
    }

    // Mapping from auction ID to Auction struct
    mapping(uint256 => Auction) public auctions;

    // Events
    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        address tokenToSell,
        address tokenToBuy,
        uint256 tokenAmount,
        uint256 startPrice,
        uint256 duration,
        uint256 priceDecreaseRate
    );
    event AuctionExecuted(
        uint256 indexed auctionId,
        address indexed buyer,
        uint256 finalPrice
    );
    event AuctionCancelled(uint256 indexed auctionId);

    // Custom modifier
    modifier validateAuction(uint256 _auctionId) {
        require(_auctionId < nextAuctionId, "Invalid auction ID");
        _;
    }

    // Create a new auction
    function createAuction(
        address _tokenToSell,
        address _tokenToBuy,
        uint256 _tokenAmount,
        uint256 _startPrice,
        uint256 _duration,
        uint256 _priceDecreaseRate
    ) external returns (uint256) {
        require(_tokenToSell != address(0) && _tokenToBuy != address(0), "Invalid token addresses");
        require(_tokenAmount > 0, "Amount must be greater than 0");
        require(_startPrice > 0, "Start price must be greater than 0");
        require(_duration > 0, "Duration must be greater than 0");
        require(_priceDecreaseRate > 0, "Price decrease rate must be greater than 0");
        
        // Check if seller has enough tokens and has approved transfer
        require(
            IERC20(_tokenToSell).balanceOf(msg.sender) >= _tokenAmount,
            "Insufficient token balance"
        );
        
        // Transfer tokens from seller to contract
        bool success = IERC20(_tokenToSell).transferFrom(msg.sender, address(this), _tokenAmount);
        require(success, "Token transfer failed");
        
        uint256 auctionId = nextAuctionId++;
        auctions[auctionId] = Auction({
            seller: msg.sender,
            tokenToSell: _tokenToSell,
            tokenToBuy: _tokenToBuy,
            tokenAmount: _tokenAmount,
            startPrice: _startPrice,
            startTime: block.timestamp,
            duration: _duration,
            priceDecreaseRate: _priceDecreaseRate,
            active: true
        });

        emit AuctionCreated(
            auctionId,
            msg.sender,
            _tokenToSell,
            _tokenToBuy,
            _tokenAmount,
            _startPrice,
            _duration,
            _priceDecreaseRate
        );

        return auctionId;
    }

    // Calculate current price of auction
    function getCurrentPrice(uint256 _auctionId) public view 
        validateAuction(_auctionId) 
        returns (uint256) 
    {
        Auction storage auction = auctions[_auctionId];
        require(auction.active, "Auction is not active");
        
        uint256 elapsed = block.timestamp - auction.startTime;
        if (elapsed >= auction.duration) {
            return 0;
        }
        
        uint256 priceDecrease = elapsed * auction.priceDecreaseRate;
        if (priceDecrease >= auction.startPrice) {
            return 0;
        }
        
        return auction.startPrice - priceDecrease;
    }

    // Execute auction (buy tokens)
    function executeAuction(uint256 _auctionId) external 
        nonReentrant 
        validateAuction(_auctionId) 
    {
        Auction storage auction = auctions[_auctionId];
        require(auction.active, "Auction is not active");
        require(msg.sender != auction.seller, "Seller cannot buy");
        
        uint256 currentPrice = getCurrentPrice(_auctionId);
        require(currentPrice > 0, "Auction has ended");
        
        // Check buyer's token balance and allowance
        require(
            IERC20(auction.tokenToBuy).balanceOf(msg.sender) >= currentPrice,
            "Insufficient buyer balance"
        );
        
        // Transfer payment tokens from buyer to seller
        bool paymentSuccess = IERC20(auction.tokenToBuy).transferFrom(
            msg.sender,
            auction.seller,
            currentPrice
        );
        require(paymentSuccess, "Payment transfer failed");
        
        // Transfer auction tokens to buyer
        bool tokenSuccess = IERC20(auction.tokenToSell).transfer(
            msg.sender, 
            auction.tokenAmount
        );
        require(tokenSuccess, "Token transfer failed");
        
        auction.active = false;
        
        emit AuctionExecuted(_auctionId, msg.sender, currentPrice);
    }

    // Cancel auction (only seller)
    function cancelAuction(uint256 _auctionId) external 
        nonReentrant 
        validateAuction(_auctionId) 
    {
        Auction storage auction = auctions[_auctionId];
        require(msg.sender == auction.seller, "Only seller can cancel");
        require(auction.active, "Auction is not active");
        
        auction.active = false;
        
        // Return tokens to seller
        bool success = IERC20(auction.tokenToSell).transfer(
            auction.seller,
            auction.tokenAmount
        );
        require(success, "Token return failed");
        
        emit AuctionCancelled(_auctionId);
    }

    // View auction details
    function getAuction(uint256 _auctionId) external view 
        validateAuction(_auctionId) 
        returns (
            address seller,
            address tokenToSell,
            address tokenToBuy,
            uint256 tokenAmount,
            uint256 startPrice,
            uint256 startTime,
            uint256 duration,
            uint256 priceDecreaseRate,
            bool active
        ) 
    {
        Auction storage auction = auctions[_auctionId];
        return (
            auction.seller,
            auction.tokenToSell,
            auction.tokenToBuy,
            auction.tokenAmount,
            auction.startPrice,
            auction.startTime,
            auction.duration,
            auction.priceDecreaseRate,
            auction.active
        );
    }
}