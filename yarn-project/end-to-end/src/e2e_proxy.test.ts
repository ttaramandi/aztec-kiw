import { AztecAddress, CompleteAddress, ContractDeployer, DebugLogger, EthAddress, Fr, PXE, TxStatus, Wallet, getContractInstanceFromDeployParams, isContractDeployed } from '@aztec/aztec.js';
import { broadcastPrivateFunction, broadcastUnconstrainedFunction, deployInstance, registerContractClass } from '@aztec/aztec.js/deployment';
import { CounterContract, CounterContractArtifact } from '@aztec/noir-contracts.js/Counter';
import { ProxyContract, ProxyContractArtifact } from '@aztec/noir-contracts.js/Proxy';
import { setup } from "./fixtures/utils.js";


// import ___ import from noir-contracts;
describe('e2e_deploy_contract', () => {
  let pxe: PXE;
  let accounts: CompleteAddress[];
  let owner: AztecAddress;
  let logger: DebugLogger;
  let wallet: Wallet;
  let counterContract: CounterContract;
  let proxyContract: ProxyContract;
  // let sequencer: SequencerClient | undefined;
  // let aztecNode: AztecNode;
  let teardown: () => Promise<void>;

  beforeAll(async () => {
    ({ teardown, pxe, accounts, logger, wallet} = await setup());
    owner = accounts[0].address;
    counterContract = await CounterContract.deploy(wallet,10, owner).send().deployed();
    proxyContract = await ProxyContract.deploy(wallet).send().deployed();
  }, 100_000);

  afterAll(() => teardown());

  /**
   * Milestone 1.1.
   * https://hackmd.io/ouVCnacHQRq2o1oRc5ksNA#Interfaces-and-Responsibilities
   */
  it('should initialize proxy contract', async () => {
    const fn_select = counterContract.methods.initialise.selector;
    const tx = proxyContract.methods.initialize_counter(counterContract.address, 120, owner, fn_select).send();
    const receipt = await tx.wait();
    expect(receipt.status).toBe(TxStatus.MINED);
    expect(await counterContract.methods.get_counter(owner).view()).toBe(10n);
    expect(await proxyContract.methods.get_counter(owner).view()).toBe(120n);
    const fn_select_2 = counterContract.methods.increment.selector;
    const tx_2 = proxyContract.methods.increment(counterContract.address, owner, fn_select_2).send();
    await tx_2.wait();
    expect(await counterContract.methods.get_counter(owner).view()).toBe(10n);
    expect(await proxyContract.methods.get_counter(owner).view()).toBe(121n);
  }, 60_000);
});