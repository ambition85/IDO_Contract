//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPresaleDAYL is IERC20 {
    function mint(address dest, uint256 amount) external returns (bool);
}
