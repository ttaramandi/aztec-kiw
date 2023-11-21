import {
  AccountWallet,
  NotePreimage,
  TxHash,
  TxStatus,
  computeAuthWitMessageHash,
  computeMessageSecretHash,
} from '@aztec/aztec.js';
import { CircuitsWasm, CompleteAddress, Fr, FunctionSelector } from '@aztec/circuits.js';
import { DebugLogger, createDebugLogger } from '@aztec/foundation/log';
import { AvmTestContract } from '@aztec/noir-contracts/types';

import { jest } from '@jest/globals';

import { setup } from './fixtures/utils.js';
import { AvmTokenSimulator } from './simulators/avm_token_simulator.js';
import { computeFunctionSelector } from '@aztec/circuits.js/abis';

const TIMEOUT = 90_000;

describe('e2e_avm_token_contract', () => {
  jest.setTimeout(TIMEOUT);

  let teardown: () => Promise<void>;
  let wallets: AccountWallet[];
  let accounts: CompleteAddress[];
  let logger: DebugLogger;

  let asset: AvmTestContract;

  let tokenSim: AvmTokenSimulator;

  beforeAll(async () => {
    ({ teardown, logger, wallets, accounts } = await setup(3));

    asset = await AvmTestContract.deploy(wallets[0], accounts[0]).send().deployed();
    logger(`Token deployed to ${asset.address}`);
    tokenSim = new AvmTokenSimulator(
      asset,
      logger,
      accounts.map(a => a.address),
    );

    expect(await asset.methods.view_admin().view()).toBe(accounts[0].address.toBigInt());

    asset.artifact.functions.forEach(fn => {
      logger(
        `Function ${fn.name} has ${fn.bytecode.length} bytes and the selector: ${FunctionSelector.fromNameAndParameters(
          fn.name,
          fn.parameters,
        )}`,
      );
    });
  }, 100_000);

  afterAll(() => teardown());

  afterEach(async () => {
    await tokenSim.check();
  }, TIMEOUT);

  describe('Access controlled functions', () => {
    it('Set admin', async () => {
      const tx = asset.methods.set_admin(accounts[1].address).send();
      const receipt = await tx.wait();
      expect(receipt.status).toBe(TxStatus.MINED);
      expect(await asset.methods.view_admin().view()).toBe(accounts[1].address.toBigInt());
    });

    it('Add minter as admin', async () => {
      const tx = asset.withWallet(wallets[1]).methods.set_minter(accounts[1].address, true).send();
      const receipt = await tx.wait();
      expect(receipt.status).toBe(TxStatus.MINED);
      expect(await asset.methods.view_is_minter(accounts[1].address).view()).toBe(true);
    });

    it('Revoke minter as admin', async () => {
      const tx = asset.withWallet(wallets[1]).methods.set_minter(accounts[1].address, false).send();
      const receipt = await tx.wait();
      expect(receipt.status).toBe(TxStatus.MINED);
      expect(await asset.methods.view_is_minter(accounts[1].address).view()).toBe(false);
    });

    describe('failure cases', () => {
      it('Set admin (not admin)', async () => {
        await expect(asset.methods.set_admin(accounts[0].address).simulate()).rejects.toThrowError(
          //'Assertion failed: caller is not admin',
          //`AVM reverted execution in contract:${asset.completeAddress}`,
          new RegExp(`AVM reverted execution in contract:${asset.address}.*`)
        );
      });
      it('Revoke minter not as admin', async () => {
        await expect(asset.methods.set_minter(accounts[0].address, false).simulate()).rejects.toThrowError(
          //'Assertion failed: caller is not admin',
          //`AVM reverted execution in contract:${asset.completeAddress}`,
          new RegExp(`AVM reverted execution in contract:${asset.address}.*`)
        );
      });
    });
  });

  describe('Minting', () => {
    describe('Public', () => {
      it('as minter', async () => {
        const amount = 10000n;
        const tx = asset.methods.mint_public(accounts[0].address, amount).send();
        const receipt = await tx.wait();
        expect(receipt.status).toBe(TxStatus.MINED);

        const wasm = await CircuitsWasm.get();
        const selector = computeFunctionSelector(wasm, "_initialize((Field))");
        logger(`_initialize function selector: ${selector.toString('hex')}`);

        tokenSim.mintPublic(accounts[0].address, amount);
        expect(await asset.methods.view_balance_of_public(accounts[0].address).view()).toEqual(
          tokenSim.balanceOfPublic(accounts[0].address),
        );
        expect(await asset.methods.view_total_supply().view()).toEqual(tokenSim.totalSupply);
      });

      describe('failure cases', () => {
        it('as non-minter', async () => {
          const amount = 10000n;
          await expect(
            asset.withWallet(wallets[1]).methods.mint_public(accounts[0].address, amount).simulate(),
          //).rejects.toThrowError('Assertion failed: caller is not minter');
          ).rejects.toThrowError(new RegExp(`AVM reverted execution in contract:${asset.address}.*`));
        });

      //  it('mint >u120 tokens to overflow', async () => {
      //    const amount = 2n ** 120n; // SafeU120::max() + 1;
      //    await expect(asset.methods.mint_public(accounts[0].address, amount).simulate()).rejects.toThrowError(
      //      'Assertion failed: Value too large for SafeU120',
      //    );
      //  });

      //  it('mint <u120 but recipient balance >u120', async () => {
      //    const amount = 2n ** 120n - tokenSim.balanceOfPublic(accounts[0].address);
      //    await expect(asset.methods.mint_public(accounts[0].address, amount).simulate()).rejects.toThrowError(
      //      'Assertion failed: Overflow',
      //    );
      //  });

      //  it('mint <u120 but such that total supply >u120', async () => {
      //    const amount = 2n ** 120n - tokenSim.balanceOfPublic(accounts[0].address);
      //    await expect(asset.methods.mint_public(accounts[1].address, amount).simulate()).rejects.toThrowError(
      //      'Assertion failed: Overflow',
      //    );
      //  });
      });
    });
  });

  describe('Transfer', () => {
    beforeAll(async () => {
        const amount = 10000n;
        const tx = asset.methods.mint_public(accounts[0].address, amount).send();
        const receipt = await tx.wait();
        expect(receipt.status).toBe(TxStatus.MINED);
        tokenSim.mintPublic(accounts[0].address, amount);
    });
    describe('public', () => {
      it('transfer less than balance', async () => {
        const balance0 = await asset.methods.view_balance_of_public(accounts[0].address).view();
        const amount = balance0 / 2n;
        expect(amount).toBeGreaterThan(0n);
        const tx = asset.methods.transfer_public(accounts[0].address, accounts[1].address, amount, 0).send();
        const receipt = await tx.wait();
        expect(receipt.status).toBe(TxStatus.MINED);

        tokenSim.transferPublic(accounts[0].address, accounts[1].address, amount);
      });

      it('transfer to self', async () => {
        const balance = await asset.methods.view_balance_of_public(accounts[0].address).view();
        const amount = balance / 2n;
        expect(amount).toBeGreaterThan(0n);
        const tx = asset.methods.transfer_public(accounts[0].address, accounts[0].address, amount, 0).send();
        const receipt = await tx.wait();
        expect(receipt.status).toBe(TxStatus.MINED);

        tokenSim.transferPublic(accounts[0].address, accounts[0].address, amount);
      });

      it.skip('transfer on behalf of other', async () => {
        const balance0 = await asset.methods.view_balance_of_public(accounts[0].address).view();
        const amount = balance0 / 2n;
        expect(amount).toBeGreaterThan(0n);
        const nonce = Fr.random();

        // docs:start:authwit_public_transfer_example
        const action = asset
          .withWallet(wallets[1])
          .methods.transfer_public(accounts[0].address, accounts[1].address, amount, nonce);
        const messageHash = await computeAuthWitMessageHash(accounts[1].address, action.request());

        await wallets[0].setPublicAuth(messageHash, true).send().wait();
        // docs:end:authwit_public_transfer_example

        // Perform the transfer
        const tx = action.send();
        const receipt = await tx.wait();
        expect(receipt.status).toBe(TxStatus.MINED);

        tokenSim.transferPublic(accounts[0].address, accounts[1].address, amount);

        // Check that the message hash is no longer valid. Need to try to send since nullifiers are handled by sequencer.
        const txReplay = asset
          .withWallet(wallets[1])
          .methods.transfer_public(accounts[0].address, accounts[1].address, amount, nonce)
          .send();
        await txReplay.isMined();
        const receiptReplay = await txReplay.getReceipt();
        expect(receiptReplay.status).toBe(TxStatus.DROPPED);
      });

      describe('failure cases', () => {
        it.skip('transfer more than balance', async () => {
          const balance0 = await asset.methods.view_balance_of_public(accounts[0].address).view();
          const amount = balance0 + 1n;
          const nonce = 0;
          await expect(
            asset.methods.transfer_public(accounts[0].address, accounts[1].address, amount, nonce).simulate(),
          //).rejects.toThrowError('Assertion failed: Underflow');
          ).rejects.toThrowError(new RegExp(`AVM reverted execution in contract:${asset.address}.*`));
        });

        it('transfer on behalf of self with non-zero nonce', async () => {
          const balance0 = await asset.methods.view_balance_of_public(accounts[0].address).view();
          const amount = balance0 - 1n;
          const nonce = 1;
          await expect(
            asset.methods.transfer_public(accounts[0].address, accounts[1].address, amount, nonce).simulate(),
          //).rejects.toThrowError('Assertion failed: invalid nonce');
          ).rejects.toThrowError(new RegExp(`AVM reverted execution in contract:${asset.address}.*`));
        });

        it.skip('transfer on behalf of other without "approval"', async () => {
          const balance0 = await asset.methods.view_balance_of_public(accounts[0].address).view();
          const amount = balance0 + 1n;
          const nonce = Fr.random();
          await expect(
            asset
              .withWallet(wallets[1])
              .methods.transfer_public(accounts[0].address, accounts[1].address, amount, nonce)
              .simulate(),
          //).rejects.toThrowError('Assertion failed: Message not authorized by account');
          ).rejects.toThrowError(new RegExp(`AVM reverted execution in contract:${asset.address}.*`));
        });

        it.skip('transfer more than balance on behalf of other', async () => {
          const balance0 = await asset.methods.view_balance_of_public(accounts[0].address).view();
          const balance1 = await asset.methods.view_balance_of_public(accounts[1].address).view();
          const amount = balance0 + 1n;
          const nonce = Fr.random();
          expect(amount).toBeGreaterThan(0n);

          const action = asset
            .withWallet(wallets[1])
            .methods.transfer_public(accounts[0].address, accounts[1].address, amount, nonce);
          const messageHash = await computeAuthWitMessageHash(accounts[1].address, action.request());

          // We need to compute the message we want to sign and add it to the wallet as approved
          await wallets[0].setPublicAuth(messageHash, true).send().wait();

          // Perform the transfer
          await expect(action.simulate()).rejects.toThrowError('Assertion failed: Underflow');

          expect(await asset.methods.view_balance_of_public(accounts[0].address).view()).toEqual(balance0);
          expect(await asset.methods.view_balance_of_public(accounts[1].address).view()).toEqual(balance1);
        });

        it.skip('transfer on behalf of other, wrong designated caller', async () => {
          const balance0 = await asset.methods.view_balance_of_public(accounts[0].address).view();
          const balance1 = await asset.methods.view_balance_of_public(accounts[1].address).view();
          const amount = balance0 + 2n;
          const nonce = Fr.random();
          expect(amount).toBeGreaterThan(0n);

          // We need to compute the message we want to sign and add it to the wallet as approved
          const action = asset
            .withWallet(wallets[1])
            .methods.transfer_public(accounts[0].address, accounts[1].address, amount, nonce);
          const messageHash = await computeAuthWitMessageHash(accounts[0].address, action.request());

          await wallets[0].setPublicAuth(messageHash, true).send().wait();

          // Perform the transfer
          await expect(action.simulate()).rejects.toThrowError('Assertion failed: Message not authorized by account');

          expect(await asset.methods.view_balance_of_public(accounts[0].address).view()).toEqual(balance0);
          expect(await asset.methods.view_balance_of_public(accounts[1].address).view()).toEqual(balance1);
        });

        it.skip('transfer on behalf of other, wrong designated caller', async () => {
          const balance0 = await asset.methods.view_balance_of_public(accounts[0].address).view();
          const balance1 = await asset.methods.view_balance_of_public(accounts[1].address).view();
          const amount = balance0 + 2n;
          const nonce = Fr.random();
          expect(amount).toBeGreaterThan(0n);

          // We need to compute the message we want to sign and add it to the wallet as approved
          const action = asset
            .withWallet(wallets[1])
            .methods.transfer_public(accounts[0].address, accounts[1].address, amount, nonce);
          const messageHash = await computeAuthWitMessageHash(accounts[0].address, action.request());
          await wallets[0].setPublicAuth(messageHash, true).send().wait();

          // Perform the transfer
          await expect(action.simulate()).rejects.toThrowError('Assertion failed: Message not authorized by account');

          expect(await asset.methods.view_balance_of_public(accounts[0].address).view()).toEqual(balance0);
          expect(await asset.methods.view_balance_of_public(accounts[1].address).view()).toEqual(balance1);
        });

        it.skip('transfer into account to overflow', () => {
          // This should already be covered by the mint case earlier. e.g., since we cannot mint to overflow, there is not
          // a way to get funds enough to overflow.
          // Require direct storage manipulation for us to perform a nice explicit case though.
          // See https://github.com/AztecProtocol/aztec-packages/issues/1259
        });
      });
    });
  });

  //describe('Burn', () => {
  //  describe('public', () => {
  //    it('burn less than balance', async () => {
  //      const balance0 = await asset.methods.view_balance_of_public(accounts[0].address).view();
  //      const amount = balance0 / 2n;
  //      expect(amount).toBeGreaterThan(0n);
  //      const tx = asset.methods.burn_public(accounts[0].address, amount, 0).send();
  //      const receipt = await tx.wait();
  //      expect(receipt.status).toBe(TxStatus.MINED);

  //      tokenSim.burnPublic(accounts[0].address, amount);
  //    });

  //    it('burn on behalf of other', async () => {
  //      const balance0 = await asset.methods.view_balance_of_public(accounts[0].address).view();
  //      const amount = balance0 / 2n;
  //      expect(amount).toBeGreaterThan(0n);
  //      const nonce = Fr.random();

  //      // We need to compute the message we want to sign and add it to the wallet as approved
  //      const action = asset.withWallet(wallets[1]).methods.burn_public(accounts[0].address, amount, nonce);
  //      const messageHash = await computeAuthWitMessageHash(accounts[1].address, action.request());
  //      await wallets[0].setPublicAuth(messageHash, true).send().wait();

  //      const tx = action.send();
  //      const receipt = await tx.wait();
  //      expect(receipt.status).toBe(TxStatus.MINED);

  //      tokenSim.burnPublic(accounts[0].address, amount);

  //      // Check that the message hash is no longer valid. Need to try to send since nullifiers are handled by sequencer.
  //      const txReplay = asset.withWallet(wallets[1]).methods.burn_public(accounts[0].address, amount, nonce).send();
  //      await txReplay.isMined();
  //      const receiptReplay = await txReplay.getReceipt();
  //      expect(receiptReplay.status).toBe(TxStatus.DROPPED);
  //    });

  //    describe('failure cases', () => {
  //      it('burn more than balance', async () => {
  //        const balance0 = await asset.methods.view_balance_of_public(accounts[0].address).view();
  //        const amount = balance0 + 1n;
  //        const nonce = 0;
  //        await expect(asset.methods.burn_public(accounts[0].address, amount, nonce).simulate()).rejects.toThrowError(
  //          'Assertion failed: Underflow',
  //        );
  //      });

  //      it('burn on behalf of self with non-zero nonce', async () => {
  //        const balance0 = await asset.methods.view_balance_of_public(accounts[0].address).view();
  //        const amount = balance0 - 1n;
  //        expect(amount).toBeGreaterThan(0n);
  //        const nonce = 1;
  //        await expect(asset.methods.burn_public(accounts[0].address, amount, nonce).simulate()).rejects.toThrowError(
  //          'Assertion failed: invalid nonce',
  //        );
  //      });

  //      it('burn on behalf of other without "approval"', async () => {
  //        const balance0 = await asset.methods.view_balance_of_public(accounts[0].address).view();
  //        const amount = balance0 + 1n;
  //        const nonce = Fr.random();
  //        await expect(
  //          asset.withWallet(wallets[1]).methods.burn_public(accounts[0].address, amount, nonce).simulate(),
  //        ).rejects.toThrowError('Assertion failed: Message not authorized by account');
  //      });

  //      it('burn more than balance on behalf of other', async () => {
  //        const balance0 = await asset.methods.view_balance_of_public(accounts[0].address).view();
  //        const amount = balance0 + 1n;
  //        const nonce = Fr.random();
  //        expect(amount).toBeGreaterThan(0n);

  //        // We need to compute the message we want to sign and add it to the wallet as approved
  //        const action = asset.withWallet(wallets[1]).methods.burn_public(accounts[0].address, amount, nonce);
  //        const messageHash = await computeAuthWitMessageHash(accounts[1].address, action.request());
  //        await wallets[0].setPublicAuth(messageHash, true).send().wait();

  //        await expect(action.simulate()).rejects.toThrowError('Assertion failed: Underflow');
  //      });

  //      it('burn on behalf of other, wrong designated caller', async () => {
  //        const balance0 = await asset.methods.view_balance_of_public(accounts[0].address).view();
  //        const amount = balance0 + 2n;
  //        const nonce = Fr.random();
  //        expect(amount).toBeGreaterThan(0n);

  //        // We need to compute the message we want to sign and add it to the wallet as approved
  //        const action = asset.withWallet(wallets[1]).methods.burn_public(accounts[0].address, amount, nonce);
  //        const messageHash = await computeAuthWitMessageHash(accounts[0].address, action.request());
  //        await wallets[0].setPublicAuth(messageHash, true).send().wait();

  //        await expect(
  //          asset.withWallet(wallets[1]).methods.burn_public(accounts[0].address, amount, nonce).simulate(),
  //        ).rejects.toThrowError('Assertion failed: Message not authorized by account');
  //      });
  //    });
  //  });

  //  describe('private', () => {
  //    it('burn less than balance', async () => {
  //      const balance0 = await asset.methods.view_balance_of_private(accounts[0].address).view();
  //      const amount = balance0 / 2n;
  //      expect(amount).toBeGreaterThan(0n);
  //      const tx = asset.methods.burn(accounts[0].address, amount, 0).send();
  //      const receipt = await tx.wait();
  //      expect(receipt.status).toBe(TxStatus.MINED);
  //      tokenSim.burnPrivate(accounts[0].address, amount);
  //    });

  //    it('burn on behalf of other', async () => {
  //      const balance0 = await asset.methods.view_balance_of_private(accounts[0].address).view();
  //      const amount = balance0 / 2n;
  //      const nonce = Fr.random();
  //      expect(amount).toBeGreaterThan(0n);

  //      // We need to compute the message we want to sign and add it to the wallet as approved
  //      const action = asset.withWallet(wallets[1]).methods.burn(accounts[0].address, amount, nonce);
  //      const messageHash = await computeAuthWitMessageHash(accounts[1].address, action.request());

  //      // Both wallets are connected to same node and PXE so we could just insert directly using
  //      // await wallet.signAndAddAuthWitness(messageHash, );
  //      // But doing it in two actions to show the flow.
  //      const witness = await wallets[0].createAuthWitness(messageHash);
  //      await wallets[1].addAuthWitness(witness);

  //      const tx = asset.withWallet(wallets[1]).methods.burn(accounts[0].address, amount, nonce).send();
  //      const receipt = await tx.wait();
  //      expect(receipt.status).toBe(TxStatus.MINED);
  //      tokenSim.burnPrivate(accounts[0].address, amount);

  //      // Perform the transfer again, should fail
  //      const txReplay = asset.withWallet(wallets[1]).methods.burn(accounts[0].address, amount, nonce).send();
  //      await txReplay.isMined();
  //      const receiptReplay = await txReplay.getReceipt();
  //      expect(receiptReplay.status).toBe(TxStatus.DROPPED);
  //    });

  //    describe('failure cases', () => {
  //      it('burn more than balance', async () => {
  //        const balance0 = await asset.methods.view_balance_of_private(accounts[0].address).view();
  //        const amount = balance0 + 1n;
  //        expect(amount).toBeGreaterThan(0n);
  //        await expect(asset.methods.burn(accounts[0].address, amount, 0).simulate()).rejects.toThrowError(
  //          'Assertion failed: Balance too low',
  //        );
  //      });

  //      it('burn on behalf of self with non-zero nonce', async () => {
  //        const balance0 = await asset.methods.view_balance_of_private(accounts[0].address).view();
  //        const amount = balance0 - 1n;
  //        expect(amount).toBeGreaterThan(0n);
  //        await expect(asset.methods.burn(accounts[0].address, amount, 1).simulate()).rejects.toThrowError(
  //          'Assertion failed: invalid nonce',
  //        );
  //      });

  //      it('burn more than balance on behalf of other', async () => {
  //        const balance0 = await asset.methods.view_balance_of_private(accounts[0].address).view();
  //        const amount = balance0 + 1n;
  //        const nonce = Fr.random();
  //        expect(amount).toBeGreaterThan(0n);

  //        // We need to compute the message we want to sign and add it to the wallet as approved
  //        const action = asset.withWallet(wallets[1]).methods.burn(accounts[0].address, amount, nonce);
  //        const messageHash = await computeAuthWitMessageHash(accounts[1].address, action.request());

  //        // Both wallets are connected to same node and PXE so we could just insert directly using
  //        // await wallet.signAndAddAuthWitness(messageHash, );
  //        // But doing it in two actions to show the flow.
  //        const witness = await wallets[0].createAuthWitness(messageHash);
  //        await wallets[1].addAuthWitness(witness);

  //        await expect(action.simulate()).rejects.toThrowError('Assertion failed: Balance too low');
  //      });

  //      it('burn on behalf of other without approval', async () => {
  //        const balance0 = await asset.methods.view_balance_of_private(accounts[0].address).view();
  //        const amount = balance0 / 2n;
  //        const nonce = Fr.random();
  //        expect(amount).toBeGreaterThan(0n);

  //        // We need to compute the message we want to sign and add it to the wallet as approved
  //        const action = asset.withWallet(wallets[1]).methods.burn(accounts[0].address, amount, nonce);
  //        const messageHash = await computeAuthWitMessageHash(accounts[1].address, action.request());

  //        await expect(action.simulate()).rejects.toThrowError(
  //          `Unknown auth witness for message hash 0x${messageHash.toString('hex')}`,
  //        );
  //      });

  //      it('on behalf of other (invalid designated caller)', async () => {
  //        const balancePriv0 = await asset.methods.view_balance_of_private(accounts[0].address).view();
  //        const amount = balancePriv0 + 2n;
  //        const nonce = Fr.random();
  //        expect(amount).toBeGreaterThan(0n);

  //        // We need to compute the message we want to sign and add it to the wallet as approved
  //        const action = asset.withWallet(wallets[2]).methods.burn(accounts[0].address, amount, nonce);
  //        const messageHash = await computeAuthWitMessageHash(accounts[1].address, action.request());
  //        const expectedMessageHash = await computeAuthWitMessageHash(accounts[2].address, action.request());

  //        const witness = await wallets[0].createAuthWitness(messageHash);
  //        await wallets[2].addAuthWitness(witness);

  //        await expect(action.simulate()).rejects.toThrowError(
  //          `Unknown auth witness for message hash 0x${expectedMessageHash.toString('hex')}`,
  //        );
  //      });
  //    });
  //  });
  //});
});
