import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployMarketplace: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, get } = hre.deployments;

  const yourCollectibleDeployment = await get("YourCollectible");

  await deploy("NFTMarketplace", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });
};

export default deployMarketplace;

deployMarketplace.tags = ["Marketplace"];
deployMarketplace.dependencies = ["YourCollectible"];
