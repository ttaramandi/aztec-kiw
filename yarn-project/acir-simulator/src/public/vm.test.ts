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
import { PublicCall, PublicExecutionResult } from './execution.js';
import { AVMExecutor } from './vm.js';
import { AVMInstruction, Opcode } from './opcodes.js';

export const createMemDown = () => (memdown as any)() as MemDown<any, any>;

// function addArgsReturnExample(addArg0, addArg1) {
//  return addArg0 + addArg1;
//}
const addArgsReturnExample = [
  // Get calldata size and store at M[0]
  new AVMInstruction(Opcode.CALLDATASIZE, 0, 0, 0, 0), // SET M[0] = CD.length
  // Copy calldata to memory starting at M[1]
  new AVMInstruction(Opcode.CALLDATACOPY, 1, 0, 0, 0), // M[1:1+M[0]] = calldata[0+M[0]]);
  // Add args and store at M[10]
  new AVMInstruction(Opcode.ADD, 10, 0, 1, 2), // M[10] = M[1] + M[2]
  // set return size to 1
  new AVMInstruction(Opcode.SET, 20, 0, 1, 0), // SET M[20] = 1
  new AVMInstruction(Opcode.RETURN, 0, 0, 10, 20), // return M[10]
];
const addArgsReturnBytecode = AVMInstruction.toBytecode(addArgsReturnExample);

// function storageExample(addArg0, slotArg) {
//  S[slotArg] = addArg0 + S[slotArg];
//  return S[slotArg];
//}
const storageExample = [
  // Get calldata size and store at M[0]
  new AVMInstruction(Opcode.CALLDATASIZE, 0, 0, 0, 0), // SET M[0] = CD.length
  // Copy calldata to memory starting at M[1]
  new AVMInstruction(Opcode.CALLDATACOPY, 1, 0, 0, 0), // M[1:1+M[0]] = calldata[0+M[0]]);
  // Arg1 species storage slot to load from (S[M[2]])
  // load it into M[3]
  new AVMInstruction(Opcode.SLOAD, 3, 0, 2, 0), // M[3] = S[M[2]]
  // Add arg0 to value loaded from storage. Store result to memory at M[10].
  new AVMInstruction(Opcode.ADD, 10, 0, 1, 3), // M[10] = M[1] + M[2]
  // store results of ADD to the same storage slot S[M[2]]
  new AVMInstruction(Opcode.SSTORE, 2, 0, 10, 0), // S[M[2]] = M[10]
  // load the same word from storage (S[M[2]]) that was just written.
  // store word to memory (M[4])
  // (should now have value stored above)
  new AVMInstruction(Opcode.SLOAD, 4, 0, 2, 0), // M[4] = S[M[2]]
  // set return size to 1
  new AVMInstruction(Opcode.SET, 20, 0, 1, 0), // SET M[20] = 1
  // return the word loaded from storage (should match ADD output)
  new AVMInstruction(Opcode.RETURN, 0, 0, 4, 20), // return M[4]
];
const storageBytecode = AVMInstruction.toBytecode(storageExample);

