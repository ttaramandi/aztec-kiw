import { Wallet } from '@aztec/aztec.js';
import { DelegatedOnContract, ProxyContract } from '@aztec/noir-contracts.js';

import { setup } from './fixtures/utils.js';

describe('e2e_proxy', () => {
  let wallet: Wallet;
  let proxyContract: ProxyContract;
  let implementationContract: DelegatedOnContract;
  let proxyContractInterface: DelegatedOnContract;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    ({ teardown, wallet } = await setup());
  }, 100_000);

  afterEach(() => teardown());

  beforeEach(async () => {
    proxyContract = await ProxyContract.deploy(wallet).send().deployed();
    implementationContract = await DelegatedOnContract.deploy(wallet).send().deployed();
    proxyContractInterface = await DelegatedOnContract.at(proxyContract.address, wallet);
  }, 100_000);

  describe('proxies to another contract', () => {
    it("runs another contract's private function on proxy's storage via fallback", async () => {
      const sentValue = 42n;

      await proxyContract.methods
        .initialize(wallet.getCompleteAddress().address, implementationContract.address)
        .send()
        .wait();

      await proxyContractInterface.methods
        .private_set_value(sentValue, wallet.getCompleteAddress().address)
        .send()
        .wait();

      const proxyValue = await proxyContract.methods
        .view_private_value(sentValue, wallet.getCompleteAddress().address)
        .view();

      const implementationValue = await implementationContract.methods
        .view_private_value(sentValue, wallet.getCompleteAddress().address)
        .view();

      expect(implementationValue).toEqual(0n);
      expect(proxyValue).toEqual(sentValue);
    }, 100_000);

    it("runs another contract's enqueued public function on proxy's storage via fallback", async () => {
      const sentValue = 42n;

      await proxyContract.methods
        .initialize(wallet.getCompleteAddress().address, implementationContract.address)
        .send()
        .wait();

      await proxyContractInterface.methods.public_set_value(sentValue).send().wait();

      const proxyValue = await proxyContract.methods.view_public_value().view();

      const implementationValue = await implementationContract.methods.view_public_value().view();

      expect(implementationValue).toEqual(0n);
      expect(proxyValue).toEqual(sentValue);
    }, 100_000);
  });
});
