import { EthAddress } from '@aztec/foundation/eth-address';
import { DebugLogger } from '@aztec/foundation/log';
import {
  AvailabilityOracleAbi,
  AvailabilityOracleBytecode,
  ContractDeploymentEmitterAbi,
  ContractDeploymentEmitterBytecode,
  InboxAbi,
  InboxBytecode,
  OutboxAbi,
  OutboxBytecode,
  RegistryAbi,
  RegistryBytecode,
  RollupAbi,
  RollupBytecode,
} from '@aztec/l1-artifacts';

import type { Abi, Narrow } from 'abitype';
import {
  Account,
  Chain,
  Hex,
  HttpTransport,
  PublicClient,
  WalletClient,
  createPublicClient,
  createWalletClient,
  getAddress,
  getContract,
  http,
} from 'viem';
import { HDAccount, PrivateKeyAccount } from 'viem/accounts';

import { L1ContractAddresses } from './l1_contract_addresses.js';

/**
 * Return type of the deployL1Contract function.
 */
export type DeployL1Contracts = {
  /**
   * Wallet Client Type.
   */
  walletClient: WalletClient<HttpTransport, Chain, Account>;
  /**
   * Public Client Type.
   */
  publicClient: PublicClient<HttpTransport, Chain>;

  /**
   * The currently deployed l1 contract addresses
   */
  l1ContractAddresses: L1ContractAddresses;
};

/**
 * Contract artifacts
 */
export interface ContractArtifacts {
  /**
   * The contract abi.
   */
  contractAbi: Narrow<Abi | readonly unknown[]>;
  /**
   * The contract bytecode
   */
  contractBytecode: Hex;
}

/**
 * Deploys the aztec L1 contracts; Rollup, Contract Deployment Emitter & (optionally) Decoder Helper.
 * @param rpcUrl - URL of the ETH RPC to use for deployment.
 * @param account - Private Key or HD Account that will deploy the contracts.
 * @param chain - The chain instance to deploy to.
 * @param logger - A logger object.
 * @returns A list of ETH addresses of the deployed contracts.
 */
export const deployL1Contracts = async (
  rpcUrl: string,
  account: HDAccount | PrivateKeyAccount,
  chain: Chain,
  logger: DebugLogger,
): Promise<DeployL1Contracts> => {
  logger('Deploying contracts...');

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const registryAddress = await deployL1Contract(walletClient, publicClient, RegistryAbi, RegistryBytecode);
  logger(`Deployed Registry at ${registryAddress}`);

  const inboxAddress = await deployL1Contract(walletClient, publicClient, InboxAbi, InboxBytecode, [
    getAddress(registryAddress.toString()),
  ]);
  logger(`Deployed Inbox at ${inboxAddress}`);

  const outboxAddress = await deployL1Contract(walletClient, publicClient, OutboxAbi, OutboxBytecode, [
    getAddress(registryAddress.toString()),
  ]);
  logger(`Deployed Outbox at ${outboxAddress}`);

  const availabilityOracleAddress = await deployL1Contract(
    walletClient,
    publicClient,
    AvailabilityOracleAbi,
    AvailabilityOracleBytecode,
  );
  logger(`Deployed AvailabilityOracle at ${availabilityOracleAddress}`);


  const rollupAddress = await deployL1Contract(walletClient, publicClient, RollupAbi, RollupBytecode, [
    getAddress(registryAddress.toString()), getAddress(availabilityOracleAddress.toString()),
  ]);
  logger(`Deployed Rollup at ${rollupAddress}`);

  // We need to call a function on the registry to set the various contract addresses.
  const registryContract = getContract({
    address: getAddress(registryAddress.toString()),
    abi: RegistryAbi,
    publicClient,
    walletClient,
  });
  await registryContract.write.upgrade(
    [getAddress(rollupAddress.toString()), getAddress(inboxAddress.toString()), getAddress(outboxAddress.toString())],
    { account },
  );

  const contractDeploymentEmitterAddress = await deployL1Contract(
    walletClient,
    publicClient,
    ContractDeploymentEmitterAbi,
    ContractDeploymentEmitterBytecode,
  );
  logger(`Deployed contract deployment emitter at ${contractDeploymentEmitterAddress}`);

  const l1ContractAddresses: L1ContractAddresses = {
    availabilityOracleAddress,
    rollupAddress,
    registryAddress,
    inboxAddress,
    outboxAddress,
    contractDeploymentEmitterAddress,
  };

  return {
    walletClient,
    publicClient,
    l1ContractAddresses,
  };
};

// docs:start:deployL1Contract
/**
 * Helper function to deploy ETH contracts.
 * @param walletClient - A viem WalletClient.
 * @param publicClient - A viem PublicClient.
 * @param abi - The ETH contract's ABI (as abitype's Abi).
 * @param bytecode  - The ETH contract's bytecode.
 * @param args - Constructor arguments for the contract.
 * @returns The ETH address the contract was deployed to.
 */
export async function deployL1Contract(
  walletClient: WalletClient<HttpTransport, Chain, Account>,
  publicClient: PublicClient<HttpTransport, Chain>,
  abi: Narrow<Abi | readonly unknown[]>,
  bytecode: Hex,
  args: readonly unknown[] = [],
): Promise<EthAddress> {
  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const contractAddress = receipt.contractAddress;
  if (!contractAddress) {
    throw new Error(`No contract address found in receipt: ${JSON.stringify(receipt)}`);
  }

  return EthAddress.fromString(receipt.contractAddress!);
}
// docs:end:deployL1Contract
