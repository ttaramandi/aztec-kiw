import { DefaultDappEntrypoint } from '@aztec/accounts/defaults';
import {
  AccountWalletWithPrivateKey,
  AztecAddress,
  AztecNode,
  CompleteAddress,
  ContractDeployer,
  Fr,
  PXE,
  SentTx,
  computeAuthWitMessageHash,
} from '@aztec/aztec.js';
import {
  AppSubscriptionContractContract,
  CounterContract,
  GasTokenContract,
  TokenContract,
} from '@aztec/noir-contracts.js';
import { getCanonicalGasToken } from '@aztec/protocol-contracts/gas-token';

import { jest } from '@jest/globals';

import { setup } from './fixtures/utils.js';

jest.setTimeout(100_000);

describe('e2e_fees', () => {
  let accounts: CompleteAddress[];
  let aztecNode: AztecNode;
  let pxe: PXE;
  let wallets: AccountWalletWithPrivateKey[];
  let aliceWallet: AccountWalletWithPrivateKey;
  let bobWallet: AccountWalletWithPrivateKey;
  let aliceAddress: AztecAddress; // Dapp subscriber.
  let bobAddress: AztecAddress; // Dapp owner.
  let sequencerAddress: AztecAddress;
  // let gasTokenContract: GasTokenContract;
  let testTokenContract: TokenContract;
  let appContract: CounterContract;
  let appSubContract: AppSubscriptionContractContract;
  let gasTokenContract: GasTokenContract;

  beforeAll(async () => {
    process.env.PXE_URL = '';
    ({ accounts, aztecNode, pxe, wallets } = await setup(3));

    await aztecNode.setConfig({
      feeRecipient: accounts.at(-1)!.address,
    });

    aliceAddress = accounts.at(0)!.address;
    bobAddress = accounts.at(1)!.address;
    sequencerAddress = accounts.at(2)!.address;

    [aliceWallet, bobWallet] = wallets;

    testTokenContract = await TokenContract.deploy(aliceWallet, aliceAddress, 'Test', 'TEST', 1).send().deployed();
    appContract = await CounterContract.deploy(bobWallet, 0, bobAddress).send().deployed();

    // mint some test tokens for Alice
    // she'll pay for the subscription with these
    await testTokenContract.methods.privately_mint_private_note(1000n).send().wait();

    // deploy the gas token
    // this is what the sequencer will be paid in
    const canonicalGasToken = getCanonicalGasToken();
    const deployer = new ContractDeployer(canonicalGasToken.artifact, aliceWallet);
    const { contract } = await deployer
      .deploy()
      .send({
        contractAddressSalt: canonicalGasToken.instance.salt,
      })
      .wait();

    gasTokenContract = contract as GasTokenContract;

    appSubContract = await AppSubscriptionContractContract.deploy(
      bobWallet,
      appContract.address,
      bobAddress,
      // anyone can purchase a subscription for 100 test tokens
      testTokenContract.address,
      100n,
      // I had to pass this in because the address kept changing
      gasTokenContract.address,
    )
      .send()
      .deployed();

    // credit the app sub contract with 1000n gas tokens
    await gasTokenContract.methods.redeem_bridged_balance(appSubContract.address, 1000n).send().wait();
  }, 100_000);

  it('should deploy the gas contract at ' + getCanonicalGasToken().address, () => {
    expect(gasTokenContract.address).toEqual(getCanonicalGasToken().address);
  });

  it('should allow Alice to subscribe', async () => {
    // Authorize the subscription contract to transfer the subscription amount from the subscriber.
    await subscribe();
    expect(await testTokenContract.methods.balance_of_private(aliceAddress).view()).toBe(900n);
  }, 100_000);

  it('should call dapp subscription entrypoint', async () => {
    const dappPayload = new DefaultDappEntrypoint(aliceAddress, aliceWallet, appSubContract.address);
    const action = appContract.methods.increment(bobAddress).request();
    const txExReq = await dappPayload.createTxExecutionRequest([action]);
    const tx = await pxe.simulateTx(txExReq, true);
    const sentTx = new SentTx(pxe, pxe.sendTx(tx));
    await sentTx.wait();

    expect(await appContract.methods.get_counter(bobAddress).view()).toBe(1n);
    expect(await gasTokenContract.methods.balance_of(appSubContract).view()).toBe(999n);
    expect(await gasTokenContract.methods.balance_of(sequencerAddress).view()).toBe(1n);
  }, 100_000);

  it('should reject after the sub runs out', async () => {
    // subscribe again. This will overwrite the subscription
    await subscribe(0);
    await expect(dappIncrement()).rejects.toThrow(
      "Failed to solve brillig function, reason: explicit trap hit in brillig '(context.block_number()) as u64 < expiry_block_number as u64'",
    );
  }, 100_000);

  it('should reject after the txs run out', async () => {
    // subscribe again. This will overwrite the subscription
    await subscribe(5, 1);
    await expect(dappIncrement()).resolves.toBeDefined();
    await expect(dappIncrement()).rejects.toThrow(/note.remaining_txs as u64 > 0/);
  }, 100_000);

  async function subscribe(blockDelta: number = 5, txCount: number = 4) {
    const nonce = Fr.random();
    const action = testTokenContract.methods.transfer(aliceAddress, bobAddress, 100n, nonce);
    const messageHash = computeAuthWitMessageHash(appSubContract.address, action.request());
    const witness = await aliceWallet.createAuthWitness(messageHash);
    await aliceWallet.addAuthWitness(witness);

    return appSubContract
      .withWallet(aliceWallet)
      .methods.subscribe(aliceAddress, nonce, (await pxe.getBlockNumber()) + blockDelta, txCount)
      .send()
      .wait();
  }

  async function dappIncrement() {
    const dappPayload = new DefaultDappEntrypoint(aliceAddress, aliceWallet, appSubContract.address);
    const action = appContract.methods.increment(bobAddress).request();
    const txExReq = await dappPayload.createTxExecutionRequest([action]);
    const tx = await pxe.simulateTx(txExReq, true);
    const sentTx = new SentTx(pxe, pxe.sendTx(tx));
    return sentTx.wait();
  }
});
