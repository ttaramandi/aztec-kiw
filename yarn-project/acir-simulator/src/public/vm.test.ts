import {
  CallContext,
  CircuitsWasm,
  FunctionData,
  GlobalVariables,
  HistoricBlockData,
} from '@aztec/circuits.js';
import { FunctionSelector, encodeArguments } from '@aztec/foundation/abi';
import { AztecAddress } from '@aztec/foundation/aztec-address';
import { EthAddress } from '@aztec/foundation/eth-address';
import { Fr } from '@aztec/foundation/fields';
import {
  TokenContractArtifact,
} from '@aztec/noir-contracts/artifacts';

import { MockProxy, mock } from 'jest-mock-extended';
import { type MemDown, default as memdown } from 'memdown';

import { CommitmentsDB, PublicContractsDB, PublicStateDB } from './db.js';
import { PublicExecution } from './execution.js';
import { PublicExecutor } from './executor.js';
import { AVMCallExecutor } from './vm.js';

export const createMemDown = () => (memdown as any)() as MemDown<any, any>;

describe('ACIR public execution simulator', () => {
  let publicState: MockProxy<PublicStateDB>;
  let publicContracts: MockProxy<PublicContractsDB>;
  let commitmentsDb: MockProxy<CommitmentsDB>;
  let executor: PublicExecutor; // TODO: replace with AVMSimulator
  let blockData: HistoricBlockData;

  beforeEach(() => {
    publicState = mock<PublicStateDB>();
    publicContracts = mock<PublicContractsDB>();
    commitmentsDb = mock<CommitmentsDB>();

    blockData = HistoricBlockData.empty();
    executor = new PublicExecutor(publicState, publicContracts, commitmentsDb, blockData);
  }, 10000);

  describe('Token contract', () => {
    describe('public vm', () => {
      it('AVM should simulate basic programs', async () => {
        const contractAddress = AztecAddress.random();
        const artifact = TokenContractArtifact.functions.find(f => f.name === 'shield')!;
        const functionData = FunctionData.fromAbi(artifact);

        // ADD 42 + 24
        const addArg0 = 42n;
        const addArg1 = 24n;
        const resultSlot = 61n;
        const originalValueAtResultSlot = 96n;
        // NOTE: the artifact loaded above contains a preset number of args
        const args = encodeArguments(artifact, [addArg0, addArg1, resultSlot, 0n]);
        const ret = addArg0 + addArg1; // do the add here to compute expected result

        const msgSender = AztecAddress.random();
        const callContext = CallContext.from({
          msgSender,
          storageContractAddress: contractAddress,
          portalContractAddress: EthAddress.random(),
          functionSelector: FunctionSelector.empty(),
          isContractDeployment: false,
          isDelegateCall: false,
          isStaticCall: false,
        });

        // TODO: [de]serialize bytecode specified in test?
        publicContracts.getBytecode.mockResolvedValue(Buffer.from(artifact.bytecode, 'base64'));

        publicState.storageRead
          .mockResolvedValueOnce(new Fr(originalValueAtResultSlot)) // reading whether msg_sender is minter

        const execution: PublicExecution = { contractAddress, functionData, args, callContext };
        const result = await executor.simulate(execution, GlobalVariables.empty());

        expect(result.returnValues[0]).toEqual(new Fr(ret));

        // results of ADD are SSTOREd into resultSlot
        expect(result.contractStorageUpdateRequests).toEqual([
          {
            storageSlot: new Fr(resultSlot),
            oldValue: new Fr(originalValueAtResultSlot),
            newValue: new Fr(ret),
            sideEffectCounter: 0,
          },
        ]);
      });
      //it('should prove the public vm', async () => {
      //  const contractAddress = AztecAddress.random();
      //  const mintArtifact = TokenContractArtifact.functions.find(f => f.name === 'mint_public')!;
      //  const functionData = FunctionData.fromAbi(mintArtifact);

      //  // ADD 42 + 24
      //  const args = encodeArguments(mintArtifact, [42n, 24n]);
      //  const ret = 42n + 24n;

      //  const msgSender = AztecAddress.random();
      //  const callContext = CallContext.from({
      //    msgSender,
      //    storageContractAddress: contractAddress,
      //    portalContractAddress: EthAddress.random(),
      //    functionSelector: FunctionSelector.empty(),
      //    isContractDeployment: false,
      //    isDelegateCall: false,
      //    isStaticCall: false,
      //  });

      //  publicContracts.getBytecode.mockResolvedValue(Buffer.from(mintArtifact.bytecode, 'base64'));

      //  const execution: PublicExecution = { contractAddress, functionData, args, callContext };
      //  //const result = await executor.simulate(execution, GlobalVariables.empty());

      //  //expect(result.returnValues[0]).toEqual(new Fr(ret));

      //  const outAsmPath = await executor.bytecodeToPowdr(execution);
      //  await executor.generateWitness(outAsmPath);
      //  await executor.prove();
      //}, 1_000_000);
    });
  });
});
