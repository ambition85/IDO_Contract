//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract IDOToken is ERC20, Ownable {
    uint256 private constant _minSupply = 2500000 * 10**18;
    uint256 private constant _maxSupply = 6000000 * 10**18;
    string public _symbol;
    string public _name;
    address public ido;

    constructor(address _treasuryWallet) ERC20("IDO Daylight", "IDODAYL") {
        _transferOwnership(_treasuryWallet);
    }

    function minSupply() external pure returns (uint256) {
        return _minSupply;
    }

    function maxSupply() external pure returns (uint256) {
        return _maxSupply;
    }

    function mint(address dest, uint256 amount) external returns (bool) {
        require(
            msg.sender == ido || msg.sender == owner(),
            "Only Owner and Ido Mintable"
        );
        require(totalSupply() + amount <= _maxSupply, "Exceeds Max Supply");
        _mint(dest, amount);
        return true;
    }

    function burn(uint256 amount) public returns (bool) {
        _burn(_msgSender(), amount);
        return true;
    }

    function setIdoAddress(address _ido) external onlyOwner {
        ido = _ido;
    }
}
