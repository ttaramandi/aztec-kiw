import { CommitmentsDB, PublicContractsDB, PublicStateDB } from '../../public/db.js';

/**
 * Host Aztec State
 *
 * A wrapper around the node's dbs
 */
export class HostAztecState {
  public readonly publicStorageDb: PublicStateDB;

  public readonly contractsDb: PublicContractsDB;

  public readonly commitmentsDb: CommitmentsDB;

  constructor(publicStateDb: PublicStateDB, contractsDb: PublicContractsDB, commitmentsDb: CommitmentsDB) {
    this.publicStorageDb = publicStateDb;
    this.contractsDb = contractsDb;
    this.commitmentsDb = commitmentsDb;
  }
}
