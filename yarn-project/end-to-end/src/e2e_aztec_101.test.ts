/* eslint-disable camelcase */
import { AztecAddress, TxStatus, Wallet } from '@aztec/aztec.js';
import { Aztec101Contract } from '@aztec/noir-contracts';

import { setup } from './fixtures/utils.js';

describe('e2e_aztec_nr_101', () => {
  // export DEBUG=aztec:e2e_aztec_101
  let wallet: Wallet;
  let teardown: () => Promise<void>;

  let contract: Aztec101Contract;
  let owner: AztecAddress;

  beforeAll(async () => {
    ({ teardown, wallet } = await setup());
    owner = wallet.getCompleteAddress().address;

    contract = await Aztec101Contract.deploy(wallet, owner).send().deployed();
  }, 100_000);

  afterAll(() => teardown());

  it('Let the fun begin', async () => {
    const value = await contract.methods.get_counter().view();
    expect(value).toBe(0n);
  });

  it('Should increment the counter', async () => {
    const before = await contract.methods.get_counter().view();

    const tx = contract.methods.increment().send();
    const receipt = await tx.wait();
    expect(receipt.status).toBe(TxStatus.MINED);

    const after = await contract.methods.get_counter().view();

    expect(after).toBe(before + 1n);
  });

  it('Should increment the counter', async () => {
    const before = await contract.methods.get_counter().view();

    const tx = contract.methods.efficient_increment().send();
    const receipt = await tx.wait();
    expect(receipt.status).toBe(TxStatus.MINED);

    const after = await contract.methods.get_counter().view();

    expect(after).toBe(before + 1n);
  });
});
