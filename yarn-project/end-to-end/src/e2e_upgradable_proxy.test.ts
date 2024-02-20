import { AztecAddress, Wallet } from '@aztec/aztec.js';
import { TokenContract, UpgradableProxyContract } from '@aztec/noir-contracts.js';

import { setup } from './fixtures/utils.js';

describe('e2e_upgradable_proxy', () => {
  let wallet: Wallet;
  let admin: AztecAddress;
  let token: TokenContract;
  let proxy: UpgradableProxyContract;

  const TOKEN_NAME = 'Aztec Token';
  const TOKEN_SYMBOL = 'AZT';
  const TOKEN_DECIMALS = 18n;

  let teardown: () => Promise<void>;

  beforeAll(async () => {
    ({ teardown, wallet } = await setup());

    admin = wallet.getCompleteAddress().address;
    token = await TokenContract.deploy(wallet, admin, TOKEN_NAME, TOKEN_SYMBOL, TOKEN_DECIMALS).send().deployed();

    proxy = await UpgradableProxyContract.deploy(wallet, admin, token.address).send().deployed();
  }, 25_000);

  afterAll(() => teardown());

  it('deploys stuff', () => {
    console.log(proxy.address);
  });
});
