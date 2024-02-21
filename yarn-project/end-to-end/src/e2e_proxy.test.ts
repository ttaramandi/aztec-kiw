import { CheatCodes, ExtendedNote, Fr, Note, Wallet } from '@aztec/aztec.js';
import { openTmpStore } from '@aztec/kv-store/utils';
import { Pedersen, SparseTree, newTree } from '@aztec/merkle-tree';
import { DelegatedOnContract, ProxyContract, SlowTreeContract } from '@aztec/noir-contracts.js';

import { setup } from './fixtures/utils.js';

const SLOW_TREE_STORAGE_SLOT = 98n;

describe('e2e_proxy', () => {
  let wallets: Wallet[];
  let userWallet: Wallet;
  let adminWallet: Wallet;
  let proxyContract: ProxyContract;
  let implementationContract: DelegatedOnContract;
  let proxyContractInterface: DelegatedOnContract;
  let slowTreeContract: SlowTreeContract;
  let slowUpdateTreeSimulator: SparseTree;
  let cheatCodes: CheatCodes;

  let teardown: () => Promise<void>;

  const getMembershipProof = async (
    slowUpdateTreeSimulator: SparseTree,
    index: bigint,
    includeUncommitted: boolean,
  ) => {
    let currentLeafValue = slowUpdateTreeSimulator.getLeafValue(index, includeUncommitted);
    console.log(`current leaf: ??${currentLeafValue!.toString()}¿¿`);
    return {
      index,
      value: Fr.fromBuffer(slowUpdateTreeSimulator.getLeafValue(index, includeUncommitted)!),
      // eslint-disable-next-line camelcase
      sibling_path: (await slowUpdateTreeSimulator.getSiblingPath(index, includeUncommitted)).toFields(),
    };
  };

  const getMembershipCapsule = (proof: { index: bigint; value: Fr; sibling_path: Fr[] }) => {
    return [new Fr(proof.index), proof.value, ...proof.sibling_path];
  };

  const getUpdateProof = async (slowUpdateTreeSimulator: SparseTree, newValue: Fr, index: bigint) => {
    const beforeProof = await getMembershipProof(slowUpdateTreeSimulator, index, false);
    const afterProof = await getMembershipProof(slowUpdateTreeSimulator, index, true);

    return {
      index,
      // eslint-disable-next-line camelcase
      new_value: newValue,
      // eslint-disable-next-line camelcase
      before: { value: beforeProof.value, sibling_path: beforeProof.sibling_path },
      // eslint-disable-next-line camelcase
      after: { value: afterProof.value, sibling_path: afterProof.sibling_path },
    };
  };

  const getUpdateCapsule = (proof: {
    index: bigint;
    new_value: Fr;
    before: { value: Fr; sibling_path: Fr[] };
    after: { value: Fr; sibling_path: Fr[] };
  }) => {
    return [
      new Fr(proof.index),
      proof.new_value,
      proof.before.value,
      ...proof.before.sibling_path,
      proof.after.value,
      ...proof.after.sibling_path,
    ];
  };

  const updateSlowTree = async (tree: SparseTree, wallet: Wallet, index: bigint, value: Fr) => {
    await wallet.addCapsule(getUpdateCapsule(await getUpdateProof(tree, value, index)));
    await tree.updateLeaf(new Fr(value).toBuffer(), index);
  };

  afterAll(() => teardown());

  beforeAll(async () => {
    ({ teardown, wallets, cheatCodes } = await setup(2));
    [userWallet, adminWallet] = wallets;
    slowTreeContract = await SlowTreeContract.deploy(userWallet).send().deployed();
    implementationContract = await DelegatedOnContract.deploy(userWallet).send().deployed();

    const depth = 254;
    slowUpdateTreeSimulator = await newTree(SparseTree, openTmpStore(), new Pedersen(), 'test', depth);

    // Add data
    await updateSlowTree(slowUpdateTreeSimulator, userWallet, 1n, implementationContract.address.toField());

    // Progress to next "epoch"
    const proxyReceipt = await ProxyContract.deploy(
      userWallet,
      adminWallet.getCompleteAddress().address,
      implementationContract.address,
      slowTreeContract.address,
    )
      .send()
      .wait();

    proxyContract = proxyReceipt.contract;

    const fieldNoteTypeId = new Fr(7010510110810078111116101n); // FieldNote
    // Add slow note
    const slowNote = new Note([slowTreeContract.address.toField()]);
    const slowNoteStorageSlot = new Fr(SLOW_TREE_STORAGE_SLOT);

    const extendedSlowNote = new ExtendedNote(
      slowNote,
      userWallet.getCompleteAddress().address,
      proxyContract.address,
      slowNoteStorageSlot,
      fieldNoteTypeId,
      proxyReceipt.txHash,
    );
    await userWallet.addNote(extendedSlowNote);
    await adminWallet.addNote(extendedSlowNote);

    await proxyContract.methods.upgrade(implementationContract.address).send().wait();

    const time = await cheatCodes.eth.timestamp();
    await cheatCodes.aztec.warp(time + 200);
    await slowUpdateTreeSimulator.commit();
    proxyContractInterface = await DelegatedOnContract.at(proxyContract.address, userWallet);
  }, 100_000);

  describe('proxies to another contract', () => {
    it("runs another contract's private function on proxy's storage via fallback", async () => {
      const sentValue = 42n;

      await userWallet.addCapsule(getMembershipCapsule(await getMembershipProof(slowUpdateTreeSimulator, 1n, false)));

      await proxyContractInterface.methods
        .private_set_value(sentValue, userWallet.getCompleteAddress().address)
        .send()
        .wait();

      const proxyValue = await proxyContract.methods
        .view_private_value(sentValue, userWallet.getCompleteAddress().address)
        .view();

      const implementationValue = await implementationContract.methods
        .view_private_value(sentValue, userWallet.getCompleteAddress().address)
        .view();

      expect(implementationValue).toEqual(0n);
      expect(proxyValue).toEqual(sentValue);
    }, 100_000);

    it("runs another contract's enqueued public function on proxy's storage via fallback", async () => {
      const sentValue = 42n;

      await proxyContractInterface.methods.public_set_value(sentValue).send().wait();

      const proxyValue = await proxyContract.methods.view_public_value().view();

      const implementationValue = await implementationContract.methods.view_public_value().view();

      expect(implementationValue).toEqual(0n);
      expect(proxyValue).toEqual(sentValue);
    }, 100_000);
  });
});
