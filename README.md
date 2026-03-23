# NFT Challenge Marketplace

一个基于 Hardhat + Next.js（Scaffold-ETH 2 技术栈）实现的端到端 NFT 交易市场 dApp。

本项目包含智能合约、部署脚本与前端页面，支持 NFT 铸造、上架、浏览、交易，以及基于 IPFS 的元数据存储与读取。

## 项目地址

- GitHub: https://github.com/YoungYangYang0303/nft-challenge-marketplace

## 技术栈

- Solidity + Hardhat
- Next.js（App Router）+ TypeScript
- Wagmi + Viem + RainbowKit
- IPFS 上传 / 读取 API

## 核心功能

- 前端铸造 NFT
- 上传文件与元数据到 IPFS
- 查看我持有的 NFT
- 在 Marketplace 上架 NFT
- 浏览市场中的在售 NFT
- 基础转移与交易流程
- 本地链与脚手架开发流程支持

## 目录结构

```text
packages/
  hardhat/   # 智能合约、部署脚本、测试
  nextjs/    # 前端应用（App Router）、hooks、web3 配置
```

## 环境要求

- Node.js >= 20.18.3
- Yarn（Berry 或 Classic）
- Git

## 快速开始

1. 安装依赖

```bash
yarn
```

2. 启动本地区块链

```bash
yarn chain
```

3. 部署合约（新开一个终端）

```bash
yarn deploy
```

4. 启动前端（再开一个终端）

```bash
yarn start
```

5. 打开页面

- http://localhost:3000

## 常用命令

```bash
yarn test                 # 运行 Hardhat 测试
yarn lint                 # 运行 Next.js + Hardhat lint
yarn compile              # 编译合约
yarn next:check-types     # 前端类型检查
yarn hardhat:check-types  # Hardhat 类型检查
```

## 环境变量说明

- 前端本地环境变量：`packages/nextjs/.env.local`
- Hardhat 环境变量：`packages/hardhat/.env`

如需部署到测试网/主网，请安全配置你自己的 API Key 与私钥（或助记词）。

## 部署说明

### 部署智能合约

可在 Hardhat 配置中指定网络，或直接传入参数：

```bash
yarn deploy --network sepolia
```

### 部署前端

使用 Vercel 部署：

```bash
yarn vercel
```

## 开发说明

- 本仓库基于 Scaffold-ETH 2 Challenge 模板扩展，新增了 Marketplace 与 NFT 业务页面。
- 如果 pre-commit 失败，建议先在本地执行 lint / type check 并修复后再提交。

## 许可证

详见 `LICENCE`。