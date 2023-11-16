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
//import {
//  TokenContractArtifact,
//} from '@aztec/noir-contracts/artifacts';

import { MockProxy, mock } from 'jest-mock-extended';
import { type MemDown, default as memdown } from 'memdown';

import { CommitmentsDB, PublicContractsDB, PublicStateDB } from './db.js';
import { PublicCall } from './execution.js';
import { AVMExecutor } from './vm.js';
import { AVMInstruction, Opcode } from './opcodes.js';

export const createMemDown = () => (memdown as any)() as MemDown<any, any>;

const instructions = [
  new AVMInstruction(
    /*opcode*/ Opcode.CALLDATASIZE, // M[0] = CD.length
    /*d0:*/ 0, /*target memory address*/
    /*sd:*/ 0, /*unused*/
    /*s0:*/ 0, /*unused*/
    /*s1:*/ 0, /*unused*/
  ),
  new AVMInstruction(
    /*opcode*/ Opcode.CALLDATACOPY, // M[1:1+M[0]] = calldata[0+M[0]]);
    /*d0:*/ 1, /*target memory address (store calldata starting at M[1])*/
    /*sd:*/ 0, /*unused*/
    /*s0:*/ 0, /*calldata offset*/
    /*s1:*/ 0, /*copy size (M[0] contains copy size)*/
  ),
  new AVMInstruction(
    /*opcode*/ Opcode.ADD, // M[10] = M[1] + M[2]
    /*d0:*/ 10, /*target memory address*/
    /*sd:*/ 0, /*unused*/
    /*s0:*/ 1, /*to add*/
    /*s1:*/ 2, /*to add*/
  ),
  new AVMInstruction( // TODO: but PublicStateDB.storageWrite() is not mocked in test
    /*opcode*/ Opcode.SLOAD, // M[d0] = S[M[s0]]
    /*d0:*/ 11, /*write loaded word into M[11]*/
    /*sd:*/ 0, /*unused*/
    /*s0:*/ 3, /*load storage word at S[M[3]]*/
    /*s1:*/ 0, /*unused*/
  ),
  new AVMInstruction( // TODO: but PublicStateDB.storageWrite() is not mocked in test
    /*opcode*/ Opcode.SSTORE, // S[M[d0]] = M[s0]
    /*d0:*/ 3, /*memory word containing target storage slot (M[3] originally from calldata[2])*/
    /*sd:*/ 0, /*unused*/
    /*s0:*/ 10, /*store result of add (M[10])*/
    /*s1:*/ 0, /*unused*/
  ),
  new AVMInstruction( // TODO: but PublicStateDB.storageWrite() is not mocked in test
    /*opcode*/ Opcode.SLOAD, // M[d0] = S[M[s0]]
    /*d0:*/ 11, /*write loaded word into M[11]*/
    /*sd:*/ 0, /*unused*/
    /*s0:*/ 3, /*load storage word at S[M[3]]*/
    /*s1:*/ 0, /*unused*/
  ),
  new AVMInstruction(
    /*opcode*/ Opcode.RETURN, // return M[10]
    /*d0:*/ 0, /*unused*/
    /*sd:*/ 0, /*unused*/
    /*s0:*/ 10, /*field memory offset (return M[10])*/
    /*s1:*/ 1, /*return size (1 word)*/
  )
];
const bytecode = AVMInstruction.toBytecode(instructions);

describe('ACIR public execution simulator', () => {
  let publicState: MockProxy<PublicStateDB>;
  let publicContracts: MockProxy<PublicContractsDB>;
  //let commitmentsDb: MockProxy<CommitmentsDB>;
  //let blockData: HistoricBlockData;
  let executor: AVMExecutor; // TODO: replace with AVMSimulator

  beforeEach(() => {
    publicState = mock<PublicStateDB>();
    publicContracts = mock<PublicContractsDB>();
    //commitmentsDb = mock<CommitmentsDB>();
    //blockData = HistoricBlockData.empty();
    executor = new AVMExecutor(publicState, publicContracts);
  }, 10000);

  describe('Token contract', () => {
    describe('public vm', () => {
      it('AVM should simulate basic programs', async () => {
        const contractAddress = AztecAddress.random();
        //const artifact = TokenContractArtifact.functions.find(f => f.name === 'shield')!;
        //const functionData = FunctionData.fromAbi(artifact);
        const functionSelector = new FunctionSelector(0x1234);
        const functionData = new FunctionData(functionSelector, false, false, false);

        // ADD 42 + 24
        const addArg0 = 42n;
        const addArg1 = 24n;
        const resultSlot = 61n;
        const originalValueAtResultSlot = 96n;
        // NOTE: the artifact loaded above contains a preset number of args
        //const args = encodeArguments(artifact, [addArg0, addArg1, resultSlot, 0n]);
        // TODO: prepend with function selector
        const calldata = [addArg0, addArg1, resultSlot, 0n].map(arg => new Fr(arg));
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
        //publicContracts.getBytecode.mockResolvedValue(Buffer.from(artifact.bytecode, 'base64'));
        publicContracts.getBytecode.mockResolvedValue(bytecode);

        publicState.storageRead
          .mockResolvedValueOnce(new Fr(originalValueAtResultSlot)) // before sstore
          .mockResolvedValueOnce(new Fr(ret)); // after sstore

        const publicCall: PublicCall = { contractAddress, functionData, calldata, callContext };
        const result = await executor.simulate(publicCall); //, GlobalVariables.empty());

        expect(result.returnValues[0]).toEqual(new Fr(ret));

        // SLOAD is performed before SSTORE and after
        expect(result.contractStorageReads).toEqual([
          {
            storageSlot: new Fr(resultSlot),
            currentValue: new Fr(originalValueAtResultSlot),
            sideEffectCounter: 0,
          },
          {
            storageSlot: new Fr(resultSlot),
            currentValue: new Fr(ret),
            sideEffectCounter: 2,
          },
        ]);
        // results of ADD are SSTOREd into resultSlot
        expect(result.contractStorageUpdateRequests).toEqual([
          {
            storageSlot: new Fr(resultSlot),
            oldValue: new Fr(originalValueAtResultSlot),
            newValue: new Fr(ret),
            sideEffectCounter: 1,
          },
        ]);
      });
      //it('should prove the public vm', async () => {
      //  ...
      //  const outAsmPath = await executor.bytecodeToPowdr(execution);
      //  await executor.generateWitness(outAsmPath);
      //  await executor.prove();
      //}, 1_000_000);
    });
  });
});
