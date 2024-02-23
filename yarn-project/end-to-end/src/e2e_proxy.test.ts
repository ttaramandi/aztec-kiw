import { DefaultAccountContract } from '@aztec/accounts/defaults';
import { SchnorrAccountContract } from '@aztec/accounts/schnorr';
import {
  AccountWallet,
  AztecAddress,
  CheatCodes,
  ContractDeployer,
  DebugLogger,
  DeployAccountSentTx,
  ExtendedNote,
  Fr,
  GrumpkinScalar,
  Note,
  PXE,
  Point,
  Wallet,
  generatePublicKey,
} from '@aztec/aztec.js';
import {
  AccountManager,
  AuthWitness,
  AuthWitnessProvider,
  ContractArtifact,
  GrumpkinPrivateKey,
  TxExecutionRequest,
} from '@aztec/aztec.js';
import { padArrayEnd } from '@aztec/foundation/collection';
import { pedersenHash } from '@aztec/foundation/crypto';
import { openTmpStore } from '@aztec/kv-store/utils';
import { Pedersen, SparseTree, newTree } from '@aztec/merkle-tree';
import {
  ChildContract,
  DelegatedOnContract,
  MultiSigAccountContract,
  ProxyContract,
  SchnorrAccountContract as SchnorrAccountContractRaw,
  SlowTreeContract,
} from '@aztec/noir-contracts.js';
import { MultiSigAccountContractArtifact } from '@aztec/noir-contracts.js';

import { setup } from './fixtures/utils.js';

const SLOW_TREE_STORAGE_SLOT = 98n;

