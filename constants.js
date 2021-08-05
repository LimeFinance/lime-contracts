const Web3 = require("web3");
const web3 = new Web3();
const SAFE_GAS = 5000000;
const ADDRESSES = {
  testnet: {
    pancakeRouter: "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3",
    pancakeFactory: "0xB7926C0430Afb07AA7DEfDE6DA862aE0Bde767bc",
    BUSD: "0x78867bbeef44f2326bf8ddd1941a4439382ef2a7",
    USDT: "0x7ef95a0fee0dd31b22626fa2e10ee6a223f8a684",
    WBNB: "0xae13d989dac2f0debff460ac112a837c89baa7cd",
    ETH: "0x8babbb98678facc7342735486c851abd7a0d17ca",
    DAI: "0x8a9424745056eb399fd19a0ec26a14316684e274",
    CAKE: "0xf9f93cf501bfadb6494589cb4b4c15de49e85d0e",
    LINK: "0x84b9B910527Ad5C03A9Ca831909E21e236EA7b06",
    VRF: "0xa555fC018435bef5A13C6c6870a9d4C11DEC329C",
    KEY_HASH: "0xcaf3c3727e033261d383b315559476f48034c13b18f8cafed4d871abe5049186",
    ZERO: "0x0000000000000000000000000000000000000000",
    linkFee: web3.utils.toWei("0.1"),
  },
  bsc: {
    pancakeRouter: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    pancakeFactory: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
    BUSD: "",
    USDT: "",
    WBNB: "",
    ETH: "",
    LINK: "0x404460C6A5EdE2D891e8297795264fDe62ADBB75",
    VRF: "0x747973a5A2a4Ae1D3a8fDF5479f1514F65Db9C31",
    KEY_HASH: "0xc251acd21ec4fb7f31bb8868288bfdbaeb4fbfec2df3735ddbd4f7dc8d60103c",
    linkFee: web3.utils.toWei("0.2"),
  },
};

module.exports = {
  ADDRESSES,
  SAFE_GAS: SAFE_GAS,
};
