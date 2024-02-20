import { DefaultDappEntrypoint, buildAppPayload, buildDappPayload } from '@aztec/accounts/defaults';
import {
  AccountWalletWithPrivateKey,
  AztecAddress,
  AztecNode,
  CompleteAddress,
  ContractDeployer, // ContractDeployer,
  Fr, // NativeFeePaymentMethod,
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

// import { getCanonicalGasToken } from '@aztec/protocol-contracts/gas-token';
import { setup } from './fixtures/utils.js';

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
    // const canonicalGasToken = getCanonicalGasToken();
    // const deployer = new ContractDeployer(canonicalGasToken.artifact, wallet);
    // const { contract } = await deployer
    //   .deploy()
    //   .send({
    //     contractAddressSalt: canonicalGasToken.instance.salt,
    //   })
    //   .wait();

    // gasTokenContract = contract as GasTokenContract;
    aliceAddress = accounts.at(0)!.address;
    bobAddress = accounts.at(1)!.address;
    sequencerAddress = accounts.at(2)!.address;

    [aliceWallet, bobWallet] = wallets;

    testTokenContract = await TokenContract.deploy(aliceWallet, aliceAddress, 'Test', 'TEST', 1).send().deployed();

    appContract = await CounterContract.deploy(bobWallet, 0, bobAddress).send().deployed();

    appSubContract = await AppSubscriptionContractContract.deploy(
      bobWallet,
      appContract.address,
      bobAddress,
      testTokenContract.address,
      100n,
    )
      .send()
      .deployed();

    // Alice gets a balance of 1000 gas token
    // await gasTokenContract.methods.redeem_bridged_balance(1000).send().wait();

    await testTokenContract.methods.privately_mint_private_note(1000n).send().wait();

    const canonicalGasToken = getCanonicalGasToken();
    const deployer = new ContractDeployer(canonicalGasToken.artifact, aliceWallet);
    const { contract } = await deployer
      .deploy()
      .send({
        contractAddressSalt: canonicalGasToken.instance.salt,
      })
      .wait();

    gasTokenContract = contract as GasTokenContract;

    // gasTokenContract.methods.redeem_bridged_balance();
    await appSubContract.methods.secretly_redeem().send().wait();
  }, 100_000);

  it('should allow Alice to subscribe', async () => {
    // Authorize the subscription contract to transfer the subscription amount from the subscriber.
    const nonce = Fr.random();
    const action = testTokenContract.methods.transfer(aliceAddress, bobAddress, 100n, nonce);
    const messageHash = computeAuthWitMessageHash(appSubContract.address, action.request());
    const witness = await aliceWallet.createAuthWitness(messageHash);
    await aliceWallet.addAuthWitness(witness);

    await appSubContract
      .withWallet(aliceWallet)
      .methods.subscribe(aliceAddress, nonce, (await pxe.getBlockNumber()) + 5)
      .send()
      .wait();

    expect(await testTokenContract.methods.balance_of_private(aliceAddress).view()).toBe(900n);
  }, 100_000);

  it('should call dapp subscription entrypoint', async () => {
    const dappPayload = new DefaultDappEntrypoint(aliceAddress, aliceWallet, appSubContract.address);
    const action = appContract.methods.increment(bobAddress).request();
    const txExReq = await dappPayload.createTxExecutionRequest([action]);
    const tx = await pxe.simulateTx(txExReq, true);
    const sentTx = new SentTx(pxe, pxe.sendTx(tx));
    await sentTx.wait();
    // const txHash = await pxe.sendTx(tx);
    // await pxe.getTxReceipt(txHash);
    expect(await appContract.methods.get_counter(bobAddress).view()).toBe(1n);

    expect(await gasTokenContract.methods.balance_of(appSubContract).view()).toBe(999n);
    expect(await gasTokenContract.methods.balance_of(sequencerAddress).view()).toBe(1n);
  }, 100_000);

  // it('deploys gas token contract at canonical address', () => {
  //   expect(gasTokenContract.address).toEqual(getCanonicalGasToken().address);
  // });

  // describe('NativeFeePaymentMethod', () => {
  //   it('pays out the expected fee to the sequencer', async () => {
  //     await testTokenContract.methods
  //       .mint_public(aliceAddress, 1000)
  //       .send({
  //         fee: {
  //           maxFee: 1,
  //           paymentMethod: new NativeFeePaymentMethod(),
  //         },
  //       })
  //       .wait();

  //     const [sequencerBalance, aliceBalance] = await Promise.all([
  //       gasTokenContract.methods.balance_of(sequencerAddress).view(),
  //       gasTokenContract.methods.balance_of(aliceAddress).view(),
  //     ]);

  //     expect(sequencerBalance).toEqual(1n);
  //     expect(aliceBalance).toEqual(999n);
  //   });
  // });
});
