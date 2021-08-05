require("dotenv").config()
const Web3 = require("web3")
const web3 = new Web3()
const LimeToken = artifacts.require("LimeToken")

module.exports = async(cb) => {
	const limeToken  = await LimeToken.deployed()	
	await limeToken.transfer(process.env.OPERATOR_ADDRESS, web3.utils.toWei("10000"))
	cb()

}
