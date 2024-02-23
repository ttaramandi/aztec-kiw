import { BlankContract } from '../artifacts/Blank.js';
import { AccountWallet, Fr, Contract, TxStatus, createDebugLogger, ContractDeployer } from '@aztec/aztec.js';
import { deployerEnv } from '../src/config.js';

const logger = createDebugLogger('aztec:http-pxe-client');

describe('Blank Contract Tests', () => {
  let wallet: AccountWallet;
  let contract: Contract;
  const { artifact } = BlankContract;
  const numberToSet = Fr.random();

  beforeAll(async () => {
    wallet = await deployerEnv.getWallet();
    const pxe = deployerEnv.pxe;
    const deployer = new ContractDeployer(artifact, wallet);
    const salt = Fr.random();
    const { address: contractAddress } = await deployer
      .deploy(Fr.random(), wallet.getCompleteAddress().address)
      .send({ contractAddressSalt: salt })
      .deployed();
    contract = await BlankContract.at(contractAddress!, wallet);

    logger(`L2 contract deployed at ${contractAddress}`);
  }, 60000);

  test('Can set a number', async () => {
    logger(`${await wallet.getRegisteredAccounts()}`);
    const callTxReceipt = await contract.methods.setNumber(numberToSet, wallet.getCompleteAddress()).send().wait();

    expect(callTxReceipt.status).toBe(TxStatus.MINED);
  }, 40000);

  test('Can read a number', async () => {
    const viewTxReceipt = await contract.methods.getNumber(wallet.getCompleteAddress()).view();
    expect(numberToSet.toBigInt()).toEqual(viewTxReceipt.value);
  }, 40000);
});
