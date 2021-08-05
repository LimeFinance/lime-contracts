// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IDistribution {
  /**
   * @dev Recieves LP or standard BEP20 tokens and converts them into ether
   * using PancakeRouter. The resulting amount is distributed among the products
   * and devs.
   *	Requirements:
   * - Amount must be greater than 0
   */
  function receiveTokensAndConvertToETH(
    uint256 amount,
    address token,
    bool isLp
  ) external;

  /**
   * @dev Adds a new product (e.g Lottery, Roulette) to the payee list,
   * specifiying the shares of it. The product can withdraw ether according
   * to its shares relative to the total ones.
   *	Requirements:
   * - Caller must be the owner
   */
  function addProduct(address payable _productContract, uint256 _shares) external;
}