describe('e2e_proxy', () => {
  let wallets: Wallet[];
  let userWallet: Wallet;
  let adminWallet: Wallet;
  let walletC: Wallet;
  let proxyContract: ProxyContract;
  let implementationContract: DelegatedOnContract;
  let proxyContractInterface: DelegatedOnContract;
  let slowTreeContract: SlowTreeContract;
  let slowUpdateTreeSimulator: SparseTree;
  let cheatCodes: CheatCodes;
  let pxe: PXE;
  let logger: DebugLogger;
  let deploymentPrivateKey: GrumpkinScalar;
  let deploymentPublicKey: Point;
  let extendedSlowNote: ExtendedNote;

  let teardown: () => Promise<void>;

  const getMembershipProof = async (
    slowUpdateTreeSimulator: SparseTree,
    index: bigint,
    includeUncommitted: boolean,
  ) => {
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
    ({ teardown, wallets, cheatCodes, pxe, logger } = await setup(3));
    [userWallet, adminWallet, walletC] = wallets;
    slowTreeContract = await SlowTreeContract.deploy(userWallet).send().deployed();
    implementationContract = await DelegatedOnContract.deploy(userWallet).send().deployed();

    const depth = 254;
    slowUpdateTreeSimulator = await newTree(SparseTree, openTmpStore(), new Pedersen(), 'test', depth);

    // Add data
    await updateSlowTree(slowUpdateTreeSimulator, userWallet, 1n, implementationContract.address.toField());

    deploymentPrivateKey = GrumpkinScalar.random();
    deploymentPublicKey = generatePublicKey(deploymentPrivateKey);
    const proxyReceipt = await ProxyContract.deployWithPublicKey(
      deploymentPublicKey,
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

    extendedSlowNote = new ExtendedNote(
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
    it.only("runs another contract's private function on proxy's storage via fallback", async () => {
      const sentValue = 42n;

      await userWallet.addCapsule(getMembershipCapsule(await getMembershipProof(slowUpdateTreeSimulator, 1n, false)));

      await proxyContractInterface.methods
        .private_set_value(sentValue, userWallet.getCompleteAddress().address)
        .send()
        .wait();

      const implementationValue = await implementationContract.methods
        .view_private_value(sentValue, userWallet.getCompleteAddress().address)
        .view();

      expect(implementationValue).toEqual(0n);
    }, 100_000);

    it("runs another contract's enqueued public function on proxy's storage via fallback", async () => {
      const sentValue = 42n;

      await userWallet.addCapsule(getMembershipCapsule(await getMembershipProof(slowUpdateTreeSimulator, 1n, false)));

      await proxyContractInterface.methods.public_set_value(sentValue).send().wait();

      const implementationValue = await implementationContract.methods.view_public_value().view();

      expect(implementationValue).toEqual(0n);
    }, 100_000);
  });

  describe(`behaves like an account contract`, () => {
    let child: ChildContract;
    let proxiedWallet: Wallet;

    beforeAll(async () => {
      const completeAddress = await pxe.registerAccount(deploymentPrivateKey, proxyContract.partialAddress);
      const signingPrivateKey = GrumpkinScalar.random();
      const accountContract = new SchnorrAccountContract(signingPrivateKey);
      const nodeInfo = await pxe.getNodeInfo();
      const accountInterface = accountContract.getInterface(completeAddress, nodeInfo);
      proxiedWallet = new AccountWallet(pxe, accountInterface);

      const deployer = new ContractDeployer(accountContract.getContractArtifact(), pxe, deploymentPublicKey);
      const args = accountContract.getDeploymentArgs();
      const deployMethod = deployer.deploy(...args);
      await deployMethod.create({ contractAddressSalt: Fr.random() });
      await pxe.registerAccount(deploymentPrivateKey, deployMethod.partialAddress!);
      const sentTx = deployMethod.send();

      const deploymentResult = await new DeployAccountSentTx(proxiedWallet, sentTx.getTxHash()).wait();

      await updateSlowTree(slowUpdateTreeSimulator, proxiedWallet, 1n, deploymentResult.contractAddress!.toField());

      await proxiedWallet.addNote(extendedSlowNote);
      await proxyContract.methods
        .upgrade(deploymentResult.contractAddress as AztecAddress)
        .send()
        .wait();
      const time = await cheatCodes.eth.timestamp();
      await cheatCodes.aztec.warp(time + 400);
      await slowUpdateTreeSimulator.commit();
      const [signingX, signingY] = accountContract.getDeploymentArgs();
      const proxyAsImplementation = await SchnorrAccountContractRaw.at(proxyContract.address, userWallet);
      await userWallet.addCapsule(getMembershipCapsule(await getMembershipProof(slowUpdateTreeSimulator, 1n, false)));
      await proxyAsImplementation.methods.initialize(signingX, signingY).send().wait();

      child = await ChildContract.deploy(proxiedWallet).send().deployed();
    }, 60_000);

    it('calls a private function', async () => {
      logger('Calling private function...');
      await proxiedWallet.addCapsule(
        getMembershipCapsule(await getMembershipProof(slowUpdateTreeSimulator, 1n, false)),
      );
      await child.methods.value(42).send().wait({ interval: 0.1 });
    }, 60_000);

    it('calls a public function', async () => {
      logger('Calling public function...');
      await proxiedWallet.addCapsule(
        getMembershipCapsule(await getMembershipProof(slowUpdateTreeSimulator, 1n, false)),
      );
      await child.methods.pubIncValue(42).send().wait({ interval: 0.1 });
      const storedValue = await pxe.getPublicStorageAt(child.address, new Fr(1));
      expect(storedValue).toEqual(new Fr(42n));
    }, 60_000);
  });

  describe.only(`upgrades to a multisig account contract`, () => {
    let child: ChildContract;
    let proxiedWallet: Wallet;

    beforeAll(async () => {
      // Deploy the multisig contract
      const ownerAddresses = [userWallet, adminWallet, walletC].map(w => w.getCompleteAddress().address);
      logger.info(`Multisig owners: ${ownerAddresses.map(a => a.toString()).join(', ')}`);
      const completeAddress = await pxe.registerAccount(deploymentPrivateKey, proxyContract.partialAddress);
      const accountContract = new AccountManagerMultisigAccountContract(deploymentPrivateKey, ownerAddresses, 2);
      const nodeInfo = await pxe.getNodeInfo();
      const accountInterface = accountContract.getInterface(completeAddress, nodeInfo);
      proxiedWallet = new AccountWallet(pxe, accountInterface);

      const deployer = new ContractDeployer(accountContract.getContractArtifact(), pxe, deploymentPublicKey);
      const args = accountContract.getDeploymentArgs();
      const deployMethod = deployer.deploy(...args);
      await deployMethod.create({ contractAddressSalt: Fr.random() });
      await pxe.registerAccount(deploymentPrivateKey, deployMethod.partialAddress!);
      const sentTx = deployMethod.send();

      const deploymentResult = await new DeployAccountSentTx(proxiedWallet, sentTx.getTxHash()).wait();

      await updateSlowTree(slowUpdateTreeSimulator, proxiedWallet, 1n, deploymentResult.contractAddress!.toField());

      await proxiedWallet.addNote(extendedSlowNote);
      await proxyContract.methods
        .upgrade(deploymentResult.contractAddress as AztecAddress)
        .send()
        .wait();
      const time = await cheatCodes.eth.timestamp();
      await cheatCodes.aztec.warp(time + 600);
      await slowUpdateTreeSimulator.commit();
      const proxyAsImplementation = await MultiSigAccountContract.at(proxyContract.address, userWallet);
      await userWallet.addCapsule(getMembershipCapsule(await getMembershipProof(slowUpdateTreeSimulator, 1n, false)));
      await proxyAsImplementation.methods
        .constructor(padArrayEnd(ownerAddresses, AztecAddress.ZERO, 5), deploymentPrivateKey.toBuffer(), 2)
        .send()
        .wait();

      child = await ChildContract.deploy(proxiedWallet).send().deployed();
    }, 60_000);

    it('sends a tx to the test contract via the multisig with first two owners', async () => {
      logger('Calling private function...');
      for (let i = 0; i < 20; i++) {
        await proxiedWallet.addCapsule(
          getMembershipCapsule(await getMembershipProof(slowUpdateTreeSimulator, 1n, false)),
        );
      }
      // Set up the method we want to call on a contract with the multisig as the wallet
      const action = child.methods.value(42);

      // We collect the signatures from each owner and register them using addAuthWitness
      const authWits = await collectSignatures(getRequestsFromTxRequest(await action.create()), [
        userWallet,
        adminWallet,
      ]);
      await Promise.all(authWits.map(w => proxiedWallet.addAuthWitness(w)));

      // Send the tx after having added all auth witnesses from the signers
      // TODO: We should be able to call send() on the result of create()
      await action.send().wait();
    });

    it('calls a public function', async () => {
      logger('Calling public function...');
      for (let i = 0; i < 20; i++) {
        await proxiedWallet.addCapsule(
          getMembershipCapsule(await getMembershipProof(slowUpdateTreeSimulator, 1n, false)),
        );
      }
      // Set up the method we want to call on a contract with the multisig as the wallet
      const action = child.methods.pubIncValue(42);

      // We collect the signatures from each owner and register them using addAuthWitness
      const authWits = await collectSignatures(getRequestsFromTxRequest(await action.create()), [
        userWallet,
        adminWallet,
      ]);
      await Promise.all(authWits.map(w => proxiedWallet.addAuthWitness(w)));

      // Send the tx after having added all auth witnesses from the signers
      // TODO: We should be able to call send() on the result of create()
      await action.send().wait();
      const storedValue = await pxe.getPublicStorageAt(child.address, new Fr(1));
      expect(storedValue).toEqual(new Fr(42n));
    }, 60_000);
  });
});

const MULTISIG_MAX_OWNERS = 5;

class AccountManagerMultisigAccountContract extends DefaultAccountContract {
  constructor(private privateKey: GrumpkinPrivateKey, private owners: AztecAddress[], private threshold: number) {
    super(MultiSigAccountContractArtifact as ContractArtifact);
  }

  getDeploymentArgs() {
    return [
      padArrayEnd(this.owners, AztecAddress.ZERO, MULTISIG_MAX_OWNERS),
      this.privateKey.toBuffer(),
      this.threshold,
    ];
  }

  getAuthWitnessProvider(): AuthWitnessProvider {
    return {
      createAuthWitness(message: Fr): Promise<AuthWitness> {
        return Promise.resolve(new AuthWitness(message, []));
      },
    };
  }
}

// Returns the requests to sign for a given tx request
function getRequestsFromTxRequest(txRequest: TxExecutionRequest) {
  return txRequest.authWitnesses.map(w => w.requestHash);
}

// Given a set of requests and an owner, returns the request that the owner needs to sign
function getRequestsToSignFor(requests: Fr[], owner: AztecAddress): Fr[] {
  return requests.map(request =>
    Fr.fromBuffer(
      pedersenHash(
        [request, owner.toField()].map(fr => fr.toBuffer()),
        0, // TODO: Use a non-zero generator point
      ),
    ),
  );
}

// Returns authwitnesses signed by the `owners` wallets for each of the `requests`
async function collectSignatures(requests: Fr[], owners: Wallet[]): Promise<AuthWitness[]> {
  // TODO: Rewrite this using a flatMap instead of two loops because it'd look nicer

  const authWits: AuthWitness[] = [];
  for (const ownerWallet of owners) {
    const messagesToSign = getRequestsToSignFor(requests, ownerWallet.getCompleteAddress().address);
    for (const messageToSign of messagesToSign) {
      authWits.push(await ownerWallet.createAuthWitness(messageToSign));
    }
  }
  return authWits;
}
