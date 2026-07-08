// AlgoRhythmSeedNFT.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Use OpenZeppelin from Remix's built-in library resolver
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.2/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.2/contracts/access/Ownable.sol";

contract AlgoRhythmSeedNFT is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;

    event SeedMinted(address indexed to, uint256 indexed tokenId, string seedHash, string tokenURI);

    constructor() ERC721("AlgoRhythm Seed", "ALGSEED") Ownable(msg.sender) {}

    function mintSeedNFT(
        address to,
        string calldata seedHash,
        string calldata tokenURI_
    ) external returns (uint256) {
        require(to != address(0), "Invalid recipient");

        _tokenIdCounter += 1;
        uint256 newTokenId = _tokenIdCounter;

        _safeMint(to, newTokenId);
        _setTokenURI(newTokenId, tokenURI_);

        emit SeedMinted(to, newTokenId, seedHash, tokenURI_);
        return newTokenId;
    }

    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter;
    }
}
