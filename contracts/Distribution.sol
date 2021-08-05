// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";

import "./interfaces/IDistribution.sol";

contract Distribution is IDistribution, Ownable {
  uint256[] private shares;
  address payable[] private products;

  address payable public dev;
  uint256 private totalShares;
  IUniswapV2Router02 router;

  constructor(address payable _dev, IUniswapV2Router02 _router) {
    dev = _dev;
    router = _router;
  }

  // fallback() external payable {}

  receive() external payable {}

  function addProduct(address payable _productContract, uint256 _shares)
    external
    override
    onlyOwner
  {
    require(_productContract != address(0), "Cannot set product contract to zero address");
    require(_shares > 0, "Shares must be greater than 0");

    totalShares += _shares;
    products.push(_productContract);
    shares.push(_shares);
  }

  function receiveTokensAndConvertToETH(
    uint256 amount,
    address token,
    bool isLp
  ) external override {
    require(amount > 0, "Distribution: Amount must be greater than 0");

    address WETH = router.WETH();

    IERC20(token).approve(address(router), amount);

    if (isLp) {
      address _token0 = IUniswapV2Pair(token).token0();
      address _token1 = IUniswapV2Pair(token).token1();

      router.removeLiquidity(_token0, _token1, amount, 1, 1, address(this), block.timestamp);

      uint256 amountToSwap0 = IERC20(_token0).balanceOf(address(this));
      uint256 amountToSwap1 = IERC20(_token1).balanceOf(address(this));

      IERC20(_token0).approve(address(router), amountToSwap0);
      IERC20(_token1).approve(address(router), amountToSwap1);

      if (_token0 == WETH) {
        // Only swap token1
        address[] memory pathForLp = new address[](2);
        pathForLp[0] = _token1;
        pathForLp[1] = WETH;
        router.swapExactTokensForETH(amountToSwap1, 0, pathForLp, address(this), block.timestamp);
        IWETH(WETH).withdraw(amountToSwap0);
        transferETHToHolders();
        return;
      }
      if (_token1 == WETH) {
        // Only swap token0
        address[] memory pathForLp = new address[](2);
        pathForLp[0] = _token0;
        pathForLp[1] = WETH;
        router.swapExactTokensForETH(amountToSwap0, 0, pathForLp, address(this), block.timestamp);
        IWETH(WETH).withdraw(amountToSwap1);
        transferETHToHolders();
        return;
      }

      address[] memory path0 = new address[](2);
      path0[0] = _token0;
      path0[1] = WETH;

      address[] memory path1 = new address[](2);
      path1[0] = _token1;
      path1[1] = WETH;

      router.swapExactTokensForETH(amountToSwap0, 0, path0, address(this), block.timestamp);
      router.swapExactTokensForETH(amountToSwap1, 0, path1, address(this), block.timestamp);
      transferETHToHolders();
    } else {
      if (token == WETH) {
        IWETH(WETH).withdraw(amount);
        transferETHToHolders();
        return;
      }
      address[] memory path = new address[](2);
      path[0] = token;
      path[1] = WETH;
      router.swapExactTokensForETH(amount, 0, path, address(this), block.timestamp);
      transferETHToHolders();
    }
  }

  function transferETHToHolders() internal {
    uint256 _balance = address(this).balance;
    require(_balance > 0, "Balance should not be 0");

    // uint256 devPayment = (address(this).balance * 90) / 100;
    // uint256 productPayment = (address(this).balance * 10) / 100;

    Address.sendValue(dev, (_balance * 90) / 100);

    _balance = (_balance * 10) / 100;

    for (uint256 index = 0; index < products.length; index++) {
      uint256 payment = (_balance * shares[index]) / totalShares;
      require(payment > 0, "Account is not due payment");
      Address.sendValue(products[index], payment);
    }
  }
}
