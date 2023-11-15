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

export const createMemDown = () => (memdown as any)() as MemDown<any, any>;

describe('ACIR public execution simulator', () => {
  let publicState: MockProxy<PublicStateDB>;
  let publicContracts: MockProxy<PublicContractsDB>;
  let commitmentsDb: MockProxy<CommitmentsDB>;
  let executor: PublicExecutor;
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
      it('should simulate the public vm', async () => {
        const contractAddress = AztecAddress.random();
        const mintArtifact = TokenContractArtifact.functions.find(f => f.name === 'mint_public')!;
        const functionData = FunctionData.fromAbi(mintArtifact);

        // ADD 42 + 24
        const args = encodeArguments(mintArtifact, [42n, 24n]);
        const ret = 42n + 24n;

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

        publicContracts.getBytecode.mockResolvedValue(Buffer.from(mintArtifact.bytecode, 'base64'));

        const execution: PublicExecution = { contractAddress, functionData, args, callContext };
        const result = await executor.simulate(execution, GlobalVariables.empty());

        expect(result.returnValues[0]).toEqual(new Fr(ret));
      });
      it('should prove the public vm', async () => {
        const contractAddress = AztecAddress.random();
        const mintArtifact = TokenContractArtifact.functions.find(f => f.name === 'mint_public')!;
        const functionData = FunctionData.fromAbi(mintArtifact);

        // ADD 42 + 24
        const args = encodeArguments(mintArtifact, [42n, 24n]);
        const ret = 42n + 24n;

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

        publicContracts.getBytecode.mockResolvedValue(Buffer.from(mintArtifact.bytecode, 'base64'));

        const execution: PublicExecution = { contractAddress, functionData, args, callContext };
        //const result = await executor.simulate(execution, GlobalVariables.empty());

        //expect(result.returnValues[0]).toEqual(new Fr(ret));

        const outAsmPath = await executor.bytecodeToPowdr(execution);
        await executor.generateWitness(outAsmPath);
        await executor.prove();
      }, 1_000_000);
    });
  });
});
