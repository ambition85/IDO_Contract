// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./utils/ERC20.sol";

contract TestBUSD is ERC20 {
    constructor() ERC20("BUSD Coin", "BUSD", 18) {}

    function mint(uint256 _amount) external {
        _mint(msg.sender, _amount);
    }
}