// Make nested call to the specified address with some args
// return nested call results
//function nestedCallExample(targetAddr, [nestedCallArgs]) {
//  gas = 1234
//  return CALL(gas, targetAddr, nestedCallArgs)
//}
const nestedCallExample = [
  // Get calldata size and store at M[0]
  new AVMInstruction(Opcode.CALLDATASIZE, 0, 0, 0, 0), // SET M[0] = CD.length
  // Copy calldata to memory starting at M[1]
  new AVMInstruction(Opcode.CALLDATACOPY, 1, 0, 0, 0), // M[1:1+M[0]] = calldata[0+M[0]]);
  // gas limit for CALL
  new AVMInstruction(Opcode.SET, 100, 0, 1234, 0), //  SET M[100] = 1234
  // Populate M[10,11,12,13] with the argsOffset, argsSize, retOffset, retSize for CALL
  // argsOffset for CALL: M[2] because M[0] is calldatasize and M[1] is targetAddress (arg0 to top call)
  new AVMInstruction(Opcode.SET, 10, 0, 2, 0), //  SET M[10] = 2 (points to second arg)
  // const 1 for subtraction below
  new AVMInstruction(Opcode.SET, 20, 0, 1, 0), // SET M[10] = 1
  // argsSize for CALL: CALLDATASIZE - 1
  // - args/calldata for nested call is pretty much the same as this call's calldata
  //   but we don't forward the nested call address
  new AVMInstruction(Opcode.SUB, 11, 0, 0, 20), // SET M[11] = M[0] - 1
  // ReturnData will be one word and will be placed at M[200]
  // retOffset for CALL: where will returnData go
  new AVMInstruction(Opcode.SET, 12, 0, 200, 0), // SET M[12] = M[200]
  // retSize for CALL: just one return field
  new AVMInstruction(Opcode.SET, 13, 0, 1, 0), // SET M[13] = 1
  // Make a nested CALL with:
  // - gas: M[100] (1234)
  // - targetAddress: M[1]
  // - M[10:14] is 4 word memory chunk containing argsOffset, argsSize, retOffset, retSize
  new AVMInstruction(Opcode.CALL, 0, 10, 100, 1),
  // TODO: add support for RETURNDATASIZE/COPY
  new AVMInstruction(Opcode.RETURN, 0, 0, 200, 13), // return M[200] (size 1 from M[13])
];
const nestedCallBytecode = AVMInstruction.toBytecode(nestedCallExample);

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

  async function simulateAndCheck(
    calldata: Fr[],
    expectReturn: Fr[],
    bytecode: Buffer,
    bytecodesForNestedCalls: Buffer[] = [],
  ): Promise<PublicExecutionResult> {
    const contractAddress = AztecAddress.random();
    const functionSelector = new FunctionSelector(0x1234);
    const functionData = new FunctionData(functionSelector, false, false, false);
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

    publicContracts.getBytecode.mockResolvedValueOnce(bytecode);
    for (let i = 0; i < bytecodesForNestedCalls.length; i++) {
      publicContracts.getBytecode.mockResolvedValueOnce(bytecodesForNestedCalls[i]);
      publicContracts.getPortalContractAddress.mockResolvedValueOnce(EthAddress.random());
      publicContracts.getIsInternal.mockResolvedValueOnce(false);
    }

    const publicCall: PublicCall = { contractAddress, functionData, calldata, callContext };
    const result = await executor.simulate(publicCall); //, GlobalVariables.empty());

    expect(result.returnValues.length).toEqual(expectReturn.length);
    for (let i = 0; i < expectReturn.length; i++) {
      expect(result.returnValues[i]).toEqual(new Fr(expectReturn[i]));
    }

    return result;
  }

  describe('Token contract', () => {
    describe('public vm', () => {
      it('AVM can add arguments and return result', async () => {
        // ADD 42 + 25
        const addArg0 = 42n;
        const addArg1 = 25n;
        const calldata = [addArg0, addArg1].map(arg => new Fr(arg));
        const returndata = [addArg0 + addArg1].map(arg => new Fr(arg));
        await simulateAndCheck(calldata, returndata, addArgsReturnBytecode);
      });
      it('AVM storage operations work', async () => {
        // ADD 42 + S[61]
        // ADD 42 + 96
        // => 138
        const addArg0 = 42n;
        const slotArg = 61n;
        const startValueAtSlot = 96n;
        const calldata = [addArg0, slotArg].map(arg => new Fr(arg));
        const ret = addArg0 + startValueAtSlot;
        const returndata = [ret].map(arg => new Fr(arg));

        publicContracts.getBytecode.mockResolvedValue(storageBytecode);

        publicState.storageRead
          .mockResolvedValueOnce(new Fr(startValueAtSlot)) // before sstore
          .mockResolvedValueOnce(new Fr(ret)); // after sstore

        const result = await simulateAndCheck(calldata, returndata, storageBytecode);

        // VALIDATE STORAGE ACTION TRACE
        // SLOAD is performed before SSTORE and after
        expect(result.contractStorageReads).toEqual([
          {
            storageSlot: new Fr(slotArg),
            currentValue: new Fr(startValueAtSlot),
            sideEffectCounter: 0,
          },
          {
            storageSlot: new Fr(slotArg),
            currentValue: new Fr(ret),
            sideEffectCounter: 2,
          },
        ]);
        // results of ADD are SSTOREd into resultSlot
        expect(result.contractStorageUpdateRequests).toEqual([
          {
            storageSlot: new Fr(slotArg),
            oldValue: new Fr(startValueAtSlot),
            newValue: new Fr(ret),
            sideEffectCounter: 1,
          },
        ]);
      });
      it('AVM can perform nested calls', async () => {
        // ADD 42 + 25
        const nestedCallAddress = 5678n;
        const addArg0 = 42n;
        const addArg1 = 25n;
        const calldata = [nestedCallAddress, addArg0, addArg1].map(arg => new Fr(arg));
        const returndata = [addArg0 + addArg1].map(arg => new Fr(arg));

        await simulateAndCheck(calldata, returndata, nestedCallBytecode, [addArgsReturnBytecode]);
      });
      //it('should prove the public vm', async () => {
      //  ...
      //  const outAsmPath = await executor.bytecodeToPowdr(execution);
      //  await executor.generateWitness(outAsmPath);
      //  await executor.prove();
      //}, 1_000_000);
    });
  });
  // TODO: test field addition that could overflow (should just wrap around)
});
